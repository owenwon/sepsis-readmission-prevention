import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_COLUMNS = [
  "is_patient",
  "is_caregiver",
  "patient_name",
  "birthday",
  "currently_hospitalized",
  "sepsis_status",
  "days_since_last_discharge",
  "admitted_count",
  "has_weakened_immune",
  "has_lung_condition",
  "has_heart_failure",
  "has_hypertension",
  "has_other_chronic_conditions",
  "has_recent_uti",
  "has_recent_pneumonia",
  "has_had_septic_shock",
  "has_urinary_catheter",
  "has_other_acute_illnesses",
  "on_immunosuppressants",
  "has_other_medications",
  "has_caregiver",
  "caregiver_availability",
  "physical_ability_level",
  "can_exercise_regularly",
  "has_social_support",
  "has_thermometer",
  "has_pulse_oximeter",
  "has_bp_cuff",
  "has_hr_monitor",
  "baseline_bp_systolic",
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

    // 2. Parse body — the raw answers dictionary
    const body: Record<string, any> = await req.json();

    // 3. Pick only allowed columns
    const payload: Record<string, any> = { user_id: user.id };

    for (const col of ALLOWED_COLUMNS) {
      if (body[col] !== undefined) {
        payload[col] = body[col];
      }
    }

    // Enum allowlist guards — each set matches the CREATE TYPE definition in database_schema.sql.
    // Supabase/PostgREST does not coerce unknown strings to enum members; it throws.
    // We delete invalid keys rather than rejecting the whole request because these
    // fields are all optional and may legitimately be absent for some patient profiles.
    const ENUM_ALLOWLISTS: Record<string, readonly string[]> = {
      // sepsis_status_type
      sepsis_status: ['recently_discharged', 'readmitted', 'other'],
      // caregiver_availability_type
      caregiver_availability: ['full_time', 'part_time', 'occasional', 'none'],
      // physical_ability_type
      physical_ability_level: ['normal', 'tires_easily', 'needs_help', 'bed_or_wheelchair'],
    };

    for (const [col, allowlist] of Object.entries(ENUM_ALLOWLISTS)) {
      if (payload[col] !== undefined && !allowlist.includes(payload[col])) {
        // Strip the invalid value rather than crashing — the DB column is nullable
        // and an absent value is preferable to a Postgres enum type error.
        delete payload[col];
      }
    }

    // Handle current_medications as JSONB (raw array of medication value strings)
    if (body.current_medications !== undefined) {
      payload.current_medications = Array.isArray(body.current_medications)
        ? body.current_medications
        : [];
    }

    // 4. Validate required fields
    if (
      typeof payload.patient_name !== "string" ||
      payload.patient_name.length < 2 ||
      payload.patient_name.length > 100
    ) {
      return NextResponse.json(
        { error: "patient_name is required and must be 2–100 characters." },
        { status: 400 }
      );
    }

    if (!payload.birthday || isNaN(Date.parse(payload.birthday))) {
      return NextResponse.json(
        { error: "birthday is required and must be a valid date string." },
        { status: 400 }
      );
    }

    // 5. Upsert into patients table
    const { data, error } = await supabase
      .from("patients")
      .upsert(payload, { onConflict: "user_id" })
      .select("patient_id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ patient_id: data.patient_id }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}
