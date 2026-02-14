import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

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
        {!patient ? (
          // User hasn't completed onboarding
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <h2 className="text-xl font-semibold text-yellow-800 mb-2">
              Welcome! Let&apos;s get you set up.
            </h2>
            <p className="text-yellow-700 mb-4">
              Please complete your profile to start tracking your health.
            </p>
            <Link
              href="/onboarding"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
            >
              Start Onboarding →
            </Link>
          </div>
        ) : (
          // User has completed onboarding
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
        )}
      </main>
    </div>
  );
}
