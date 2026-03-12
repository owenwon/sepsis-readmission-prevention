"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { dailyCheckInQuestions } from "@/lib/questions";
import { validateCurrentQuestion, hasAnswerForQuestion } from "@/lib/questions/validate";
import { calculateSepsisRisk } from "@/lib/riskCalculator";
import { getLocalToday, buildSurveyResponse } from "@/lib/localDate";
import type { Question } from "@/lib/questions/types";
import { createClient } from "@/lib/supabase/client";
import { useCaregiver } from "@/lib/CaregiverContext";
import RiskGauge from "@/components/RiskGauge";
import HelpTooltip from "@/components/HelpTooltip";
import type { GaugeLevel } from "@/components/RiskGauge";
import { evaluateTrigger, QuestionInput, OptionButton, FEELING_FACES } from "@/components/CheckInComponents";

// ============================================================================
// Design tokens from Figma
// ============================================================================
const colors = {
  bg: "bg-[#fdfbf5]",
  primary: "#186346",
  primaryBg: "bg-[#186346]",
  optionBg: "bg-[#f4f4f4]",
  selectedBg: "bg-[#dcf5f0]",
  selectedBorder: "border-[#186346]",
  disabledBg: "bg-[#e5e5e0]",
  disabledText: "text-[#a0a09b]",
  trackBg: "bg-[#d9d9d9]",
  trackFill: "bg-[#186346]",
};

// The subset of patient profile fields the check-in page needs.
// Onboarding flags gate which vital questions appear; is_caregiver
// controls which question text variant is shown.
type PatientProfile = {
  patient_id: string;
  is_caregiver: boolean;
  has_thermometer: boolean;
  has_pulse_oximeter: boolean;
  has_bp_cuff: boolean;
  has_hr_monitor: boolean;
  has_recent_uti: boolean;
  birthday?: string;
  discharge_date?: string;
  has_weakened_immune?: boolean;
  admitted_count?: number;
  on_immunosuppressants?: boolean;
  has_lung_condition?: boolean;
  has_heart_failure?: boolean;
  has_had_septic_shock?: boolean;
  has_urinary_catheter?: boolean;
  has_recent_pneumonia?: boolean;
  baseline_bp_systolic?: number;
};

// ============================================================================
// Main page
// ============================================================================
export default function CheckInPage() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [riskResult, setRiskResult] = useState<string | null>(null);
  const [emergency, setEmergency] = useState<{ message: string; emergencyMessage?: string } | null>(null);
  const [emergencyDismissed, setEmergencyDismissed] = useState(false);
  const emergencySubmittedRef = useRef(false);

  // ------------------------------------------------------------------
  // Fetch patient profile once on mount so we know is_caregiver and
  // which onboarding device flags were set. These are stored in the DB
  // after onboarding completes and must not be re-derived from local
  // answers here — the check-in session has no onboarding answers.
  // ------------------------------------------------------------------
  useEffect(() => {
    async function fetchProfile() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          setProfileError("Not authenticated.");
          setProfileLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("patients")
          .select(
            "patient_id, is_caregiver, has_thermometer, has_pulse_oximeter, has_bp_cuff, has_hr_monitor, has_recent_uti, birthday, discharge_date, has_weakened_immune, admitted_count, on_immunosuppressants, has_lung_condition, has_heart_failure, has_had_septic_shock, has_urinary_catheter, has_recent_pneumonia, baseline_bp_systolic"
          )
          .eq("user_id", user.id)
          .single();

        if (error || !data) {
          setProfileError("Could not load your profile. Please complete onboarding first.");
          setProfileLoading(false);
          return;
        }

        // Check if a check-in already exists for today
        const today = getLocalToday();
        const { data: existingCheckin } = await supabase
          .from('daily_checkins')
          .select('daily_checkin_id')
          .eq('patient_id', data.patient_id)
          .eq('checkin_date', today)
          .maybeSingle();

        if (existingCheckin) {
          router.replace('/checkin/review');
          return;
        }

        setProfile(data as PatientProfile);
      } catch (err: any) {
        setProfileError(err.message ?? "Unexpected error loading profile.");
      } finally {
        setProfileLoading(false);
      }
    }

    fetchProfile();
  }, []);

  const { setIsCaregiver } = useCaregiver();
  const isCaregiver = profile?.is_caregiver ?? false;

  // Sync caregiver context on profile load
  useEffect(() => {
    if (profile) setIsCaregiver(profile.is_caregiver ?? false);
  }, [profile, setIsCaregiver]);

  // ------------------------------------------------------------------
  // Filter questions based on prerequisites.
  // For 'onboarding' source prerequisites, resolve against the fetched
  // profile instead of the current answers object — those fields were
  // set during onboarding and live in the DB, not in this session.
  // ------------------------------------------------------------------
  const visibleQuestions = useMemo(() => {
    if (!profile) return [];

    return dailyCheckInQuestions.filter((q) => {
      if (!q.prerequisites || q.prerequisites.length === 0) return true;

      return q.prerequisites.every((prereq) => {
        if (prereq.source === "onboarding") {
          // Resolve against the DB profile, not local answers
          const profileValue = (profile as any)[prereq.field];
          if (profileValue === undefined) return false;
          switch (prereq.operator) {
            case "==": return profileValue === prereq.value;
            case "!=": return profileValue !== prereq.value;
            case ">":  return profileValue > prereq.value;
            case "<":  return profileValue < prereq.value;
            case ">=": return profileValue >= prereq.value;
            case "<=": return profileValue <= prereq.value;
            default:   return true;
          }
        }

        // 'current' source — resolve against this session's answers
        const answer = answers[prereq.field];
        if (answer === undefined) return false;
        switch (prereq.operator) {
          case "==":       return answer === prereq.value;
          case "!=":       return answer !== prereq.value;
          case ">":        return answer > prereq.value;
          case "<":        return answer < prereq.value;
          case ">=":       return answer >= prereq.value;
          case "<=":       return answer <= prereq.value;
          case "includes": return Array.isArray(answer) && answer.includes(prereq.value);
          case "excludes": return Array.isArray(answer) && !answer.includes(prereq.value);
          default:         return true;
        }
      });
    });
  }, [profile, answers]);

  const currentQuestion = visibleQuestions[currentIndex];
  const totalQuestions = visibleQuestions.length;
  const currentValue = currentQuestion
    ? (answers[`__ui__${currentQuestion.id}`] ?? answers[currentQuestion.id])
    : undefined;

  const hasAnswer = currentQuestion ? hasAnswerForQuestion(currentQuestion, currentValue) : false;

  const progressPct = useMemo(
    () => (totalQuestions > 0 ? (currentIndex / totalQuestions) * 100 : 0),
    [currentIndex]
  );

  const setAnswer = (question: Question, value: any) => {
    setAnswers((prev) => {
      const updated = { ...prev };

      updated[`__ui__${question.id}`] = value;
      updated[question.id] = value;

      if (question.businessLogic?.mapToMultipleFields && question.businessLogic.customMapping) {
        const mapped = question.businessLogic.customMapping(value);
        Object.assign(updated, mapped);
      }

      if (typeof question.schemaField === "string" && question.id !== question.schemaField) {
        updated[question.schemaField] = value;
      }

      return updated;
    });
  };

  const submitPartialCheckin = async () => {
    try {
      const riskCalcResult = calculateSepsisRisk(buildSurveyResponse(answers, profile!) as any);
      const { zones } = riskCalcResult;
      const payload = { ...answers, ...zones, risk_level: 'RED_EMERGENCY', checkin_date: getLocalToday() };
      await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: payload })
      });
    } catch {
      // Silently ignore — the emergency UI is already showing.
    }
  };

  const handleContinue = async () => {
    if (
      currentQuestion?.businessLogic?.requiresEmergencyAlert &&
      currentQuestion.businessLogic.triggerWhen &&
      evaluateTrigger(
        currentQuestion.businessLogic.triggerWhen.operator,
        currentQuestion.businessLogic.triggerWhen.value,
        currentValue
      )
    ) {
      setEmergency({
        message: currentQuestion.businessLogic.terminationMessage ?? 'Seek emergency care immediately.',
      });
      return;
    }
    if (!hasAnswer) return;

    const error = currentQuestion ? validateCurrentQuestion(currentQuestion, currentValue) : null;
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError(null);
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      const riskCalcResult = calculateSepsisRisk(buildSurveyResponse(answers, profile!) as any);
      const risk_level = riskCalcResult.riskLevel;
      const { zones } = riskCalcResult;

      if (risk_level === 'RED_EMERGENCY') {
        setEmergency({
          message: 'Your responses indicate a high-risk situation.',
          emergencyMessage: riskCalcResult.emergencyMessage,
        });
        if (!emergencySubmittedRef.current) {
          emergencySubmittedRef.current = true;
          await submitPartialCheckin();
        }
        return;
      }

      setSubmitting(true);
      setSubmitError(null);
      try {
        const res = await fetch("/api/checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: { ...answers, ...zones, risk_level, checkin_date: getLocalToday() } })
        });
        if (res.ok) {
          setRiskResult(risk_level);
          setFinished(true);
        } else {
          const data = await res.json();
          setSubmitError(data.error ?? "Failed to save check-in data.");
          setSubmitting(false);
        }
      } catch (err: any) {
        setSubmitError(err.message ?? "Network error. Please try again.");
        setSubmitting(false);
      }
    }
  };

  const handleRestart = () => {
    setFinished(false);
    setCurrentIndex(0);
    setAnswers({});
  };

  const handleBack = () => {
    if (currentIndex === 0) {
      router.push('/dashboard');
    } else {
      setCurrentIndex(currentIndex - 1);
      setValidationError(null);
    }
  };

  useEffect(() => {
    if (emergencyDismissed) {
      const timer = setTimeout(() => router.push('/dashboard'), 2000);
      return () => clearTimeout(timer);
    }
  }, [emergencyDismissed]);

  // ----- Loading / error states -----
  if (profileLoading) {
    return (
      <div className={`${colors.bg} flex min-h-dvh items-center justify-center px-4`}>
        <p className="text-base text-black/50">Loading your profile…</p>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className={`${colors.bg} flex min-h-dvh items-center justify-center px-4`}>
        <p className="text-base text-red-600">{profileError}</p>
      </div>
    );
  }

  // ----- Emergency alert overlay -----
  if (emergency && !emergencyDismissed) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-red-700 px-6 text-center">
        <p className="text-5xl">🚨</p>
        <h1 className="mt-6 text-2xl font-bold text-white leading-snug">
          Based on your answers, we strongly recommend seeking emergency care right away.
        </h1>
        <p className="mt-4 text-base font-medium text-white/90">
          Please contact emergency services or have someone take you to the nearest emergency room.
        </p>
        <p className="mt-3 text-sm text-white/70">
          Do not drive yourself. If you are alone, call someone who can help or contact emergency services directly.
        </p>
        {(emergency.emergencyMessage || emergency.message) && (
          <p className="mt-4 text-xs text-white/40">
            {emergency.emergencyMessage ?? emergency.message}
          </p>
        )}
        <button
          onClick={async () => {
            if (!emergencySubmittedRef.current) {
              emergencySubmittedRef.current = true;
              await submitPartialCheckin();
            }
            setEmergencyDismissed(true);
          }}
          className="mt-10 flex h-[54px] w-full max-w-[380px] cursor-pointer items-center justify-center rounded-[14px] bg-white px-6 text-lg font-semibold text-red-700"
        >
          I understand — go to my dashboard
        </button>
      </div>
    );
  }

  if (emergency && emergencyDismissed) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#fdfbf5] px-6 text-center">
        <p className="text-5xl">✅</p>
        <h1 className="mt-6 text-xl font-semibold text-black">
          Your responses have been recorded.
        </h1>
        <p className="mt-3 text-sm text-black/50">Returning you to your dashboard...</p>
      </div>
    );
  }

  // ----- Completion screen -----
  if (finished) {
    const gaugeLevel: GaugeLevel =
      riskResult === "GREEN" ? "GREEN"
      : riskResult === "YELLOW" ? "YELLOW"
      : "RED";

    return (
      <div className={`${colors.bg} flex min-h-dvh flex-col items-center justify-between px-4 pb-20 pt-2.5`}>
        <div className="flex w-full max-w-[430px] flex-col gap-6">
          <button
            onClick={handleRestart}
            className="flex size-10 cursor-pointer items-center justify-center self-start"
            aria-label="Go back"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <h1 className="w-full text-center text-[26px] font-semibold text-black">
            Your Results
          </h1>

          <RiskGauge
            level={gaugeLevel}
            onDashboard={() => router.push("/dashboard")}
          />
        </div>
      </div>
    );
  }

  // ----- No questions fallback -----
  if (!currentQuestion) {
    return (
      <div className={`${colors.bg} flex min-h-dvh items-center justify-center px-4`}>
        <p className="text-lg text-black/60">No questions available.</p>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Pick the correct text variant based on the user's role from the DB.
  // Falls back to patientText/helpText if caregiverText is not defined,
  // mirroring the same fallback pattern used in onboarding.
  // ------------------------------------------------------------------
  const questionText = isCaregiver
    ? (currentQuestion.caregiverText ?? currentQuestion.patientText)
    : currentQuestion.patientText;

  // ----- Main question screen -----
  return (
    <div className={`${colors.bg} flex min-h-dvh flex-col items-center justify-between px-4 pb-20 pt-2.5`}>
      <div className="flex w-full max-w-[430px] flex-col gap-6">
        <button
          onClick={handleBack}
          className="flex size-10 cursor-pointer items-center justify-center self-start"
          aria-label="Go back"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="flex w-full flex-col gap-4">
          <div className={`flex w-full items-center rounded-full ${colors.trackBg}`}>
            <div
              className={`h-1.5 rounded-l-full ${colors.trackFill} transition-all duration-300 ease-out`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span style={{ position: 'relative', display: 'inline' }}>
            <h2 className="text-[26px] font-semibold leading-normal text-black inline">
              {questionText}<HelpTooltip
                helpText={currentQuestion.helpText}
                caregiverHelpText={currentQuestion.caregiverHelpText}
              />
            </h2>
          </span>
        </div>

        <QuestionInput
          question={currentQuestion}
          value={currentValue}
          onChange={(value) => setAnswer(currentQuestion, value)}
        />
      </div>

      <div className="flex w-full max-w-[430px] flex-col gap-2 pt-6">
        {validationError && (
          <p className="text-center text-sm text-red-600">{validationError}</p>
        )}
        {submitError && (
          <p className="text-center text-sm text-red-600">{submitError}</p>
        )}
        <button
          onClick={handleContinue}
          disabled={submitting || !hasAnswer}
          className={`flex h-[50px] w-full cursor-pointer items-center justify-center rounded-[14px] px-6 py-[5px] text-lg font-semibold transition-colors duration-200 ${
            hasAnswer && !submitting
              ? `${colors.primaryBg} text-white`
              : `${colors.disabledBg} ${colors.disabledText} cursor-default`
          }`}
        >
          {submitting ? "Saving..." : currentIndex === totalQuestions - 1 ? "Finish" : "Continue"}
        </button>
      </div>
    </div>
  );
}

