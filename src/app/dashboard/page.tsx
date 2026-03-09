import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { RiskLevel } from "@/types/database";


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
    .select("*")
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

  // fetch latest check-in
  const { data: latestCheckin } = await supabase
    .from("daily_checkins")
    .select("risk_level, checkin_date")
    .eq("patient_id", patient.patient_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const hasCheckin = !!latestCheckin;
  const riskLevel: RiskLevel = (latestCheckin?.risk_level as RiskLevel) ?? "GREEN";
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
        <button className="flex flex-col items-center justify-center cursor-pointer">
          <Image
            src="/images/dashboard/menu-icon.svg"
            alt="Menu"
            width={24}
            height={24}
          />
          <span className="text-xs text-white">Menu</span>
        </button>
      </nav>

      {/* greeting + risk card */}
      <div className="relative z-10 flex w-full max-w-md flex-col gap-6">
        {/* greeting text */}
        <div className="flex flex-col gap-2">
          <p className="text-base text-black">
            {greeting}, {patient.patient_name}
          </p>
          <h1 className="text-3xl font-semibold text-black leading-tight">
            {hasCheckin
              ? "Well done completing your daily check in!"
              : "Ready for your daily check in?"}
          </h1>
        </div>

        {/* Risk Level card (shown after check-in) or Start card */}
        {hasCheckin ? (
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
              href="/checkin"
              className="flex h-[50px] w-full items-center justify-center rounded-[14px] bg-[#186346] text-lg font-semibold text-white hover:opacity-90 transition-opacity"
            >
              Review my answers
            </Link>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-4 overflow-hidden rounded-[14px] bg-white p-6 shadow-[0px_4px_12px_rgba(0,0,0,0.15)]">
            <p className="text-xl font-semibold text-black">
              Complete your daily symptom check to monitor your recovery.
            </p>
            <Link
              href="/checkin"
              className="flex h-[50px] w-full items-center justify-center rounded-[14px] bg-[#186346] text-lg font-semibold text-white hover:opacity-90 transition-opacity"
            >
              Start Check-in
            </Link>
          </div>
        )}
      </div>

      {/* ── Navigation cards ── */}
      <div className="relative z-10 flex w-full max-w-md flex-col gap-6 mt-10">
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
