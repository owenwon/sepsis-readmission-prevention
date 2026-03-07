import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export default async function DashboardPage() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
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
    // ─── Welcome screen (matches Figma node 1314-9820) ───
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
        <div className="pointer-events-none absolute left-[7%] bottom-[38%] w-[40px] h-[70px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/welcome/flower1.svg" alt="" className="w-full h-full" />
        </div>
        <div className="pointer-events-none absolute left-[63%] bottom-[36%] w-[32px] h-[57px] -scale-y-100 rotate-180">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/welcome/flower2.svg" alt="" className="w-full h-full" />
        </div>
        <div className="pointer-events-none absolute right-[8%] bottom-[42%] w-[44px] h-[75px] -scale-y-100 rotate-180">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/welcome/flower3.svg" alt="" className="w-full h-full" />
        </div>
        <div className="pointer-events-none absolute left-[36%] bottom-[38%] w-[14px] h-[23px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/welcome/flower4.svg" alt="" className="w-full h-full" />
        </div>
        <div className="pointer-events-none absolute left-[7%] bottom-[42%] w-[10px] h-[25px] -scale-y-100 rotate-180">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/welcome/flower5.svg" alt="" className="w-full h-full" />
        </div>
        <div className="pointer-events-none absolute left-[8%] bottom-[30%] w-[309px] h-[85px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/welcome/butterfly.svg" alt="" className="w-full h-full" />
        </div>

        {/* Text content */}
        <div className="w-full max-w-[430px] pt-[120px] relative z-10">
          <h1 className="text-[30px] font-semibold text-black leading-tight">
            Welcome!
          </h1>
          <p className="text-[16px] text-black mt-1 leading-relaxed">
            We&apos;re here to support your sepsis recovery journey. Let&apos;s
            personalize your experience with these next questions!
          </p>
        </div>

        {/* CTA */}
        <Link
          href="/onboarding"
          className="relative z-10 w-full max-w-[342px] h-[50px] flex items-center justify-center bg-[#186346] text-white text-[18px] font-semibold rounded-[14px] hover:opacity-90 transition-opacity"
        >
          Get Started
        </Link>
      </div>
    );
  }

  // ─── Returning user dashboard ───
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-xl font-bold text-green-600">
              Sepsis Tracker
            </h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">{user.email}</span>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="text-sm text-red-600 hover:text-red-500"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Welcome back, {patient.patient_name}!
            </h2>
            <p className="text-gray-600">
              How are you feeling today?
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Daily Check-in Card */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Daily Check-in
              </h3>
              <p className="text-gray-600 mb-4">
                Complete your daily symptom check to monitor your health.
              </p>
              <Link
                href="/checkin"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
              >
                Start Check-in
              </Link>
            </div>

            {/* History Card */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Your History
              </h3>
              <p className="text-gray-600 mb-4">
                View your past check-ins and track your progress.
              </p>
              <Link
                href="/history"
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                View History
              </Link>
            </div>
          </div>

          {/* Risk Status */}
          {patient.is_high_risk && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 font-medium">
                ⚠️ You are marked as high-risk. Please ensure you complete your daily check-ins.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
