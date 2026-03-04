"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { onboardingQuestions } from "@/lib/questions";
import type { Question } from "@/lib/questions/types";

// ============================================================================
// Design tokens from Figma (same as check-in)
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

// ============================================================================
// Main page
// ============================================================================
export default function OnboardingPage() {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Determine user mode from first question answer
  const isCaregiver = answers["user_type"] === "caregiver";

  // Filter questions based on prerequisites and caregiver mode
  const visibleQuestions = onboardingQuestions.filter((q) => {
    // Skip questions where caregiverText is null and user is a caregiver
    if (isCaregiver && q.caregiverText === null) return false;

    // Check prerequisites
    if (q.prerequisites && q.prerequisites.length > 0) {
      return q.prerequisites.every((prereq) => {
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

    return true;
  });

  const currentQuestion = visibleQuestions[currentIndex];
  const totalQuestions = visibleQuestions.length;
  const currentValue = currentQuestion ? answers[currentQuestion.id] : undefined;
  const isRequired = currentQuestion?.validation?.required === true;
  const hasAnswer = !isRequired || (currentValue !== undefined && currentValue !== "" && currentValue !== null);

  const progressPct = useMemo(
    () => (totalQuestions > 0 ? (currentIndex / totalQuestions) * 100 : 0),
    [currentIndex]
  );

  const setAnswer = (question: Question, value: any) => {
    setAnswers((prev) => {
      const updated = { ...prev, [question.id]: value };

      // If this question maps to multiple fields via customMapping,
      // also store the mapped field values so prerequisites can reference them
      if (question.businessLogic?.mapToMultipleFields && question.businessLogic.customMapping) {
        const mapped = question.businessLogic.customMapping(value);
        // Object.assign intentionally overwrites existing keys in `updated`.
        // This is load-bearing: some customMappings (e.g. caregiver_availability)
        // write back to fields owned by earlier questions (e.g. has_caregiver) in
        // order to keep logically dependent columns consistent. Do not change this
        // to a non-overwriting merge or the has_caregiver correction in
        // caregiver_availability's customMapping will stop working silently.
        Object.assign(updated, mapped);

        // Only re-store the raw UI value under question.id if the customMapping
        // did NOT already write a clean value for that key. Unconditionally writing
        // updated[question.id] = value would overwrite null-sentinel mappings with
        // the raw string 'none', which crashes Postgres INTEGER columns.
        // Questions where question.id is not a mapped key still need this line to
        // preserve the raw selection for UI state (selected option highlighting).
        if (!Object.prototype.hasOwnProperty.call(mapped, question.id)) {
          updated[question.id] = value;
        }
      }

      // For simple single-field schema mappings, also store by schemaField name
      // so prerequisites like { field: 'has_bp_cuff' } work against the answer
      if (typeof question.schemaField === "string" && question.id !== question.schemaField) {
        updated[question.schemaField] = value;
      }

      return updated;
    });
  };

  const handleContinue = async () => {
    if (!hasAnswer) return;
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Last question — submit to API
      setSubmitting(true);
      setSubmitError(null);
      try {
        const res = await fetch("/api/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(answers),
        });
        if (res.ok) {
          setFinished(true);
          setTimeout(() => router.push("/dashboard"), 1500);
        } else {
          const data = await res.json();
          setSubmitError(data.error ?? "Failed to save onboarding data.");
          setSubmitting(false);
        }
      } catch (err: any) {
        setSubmitError(err.message ?? "Network error. Please try again.");
        setSubmitting(false);
      }
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleRestart = () => {
    setFinished(false);
    setCurrentIndex(0);
    setAnswers({});
  };

  // ----- Completion screen -----
  if (finished) {
    return (
      <div className={`${colors.bg} flex min-h-dvh flex-col items-center justify-between px-4 pb-20 pt-2.5`}>
        <div className="flex w-full max-w-[430px] flex-col gap-6">
          <div className="flex flex-col items-end">
            <button
              onClick={handleRestart}
              className="cursor-pointer rounded-[9px] bg-[#f4f4f4] px-3 py-[7px] text-xs font-medium text-black"
            >
              Restart
            </button>
          </div>

          {/* Full progress bar */}
          <div className="flex w-full flex-col gap-4">
            <div className={`flex w-full items-center rounded-full ${colors.trackBg}`}>
              <div className={`h-1.5 rounded-full ${colors.trackFill}`} style={{ width: "100%" }} />
            </div>
            <h1 className="text-[26px] font-semibold leading-normal text-black">
              Onboarding Complete 🎉
            </h1>
            <p className="text-sm text-black/60">Your profile has been set up. You&apos;re ready to start tracking your health.</p>
          </div>
        </div>

        <button
          onClick={handleRestart}
          className={`${colors.primaryBg} flex h-[50px] w-full max-w-[430px] cursor-pointer items-center justify-center rounded-[14px] px-6 py-[5px] text-lg font-semibold text-white`}
        >
          Start Over
        </button>
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

  const questionText = isCaregiver
    ? currentQuestion.caregiverText || currentQuestion.patientText
    : currentQuestion.patientText;

  const helpText = isCaregiver
    ? currentQuestion.caregiverHelpText || currentQuestion.helpText
    : currentQuestion.helpText;

  // ----- Main question screen -----
  return (
    <div className={`${colors.bg} flex min-h-dvh flex-col items-center justify-between px-4 pb-20 pt-2.5`}>
      {/* ---- Top: restart, progress, question, options ---- */}
      <div className="flex w-full max-w-[430px] flex-col gap-6">
        {/* Top bar: back button + restart */}
        <div className="flex items-center justify-between">
          {currentIndex > 0 ? (
            <button
              onClick={handleBack}
              className="cursor-pointer rounded-[9px] bg-[#f4f4f4] px-3 py-[7px] text-xs font-medium text-black"
            >
              ← Back
            </button>
          ) : (
            <div />
          )}
          <button
            onClick={handleRestart}
            className="cursor-pointer rounded-[9px] bg-[#f4f4f4] px-3 py-[7px] text-xs font-medium text-black"
          >
            Restart
          </button>
        </div>

        {/* Progress bar + question text */}
        <div className="flex w-full flex-col gap-4">
          <div className={`flex w-full items-center rounded-full ${colors.trackBg}`}>
            <div
              className={`h-1.5 rounded-l-full ${colors.trackFill} transition-all duration-300 ease-out`}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <h2 className="text-[26px] font-semibold leading-normal text-black">
            {questionText}
          </h2>

          {helpText && (
            <p className="text-sm leading-relaxed text-black/50">{helpText}</p>
          )}
        </div>

        {/* Answer options */}
        <QuestionInput
          question={currentQuestion}
          value={currentValue}
          onChange={(value) => setAnswer(currentQuestion, value)}
        />
      </div>

      {/* ---- Bottom: error + continue button ---- */}
      <div className="flex w-full max-w-[430px] flex-col gap-2 pt-6">
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
          {submitting
            ? "Saving..."
            : currentIndex === totalQuestions - 1
              ? "Finish"
              : "Continue"}
        </button>
      </div>
    </div>
  );
}


function OptionButton({
  label,
  selected,
  onClick,
  emoji,
  description,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  emoji?: string;
  description?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center justify-center rounded-[14px] transition-colors duration-150 ${
        selected
          ? "bg-[#dcf5f0]"
          : "bg-[#f4f4f4]"
      }`}
    >
      <div
        className={`flex min-h-[50px] flex-1 items-center justify-center rounded-[14px] px-[19px] py-[13px] ${
          selected ? "border border-solid border-[#186346]" : ""
        }`}
      >
        <span className="text-center text-lg leading-snug text-black">
          {emoji && <span className="mr-2">{emoji}</span>}
          {label}
        </span>
      </div>
    </button>
  );
}


function AutocompleteInput({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: any;
  onChange: (value: any) => void;
}) {
  const [search, setSearch] = useState("");
  const selectedItems: any[] = Array.isArray(value) ? value : [];
  const filteredOptions = question.options?.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex w-full flex-col gap-3">
      <input
        type="text"
        placeholder="Search..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-[50px] w-full rounded-[14px] bg-[#f4f4f4] px-5 py-3 text-lg text-black outline-none placeholder:text-[#a0a09b] focus:ring-2 focus:ring-[#186346]"
      />
      <div className="flex max-h-[300px] w-full flex-col gap-2 overflow-y-auto">
        {filteredOptions?.map((option) => {
          const isChecked = selectedItems.includes(option.value);
          return (
            <OptionButton
              key={String(option.value)}
              label={option.label}
              selected={isChecked}
              onClick={() => {
                if (option.value === "none") {
                  onChange(isChecked ? [] : ["none"]);
                } else {
                  const withoutNone = selectedItems.filter((v) => v !== "none");
                  onChange(
                    isChecked
                      ? withoutNone.filter((v) => v !== option.value)
                      : [...withoutNone, option.value]
                  );
                }
              }}
            />
          );
        })}
      </div>
      {selectedItems.length > 0 && selectedItems[0] !== "none" && (
        <p className="text-sm text-black/50">
          Selected: {selectedItems.join(", ")}
        </p>
      )}
    </div>
  );
}

function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: any;
  onChange: (value: any) => void;
}) {
  switch (question.type) {
    // ---- Boolean (Yes / No) ----
    case "boolean":
      return (
        <div className="flex w-full flex-col gap-4">
          <OptionButton label="Yes" selected={value === true} onClick={() => onChange(true)} />
          <OptionButton label="No" selected={value === false} onClick={() => onChange(false)} />
        </div>
      );

    // ---- Single select ----
    case "single_select":
      return (
        <div className="flex w-full flex-col gap-4">
          {question.options?.map((option) => (
            <OptionButton
              key={String(option.value)}
              label={option.label}
              emoji={option.iconEmoji}
              description={option.description}
              selected={value === option.value}
              onClick={() => onChange(option.value)}
            />
          ))}
        </div>
      );

    // ---- Multi select ----
    case "multi_select": {
      const selected: any[] = Array.isArray(value) ? value : [];
      return (
        <div className="flex w-full flex-col gap-4">
          {question.options?.map((option) => {
            const isChecked = selected.includes(option.value);
            return (
              <OptionButton
                key={String(option.value)}
                label={`${option.iconEmoji ? option.iconEmoji + " " : ""}${option.label}`}
                selected={isChecked}
                onClick={() => {
                  if (option.value === "none") {
                    onChange(isChecked ? [] : ["none"]);
                  } else {
                    const withoutNone = selected.filter((v) => v !== "none");
                    onChange(
                      isChecked
                        ? withoutNone.filter((v) => v !== option.value)
                        : [...withoutNone, option.value]
                    );
                  }
                }}
              />
            );
          })}
        </div>
      );
    }

    // ---- Text ----
    case "text":
      return (
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder}
          className="h-[50px] w-full rounded-[14px] bg-[#f4f4f4] px-5 py-3 text-lg text-black outline-none placeholder:text-[#a0a09b] focus:ring-2 focus:ring-[#186346]"
        />
      );

    // ---- Textarea ----
    case "textarea":
      return (
        <textarea
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder}
          rows={4}
          className="w-full rounded-[14px] bg-[#f4f4f4] px-5 py-4 text-lg text-black outline-none placeholder:text-[#a0a09b] focus:ring-2 focus:ring-[#186346]"
        />
      );

    // ---- Date ----
    case "date":
      return (
        <input
          type="date"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="h-[50px] w-full rounded-[14px] bg-[#f4f4f4] px-5 py-3 text-lg text-black outline-none focus:ring-2 focus:ring-[#186346]"
        />
      );

    // ---- Integer ----
    case "integer":
      return (
        <div className="flex w-full items-center gap-3">
          <input
            type="number"
            inputMode="numeric"
            value={value ?? ""}
            onChange={(e) =>
              onChange(e.target.value === "" ? undefined : parseInt(e.target.value))
            }
            placeholder={question.placeholder}
            min={question.validation?.min}
            max={question.validation?.max}
            step={1}
            className="h-[50px] flex-1 rounded-[14px] bg-[#f4f4f4] px-5 py-3 text-lg text-black outline-none placeholder:text-[#a0a09b] focus:ring-2 focus:ring-[#186346]"
          />
          {question.unit && (
            <span className="shrink-0 text-base font-medium text-black/60">{question.unit}</span>
          )}
        </div>
      );

    // ---- Float ----
    case "float":
      return (
        <div className="flex w-full items-center gap-3">
          <input
            type="number"
            inputMode="decimal"
            value={value ?? ""}
            onChange={(e) =>
              onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))
            }
            placeholder={question.placeholder}
            min={question.validation?.min}
            max={question.validation?.max}
            step={0.1}
            className="h-[50px] flex-1 rounded-[14px] bg-[#f4f4f4] px-5 py-3 text-lg text-black outline-none placeholder:text-[#a0a09b] focus:ring-2 focus:ring-[#186346]"
          />
          {question.unit && (
            <span className="shrink-0 text-base font-medium text-black/60">{question.unit}</span>
          )}
        </div>
      );

    // ---- Scale (e.g. pain 0-10, overall feeling 1-5) ----
    case "scale": {
      const min = question.validation?.min ?? 0;
      const max = question.validation?.max ?? 10;
      const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i);
      return (
        <div className="flex w-full flex-col gap-3">
          <div className="flex w-full flex-wrap justify-center gap-2">
            {steps.map((step) => (
              <button
                key={step}
                onClick={() => onChange(step)}
                className={`flex h-12 w-12 cursor-pointer items-center justify-center rounded-full text-lg font-medium transition-colors duration-150 ${
                  value === step
                    ? "border border-solid border-[#186346] bg-[#dcf5f0] text-black"
                    : "bg-[#f4f4f4] text-black"
                }`}
              >
                {step}
              </button>
            ))}
          </div>
          <div className="flex justify-between px-1 text-xs text-black/40">
            <span>{min}</span>
            <span>{max}</span>
          </div>
        </div>
      );
    }

    // ---- Autocomplete (searchable checkbox list) ----
    case "autocomplete":
      return (
        <AutocompleteInput
          question={question}
          value={value}
          onChange={onChange}
        />
      );

    default:
      return <p className="text-sm text-[#a0a09b]">Unsupported question type: {question.type}</p>;
  }
}
