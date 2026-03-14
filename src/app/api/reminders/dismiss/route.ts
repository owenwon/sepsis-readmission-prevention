import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("patient_id")
      .eq("user_id", user.id)
      .single();

    if (patientError || !patient) {
      return NextResponse.json({ error: "Patient record not found" }, { status: 404 });
    }

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const reminderId =
      typeof body === "object" &&
      body !== null &&
      "reminder_id" in body &&
      typeof (body as { reminder_id?: unknown }).reminder_id === "string"
        ? (body as { reminder_id: string }).reminder_id
        : "";

    if (!reminderId) {
      return NextResponse.json(
        { error: "reminder_id is required" },
        { status: 400 },
      );
    }

    const { data: reminderState, error: reminderStateError } = await supabase
      .from("dashboard_reminder_state")
      .select("patient_id, reminder_ids, dismissed_ids, reminder_date")
      .eq("patient_id", patient.patient_id)
      .maybeSingle();

    if (reminderStateError) {
      return NextResponse.json({ error: reminderStateError.message }, { status: 500 });
    }

    const today = new Date().toISOString().split("T")[0];

    const nextRow = reminderState
      ? {
          patient_id: patient.patient_id,
          reminder_ids: (reminderState.reminder_ids ?? []) as string[],
          dismissed_ids: ((reminderState.dismissed_ids ?? []) as string[]).includes(
            reminderId,
          )
            ? ((reminderState.dismissed_ids ?? []) as string[])
            : [...((reminderState.dismissed_ids ?? []) as string[]), reminderId],
          reminder_date: reminderState.reminder_date ?? today,
        }
      : {
          patient_id: patient.patient_id,
          reminder_ids: [] as string[],
          dismissed_ids: [reminderId],
          reminder_date: today,
        };

    const { error: upsertError } = await supabase
      .from("dashboard_reminder_state")
      .upsert(nextRow, { onConflict: "patient_id" });

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
