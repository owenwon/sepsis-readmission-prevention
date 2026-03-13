import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_COLUMNS = [
  "is_patient",
  "is_caregiver",
  "patient_name",
  "birthday",
  "currently_hospitalized",
  "sepsis_status",
  "discharge_date",
  "admitted_count",
  "has_weakened_immune",
  "has_lung_condition",
  "has_heart_failure",
  "has_recent_uti",
  "has_recent_pneumonia",
  "has_had_septic_shock",
  "has_urinary_catheter",
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

    // Derive sepsis_status from discharge_date (server-side safeguard).
    // Do not override 'readmitted' — that status is set elsewhere (admitted_count logic).
    const daysSince = payload.discharge_date
      ? Math.floor(
          (Date.now() - new Date(payload.discharge_date).getTime()) / 86_400_000
        )
      : null;

    if (daysSince !== null && payload.sepsis_status !== 'readmitted') {
      payload.sepsis_status = daysSince <= 90 ? 'recently_discharged' : 'other';
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

    // 4. Validate fields only when present in the payload.
    //    Full onboarding sends both patient_name and birthday so they get
    //    validated. Partial saves from Settings omit them entirely, so these
    //    checks are skipped — the patient already completed onboarding.
    if (
      payload.patient_name !== undefined &&
      (typeof payload.patient_name !== "string" ||
        payload.patient_name.length < 2 ||
        payload.patient_name.length > 100)
    ) {
      return NextResponse.json(
        { error: "patient_name must be 2–100 characters." },
        { status: 400 }
      );
    }

    if (
      payload.birthday !== undefined &&
      isNaN(Date.parse(payload.birthday))
    ) {
      return NextResponse.json(
        { error: "birthday must be a valid date string." },
        { status: 400 }
      );
    }

    // 5. Insert or update the patients table.
    //    Full onboarding sends patient_name + birthday (NOT NULL columns), so
    //    upsert is safe.  Partial saves from Settings omit them, so we must use
    //    a plain UPDATE to avoid a NOT NULL constraint violation — Postgres
    //    validates the full row on an INSERT … ON CONFLICT DO UPDATE.
    const isPartialUpdate =
      payload.patient_name === undefined || payload.birthday === undefined;

    const { data, error } = isPartialUpdate
      ? await supabase
          .from("patients")
          .update(payload)
          .eq("user_id", user.id)
          .select("patient_id, updated_at")
          .single()
      : await supabase
          .from("patients")
          .upsert(payload, { onConflict: "user_id" })
          .select("patient_id, updated_at")
          .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { patient_id: data.patient_id, updated_at: data.updated_at },
      { status: 200 },
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}
