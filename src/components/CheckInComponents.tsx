"use client";

import type { Question } from "@/lib/questions/types";

// ============================================================================
// Pure helper — evaluate a business-logic trigger condition
// ============================================================================
export function evaluateTrigger(operator: string, triggerValue: any, answer: any): boolean {
  switch (operator) {
    case '==':  return answer === triggerValue;
    case '!=':  return answer !== triggerValue;
    case '>':   return answer > triggerValue;
    case '<':   return answer < triggerValue;
    case '>=':  return answer >= triggerValue;
    case '<=':  return answer <= triggerValue;
    default:    return false;
  }
}

// ============================================================================
// Shared option-button component
// ============================================================================
export function OptionButton({
  label, selected, onClick, emoji,
}: {
  label: string; selected: boolean; onClick: () => void; emoji?: string; description?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center justify-center rounded-[14px] transition-colors duration-150 ${selected ? "bg-[#dcf5f0]" : "bg-[#f4f4f4]"}`}
    >
      <div className={`flex min-h-[50px] flex-1 items-center justify-center rounded-[14px] px-[19px] py-[13px] ${selected ? "border border-solid border-[#186346]" : ""}`}>
        <span className="text-center text-lg leading-snug text-black">
          {emoji && <span className="mr-2">{emoji}</span>}
          {label}
        </span>
      </div>
    </button>
  );
}

// ============================================================================
// Smiley face config for overall_feeling scale (matches Figma designs)
// ============================================================================
export const FEELING_FACES = {
  5: { label: "Super", color: "#4cbe71", activeImg: "/images/faces/super_active.svg", disabledImg: "/images/faces/super_disabled.svg" },
  4: { label: "Good", color: "#a7cf5c", activeImg: "/images/faces/good_active.svg", disabledImg: "/images/faces/good_disabled.svg" },
  3: { label: "Okay", color: "#ffde45", activeImg: "/images/faces/okay_active.svg", disabledImg: "/images/faces/okay_disabled.svg" },
  2: { label: "Bad", color: "#ef8f39", activeImg: "/images/faces/bad_active.svg", disabledImg: "/images/faces/bad_disabled.svg" },
  1: { label: "Awful", color: "#f2333a", activeImg: "/images/faces/awful_active.svg", disabledImg: "/images/faces/awful_disabled.svg" },
} as const;

// ============================================================================
// Pain level colors (1–10 green-to-red gradient)
// ============================================================================
const PAIN_COLORS: Record<number, string> = {
  1: "#4cb46c",
  2: "#6bb34e",
  3: "#8ab230",
  4: "#acca28",
  5: "#c9b120",
  6: "#e69818",
  7: "#f08721",
  8: "#e8661a",
  9: "#d94313",
  10: "#dd0033",
};

// ============================================================================
// Smiley face selector for overall_feeling (1-5 scale)
// ============================================================================
function FeelingFaceSelector({ value, onChange }: { value: any; onChange: (v: number) => void }) {
  return (
    <div className="flex w-full justify-center gap-3">
      {([5, 4, 3, 2, 1] as const).map((level) => {
        const config = FEELING_FACES[level];
        const isSelected = value === level;
        return (
          <button
            key={level}
            onClick={() => onChange(level)}
            className="flex cursor-pointer flex-col items-center gap-[11px]"
          >
            <div
              className="relative h-[56px] w-[56px] transition-all duration-150"
              style={{ transform: isSelected ? "scale(1.1)" : "scale(1)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={isSelected ? config.activeImg : config.disabledImg}
                alt={config.label}
                className="block h-full w-full"
                draggable={false}
              />
            </div>
            <span
              className="text-xs font-medium"
              style={{ color: isSelected ? config.color : "#737a82" }}
            >
              {config.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// Pain scale grid (1–10 with color-coded buttons, "No pain" next to 1)
// ============================================================================
function PainScaleInput({ value, onChange }: { value: any; onChange: (v: number) => void }) {
  return (
    <div className="flex w-full flex-col gap-2">
      {/* "No pain" label above grid, left-aligned */}
      <div className="flex justify-start px-1">
        <span className="text-xs text-black/40">No pain</span>
      </div>
      {/* Row 1: 1-5 */}
      <div className="flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className="flex h-[50px] w-[50px] cursor-pointer items-center justify-center rounded-[10px] text-base font-semibold transition-all duration-150"
            style={{
              backgroundColor: value === n ? PAIN_COLORS[n] : `${PAIN_COLORS[n]}30`,
              border: `2px solid ${PAIN_COLORS[n]}`,
              color: value === n ? "white" : PAIN_COLORS[n],
            }}
          >
            {n}
          </button>
        ))}
      </div>
      {/* Row 2: 6-10 */}
      <div className="flex justify-center gap-2">
        {[6, 7, 8, 9, 10].map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className="flex h-[50px] w-[50px] cursor-pointer items-center justify-center rounded-[10px] text-base font-semibold transition-all duration-150"
            style={{
              backgroundColor: value === n ? PAIN_COLORS[n] : `${PAIN_COLORS[n]}30`,
              border: `2px solid ${PAIN_COLORS[n]}`,
              color: value === n ? "white" : PAIN_COLORS[n],
            }}
          >
            {n}
          </button>
        ))}
      </div>
      {/* "Worst pain" label below grid, right-aligned */}
      <div className="flex justify-end px-1">
        <span className="text-xs text-black/40">Worst pain</span>
      </div>
    </div>
  );
}

// ============================================================================
// Question input renderer
// ============================================================================
export function QuestionInput({ question, value, onChange }: { question: Question; value: any; onChange: (value: any) => void; }) {
  switch (question.type) {
    case "boolean":
      return (
        <div className="flex w-full flex-col gap-4">
          <OptionButton label="Yes" selected={value === true} onClick={() => onChange(true)} />
          <OptionButton label="No" selected={value === false} onClick={() => onChange(false)} />
        </div>
      );
    case "single_select":
      return (
        <div className="flex w-full flex-col gap-4">
          {question.options?.map((option) => (
            <OptionButton key={String(option.value)} label={option.label} emoji={option.iconEmoji} description={option.description} selected={value === option.value} onClick={() => onChange(option.value)} />
          ))}
        </div>
      );
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
                  if (option.value === "none") { onChange(isChecked ? [] : ["none"]); }
                  else {
                    const withoutNone = selected.filter((v) => v !== "none");
                    onChange(isChecked ? withoutNone.filter((v) => v !== option.value) : [...withoutNone, option.value]);
                  }
                }}
              />
            );
          })}
        </div>
      );
    }
    case "text":
      return <input type="text" value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={question.placeholder} className="h-[50px] w-full rounded-[14px] bg-[#f4f4f4] px-5 py-3 text-lg text-black outline-none placeholder:text-[#a0a09b] focus:ring-2 focus:ring-[#186346]" />;
    case "textarea":
      return <textarea value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={question.placeholder} rows={4} className="w-full rounded-[14px] bg-[#f4f4f4] px-5 py-4 text-lg text-black outline-none placeholder:text-[#a0a09b] focus:ring-2 focus:ring-[#186346]" />;
    case "integer":
      return (
        <div className="flex w-full items-center gap-3">
          <input type="number" inputMode="numeric" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? undefined : parseInt(e.target.value))} placeholder={question.placeholder} min={question.validation?.min} max={question.validation?.max} step={1} className="h-[50px] flex-1 rounded-[14px] bg-[#f4f4f4] px-5 py-3 text-lg text-black outline-none placeholder:text-[#a0a09b] focus:ring-2 focus:ring-[#186346]" />
          {question.unit && <span className="shrink-0 text-base font-medium text-black/60">{question.unit}</span>}
        </div>
      );
    case "float":
      return (
        <div className="flex w-full items-center gap-3">
          <input type="number" inputMode="decimal" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? undefined : parseFloat(e.target.value))} placeholder={question.placeholder} min={question.validation?.min} max={question.validation?.max} step={0.1} className="h-[50px] flex-1 rounded-[14px] bg-[#f4f4f4] px-5 py-3 text-lg text-black outline-none placeholder:text-[#a0a09b] focus:ring-2 focus:ring-[#186346]" />
          {question.unit && <span className="shrink-0 text-base font-medium text-black/60">{question.unit}</span>}
        </div>
      );
    case "scale": {
      if (question.id === "overall_feeling") {
        return <FeelingFaceSelector value={value} onChange={onChange} />;
      }
      if (question.id === "pain_level") {
        return <PainScaleInput value={value} onChange={onChange} />;
      }
      const min = question.validation?.min ?? 0;
      const max = question.validation?.max ?? 10;
      const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i);
      return (
        <div className="flex w-full flex-col gap-3">
          <div className="flex w-full flex-wrap justify-center gap-2">
            {steps.map((step) => (
              <button key={step} onClick={() => onChange(step)} className={`flex h-12 w-12 cursor-pointer items-center justify-center rounded-full text-lg font-medium transition-colors duration-150 ${value === step ? "border border-solid border-[#186346] bg-[#dcf5f0] text-black" : "bg-[#f4f4f4] text-black"}`}>
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
