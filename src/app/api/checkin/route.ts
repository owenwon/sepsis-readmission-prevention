// app/api/checkin/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateSepsisRisk, SurveyResponse } from '@/lib/riskCalculator';

export async function POST(req: NextRequest) {
  try {
    // -------------------------------------------------------------------------
    // 1. AUTHENTICATE
    // Pull the user's JWT from the Authorization header and verify it with
    // Supabase. This means even if someone hits this endpoint directly, they
    // must be a real logged-in user — RLS alone isn't enough since we're using
    // the service role key to write (see note below).
    // -------------------------------------------------------------------------
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const jwt = authHeader.replace('Bearer ', '');

    // Use anon client just to verify the JWT and get the user
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser(jwt);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // -------------------------------------------------------------------------
    // 2. PARSE & VALIDATE REQUEST BODY
    // Basic shape check — TypeScript types don't exist at runtime so we do a
    // minimal sanity check on the fields the calculator actually requires.
    // -------------------------------------------------------------------------
    const body = await req.json();
    const { surveyResponse, patientId } = body as {
      surveyResponse: SurveyResponse;
      patientId: string;
    };

    if (!surveyResponse || !patientId) {
      return NextResponse.json(
        { error: 'Missing surveyResponse or patientId' },
        { status: 400 }
      );
    }

    // Required boolean fields — if any are missing the calculator will behave
    // unpredictably, so reject early.
    const requiredFields: (keyof SurveyResponse)[] = [
      'fainted_or_very_dizzy',
      'extreme_heat_or_chills',
      'discolored_skin',
      'energy_level',
      'fever_chills',
      'has_thermometer',
      'has_pulse_oximeter',
      'heart_racing',
      'has_hr_monitor',
      'has_bp_cuff',
      'thinking_level',
      'breathing_level',
      'urine_appearance_level',
      'has_recent_uti',
      'has_cough',
      'has_recent_pneumonia',
      'nausea_vomiting_diarrhea',
      'has_weakened_immune',
      'admitted_count',
    ];
    for (const field of requiredFields) {
      if (surveyResponse[field] === undefined || surveyResponse[field] === null) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // -------------------------------------------------------------------------
    // 3. VERIFY PATIENT BELONGS TO THIS USER
    // The service role key bypasses RLS, so we must manually confirm the
    // patient_id in the request belongs to the authenticated user before
    // writing anything.
    // -------------------------------------------------------------------------
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: patient, error: patientError } = await serviceClient
      .from('patients')
      .select('patient_id, user_id, age, days_since_last_discharge')
      .eq('patient_id', patientId)
      .single();

    if (patientError || !patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    if (patient.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // -------------------------------------------------------------------------
    // 4. RUN THE RISK CALCULATOR (server-side)
    // This is the entire point of doing this server-side: the client cannot
    // tamper with the risk_level stored in the DB because we always recompute
    // it here from the raw survey inputs.
    //
    // We also merge in patient context from the DB so the client doesn't need
    // to send fields like age or days_since_last_discharge — we pull them from
    // the source of truth.
    // -------------------------------------------------------------------------
    const enrichedResponse: SurveyResponse = {
      ...surveyResponse,
      // Override with DB values so client can't spoof these
      age: patient.age ?? surveyResponse.age,
      days_since_last_discharge:
        patient.days_since_last_discharge ?? surveyResponse.days_since_last_discharge,
    };

    const result = calculateSepsisRisk(enrichedResponse);

    // -------------------------------------------------------------------------
    // 5. COMPUTE ZONES
    // The DB stores pre-computed zones alongside raw values for efficient
    // querying (e.g. "show me all RED zone oxygen readings this week").
    // We derive them from the same inputs the calculator used.
    // -------------------------------------------------------------------------
    const zones = computeZones(surveyResponse);

    // -------------------------------------------------------------------------
    // 6. INSERT DAILY CHECK-IN
    // Map survey fields to DB columns. Zone fields are stored alongside raw
    // values. risk_level comes from the server-side calculation above.
    // -------------------------------------------------------------------------
    const checkinRow = {
      patient_id: patientId,
      checkin_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD

      // Immediate danger
      fainted_or_very_dizzy: surveyResponse.fainted_or_very_dizzy,
      extreme_heat_or_chills: surveyResponse.extreme_heat_or_chills,
      discolored_skin: surveyResponse.discolored_skin,

      // Energy & well-being
      overall_feeling: surveyResponse.overall_feeling ?? null,
      energy_level: surveyResponse.energy_level,
      pain_level: surveyResponse.pain_level ?? null,

      // Temperature
      fever_chills: surveyResponse.fever_chills,
      temperature_value: surveyResponse.temperature_value ?? null,
      temperature_zone: zones.temperature_zone ?? null,

      // Oxygen
      oxygen_level_value: surveyResponse.oxygen_level_value ?? null,
      oxygen_level_zone: zones.oxygen_level_zone ?? null,

      // Heart rate
      heart_racing: surveyResponse.heart_racing,
      heart_rate_value: surveyResponse.heart_rate_value ?? null,
      heart_rate_zone: zones.heart_rate_zone ?? null,

      // Blood pressure
      blood_pressure_systolic: surveyResponse.blood_pressure_systolic ?? null,
      blood_pressure_zone: zones.blood_pressure_zone ?? null,

      // Mental status & breathing
      thinking_level: surveyResponse.thinking_level,
      breathing_level: surveyResponse.breathing_level,

      // Urine
      urine_appearance_level: surveyResponse.urine_appearance_level,
      uti_symptoms_worsening: surveyResponse.uti_symptoms_worsening ?? 'not_applicable',

      // Infection
      has_cough: surveyResponse.has_cough,
      mucus_color_level: surveyResponse.mucus_color_level ?? null,
      wound_state_level:
        surveyResponse.wound_state_level === 'none' ? null : surveyResponse.wound_state_level ?? null,

      // GI
      nausea_vomiting_diarrhea: surveyResponse.nausea_vomiting_diarrhea,

      // Notes
      additional_notes: surveyResponse.additional_notes ?? null,

      // Computed risk level — always from server calculation, never trusted from client
      risk_level: result.riskLevel,
    };

    const { data: checkin, error: insertError } = await serviceClient
      .from('daily_checkins')
      .insert(checkinRow)
      .select('daily_checkin_id, risk_level, checkin_date')
      .single();

    if (insertError) {
      console.error('Checkin insert error:', insertError);
      // Handle duplicate (patient already checked in today)
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'You have already submitted a check-in today.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: 'Failed to save check-in' }, { status: 500 });
    }

    // -------------------------------------------------------------------------
    // 7. RETURN RESULT TO CLIENT
    // Return enough for the UI to show the risk level and reasoning, but do NOT
    // return internal score details to the client in production — they're not
    // needed and expose algorithm internals.
    // -------------------------------------------------------------------------
    return NextResponse.json({
      success: true,
      checkinId: checkin.daily_checkin_id,
      riskLevel: result.riskLevel,
      emergencyMessage: result.emergencyMessage ?? null,
      reasoning: result.reasoning,
    });

  } catch (err) {
    console.error('Unexpected error in /api/checkin:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// ZONE COMPUTATION (mirrors calculateZones in riskCalculator.ts)
// Kept here separately so the API route can store zones in the DB without
// exposing or importing the private calculateZones function from the calculator.
// ---------------------------------------------------------------------------
function computeZones(r: SurveyResponse) {
  const zones: {
    temperature_zone?: number;
    oxygen_level_zone?: number;
    heart_rate_zone?: number;
    blood_pressure_zone?: number;
  } = {};

  if (r.temperature_value !== undefined) {
    const t = r.temperature_value;
    zones.temperature_zone = t >= 96.8 && t <= 99.9 ? 1 : t >= 100 && t <= 101.4 ? 2 : 3;
  }

  if (r.oxygen_level_value !== undefined) {
    const o = r.oxygen_level_value;
    zones.oxygen_level_zone = o >= 95 ? 1 : o >= 92 ? 2 : 3;
  }

  if (r.heart_rate_value !== undefined) {
    const h = r.heart_rate_value;
    zones.heart_rate_zone = h >= 60 && h <= 100 ? 1 : h >= 101 && h <= 120 ? 2 : 3;
  }

  if (r.blood_pressure_systolic !== undefined) {
    const bp = r.blood_pressure_systolic;
    const baseline = r.baseline_bp_systolic || 120;
    zones.blood_pressure_zone =
      bp < 90 || bp > 180 || bp < baseline - 40 ? 3 : bp < baseline - 20 ? 2 : 1;
  }

  return zones;
}