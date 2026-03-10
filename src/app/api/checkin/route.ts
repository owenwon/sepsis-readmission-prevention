import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VALID_RISK_LEVELS = ["GREEN", "YELLOW", "RED", "RED_EMERGENCY"] as const;

const ALLOWED_COLUMNS = [
  "fainted_or_very_dizzy",
  "extreme_heat_or_chills",
  "discolored_skin",
  "overall_feeling",
  "energy_level",
  "pain_level",
  "fever_chills",
  "temperature_value",
  "temperature_zone",
  "oxygen_level_value",
  "oxygen_level_zone",
  "heart_racing",
  "heart_rate_value",
  "heart_rate_zone",
  "blood_pressure_systolic",
  "blood_pressure_zone",
  "thinking_level",
  "breathing_level",
  "urine_appearance_level",
  "uti_symptoms_worsening",
  "has_cough",
  "mucus_color_level",
  "wound_state_level",
  "nausea_vomiting_diarrhea",
  "additional_notes",
  "risk_level",
] as const;

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse body
    const body = await req.json();
    const answers: Record<string, any> = body.answers ?? {};

    // 3. Look up patient_id and discharge_date for this user
    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("patient_id, discharge_date")
      .eq("user_id", user.id)
      .single();

    if (patientError || !patient) {
      return NextResponse.json(
        { error: "Patient record not found. Please complete onboarding first." },
        { status: 404 }
      );
    }

    // Compute days_since_last_discharge from the stored discharge_date so it
    // reflects the true elapsed days at the moment this route runs.
    // Used transiently for risk scoring (SurveyResponse.days_since_last_discharge)
    // — never written to the daily_checkins table.
    const daysSinceLastDischarge = patient.discharge_date
      ? Math.floor(
          (Date.now() - new Date(patient.discharge_date).getTime()) / 86_400_000
        )
      : undefined;

    // 4. Validate risk_level
    const riskLevel = answers.risk_level;
    if (
      !riskLevel ||
      !(VALID_RISK_LEVELS as readonly string[]).includes(riskLevel)
    ) {
      return NextResponse.json(
        { error: "risk_level is required and must be one of GREEN, YELLOW, RED, RED_EMERGENCY." },
        { status: 400 }
      );
    }

    // 5. Pick only allowed columns
    const payload: Record<string, any> = {
      patient_id: patient.patient_id,
      checkin_date: (() => {
        // Prefer client-supplied date so the check-in is filed under the
        // patient's local calendar day, not the server's UTC date.
        const clientDate = answers.checkin_date;
        if (typeof clientDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(clientDate)) {
          return clientDate;
        }
        return new Date().toISOString().split("T")[0]; // Fallback: server UTC
      })(),
    };

    for (const col of ALLOWED_COLUMNS) {
      if (answers[col] !== undefined) {
        payload[col] = answers[col];
      }
    }

    // Zone consistency guard: each vital value/zone pair must be both NULL or
    // both non-NULL. Strip any zone that has no corresponding value (and vice
    // versa) so the DB constraint is never violated by stale nulls leaking
    // through client-side merges with existing DB rows.
    const ZONE_PAIRS: [string, string][] = [
      ['temperature_value',       'temperature_zone'],
      ['oxygen_level_value',      'oxygen_level_zone'],
      ['heart_rate_value',        'heart_rate_zone'],
      ['blood_pressure_systolic', 'blood_pressure_zone'],
    ];
    for (const [valueCol, zoneCol] of ZONE_PAIRS) {
      const hasValue = payload[valueCol] != null;
      const hasZone  = payload[zoneCol] != null;
      if (hasValue && !hasZone) {
        // Value present without zone — should not happen; drop value to be safe
        delete payload[valueCol];
      } else if (!hasValue && hasZone) {
        // Zone present without value — drop the orphaned zone
        delete payload[zoneCol];
      }
    }

    // Guard: uti_symptoms_worsening must match the uti_symptoms_type Postgres enum exactly.
    // Any other value (including null or an empty string) would cause a DB type error.
    // We delete the key rather than rejecting the request because this field is
    // optional and only populated when has_recent_uti = true on the patient record.
    const VALID_UTI_SYMPTOMS = ['improved', 'same', 'worsened', 'not_applicable'] as const;
    if (
      payload.uti_symptoms_worsening !== undefined &&
      !VALID_UTI_SYMPTOMS.includes(payload.uti_symptoms_worsening)
    ) {
      delete payload.uti_symptoms_worsening;
    }

    // Numeric range guards — each range mirrors the CHECK constraint on the DB column exactly.
    // The route never trusted the client to enforce these; now it does so server-side
    // before the upsert, returning a 400 instead of letting Postgres throw a 500.
    const NUMERIC_RANGES: Record<string, [number, number]> = {
      overall_feeling:         [1,    5  ],  // CHECK (overall_feeling BETWEEN 1 AND 5)
      energy_level:            [1,    3  ],  // CHECK (energy_level BETWEEN 1 AND 3)
      pain_level:              [1,    10 ],  // CHECK (pain_level BETWEEN 1 AND 10)
      thinking_level:          [1,    3  ],  // CHECK (thinking_level BETWEEN 1 AND 3)
      breathing_level:         [1,    3  ],  // CHECK (breathing_level BETWEEN 1 AND 3)
      temperature_value:       [90.0, 110.0],// CHECK (temperature_value >= 90 AND <= 110)
      oxygen_level_value:      [0,    100 ], // CHECK (oxygen_level_value >= 0 AND <= 100)
      heart_rate_value:        [30,   250 ], // CHECK (heart_rate_value >= 30 AND <= 250)
      blood_pressure_systolic: [60,   250 ], // CHECK (blood_pressure_systolic >= 60 AND <= 250)
      urine_appearance_level:  [1,    3  ],  // CHECK (urine_appearance_level BETWEEN 1 AND 3)
      mucus_color_level:       [1,    3  ],  // CHECK (mucus_color_level BETWEEN 1 AND 3)
      wound_state_level:       [1,    3  ],  // CHECK (wound_state_level BETWEEN 1 AND 3)
    };

    for (const [col, [min, max]] of Object.entries(NUMERIC_RANGES)) {
      if (payload[col] !== undefined && 
          payload[col] !== null &&   
         (payload[col] < min || 
          payload[col] > max)) {
        return NextResponse.json(
          { error: `${col} must be between ${min} and ${max}.` },
          { status: 400 }
        );
      }
    }

    // Consistency guard: certain symptom values are unconditional RED_EMERGENCY triggers
    // as defined in the business logic of dailyCheckIn.ts. If any of these reach the
    // route with a non-RED_EMERGENCY risk_level, the data would be internally inconsistent
    // and could suppress a critical alert in downstream queries. Reject rather than silently store.
    const hardEmergencyTriggered =
      payload.fainted_or_very_dizzy    === true ||
      payload.extreme_heat_or_chills   === true ||
      payload.discolored_skin          === true ||
      payload.breathing_level          === 3    ||
      payload.thinking_level           === 3;

    if (hardEmergencyTriggered && payload.risk_level !== 'RED_EMERGENCY') {
      return NextResponse.json(
        {
          error:
            'risk_level must be RED_EMERGENCY when any hard-trigger symptom is present ' +
            '(fainted_or_very_dizzy, extreme_heat_or_chills, discolored_skin, ' +
            'breathing_level = 3, or thinking_level = 3).',
        },
        { status: 400 }
      );
    }

    // 6. Upsert into daily_checkins
    const { data, error } = await supabase
      .from("daily_checkins")
      .upsert(payload, { onConflict: "patient_id,checkin_date" })
      .select("daily_checkin_id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { daily_checkin_id: data.daily_checkin_id },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}