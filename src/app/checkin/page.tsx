"use client";

import { useState, useMemo } from "react";
import { dailyCheckInQuestions } from "@/lib/questions";
import type { Question, QuestionOption } from "@/lib/questions/types";

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

// ============================================================================
// Main page
// ============================================================================
export default function CheckInPage() {
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [finished, setFinished] = useState(false);

  // Filter questions based on prerequisites (only evaluate 'current' source)
  const visibleQuestions = dailyCheckInQuestions.filter((q) => {
    if (q.prerequisites && q.prerequisites.length > 0) {
      return q.prerequisites.every((prereq) => {
        if (prereq.source === "onboarding") return true;

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

  // Progress only recalculates when currentIndex changes (on Continue click),
  // NOT when totalQuestions changes from answer selection affecting prerequisites.
    const progressPct = useMemo(
      () => (totalQuestions > 0 ? (currentIndex / totalQuestions) * 100 : 0),
      [currentIndex]
    );

  const setAnswer = (question: Question, value: any) => {
    setAnswers((prev) => {
      const updated = { ...prev, [question.id]: value };

      if (question.businessLogic?.mapToMultipleFields && question.businessLogic.customMapping) {
        const mapped = question.businessLogic.customMapping(value);
        Object.assign(updated, mapped);
        updated[question.id] = value;
      }

      if (typeof question.schemaField === "string" && question.id !== question.schemaField) {
        updated[question.schemaField] = value;
      }

      return updated;
    });
  };

  const handleContinue = () => {
    if (!hasAnswer) return;
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setFinished(true);
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
              Restart chat
            </button>
          </div>

          {/* Full progress bar */}
          <div className="flex w-full flex-col gap-4">
            <div className={`flex w-full items-center rounded-full ${colors.trackBg}`}>
              <div className={`h-1.5 rounded-full ${colors.trackFill}`} style={{ width: "100%" }} />
            </div>
            <h1 className="text-[26px] font-semibold leading-normal text-black">
              Daily Check-In Complete 🎉
            </h1>
            <p className="text-sm text-black/60">Your responses have been recorded. Thank you for checking in today.</p>
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

  const questionText = currentQuestion.patientText;
  const helpText = currentQuestion.helpText;

  // ----- Main question screen -----
  return (
    <div className={`${colors.bg} flex min-h-dvh flex-col items-center justify-between px-4 pb-20 pt-2.5`}>
      {/* ---- Top: restart, progress, question, options ---- */}
      <div className="flex w-full max-w-[430px] flex-col gap-6">
        {/* Restart button */}
        <div className="flex flex-col items-end">
          <button
            onClick={handleRestart}
            className="cursor-pointer rounded-[9px] bg-[#f4f4f4] px-3 py-[7px] text-xs font-medium text-black"
          >
            Restart chat
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

      {/* ---- Bottom: continue button ---- */}
      <button
        onClick={handleContinue}
        disabled={!hasAnswer}
        className={`flex h-[50px] w-full max-w-[430px] cursor-pointer items-center justify-center rounded-[14px] px-6 py-[5px] text-lg font-semibold transition-colors duration-200 ${
          hasAnswer
            ? `${colors.primaryBg} text-white`
            : `${colors.disabledBg} ${colors.disabledText} cursor-default`
        }`}
      >
        {currentIndex === totalQuestions - 1 ? "Finish" : "Continue"}
      </button>
    </div>
  );
}

// ============================================================================
// Shared option‑button component (matches Figma "Button: Option")
// ============================================================================
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
        className={`flex h-[50px] flex-1 items-center justify-center overflow-hidden rounded-[14px] px-[19px] py-[13px] ${
          selected ? "border border-solid border-[#186346]" : ""
        }`}
      >
        <span className="text-center text-lg text-black">
          {emoji && <span className="mr-2">{emoji}</span>}
          {label}
        </span>
      </div>
    </button>
  );
}

// ============================================================================
// Question input renderer – styled per Figma
// ============================================================================
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

    default:
      return <p className="text-sm text-[#a0a09b]">Unsupported question type: {question.type}</p>;
  }
}
