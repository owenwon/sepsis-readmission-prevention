"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { dailyCheckInQuestions } from "@/lib/questions";
import { calculateSepsisRisk } from "@/lib/riskCalculator";
import type { RiskCalculationResult } from "@/lib/riskCalculator";
import type { Question } from "@/lib/questions/types";
import { createClient } from "@/lib/supabase/client";
import { evaluateTrigger, QuestionInput } from "@/components/CheckInComponents";
import { getLocalToday, buildSurveyResponse } from "@/lib/localDate";

// ============================================================================
// Design tokens (shared with check-in page)
// ============================================================================

const colors = {
  bg: "#fdfbf5",
  primary: "#186346",
  selectedBg: "#dcf5f0",
  disabledBg: "#e5e5e0",
  disabledText: "#a0a09b",
  divider: "rgba(0,0,0,0.2)",
  overlay: "rgba(0,0,0,0.4)",
};

// ============================================================================
// Overall feeling config (smiley face selector)
// ============================================================================

const FEELING_CONFIG: Record<number, { label: string; emoji: string; color: string }> = {
  5: { label: "Super", emoji: "😄", color: "#4cbe71" },
  4: { label: "Good", emoji: "🙂", color: "#a7cf5c" },
  3: { label: "Okay", emoji: "😐", color: "#ffde45" },
  2: { label: "Bad", emoji: "😟", color: "#ef8f39" },
  1: { label: "Awful", emoji: "😢", color: "#f2333a" },
};

// ============================================================================
// Risk level display config
// ============================================================================

const RISK_LABELS: Record<string, { label: string; color: string; bgColor: string }> = {
  GREEN: { label: "Low Risk", color: "#186346", bgColor: "#dcf5f0" },
  YELLOW: { label: "Medium Risk", color: "#8B6914", bgColor: "#FFF3CD" },
  RED: { label: "High Risk", color: "#991B1B", bgColor: "#FEE2E2" },
  RED_EMERGENCY: { label: "Emergency", color: "#991B1B", bgColor: "#FEE2E2" },
};

// ============================================================================
// Types
// ============================================================================

type PatientProfile = {
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
// Pure helpers
// ============================================================================

/** Check if a question's prerequisites are met. */
function isQuestionVisible(
  question: Question,
  profile: PatientProfile,
  answers: Record<string, any>,
): boolean {
  if (!question.prerequisites || question.prerequisites.length === 0) return true;

  return question.prerequisites.every((prereq) => {
    if (prereq.source === "onboarding") {
      const val = (profile as any)[prereq.field];
      if (val === undefined) return false;
      switch (prereq.operator) {
        case "==":
          return val === prereq.value;
        case "!=":
          return val !== prereq.value;
        case ">":
          return val > prereq.value;
        case "<":
          return val < prereq.value;
        case ">=":
          return val >= prereq.value;
        case "<=":
          return val <= prereq.value;
        default:
          return true;
      }
    }

    const answer = answers[prereq.field];
    if (answer === undefined) return false;
    switch (prereq.operator) {
      case "==":
        return answer === prereq.value;
      case "!=":
        return answer !== prereq.value;
      case ">":
        return answer > prereq.value;
      case "<":
        return answer < prereq.value;
      case ">=":
        return answer >= prereq.value;
      case "<=":
        return answer <= prereq.value;
      case "includes":
        return Array.isArray(answer) && answer.includes(prereq.value);
      case "excludes":
        return Array.isArray(answer) && !answer.includes(prereq.value);
      default:
        return true;
    }
  });
}

/**
 * Reconstruct the local answers state from a DB check-in record.
 * Iterates in question order so current-source prerequisites resolve correctly.
 */
function hydrateAnswersFromDb(
  checkin: Record<string, any>,
  profile: PatientProfile,
): Record<string, any> {
  const answers: Record<string, any> = {};

  for (const question of dailyCheckInQuestions) {
    if (!isQuestionVisible(question, profile, answers)) continue;

    let uiValue: any;

    if (question.id === "cough_mucus_selection") {
      // Reverse mapping: has_cough + mucus_color_level → single UI value
      const hasCough = checkin.has_cough;
      const mucusLevel = checkin.mucus_color_level;
      uiValue = hasCough === false || hasCough == null ? "none" : (mucusLevel ?? 1);
    } else if (question.id === "wound_state_level") {
      // Reverse mapping: DB null → UI "none"
      const dbValue = checkin.wound_state_level;
      uiValue = dbValue == null ? "none" : dbValue;
    } else {
      // Standard: get value from the question's schema field
      const field =
        typeof question.schemaField === "string"
          ? question.schemaField
          : question.schemaField[0];
      const dbValue = checkin[field];

      if (dbValue === undefined || dbValue === null) {
        if (question.type === "boolean") {
          uiValue = false; // DB columns default to false
        } else {
          continue; // No answer stored — skip
        }
      } else {
        uiValue = dbValue;
      }
    }

    // Store the UI-facing value
    answers[`__ui__${question.id}`] = uiValue;
    answers[question.id] = uiValue;

    // Map to schema field if different from id
    if (typeof question.schemaField === "string" && question.id !== question.schemaField) {
      answers[question.schemaField] = uiValue;
    }

    // Run customMapping so DB-ready fields are also populated
    if (question.businessLogic?.mapToMultipleFields && question.businessLogic.customMapping) {
      Object.assign(answers, question.businessLogic.customMapping(uiValue));
    }
  }

  return answers;
}

/**
 * Apply a new answer value for a question (mirrors check-in page setAnswer).
 * Returns a new answers object.
 */
function applyAnswer(
  answers: Record<string, any>,
  question: Question,
  value: any,
): Record<string, any> {
  const updated = { ...answers };

  updated[`__ui__${question.id}`] = value;
  updated[question.id] = value;

  if (question.businessLogic?.mapToMultipleFields && question.businessLogic.customMapping) {
    Object.assign(updated, question.businessLogic.customMapping(value));
  }

  if (typeof question.schemaField === "string" && question.id !== question.schemaField) {
    updated[question.schemaField] = value;
  }

  return updated;
}

/** Remove all answer keys related to a question (prerequisite-gated cleanup). */
function clearQuestionAnswer(answers: Record<string, any>, question: Question) {
  delete answers[question.id];
  delete answers[`__ui__${question.id}`];

  if (typeof question.schemaField === "string") {
    delete answers[question.schemaField];
  } else if (Array.isArray(question.schemaField)) {
    for (const field of question.schemaField) {
      delete answers[field];
    }
  }

  // Multi-field cleanup for known questions
  if (question.id === "cough_mucus_selection") {
    delete answers.has_cough;
    delete answers.mucus_color_level;
  }
}

/** Human-readable display text for a question's current answer. */
function getDisplayText(question: Question, value: any): string {
  if (value === undefined || value === null) return "—";

  switch (question.type) {
    case "boolean":
      return value === true ? "Yes" : "No";

    case "single_select": {
      if (question.id === "cough_mucus_selection" && value === "none") return "No cough";
      if (question.id === "wound_state_level" && value === "none") return "No wound present";
      const option = question.options?.find((o) => o.value === value);
      return option?.label ?? String(value);
    }

    case "scale": {
      if (question.id === "overall_feeling") {
        const c = FEELING_CONFIG[value as number];
        return c ? `${c.emoji} ${c.label}` : String(value);
      }
      if (question.id === "pain_level") return `${value}/10`;
      return String(value);
    }

    case "integer":
    case "float":
      return `${value}${question.unit ? ` ${question.unit}` : ""}`;

    case "text":
    case "textarea":
      return String(value);

    case "multi_select": {
      if (!Array.isArray(value)) return String(value);
      return value
        .map((v: any) => question.options?.find((o) => o.value === v)?.label ?? String(v))
        .join(", ");
    }

    default:
      return String(value);
  }
}

// ============================================================================
// SVG icons
// ============================================================================

function PencilIcon({ size = 12, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" className={className}>
      <path
        d="M8.5 1.5L10.5 3.5L3.5 10.5H1.5V8.5L8.5 1.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BackArrow() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M15 18l-6-6 6-6"
        stroke="black"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M15 5L5 15M5 5L15 15"
        stroke={colors.primary}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ============================================================================
// Edit question input — delegates to shared QuestionInput
// (QuestionInput now handles overall_feeling and pain_level internally)
// ============================================================================

function EditQuestionInput({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: any;
  onChange: (v: any) => void;
}) {
  return <QuestionInput question={question} value={value} onChange={onChange} />;
}

// ============================================================================
// Edit modal — bottom sheet (75 % of viewport)
// ============================================================================

function EditModal({
  question,
  value,
  onSave,
  onCancel,
  isCaregiver,
}: {
  question: Question;
  value: any;
  onSave: (newValue: any) => void;
  onCancel: () => void;
  isCaregiver: boolean;
}) {
  const [localValue, setLocalValue] = useState(value);

  const questionText = isCaregiver
    ? (question.caregiverText ?? question.patientText)
    : question.patientText;

  const helpText = isCaregiver
    ? (question.caregiverHelpText ?? question.helpText)
    : question.helpText;

  // Allow save as long as the user has a defined answer
  const canSave = localValue !== undefined && localValue !== null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Grey overlay — top portion */}
      <div
        className="min-h-[25%] flex-1"
        style={{ backgroundColor: colors.overlay }}
        onClick={onCancel}
      />

      {/* White bottom sheet */}
      <div
        className="flex flex-col rounded-tl-[14px] rounded-tr-[14px] bg-white shadow-[0px_-4px_12px_rgba(0,0,0,0.15)]"
        style={{ maxHeight: "75%" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h3 className="text-lg font-semibold text-black">Edit Answer</h3>
          <button onClick={onCancel} className="cursor-pointer p-1">
            <CloseIcon />
          </button>
        </div>

        {/* Content — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="mb-2 text-[18px] font-semibold leading-snug text-black">
            {questionText}
          </p>
          {helpText && (
            <p className="mb-4 text-sm leading-relaxed text-black/50">{helpText}</p>
          )}
          <EditQuestionInput question={question} value={localValue} onChange={setLocalValue} />
        </div>

        {/* Divider + action buttons */}
        <div className="border-t border-black/10 px-5 pb-6 pt-4">
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex h-[50px] flex-1 cursor-pointer items-center justify-center rounded-[14px] border-2 text-base font-semibold transition-colors"
              style={{ borderColor: colors.primary, color: colors.primary }}
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(localValue)}
              disabled={!canSave}
              className={`flex h-[50px] flex-1 items-center justify-center rounded-[14px] text-base font-semibold transition-colors ${
                canSave
                  ? "cursor-pointer bg-[#186346] text-white"
                  : "cursor-default bg-[#e5e5e0] text-[#a0a09b]"
              }`}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Unsaved changes dialog
// ============================================================================

function UnsavedChangesDialog({
  onDiscard,
  onKeepEditing,
}: {
  onDiscard: () => void;
  onKeepEditing: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-6"
      style={{ backgroundColor: colors.overlay }}
    >
      <div className="w-full max-w-[340px] rounded-[14px] bg-white p-6 shadow-[0px_4px_12px_rgba(0,0,0,0.15)]">
        <h3 className="text-xl font-semibold text-black">Unsaved Changes</h3>
        <p className="mt-2 text-sm text-black/60">
          You have unsaved changes. Are you sure you want to leave? Your edits
          will be lost.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={onDiscard}
            className="flex h-[46px] w-full cursor-pointer items-center justify-center rounded-[14px] bg-red-600 text-base font-semibold text-white"
          >
            Discard Changes
          </button>
          <button
            onClick={onKeepEditing}
            className="flex h-[46px] w-full cursor-pointer items-center justify-center rounded-[14px] border-2 text-base font-semibold"
            style={{ borderColor: colors.primary, color: colors.primary }}
          >
            Keep Editing
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main page component
// ============================================================================

export default function ReviewCheckinPage() {
  const router = useRouter();
  const supabase = createClient();

  // ------ data loading ------
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ------ fetched data ------
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  // Capture the checkin_date at load time so midnight-crossing edits
  // always target the same DB row instead of creating a duplicate.
  const [checkinDate, setCheckinDate] = useState<string>(getLocalToday());

  // ------ answer state ------
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [originalAnswers, setOriginalAnswers] = useState<Record<string, any>>({});
  const [editedFields, setEditedFields] = useState<Set<string>>(new Set());

  // ------ risk state ------
  const [currentRisk, setCurrentRisk] = useState<RiskCalculationResult | null>(null);

  // ------ UI state ------
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [emergency, setEmergency] = useState<{
    message: string;
    emergencyMessage?: string;
  } | null>(null);
  const [emergencyDismissed, setEmergencyDismissed] = useState(false);

  // ------------------------------------------------------------------
  // Load patient profile + latest check-in on mount
  // ------------------------------------------------------------------
  useEffect(() => {
    async function load() {
      try {
        const {
          data: { user },
          error: authErr,
        } = await supabase.auth.getUser();

        if (authErr || !user) {
          setError("Not authenticated.");
          setLoading(false);
          return;
        }

        // Patient profile (device flags + caregiver flag + onboarding context)
        const { data: patientData, error: patientErr } = await supabase
          .from("patients")
          .select(
            "patient_id, is_caregiver, has_thermometer, has_pulse_oximeter, has_bp_cuff, has_hr_monitor, has_recent_uti, birthday, discharge_date, has_weakened_immune, admitted_count, on_immunosuppressants, has_lung_condition, has_heart_failure, has_had_septic_shock, has_urinary_catheter, has_recent_pneumonia, baseline_bp_systolic",
          )
          .eq("user_id", user.id)
          .single();

        if (patientErr || !patientData) {
          setError("Could not load your profile.");
          setLoading(false);
          return;
        }

        setPatientId(patientData.patient_id);

        const prof: PatientProfile = {
          is_caregiver: patientData.is_caregiver,
          has_thermometer: patientData.has_thermometer,
          has_pulse_oximeter: patientData.has_pulse_oximeter,
          has_bp_cuff: patientData.has_bp_cuff,
          has_hr_monitor: patientData.has_hr_monitor,
          has_recent_uti: patientData.has_recent_uti,
          birthday: patientData.birthday,
          discharge_date: patientData.discharge_date,
          has_weakened_immune: patientData.has_weakened_immune,
          admitted_count: patientData.admitted_count,
          on_immunosuppressants: patientData.on_immunosuppressants,
          has_lung_condition: patientData.has_lung_condition,
          has_heart_failure: patientData.has_heart_failure,
          has_had_septic_shock: patientData.has_had_septic_shock,
          has_urinary_catheter: patientData.has_urinary_catheter,
          has_recent_pneumonia: patientData.has_recent_pneumonia,
          baseline_bp_systolic: patientData.baseline_bp_systolic,
        };

        // Today's check-in — capture the date used to load so edits
        // always target the same row even if the user crosses midnight.
        const today = getLocalToday();
        setCheckinDate(today);
        const { data: checkinData, error: checkinErr } = await supabase
          .from("daily_checkins")
          .select("*")
          .eq("patient_id", patientData.patient_id)
          .eq("checkin_date", today)
          .maybeSingle();

        if (checkinErr || !checkinData) {
          setError("No check-in found for today. Please complete today's check-in first.");
          setLoading(false);
          return;
        }

        // Hydrate local answers from DB record
        const hydrated = hydrateAnswersFromDb(checkinData, prof);
        const risk = calculateSepsisRisk(buildSurveyResponse(hydrated, prof) as any);

        setProfile(prof);
        setAnswers(hydrated);
        setOriginalAnswers({ ...hydrated });
        setCurrentRisk(risk);
      } catch (err: any) {
        setError(err.message ?? "Unexpected error.");
      } finally {
        setLoading(false);
      }
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isCaregiver = profile?.is_caregiver ?? false;

  // ------------------------------------------------------------------
  // Visible questions — recalculated when answers change
  // ------------------------------------------------------------------
  const visibleQuestions = useMemo(() => {
    if (!profile) return [];
    return dailyCheckInQuestions.filter((q) => {
      if (!isQuestionVisible(q, profile, answers)) return false;
      // Only show questions the user actually answered
      return answers[`__ui__${q.id}`] !== undefined;
    });
  }, [profile, answers]);

  // ------------------------------------------------------------------
  // Dirty detection — has anything changed from the original?
  // ------------------------------------------------------------------
  const hasChanges = useMemo(() => {
    return visibleQuestions.some((q) => {
      const cur = answers[`__ui__${q.id}`];
      const orig = originalAnswers[`__ui__${q.id}`];
      return cur !== orig;
    });
  }, [answers, originalAnswers, visibleQuestions]);

  // ------------------------------------------------------------------
  // Warn on browser tab close with unsaved changes
  // ------------------------------------------------------------------
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasChanges]);

  // ------------------------------------------------------------------
  // Back button — intercept if dirty
  // ------------------------------------------------------------------
  const handleBack = () => {
    if (hasChanges) {
      setShowUnsavedDialog(true);
    } else {
      router.push("/dashboard");
    }
  };

  // ------------------------------------------------------------------
  // Open edit modal
  // ------------------------------------------------------------------
  const openEdit = (question: Question) => {
    setEditingQuestion(question);
  };

  // ------------------------------------------------------------------
  // Save from edit modal
  // ------------------------------------------------------------------
  const handleEditSave = async (newValue: any) => {
    if (!editingQuestion || !profile) return;

    // 1. Check individual question emergency trigger
    if (
      editingQuestion.businessLogic?.requiresEmergencyAlert &&
      editingQuestion.businessLogic.triggerWhen &&
      evaluateTrigger(
        editingQuestion.businessLogic.triggerWhen.operator,
        editingQuestion.businessLogic.triggerWhen.value,
        newValue,
      )
    ) {
      const updated = applyAnswer(answers, editingQuestion, newValue);
      setAnswers(updated);
      setEditingQuestion(null);
      setEmergency({
        message:
          editingQuestion.businessLogic.terminationMessage ??
          "Seek emergency care immediately.",
      });

      // Submit emergency check-in — merge with existing DB row to preserve fields
      try {
        let mergedAnswers = updated;
        if (patientId) {
          const { data: existingCheckin } = await supabase
            .from('daily_checkins')
            .select('*')
            .eq('patient_id', patientId)
            .eq('checkin_date', checkinDate)
            .single();
          mergedAnswers = { ...(existingCheckin ?? {}), ...updated };
        }
        const riskResult = calculateSepsisRisk(buildSurveyResponse(mergedAnswers, profile!) as any);
        await fetch("/api/checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            answers: { ...mergedAnswers, ...riskResult.zones, risk_level: "RED_EMERGENCY", checkin_date: checkinDate },
          }),
        });
      } catch {
        // Emergency UI is already showing
      }
      return;
    }

    // 2. Apply the new answer
    const updated = applyAnswer(answers, editingQuestion, newValue);

    // 3. Prerequisite-gated cleanup — clear answers for questions
    //    whose prerequisites are no longer met after this edit
    for (const q of dailyCheckInQuestions) {
      const hasStoredAnswer = q.id in updated || `__ui__${q.id}` in updated;
      if (hasStoredAnswer && !isQuestionVisible(q, profile, updated)) {
        clearQuestionAnswer(updated, q);
      }
    }

    // 4. Save answer locally — risk recalculation is deferred to "Confirm and Submit"
    setAnswers(updated);

    // Track "edited" indicator — only if value genuinely differs from original
    const originalVal = originalAnswers[`__ui__${editingQuestion.id}`];
    if (newValue !== originalVal) {
      setEditedFields((prev) => new Set([...prev, editingQuestion.id]));
    } else {
      setEditedFields((prev) => {
        const next = new Set(prev);
        next.delete(editingQuestion.id);
        return next;
      });
    }

    setEditingQuestion(null);
  };

  // ------------------------------------------------------------------
  // Submit all changes via POST /api/checkin
  // ------------------------------------------------------------------
  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      // Merge local answers on top of existing DB row to preserve any fields not edited locally
      let mergedAnswers = answers;
      if (patientId) {
        const { data: existingCheckin } = await supabase
          .from('daily_checkins')
          .select('*')
          .eq('patient_id', patientId)
          .eq('checkin_date', checkinDate)
          .single();
        mergedAnswers = { ...(existingCheckin ?? {}), ...answers };
      }

      const riskResult = calculateSepsisRisk(buildSurveyResponse(mergedAnswers, profile!) as any);
      const { zones } = riskResult;
      const risk_level = riskResult.riskLevel;

      // Emergency check on final submission
      if (risk_level === "RED_EMERGENCY") {
        setEmergency({
          message: "Your responses indicate a high-risk situation.",
          emergencyMessage: riskResult.emergencyMessage,
        });
        await fetch("/api/checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            answers: { ...mergedAnswers, ...zones, risk_level: "RED_EMERGENCY", checkin_date: checkinDate },
          }),
        });
        setSubmitting(false);
        return;
      }

      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: { ...mergedAnswers, ...zones, risk_level, checkin_date: checkinDate } }),
      });

      if (res.ok) {
        // Snapshot becomes the new baseline — button re-disables
        setOriginalAnswers({ ...answers });
        setEditedFields(new Set());
        setCurrentRisk(riskResult);
        setSubmitSuccess(true);
        setTimeout(() => setSubmitSuccess(false), 3000);
      } else {
        const data = await res.json();
        setSubmitError(data.error ?? "Failed to save changes.");
      }
    } catch (err: any) {
      setSubmitError(err.message ?? "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ------------------------------------------------------------------
  // Redirect after emergency dismissal
  // ------------------------------------------------------------------
  useEffect(() => {
    if (emergencyDismissed) {
      const timer = setTimeout(() => router.push("/dashboard"), 2000);
      return () => clearTimeout(timer);
    }
  }, [emergencyDismissed, router]);

  // ==================================================================
  // Render: loading
  // ==================================================================
  if (loading) {
    return (
      <div
        className="flex min-h-dvh items-center justify-center px-4 font-[family-name:var(--font-poppins)]"
        style={{ backgroundColor: colors.bg }}
      >
        <p className="text-base text-black/50">Loading your check-in…</p>
      </div>
    );
  }

  // ==================================================================
  // Render: error
  // ==================================================================
  if (error) {
    return (
      <div
        className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 font-[family-name:var(--font-poppins)]"
        style={{ backgroundColor: colors.bg }}
      >
        <p className="text-base text-red-600">{error}</p>
        {error.includes("complete today") && (
          <button
            onClick={() => router.push("/checkin")}
            className="cursor-pointer rounded-[14px] px-6 py-3 text-base font-semibold text-white"
            style={{ backgroundColor: colors.primary }}
          >
            Start Check-in
          </button>
        )}
        <button
          onClick={() => router.push("/dashboard")}
          className="cursor-pointer rounded-[14px] px-6 py-3 text-base font-semibold text-white"
          style={{ backgroundColor: colors.primary }}
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  // ==================================================================
  // Render: emergency overlay
  // ==================================================================
  if (emergency && !emergencyDismissed) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-red-700 px-6 text-center font-[family-name:var(--font-poppins)]">
        <p className="text-5xl">🚨</p>
        <h1 className="mt-6 text-2xl font-bold leading-snug text-white">
          Based on your answers, we strongly recommend seeking emergency care
          right away.
        </h1>
        <p className="mt-4 text-base font-medium text-white/90">
          Please contact emergency services or have someone take you to the
          nearest emergency room.
        </p>
        <p className="mt-3 text-sm text-white/70">
          Do not drive yourself. If you are alone, call someone who can help or
          contact emergency services directly.
        </p>
        {(emergency.emergencyMessage || emergency.message) && (
          <p className="mt-4 text-xs text-white/40">
            {emergency.emergencyMessage ?? emergency.message}
          </p>
        )}
        <button
          onClick={() => setEmergencyDismissed(true)}
          className="mt-10 flex h-[54px] w-full max-w-[380px] cursor-pointer items-center justify-center rounded-[14px] bg-white px-6 text-lg font-semibold text-red-700"
        >
          I understand — go to my dashboard
        </button>
      </div>
    );
  }

  if (emergency && emergencyDismissed) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-center font-[family-name:var(--font-poppins)]"
        style={{ backgroundColor: colors.bg }}
      >
        <p className="text-5xl">✅</p>
        <h1 className="mt-6 text-xl font-semibold text-black">
          Your responses have been recorded.
        </h1>
        <p className="mt-3 text-sm text-black/50">
          Returning you to your dashboard…
        </p>
      </div>
    );
  }

  // ==================================================================
  // Derived values
  // ==================================================================
  const riskConfig = currentRisk
    ? (RISK_LABELS[currentRisk.riskLevel] ?? RISK_LABELS.GREEN)
    : RISK_LABELS.GREEN;

  // ==================================================================
  // Render: main review UI
  // ==================================================================
  return (
    <div
      className="flex min-h-dvh flex-col font-[family-name:var(--font-poppins)]"
      style={{ backgroundColor: colors.bg }}
    >
      {/* --- Unsaved changes dialog --- */}
      {showUnsavedDialog && (
        <UnsavedChangesDialog
          onDiscard={() => router.push("/dashboard")}
          onKeepEditing={() => setShowUnsavedDialog(false)}
        />
      )}

      {/* --- Edit modal --- */}
      {editingQuestion && (
        <EditModal
          question={editingQuestion}
          value={answers[`__ui__${editingQuestion.id}`]}
          onSave={handleEditSave}
          onCancel={() => setEditingQuestion(null)}
          isCaregiver={isCaregiver}
        />
      )}

      {/* --- Sticky header --- */}
      <div
        className="sticky top-0 z-10 px-4 pb-3 pt-2.5"
        style={{ backgroundColor: colors.bg }}
      >
        <div className="mx-auto flex w-full max-w-[430px] items-center gap-3">
          <button
            onClick={handleBack}
            className="flex size-10 cursor-pointer items-center justify-center"
            aria-label="Go back"
          >
            <BackArrow />
          </button>
          <h1 className="flex-1 text-[22px] font-semibold text-black">
            Review My Answers
          </h1>
        </div>
      </div>

      {/* --- Risk level badge --- */}
      <div className="px-4">
        <div
          className="mx-auto flex w-full max-w-[430px] items-center gap-2 rounded-[10px] px-4 py-2.5"
          style={{ backgroundColor: riskConfig.bgColor }}
        >
          <span
            className="text-sm font-semibold"
            style={{ color: riskConfig.color }}
          >
            Current Risk Level: {riskConfig.label}
          </span>
          {hasChanges && (
            <span className="ml-auto text-xs text-black/40">(unsaved)</span>
          )}
        </div>
      </div>

      {/* --- Question list --- */}
      <div className="flex-1 overflow-y-auto px-4 pt-4">
        <div className="mx-auto w-full max-w-[430px]">
          {visibleQuestions.map((question, index) => {
            const uiValue = answers[`__ui__${question.id}`];
            const displayText = getDisplayText(question, uiValue);
            const isEdited = editedFields.has(question.id);
            const questionText = isCaregiver
              ? (question.caregiverText ?? question.patientText)
              : question.patientText;

            return (
              <div key={question.id}>
                <div className="flex items-start justify-between gap-3 py-4">
                  {/* Question text + current answer */}
                  <div className="min-w-0 flex-1">
                    <p className="text-[20px] font-semibold leading-snug text-black">
                      {questionText}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      {isEdited && (
                        <span className="text-[#186346]">
                          <PencilIcon size={14} />
                        </span>
                      )}
                      <p
                        className={`text-[18px] leading-snug ${
                          isEdited
                            ? "font-medium text-[#186346]"
                            : "text-black/70"
                        }`}
                      >
                        {displayText}
                      </p>
                    </div>
                  </div>

                  {/* Edit button */}
                  <button
                    onClick={() => openEdit(question)}
                    className="mt-1 flex shrink-0 cursor-pointer items-center gap-1.5 rounded-[9px] px-[12px] py-[7px] text-[12px] font-medium text-white"
                    style={{ backgroundColor: colors.primary }}
                  >
                    <PencilIcon size={11} className="text-white" />
                    Edit
                  </button>
                </div>

                {/* Divider */}
                {index < visibleQuestions.length - 1 && (
                  <div
                    className="h-[2px]"
                    style={{ backgroundColor: colors.divider }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* --- Sticky submit section --- */}
      <div
        className="sticky bottom-0 border-t border-black/10 px-4 pb-8 pt-4"
        style={{ backgroundColor: colors.bg }}
      >
        <div className="mx-auto flex w-full max-w-[430px] flex-col gap-3">
          {submitError && (
            <p className="text-center text-sm text-red-600">{submitError}</p>
          )}
          {submitSuccess && (
            <p className="text-center text-sm font-medium text-[#186346]">
              ✓ Changes saved successfully
            </p>
          )}
          <button
            onClick={handleSubmit}
            disabled={!hasChanges || submitting}
            className={`flex h-[50px] w-full items-center justify-center rounded-[14px] text-lg font-semibold transition-colors duration-200 ${
              hasChanges && !submitting
                ? "cursor-pointer bg-[#186346] text-white"
                : "cursor-default bg-[#e5e5e0] text-[#a0a09b]"
            }`}
          >
            {submitting ? "Saving…" : "Confirm and Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
