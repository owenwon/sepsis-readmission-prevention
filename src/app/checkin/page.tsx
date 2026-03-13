import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocalToday } from "@/lib/localDate";
import { getPreCheckinNotification } from "@/lib/preCheckinNotification";
import { createClient } from "@/lib/supabase/server";
import type { RiskLevel } from "@/types/database";

type RecentCheckin = {
  risk_level: RiskLevel;
  checkin_date: string;
};

export default async function CheckInPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: patient } = await supabase
    .from("patients")
    .select("patient_id, is_caregiver, currently_hospitalized")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!patient) {
    redirect("/onboarding");
  }

  const { data: recentCheckins } = await supabase
    .from("daily_checkins")
    .select("risk_level, checkin_date")
    .eq("patient_id", patient.patient_id)
    .order("checkin_date", { ascending: false })
    .limit(91); // 3 months + today

  const typedRecentCheckins = (recentCheckins ?? []) as RecentCheckin[];
  const lastCheckin = typedRecentCheckins[0] ?? null;

  const today = getLocalToday();

  const existingCheckin = await supabase
    .from("daily_checkins")
    .select("daily_checkin_id")
    .eq("patient_id", patient.patient_id)
    .eq("checkin_date", today)
    .maybeSingle();

  if (existingCheckin.data) {
    redirect("/checkin/review");
  }

  const notification = getPreCheckinNotification({
    isCaregiver: patient.is_caregiver ?? false,
    currentlyHospitalized: patient.currently_hospitalized ?? false,
    lastCheckin,
    recentCheckins: typedRecentCheckins,
    today,
  });

  return (
    <div className="min-h-dvh bg-[#fdfbf5] flex flex-col items-center justify-between px-4 pb-20 pt-10 font-[family-name:var(--font-poppins)]">
      <div className="flex w-full max-w-[430px] flex-1 flex-col items-center justify-center gap-6 text-center">
        <div className="flex items-center gap-2">
          <Image
            src="/images/tillage-logo.svg"
            alt="Tillage"
            width={36}
            height={36}
          />
          <span className="text-2xl font-black text-[#186346]">Tillage</span>
        </div>

        <h1 className="text-3xl font-semibold text-black">{notification.title}</h1>

        <p className="mt-2 max-w-sm text-base leading-relaxed text-black">
          {notification.body}
        </p>
      </div>

      <div className="w-full max-w-[430px] space-y-3">
        {!notification.blocksCheckin ? (
          <Link
            href="/checkin/questions"
            className="flex h-[50px] w-full items-center justify-center rounded-[14px] bg-[#186346] text-lg font-semibold text-white"
          >
            Start Check-in
          </Link>
        ) : (
          <>
            <Link
              href="/settings"
              className="flex h-[50px] w-full items-center justify-center rounded-[14px] bg-[#186346] text-lg font-semibold text-white"
            >
              Go to Settings
            </Link>
            <Link
              href="/dashboard"
              className="flex h-[50px] w-full items-center justify-center rounded-[14px] border-2 border-[#186346] text-lg font-semibold text-[#186346]"
            >
              Go to Dashboard
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
