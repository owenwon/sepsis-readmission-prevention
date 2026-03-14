import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { RiskLevel } from "@/types/database";
import { getLocalToday } from "@/lib/localDate";
import { getDashboardReminders, type ReminderId } from "@/lib/dashboardReminders";
import DashboardMenuButton from "@/components/DashboardMenuButton";
import DashboardRemindersSection from "@/components/DashboardRemindersSection";

// Always re-render on every request so the dashboard reflects the latest
// risk_level written by the review/check-in pages.
export const dynamic = "force-dynamic";
export const revalidate = 0;


// Time-based greeting
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}


// Risk level display config — maps DB risk_level to dashboard copy + gauge SVG
const riskDisplayConfig: Record<
  RiskLevel,
  { label: string; gaugeImage: string }
> = {
  GREEN: { label: "Low", gaugeImage: "/images/gauge-green.svg" },
  YELLOW: { label: "Medium", gaugeImage: "/images/gauge-yellow.svg" },
  RED: { label: "High", gaugeImage: "/images/gauge-red.svg" },
  RED_EMERGENCY: { label: "Emergency", gaugeImage: "/images/gauge-911.svg" },
};


// Page component
export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check if user has completed onboarding
  const { data: patient } = await supabase
    .from("patients")
    .select("patient_id, patient_name, is_patient, is_caregiver, currently_hospitalized, discharge_date, on_immunosuppressants, has_other_medications, has_social_support, has_caregiver, physical_ability_level, has_weakened_immune, updated_at")
    .eq("user_id", user.id)
    .single();

  if (!patient) {
    // welcome / onboarding screen
    return (
      <div className="min-h-dvh bg-[#fdfbf5] flex flex-col items-center justify-between px-4 pb-20 pt-2.5 relative overflow-hidden font-[family-name:var(--font-poppins)]">
        {/* Decorative landscape */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/welcome/landscape.svg"
            alt=""
            className="w-full"
          />
        </div>

        {/* Decorative flowers & butterfly */}
        <div className="pointer-events-none absolute left-[7%] bottom-[38%] w-10 h-[70px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/welcome/flower1.svg" alt="" className="size-full" />
        </div>
        <div className="pointer-events-none absolute left-[63%] bottom-[36%] w-8 h-[57px] -scale-y-100 rotate-180">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/welcome/flower2.svg" alt="" className="size-full" />
        </div>
        <div className="pointer-events-none absolute right-[8%] bottom-[42%] w-11 h-[75px] -scale-y-100 rotate-180">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/welcome/flower3.svg" alt="" className="size-full" />
        </div>
        <div className="pointer-events-none absolute left-[36%] bottom-[38%] w-3.5 h-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/welcome/flower4.svg" alt="" className="size-full" />
        </div>
        <div className="pointer-events-none absolute left-[7%] bottom-[42%] w-2.5 h-6 -scale-y-100 rotate-180">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/welcome/flower5.svg" alt="" className="size-full" />
        </div>
        <div className="pointer-events-none absolute left-[8%] bottom-[30%] w-[309px] h-[85px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/welcome/butterfly.svg"
            alt=""
            className="size-full"
          />
        </div>

        {/* Text content */}
        <div className="w-full max-w-md pt-28 relative z-10">
          <h1 className="text-3xl font-semibold text-black leading-tight">
            Welcome!
          </h1>
          <p className="text-base text-black mt-1 leading-relaxed">
            We&apos;re here to support your sepsis recovery journey. Let&apos;s
            personalize your experience with these next questions!
          </p>
        </div>

        {/* CTA */}
        <Link
          href="/onboarding"
          className="relative z-10 w-full max-w-sm h-[50px] flex items-center justify-center bg-[#186346] text-white text-lg font-semibold rounded-[14px] hover:opacity-90 transition-opacity"
        >
          Get Started
        </Link>
      </div>
    );
  }

  // fetch today's check-in (one per calendar day)
  const today = getLocalToday();

  const { data: latestCheckin } = await supabase
    .from("daily_checkins")
    .select("risk_level, checkin_date")
    .eq("patient_id", patient.patient_id)
    .eq("checkin_date", today)
    .maybeSingle();

  if (!latestCheckin) {
    redirect("/checkin");
  }

  // Fetch last 91 check-ins for reminder logic
  const { data: recentCheckinsRaw } = await supabase
    .from("daily_checkins")
    .select("risk_level, checkin_date")
    .eq("patient_id", patient.patient_id)
    .order("checkin_date", { ascending: false })
    .limit(91);

  const recentCheckins = (recentCheckinsRaw ?? []) as {
    risk_level: RiskLevel;
    checkin_date: string;
  }[];

  // Fetch yesterday's reminder state for no-repeat logic
  const yesterdayStr = (() => {
    const d = new Date(`${today}T12:00:00`);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  })();

  const { data: reminderState } = await supabase
    .from("dashboard_reminder_state")
    .select("reminder_ids, reminder_date, dismissed_ids")
    .eq("patient_id", patient.patient_id)
    .maybeSingle();

  const yesterdayReminderIds: ReminderId[] =
    reminderState?.reminder_date === yesterdayStr
      ? (reminderState.reminder_ids as ReminderId[])
      : [];

  // Compute days since discharge
  const dischargeDate = patient.discharge_date?.includes("T")
    ? patient.discharge_date.split("T")[0]
    : patient.discharge_date;

  const daysSinceDischarge = patient.discharge_date
    ? Math.floor(
        (new Date(`${today}T12:00:00`).getTime() -
          new Date(`${dischargeDate}T12:00:00`).getTime()) /
          86_400_000,
      )
    : null;

  const reminders = getDashboardReminders({
    isCaregiver: patient.is_caregiver ?? false,
    isPatient: patient.is_patient ?? true,
    currentlyHospitalized: patient.currently_hospitalized ?? false,
    onImmunossuppressants: patient.on_immunosuppressants ?? false,
    hasOtherMedications: patient.has_other_medications ?? false,
    hasSocialSupport: patient.has_social_support ?? true,
    hasCaregiver: patient.has_caregiver ?? false,
    physicalAbilityLevel: patient.physical_ability_level ?? null,
    hasWeakenedImmune: patient.has_weakened_immune ?? false,
    profileLastUpdated: patient.updated_at ?? null,
    recentCheckins,
    today,
    todayCheckinComplete: true,
    yesterdayReminderIds,
    daysSinceDischarge,
  });

  const todayReminderIds = new Set<string>(reminders.map((r) => r.id));
  const initialDismissedIds = (
    (reminderState?.dismissed_ids ?? []) as string[]
  ).filter((id) => todayReminderIds.has(id));

  const isNewDay = reminderState?.reminder_date !== today;

  await supabase
    .from("dashboard_reminder_state")
    .upsert(
      {
        patient_id: patient.patient_id,
        reminder_ids: reminders.map((r) => r.id),
        reminder_date: today,
        ...(isNewDay ? { dismissed_ids: [] } : {}),
      },
      { onConflict: "patient_id" },
    );

  const riskLevel: RiskLevel = latestCheckin.risk_level as RiskLevel;
  const riskConfig = riskDisplayConfig[riskLevel];
  const greeting = getGreeting();

  // returning-user dashboard
  return (
    <div className="min-h-dvh bg-[#fdfbf5] flex flex-col items-center gap-6 px-4 pb-20 relative overflow-hidden font-[family-name:var(--font-poppins)]">
      {/* decorative green header background */}
      <div className="pointer-events-none absolute inset-x-0 -top-18 w-full h-[160px] -scale-y-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/dashboard/header-bg.svg"
          alt=""
          className="w-full h-full object-cover object-top scale-110"
        />
      </div>

      {/* navbar */}
      <nav className="relative z-10 flex w-full max-w-md items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <Image
            src="/images/tillage-logo.svg"
            alt="Tillage"
            width={36}
            height={36}
          />
          <span className="text-2xl font-black text-white">Tillage</span>
        </div>
        <DashboardMenuButton patientName={patient.patient_name} />
      </nav>

      {/* greeting + risk card */}
      <div className="relative z-10 flex w-full max-w-md flex-col gap-6">
        {/* greeting text */}
        <div className="flex flex-col gap-2">
          <p className="text-base text-black">
            {greeting}, {patient.patient_name}
          </p>
          <h1 className="text-3xl font-semibold text-black leading-tight">
            Well done completing your daily check in!
          </h1>
        </div>

        {/* Risk Level card */}
        <div className="flex w-full flex-col gap-4 overflow-hidden rounded-[14px] bg-white p-4 shadow-[0px_4px_12px_rgba(0,0,0,0.15)]">
          <p className="text-2xl font-semibold text-black">
            Risk Level: {riskConfig.label}
          </p>
          <div className="w-full">
            <Image
              src={riskConfig.gaugeImage}
              alt={`Risk gauge showing ${riskConfig.label}`}
              width={326}
              height={163}
              className="mx-auto h-auto w-full"
            />
          </div>
          <Link
            href="/checkin/review"
            className="flex h-[50px] w-full items-center justify-center rounded-[14px] bg-[#186346] text-lg font-semibold text-white hover:opacity-90 transition-opacity"
          >
            Review my answers
          </Link>
        </div>
      </div>

      {/* ── Navigation cards ── */}
      <div className="relative z-10 flex w-full max-w-md flex-col gap-6">
        {reminders.length > 0 && (
          <DashboardRemindersSection
            reminders={reminders}
            initialDismissedIds={initialDismissedIds}
          />
        )}

        {/* Education Modules card */}
        <Link
          href="/education"
          className="relative flex h-20 items-center overflow-hidden rounded-[14px] bg-white px-6 shadow-[0px_4px_12px_rgba(0,0,0,0.15)]"
        >
          {/* Decorative green diagonal */}
          <div className="absolute right-0 -top-10 h-[119px] w-[248px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/dashboard/card-bg-education.svg"
              alt=""
              className="size-full"
            />
          </div>
          <p className="relative z-10 text-lg font-semibold text-black">
            Education Modules
          </p>
          {/* Illustrations */}
          <div className="absolute right-4 bottom-1 z-10 flex items-end">
            <Image
              src="/images/dashboard/education-books.svg"
              alt=""
              width={45}
              height={35}
              className="h-auto"
            />
            <Image
              src="/images/dashboard/education-book.svg"
              alt=""
              width={40}
              height={35}
              className="h-auto -ml-1"
            />
          </div>
        </Link>

        {/* View History card */}
        <Link
          href="/history"
          className="relative flex h-20 items-center overflow-hidden rounded-[14px] bg-white px-6 shadow-[0px_4px_12px_rgba(0,0,0,0.15)]"
        >
          {/* Decorative green diagonal */}
          <div className="absolute right-0 -top-14 h-[134px] w-[274px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/dashboard/card-bg-history.svg"
              alt=""
              className="size-full"
            />
          </div>
          <p className="relative z-10 text-lg font-semibold text-black">
            View History
          </p>
          {/* Illustrations */}
          <div className="absolute right-4 bottom-1 z-10 flex items-end gap-1">
            <Image
              src="/images/dashboard/history-device.svg"
              alt=""
              width={55}
              height={48}
              className="h-auto"
            />
            <Image
              src="/images/dashboard/history-search.svg"
              alt=""
              width={18}
              height={40}
              className="h-auto rotate-[22deg] -mb-1"
            />
          </div>
        </Link>
      </div>

      {/* ── Footer ── */}
      <footer className="relative z-10 mt-10 flex w-full max-w-md flex-col gap-6">
        <div className="flex gap-4">
          {/* Legal column */}
          <div className="flex flex-1 flex-col gap-2">
            <p className="text-lg font-semibold text-black">Legal</p>
            <div className="flex flex-col gap-2 text-lg text-black">
              <p>Privacy Policy</p>
              <p>Consumer Data Privacy Policy</p>
              <p>Terms &amp; Conditions</p>
              <p>Consent Settings</p>
            </div>
          </div>
          {/* Contact column */}
          <div className="flex flex-1 flex-col gap-2">
            <p className="text-lg font-semibold text-black">Contact Us</p>
            <p className="text-lg text-black">Contact Us</p>
          </div>
        </div>

        {/* Copyright */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-black">©</span>
          <span className="text-xs text-black">Tillage 2026</span>
        </div>
      </footer>
    </div>
  );
}