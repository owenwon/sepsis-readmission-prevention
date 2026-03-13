"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useCaregiver } from "@/lib/CaregiverContext";
import { onboardingQuestions, getOnboardingQuestion } from "@/lib/questions/onboarding";
import { QuestionInput } from "@/components/CheckInComponents";
import HelpTooltip from "@/components/HelpTooltip";
import type { Question } from "@/lib/questions/types";

// ============================================================================
// Design tokens
// ============================================================================
const colors = {
  bg: "#fdfbf5",
  primary: "#186346",
  selectedBg: "#dcf5f0",
  disabledBg: "#e5e5e0",
  disabledText: "#a0a09b",
};

const EMPTY_MULTI_SELECT_VALUES: string[] = [];

// ============================================================================
// Types
// ============================================================================

type PatientProfile = Record<string, any>;

// ============================================================================
// Helper: Debounce hook
// ============================================================================
function useDebouncedCallback(
  callback: (...args: any[]) => void,
  delay: number,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedFn = useCallback(
    (...args: any[]) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return debouncedFn;
}

// ============================================================================
// Info icon component (ⓘ accordion)
// ============================================================================
function InfoAccordion({
  patientInfo,
  caregiverInfo,
  isCaregiver,
}: {
  patientInfo?: string;
  caregiverInfo?: string;
  isCaregiver: boolean;
}) {
  const [open, setOpen] = useState(false);
  const info = isCaregiver ? (caregiverInfo ?? patientInfo) : patientInfo;
  if (!info) return null;

  return (
    <span className="inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="ml-1.5 inline-flex size-5 cursor-pointer items-center justify-center rounded-full border border-[#186346]/30 text-xs font-semibold text-[#186346] transition-colors hover:bg-[#186346]/10"
        aria-label="More info"
      >
        i
      </button>
      {open && (
        <span className="mt-1 block w-full text-sm leading-relaxed text-black/50">
          {info}
        </span>
      )}
    </span>
  );
}

// ============================================================================
// Save status indicator
// ============================================================================
function SaveIndicator({
  status,
  error,
}: {
  status: "idle" | "saving" | "saved" | "error";
  error?: string;
}) {
  if (status === "saving") {
    return (
      <span className="ml-2 inline-flex items-center text-xs text-black/40">
        Saving…
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="ml-2 inline-flex items-center text-xs font-medium text-[#186346] animate-pulse">
        ✓
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="ml-2 inline-flex items-center text-xs text-red-600">
        {error || "Save failed"}
      </span>
    );
  }
  return null;
}

// ============================================================================
// Section header
// ============================================================================
function SectionHeader({
  title,
  patientDescription,
  caregiverDescription,
  isCaregiver,
}: {
  title: string;
  patientDescription?: string;
  caregiverDescription?: string;
  isCaregiver: boolean;
}) {
  const desc = isCaregiver
    ? (caregiverDescription ?? patientDescription)
    : patientDescription;

  return (
    <div className="mb-4 mt-8 first-of-type:mt-2">
      <h2 className="text-xl font-semibold text-black">{title}</h2>
      {desc && (
        <p className="mt-1 text-sm leading-relaxed text-black/50">{desc}</p>
      )}
    </div>
  );
}

// ============================================================================
// Setting field wrapper
// ============================================================================
function SettingField({
  label,
  patientInfo,
  caregiverInfo,
  isCaregiver,
  saveStatus,
  saveError,
  helperText,
  children,
}: {
  label: string;
  patientInfo?: string;
  caregiverInfo?: string;
  isCaregiver: boolean;
  saveStatus?: "idle" | "saving" | "saved" | "error";
  saveError?: string;
  helperText?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-4">
      <div className="mb-2 flex items-start flex-wrap gap-y-1">
        <span className="text-base font-medium text-black">
          {label}
          <HelpTooltip
            helpText={patientInfo}
            caregiverHelpText={caregiverInfo}
          />
        </span>
        {saveStatus && (
          <SaveIndicator status={saveStatus} error={saveError} />
        )}
      </div>
      {helperText && (
        <p className="mb-2 text-sm text-black/40">{helperText}</p>
      )}
      {children}
    </div>
  );
}

// ============================================================================
// Toggle component
// ============================================================================
function Toggle({
  checked,
  onChange,
  labelOn = "Yes",
  labelOff = "No",
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  labelOn?: string;
  labelOff?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative flex h-[40px] w-[160px] cursor-pointer items-center rounded-full transition-colors duration-200 ${
        checked ? "bg-[#186346]" : "bg-[#d9d9d9]"
      }`}
    >
      <span
        className={`absolute transition-all duration-200 ${
          checked ? "left-2 text-white" : "left-2 text-black/50"
        } text-xs font-medium`}
      >
        {labelOn}
      </span>
      <span
        className={`absolute transition-all duration-200 ${
          checked ? "right-2 text-white/50" : "right-2 text-black/50"
        } text-xs font-medium`}
      >
        {labelOff}
      </span>
      <div
        className={`absolute size-[32px] rounded-full bg-white shadow transition-all duration-200 ${
          checked ? "left-[124px]" : "left-[4px]"
        }`}
      />
    </button>
  );
}

// ============================================================================
// Patient/Caregiver toggle
// ============================================================================
function UserTypeToggle({
  isCaregiver,
  onChange,
}: {
  isCaregiver: boolean;
  onChange: (isCaregiver: boolean) => void;
}) {
  return (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`flex h-[50px] flex-1 cursor-pointer items-center justify-center rounded-[14px] text-base font-medium transition-colors duration-150 ${
          !isCaregiver
            ? "border border-solid border-[#186346] bg-[#dcf5f0] text-black"
            : "bg-[#f4f4f4] text-black"
        }`}
      >
        Patient
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`flex h-[50px] flex-1 cursor-pointer items-center justify-center rounded-[14px] text-base font-medium transition-colors duration-150 ${
          isCaregiver
            ? "border border-solid border-[#186346] bg-[#dcf5f0] text-black"
            : "bg-[#f4f4f4] text-black"
        }`}
      >
        Caregiver
      </button>
    </div>
  );
}

// ============================================================================
// Main Settings Page
// ============================================================================
export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const { isCaregiver, setIsCaregiver } = useCaregiver();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [saveStatuses, setSaveStatuses] = useState<
    Record<string, { status: "idle" | "saving" | "saved" | "error"; error?: string }>
  >({});

  // Multi-select dirty tracking
  const [conditionsChanged, setConditionsChanged] = useState(false);
  const [medsChanged, setMedsChanged] = useState(false);
  const [conditionsSaving, setConditionsSaving] = useState(false);
  const [medsSaving, setMedsSaving] = useState(false);

  // Reference questions from onboarding.ts
  const admittedCountQuestion = getOnboardingQuestion("admitted_count")!;
  const chronicConditionsQuestion = getOnboardingQuestion("chronic_conditions")!;
  const medicationsQuestion = getOnboardingQuestion("current_medications")!;
  const caregiverAvailabilityQuestion = getOnboardingQuestion("caregiver_availability")!;
  const socialSupportQuestion = getOnboardingQuestion("social_support")!;
  const physicalAbilityQuestion = getOnboardingQuestion("physical_ability")!;

  // Snapshot for multi-selects
  const [initialConditions, setInitialConditions] = useState<string[]>([]);

  // ---- Load profile on mount ----
  useEffect(() => {
    async function load() {
      try {
        const {
          data: { user },
          error: authErr,
        } = await supabase.auth.getUser();
        if (authErr || !user) {
          router.push("/login");
          return;
        }

        const { data, error } = await supabase
          .from("patients")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (error || !data) {
          router.push("/onboarding");
          return;
        }

        setProfile(data);
        setIsCaregiver(data.is_caregiver ?? false);

        // Reverse-map conditions booleans to option values
        const conds = reverseMapConditions(data);
        setInitialConditions(conds);
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Save helper: POST partial update to /api/onboarding ----
  const saveFields = useCallback(
    async (fields: Record<string, any>, fieldKey: string) => {
      setSaveStatuses((prev) => ({
        ...prev,
        [fieldKey]: { status: "saving" },
      }));

      try {
        const res = await fetch("/api/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fields),
        });

        const data = await res.json().catch(() => ({}));

        if (res.ok) {
          setSaveStatuses((prev) => ({
            ...prev,
            [fieldKey]: { status: "saved" },
          }));
          // Clear saved indicator after 2 seconds
          setTimeout(() => {
            setSaveStatuses((prev) => ({
              ...prev,
              [fieldKey]: { status: "idle" },
            }));
          }, 2000);
          // Update local profile
          setProfile((prev) =>
            prev
              ? {
                  ...prev,
                  ...fields,
                  ...(data.updated_at
                    ? { updated_at: data.updated_at }
                    : {}),
                }
              : prev,
          );
          return true;
        } else {
          setSaveStatuses((prev) => ({
            ...prev,
            [fieldKey]: { status: "error", error: data.error ?? "Save failed" },
          }));
          return false;
        }
      } catch {
        setSaveStatuses((prev) => ({
          ...prev,
          [fieldKey]: { status: "error", error: "Network error" },
        }));
        return false;
      }
    },
    [],
  );

  // Debounced auto-save
  const debouncedSave = useDebouncedCallback(
    (fields: Record<string, any>, fieldKey: string) => {
      saveFields(fields, fieldKey);
    },
    600,
  );

  // ---- Field change helpers ----
  const handleSimpleFieldChange = (
    fieldKey: string,
    value: any,
    extraFields?: Record<string, any>,
  ) => {
    const fields = { [fieldKey]: value, ...extraFields };
    setProfile((prev) => (prev ? { ...prev, ...fields } : prev));
    debouncedSave(fields, fieldKey);
  };

  const handleImmediateFieldChange = (
    fieldKey: string,
    value: any,
    extraFields?: Record<string, any>,
  ) => {
    const fields = { [fieldKey]: value, ...extraFields };
    setProfile((prev) => (prev ? { ...prev, ...fields } : prev));
    saveFields(fields, fieldKey);
  };

  // ---- Reverse-map chronic conditions ----
  function reverseMapConditions(data: PatientProfile): string[] {
    const conditions: string[] = [];
    if (data.has_heart_failure) conditions.push("congestive_heart_failure");
    if (data.has_lung_condition) conditions.push("copd");
    if (data.has_weakened_immune) conditions.push("weakened_immune");
    return conditions;
  }

  // ---- Reverse-map social support ----
  function reverseMapSocialSupport(value: boolean | null): string {
    if (value === true) return "daily";
    return "none";
  }


  // ==================================================================
  // Loading skeleton
  // ==================================================================
  if (loading || !profile) {
    return (
      <div
        className="flex min-h-dvh flex-col font-[family-name:var(--font-poppins)]"
        style={{ backgroundColor: colors.bg }}
      >
        <div className="sticky top-0 z-10 px-4 pb-3 pt-2.5" style={{ backgroundColor: colors.bg }}>
          <div className="mx-auto flex w-full max-w-[430px] items-center gap-3">
            <div className="size-10" />
            <div className="h-7 w-32 animate-pulse rounded bg-black/10" />
          </div>
        </div>
        <div className="flex-1 px-4">
          <div className="mx-auto w-full max-w-[430px]">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="py-4">
                <div className="mb-2 h-5 w-40 animate-pulse rounded bg-black/10" />
                <div className="h-12 w-full animate-pulse rounded-[14px] bg-black/5" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const getStatus = (key: string) =>
    saveStatuses[key] ?? { status: "idle" as const };

  // ==================================================================
  // Render
  // ==================================================================
  return (
    <div
      className="flex min-h-dvh flex-col font-[family-name:var(--font-poppins)]"
      style={{ backgroundColor: colors.bg }}
    >
      {/* ---- Sticky header ---- */}
      <div
        className="sticky top-0 z-10 px-4 pb-3 pt-2.5"
        style={{ backgroundColor: colors.bg }}
      >
        <div className="mx-auto flex w-full max-w-[430px] items-center gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex size-10 cursor-pointer items-center justify-center"
            aria-label="Go back"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M15 18l-6-6 6-6"
                stroke="black"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <h1 className="flex-1 text-[22px] font-semibold text-black">
            Settings
          </h1>
        </div>
      </div>

      {/* ---- Content ---- */}
      <div className="flex-1 overflow-y-auto px-4 pb-20">
        <div className="mx-auto w-full max-w-[430px]">
          <p className="text-xs text-black/30">
            Last updated: {new Date(profile.updated_at).toLocaleDateString()}
          </p>

          {/* ================================================================
              SECTION 1: Account
              ================================================================ */}
          <SectionHeader title="Account" isCaregiver={isCaregiver} />

          {/* 1a: User type toggle */}
          <SettingField
            label={isCaregiver ? "I am a" : "I am a"}
            patientInfo="Switching modes changes how check-in questions are phrased. Your health data stays the same."
            caregiverInfo="Switching modes changes how check-in questions are phrased. The patient's health data stays the same."
            isCaregiver={isCaregiver}
            saveStatus={getStatus("is_patient").status}
            saveError={getStatus("is_patient").error}
          >
            <UserTypeToggle
              isCaregiver={isCaregiver}
              onChange={(newIsCaregiver) => {
                setIsCaregiver(newIsCaregiver);
                handleImmediateFieldChange("is_patient", !newIsCaregiver, {
                  is_caregiver: newIsCaregiver,
                });
              }}
            />
          </SettingField>

          {/* 1b: Name */}
          <SettingField
            label={isCaregiver ? "What is the patient's name?" : "What should we call you?"}
            isCaregiver={isCaregiver}
            saveStatus={getStatus("patient_name").status}
            saveError={getStatus("patient_name").error}
          >
            <input
              type="text"
              value={profile.patient_name ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                setProfile((prev) => (prev ? { ...prev, patient_name: val } : prev));
                if (val.length >= 2 && val.length <= 100) {
                  debouncedSave({ patient_name: val }, "patient_name");
                }
              }}
              className="h-[50px] w-full rounded-[14px] bg-[#f4f4f4] px-5 py-3 text-lg text-black outline-none placeholder:text-[#a0a09b] focus:ring-2 focus:ring-[#186346]"
            />
          </SettingField>

          {/* 1c: Birthday */}
          <SettingField
            label={isCaregiver ? "Patient's date of birth" : "Date of birth"}
            patientInfo="Used to assess age-related risk factors."
            caregiverInfo="Used to assess the patient's age-related risk factors."
            isCaregiver={isCaregiver}
            saveStatus={getStatus("birthday").status}
            saveError={getStatus("birthday").error}
          >
            <input
              type="date"
              value={profile.birthday ?? ""}
              max={new Date().toISOString().split("T")[0]}
              onChange={(e) => {
                const val = e.target.value;
                setProfile((prev) => (prev ? { ...prev, birthday: val } : prev));
                if (val) {
                  debouncedSave({ birthday: val }, "birthday");
                }
              }}
              className="h-[50px] w-full rounded-[14px] bg-[#f4f4f4] px-5 py-3 text-lg text-black outline-none focus:ring-2 focus:ring-[#186346]"
            />
          </SettingField>

          <div className="h-px bg-black/10" />

          {/* ================================================================
              SECTION 2: Current Status
              ================================================================ */}
          <SectionHeader
            title="Current Status"
            patientDescription="These fields directly affect how your check-ins work. Keep them up to date if your situation changes."
            caregiverDescription="These fields directly affect how the patient's check-ins work. Keep them up to date if their situation changes."
            isCaregiver={isCaregiver}
          />

          {/* 2a: Currently hospitalized */}
          <SettingField
            label={isCaregiver ? "Currently hospitalized" : "Currently hospitalized"}
            patientInfo="While this is on, your daily check-ins are paused. Turn it off when you have been discharged to resume monitoring."
            caregiverInfo="While this is on, the patient's daily check-ins are paused. Turn it off when they have been discharged to resume monitoring."
            isCaregiver={isCaregiver}
            saveStatus={getStatus("currently_hospitalized").status}
            saveError={getStatus("currently_hospitalized").error}
          >
            <Toggle
              checked={profile.currently_hospitalized ?? false}
              onChange={(val) =>
                handleImmediateFieldChange("currently_hospitalized", val)
              }
            />
          </SettingField>

          {/* 2b: Last discharge date — only when not hospitalized */}
          {!profile.currently_hospitalized && (
            <SettingField
              label={
                isCaregiver
                  ? "When was the patient's last sepsis-related discharge?"
                  : "When was your last sepsis-related discharge?"
              }
              patientInfo="This is used to adjust how we weigh your daily symptoms. The further you are from your discharge date, the more your baseline is expected to improve. Update this if you have been readmitted and discharged again."
              caregiverInfo="This is used to adjust how we weigh the patient's daily symptoms. The further they are from their discharge date, the more their baseline is expected to improve. Update this if they have been readmitted and discharged again."
              isCaregiver={isCaregiver}
              helperText="Not sure of the exact date? Your best estimate is fine."
              saveStatus={getStatus("discharge_date").status}
              saveError={getStatus("discharge_date").error}
            >
              <input
                type="date"
                value={profile.discharge_date ?? ""}
                max={new Date().toISOString().split("T")[0]}
                onChange={(e) => {
                  const val = e.target.value;
                  setProfile((prev) => (prev ? { ...prev, discharge_date: val } : prev));
                  if (val) {
                    const daysSince = Math.floor(
                      (Date.now() - new Date(val).getTime()) / 86_400_000
                    );
                    const sepsisStatus = daysSince <= 90 ? "recently_discharged" : "other";
                    debouncedSave(
                      { discharge_date: val, sepsis_status: sepsisStatus },
                      "discharge_date"
                    );
                  }
                }}
                className="h-[50px] w-full rounded-[14px] bg-[#f4f4f4] px-5 py-3 text-lg text-black outline-none focus:ring-2 focus:ring-[#186346]"
              />
            </SettingField>
          )}

          {/* 2c: Times hospitalized for sepsis */}
          <SettingField
            label={
              isCaregiver
                ? "How many times has the patient been hospitalized for sepsis in total?"
                : "How many times have you been hospitalized for sepsis in total?"
            }
            isCaregiver={isCaregiver}
            saveStatus={getStatus("admitted_count").status}
            saveError={getStatus("admitted_count").error}
          >
            <div className="flex w-full flex-col gap-3">
              {admittedCountQuestion.options?.map((option) => (
                <button
                  key={String(option.value)}
                  onClick={() => {
                    const mapped =
                      admittedCountQuestion.businessLogic?.customMapping?.(
                        option.value,
                      );
                    if (mapped) {
                      const fields: Record<string, any> = {
                        admitted_count: mapped.admitted_count,
                      };
                      if (mapped.sepsis_status) {
                        fields.sepsis_status = mapped.sepsis_status;
                      }
                      handleImmediateFieldChange("admitted_count", mapped.admitted_count, fields);
                    }
                  }}
                  className={`flex w-full cursor-pointer items-center justify-center rounded-[14px] transition-colors duration-150 ${
                    profile.admitted_count === option.value
                      ? "bg-[#dcf5f0]"
                      : "bg-[#f4f4f4]"
                  }`}
                >
                  <div
                    className={`flex min-h-[50px] flex-1 items-center justify-center rounded-[14px] px-[19px] py-[13px] ${
                      profile.admitted_count === option.value
                        ? "border border-solid border-[#186346]"
                        : ""
                    }`}
                  >
                    <span className="text-center text-lg leading-snug text-black">
                      {option.label}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </SettingField>

          <div className="h-px bg-black/10" />

          {/* ================================================================
              SECTION 3: Medical History
              ================================================================ */}
          <SectionHeader
            title="Medical History"
            patientDescription="Tell us about any ongoing conditions you have been diagnosed with. This helps us understand your baseline health and personalize your risk assessment."
            caregiverDescription="Tell us about any ongoing conditions the patient has been diagnosed with. This helps us understand their baseline health and personalize their risk assessment."
            isCaregiver={isCaregiver}
          />

          {/* 3a: Diagnosed conditions — multi-select with Save button */}
          <SettingField
            label={
              isCaregiver
                ? "Has the patient ever been diagnosed with any of the following conditions?"
                : "Have you ever been diagnosed with any of the following conditions?"
            }
            patientInfo="Only include conditions a doctor has told you that you have."
            caregiverInfo="Only include conditions a doctor has told the patient they have."
            isCaregiver={isCaregiver}
            saveStatus={getStatus("chronic_conditions").status}
            saveError={getStatus("chronic_conditions").error}
          >
            <p className="mb-2 text-xs text-black/40">
              To protect your privacy, specific condition names are not stored.
              Please re-select if your diagnosis has changed.
            </p>
            <ConditionsMultiSelect
              question={chronicConditionsQuestion}
              initialValues={initialConditions}
              profile={profile}
              onDirtyChange={setConditionsChanged}
              onProfileUpdate={(fields) =>
                setProfile((prev) => (prev ? { ...prev, ...fields } : prev))
              }
            />
            {conditionsChanged && (
              <button
                disabled={conditionsSaving}
                onClick={async () => {
                  setConditionsSaving(true);
                  // Use the mapped values from profile
                  const fields: Record<string, any> = {
                    has_weakened_immune: profile.has_weakened_immune,
                    has_lung_condition: profile.has_lung_condition,
                    has_heart_failure: profile.has_heart_failure,
                  };
                  const ok = await saveFields(fields, "chronic_conditions");
                  if (ok) {
                    setConditionsChanged(false);
                  }
                  setConditionsSaving(false);
                }}
                className="mt-3 flex h-[42px] w-full cursor-pointer items-center justify-center rounded-[14px] bg-[#186346] text-base font-semibold text-white transition-opacity hover:opacity-90"
              >
                {conditionsSaving ? "Saving…" : "Save Conditions"}
              </button>
            )}
          </SettingField>

          {/* 3b: Septic shock */}
          <SettingField
            label={
              isCaregiver
                ? "The patient has had septic shock before"
                : "I have had septic shock before"
            }
            patientInfo="A history of septic shock is one of the strongest factors in your risk assessment. This does not go away over time. If you are unsure whether your episode qualified, your discharge paperwork or doctor can confirm it."
            caregiverInfo="A history of septic shock is one of the strongest factors in the patient's risk assessment. This does not go away over time. If you are unsure whether their episode qualified, their discharge paperwork or doctor can confirm it."
            isCaregiver={isCaregiver}
            saveStatus={getStatus("has_had_septic_shock").status}
            saveError={getStatus("has_had_septic_shock").error}
          >
            <Toggle
              checked={profile.has_had_septic_shock ?? false}
              onChange={(val) =>
                handleImmediateFieldChange("has_had_septic_shock", val)
              }
            />
          </SettingField>

          <div className="h-px bg-black/10" />

          {/* ================================================================
              SECTION 4: Acute Conditions
              ================================================================ */}
          <SectionHeader
            title="Acute Conditions"
            patientDescription="These are conditions that may have recently changed or resolved. Keeping them current helps us assess your check-ins accurately."
            caregiverDescription="These are conditions that may have recently changed or resolved for the patient. Keeping them current helps us assess their check-ins accurately."
            isCaregiver={isCaregiver}
          />

          {/* 4a: Recent UTI */}
          <SettingField
            label={isCaregiver ? "Recent UTI (within past 3 months)" : "Recent UTI (within past 3 months)"}
            patientInfo="Turn this on if you have been diagnosed with or treated for a urinary tract infection in the past 3 months."
            caregiverInfo="Turn this on if the patient has been diagnosed with or treated for a urinary tract infection in the past 3 months."
            isCaregiver={isCaregiver}
            saveStatus={getStatus("has_recent_uti").status}
            saveError={getStatus("has_recent_uti").error}
          >
            <Toggle
              checked={profile.has_recent_uti ?? false}
              onChange={(val) =>
                handleImmediateFieldChange("has_recent_uti", val)
              }
            />
          </SettingField>

          {/* 4c: Recent pneumonia */}
          <SettingField
            label={isCaregiver ? "Recent Pneumonia (within past 3 months)" : "Recent Pneumonia (within past 3 months)"}
            patientInfo="Turn this on if you have been diagnosed with or treated for pneumonia in the past 3 months."
            caregiverInfo="Turn this on if the patient has been diagnosed with or treated for pneumonia in the past 3 months."
            isCaregiver={isCaregiver}
            saveStatus={getStatus("has_recent_pneumonia").status}
            saveError={getStatus("has_recent_pneumonia").error}
          >
            <Toggle
              checked={profile.has_recent_pneumonia ?? false}
              onChange={(val) =>
                handleImmediateFieldChange("has_recent_pneumonia", val)
              }
            />
          </SettingField>

          {/* 4e: Urinary catheter */}
          <SettingField
            label={
              isCaregiver
                ? "The patient currently has a urinary catheter"
                : "I currently have a urinary catheter"
            }
            patientInfo="Turn this on if you currently have a urinary catheter in place."
            caregiverInfo="Turn this on if the patient currently has a urinary catheter in place."
            isCaregiver={isCaregiver}
            saveStatus={getStatus("has_urinary_catheter").status}
            saveError={getStatus("has_urinary_catheter").error}
          >
            <Toggle
              checked={profile.has_urinary_catheter ?? false}
              onChange={(val) =>
                handleImmediateFieldChange("has_urinary_catheter", val)
              }
            />
          </SettingField>

          <div className="h-px bg-black/10" />

          {/* ================================================================
              SECTION 5: Medications
              ================================================================ */}
          <SectionHeader
            title="Medications"
            patientDescription="Let us know what you are currently taking so we can factor it into your monitoring."
            caregiverDescription="Let us know what the patient is currently taking so we can factor it into their monitoring."
            isCaregiver={isCaregiver}
          />

          {/* 5a: Current medications — autocomplete multi-select with Save button */}
          <SettingField
            label={
              isCaregiver
                ? "What prescribed medications is the patient currently taking?"
                : "What prescribed medications are you currently taking?"
            }
            patientInfo="List all medications you currently take. We use this to check for medications that affect your immune system. We do not store specific medication names."
            caregiverInfo="List all medications the patient currently takes. We use this to check for medications that affect their immune system. We do not store specific medication names."
            isCaregiver={isCaregiver}
            saveStatus={getStatus("medications").status}
            saveError={getStatus("medications").error}
          >
            <p className="mb-2 text-xs text-black/40">
              To protect your privacy, specific medication names are not stored.
              Please re-select if your treatment has changed.
            </p>
            <MedicationsMultiSelect
              question={medicationsQuestion}
              initialValues={EMPTY_MULTI_SELECT_VALUES}
              profile={profile}
              onDirtyChange={setMedsChanged}
              onProfileUpdate={(fields) =>
                setProfile((prev) => (prev ? { ...prev, ...fields } : prev))
              }
            />
            {medsChanged && (
              <button
                disabled={medsSaving}
                onClick={async () => {
                  setMedsSaving(true);
                  const fields: Record<string, any> = {
                    on_immunosuppressants: profile.on_immunosuppressants,
                    has_other_medications: profile.has_other_medications,
                  };
                  const ok = await saveFields(fields, "medications");
                  if (ok) {
                    setMedsChanged(false);
                  }
                  setMedsSaving(false);
                }}
                className="mt-3 flex h-[42px] w-full cursor-pointer items-center justify-center rounded-[14px] bg-[#186346] text-base font-semibold text-white transition-opacity hover:opacity-90"
              >
                {medsSaving ? "Saving…" : "Save Medications"}
              </button>
            )}
          </SettingField>

          <div className="h-px bg-black/10" />

          {/* ================================================================
              SECTION 6: Care and Support
              ================================================================ */}
          <SectionHeader
            title="Care and Support"
            patientDescription="This helps us personalize your daily wellness reminders based on your support system and physical ability."
            caregiverDescription="This helps us personalize the patient's daily wellness reminders based on their support system and physical ability."
            isCaregiver={isCaregiver}
          />

          {/* 6a: Has a caregiver — only when is_patient */}
          {!isCaregiver && (
            <SettingField
              label="I have a caregiver"
              patientInfo="Turn this on if someone is helping you manage your recovery, whether in person or remotely."
              caregiverInfo="Turn this on if someone other than you is also helping the patient manage their recovery."
              isCaregiver={isCaregiver}
              saveStatus={getStatus("has_caregiver").status}
              saveError={getStatus("has_caregiver").error}
            >
              <Toggle
                checked={profile.has_caregiver ?? false}
                onChange={(val) =>
                  handleImmediateFieldChange("has_caregiver", val)
                }
              />
            </SettingField>
          )}

          {isCaregiver && (
            <SettingField
              label="Someone else is also helping the patient"
              patientInfo="Turn this on if someone is helping you manage your recovery, whether in person or remotely."
              caregiverInfo="Turn this on if someone other than you is also helping the patient manage their recovery."
              isCaregiver={isCaregiver}
              saveStatus={getStatus("has_caregiver").status}
              saveError={getStatus("has_caregiver").error}
            >
              <Toggle
                checked={profile.has_caregiver ?? false}
                onChange={(val) =>
                  handleImmediateFieldChange("has_caregiver", val)
                }
              />
            </SettingField>
          )}

          {/* 6b: Caregiver availability — only when has_caregiver */}
          {profile.has_caregiver && (
            <SettingField
              label={
                isCaregiver
                  ? "How often is the caregiver available to help the patient?"
                  : "How often is your caregiver available?"
              }
              isCaregiver={isCaregiver}
              saveStatus={getStatus("caregiver_availability").status}
              saveError={getStatus("caregiver_availability").error}
            >
              <div className="flex w-full flex-col gap-3">
                {caregiverAvailabilityQuestion.options?.map((option) => (
                  <button
                    key={String(option.value)}
                    onClick={() =>
                      handleImmediateFieldChange(
                        "caregiver_availability",
                        option.value,
                      )
                    }
                    className={`flex w-full cursor-pointer items-center justify-center rounded-[14px] transition-colors duration-150 ${
                      profile.caregiver_availability === option.value
                        ? "bg-[#dcf5f0]"
                        : "bg-[#f4f4f4]"
                    }`}
                  >
                    <div
                      className={`flex min-h-[50px] flex-1 items-center justify-center rounded-[14px] px-[19px] py-[13px] ${
                        profile.caregiver_availability === option.value
                          ? "border border-solid border-[#186346]"
                          : ""
                      }`}
                    >
                      <span className="text-center text-lg leading-snug text-black">
                        {option.label}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </SettingField>
          )}

          {/* 6c: Social support — only when has_caregiver = false */}
          {!profile.has_caregiver && (
            <SettingField
              label={
                isCaregiver
                  ? "Does someone regularly check in on the patient?"
                  : "Does someone regularly check in on you?"
              }
              isCaregiver={isCaregiver}
              saveStatus={getStatus("has_social_support").status}
              saveError={getStatus("has_social_support").error}
            >
              <div className="flex w-full flex-col gap-3">
                {socialSupportQuestion.options?.map((option) => {
                  const currentValue = reverseMapSocialSupport(
                    profile.has_social_support,
                  );
                  return (
                    <button
                      key={String(option.value)}
                      onClick={() => {
                        const mapped =
                          socialSupportQuestion.businessLogic?.customMapping?.(
                            option.value,
                          );
                        if (mapped) {
                          handleImmediateFieldChange(
                            "has_social_support",
                            mapped.has_social_support,
                          );
                        }
                      }}
                      className={`flex w-full cursor-pointer items-center justify-center rounded-[14px] transition-colors duration-150 ${
                        currentValue === option.value
                          ? "bg-[#dcf5f0]"
                          : "bg-[#f4f4f4]"
                      }`}
                    >
                      <div
                        className={`flex min-h-[50px] flex-1 items-center justify-center rounded-[14px] px-[19px] py-[13px] ${
                          currentValue === option.value
                            ? "border border-solid border-[#186346]"
                            : ""
                        }`}
                      >
                        <span className="text-center text-lg leading-snug text-black">
                          {option.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </SettingField>
          )}

          {/* 6d: Physical ability */}
          <SettingField
            label={
              isCaregiver
                ? "Which best describes the patient's current physical ability?"
                : "Which best describes your current physical ability?"
            }
            patientInfo="Used to personalize your daily wellness reminders, such as movement suggestions or rest reminders."
            caregiverInfo="Used to personalize the patient's daily wellness reminders, such as movement suggestions or rest reminders."
            isCaregiver={isCaregiver}
            saveStatus={getStatus("physical_ability_level").status}
            saveError={getStatus("physical_ability_level").error}
          >
            <div className="flex w-full flex-col gap-3">
              {physicalAbilityQuestion.options?.map((option) => (
                <button
                  key={String(option.value)}
                  onClick={() => {
                    const mapped =
                      physicalAbilityQuestion.businessLogic?.customMapping?.(
                        option.value,
                      );
                    if (mapped) {
                      handleImmediateFieldChange(
                        "physical_ability_level",
                        mapped.physical_ability_level,
                        { can_exercise_regularly: mapped.can_exercise_regularly },
                      );
                    }
                  }}
                  className={`flex w-full cursor-pointer items-center justify-center rounded-[14px] transition-colors duration-150 ${
                    profile.physical_ability_level === option.value
                      ? "bg-[#dcf5f0]"
                      : "bg-[#f4f4f4]"
                  }`}
                >
                  <div
                    className={`flex min-h-[50px] flex-1 items-center justify-center rounded-[14px] px-[19px] py-[13px] ${
                      profile.physical_ability_level === option.value
                        ? "border border-solid border-[#186346]"
                        : ""
                    }`}
                  >
                    <span className="text-center text-lg leading-snug text-black">
                      {option.label}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </SettingField>

          <div className="h-px bg-black/10" />

          {/* ================================================================
              SECTION 7: Monitoring Devices
              ================================================================ */}
          <SectionHeader
            title="Monitoring Devices"
            patientDescription="You can still complete check-ins without any of these. If a device is turned off, we will ask about your symptoms instead of measured values."
            caregiverDescription="The patient can still complete check-ins without any of these. If a device is turned off, we will ask about their symptoms instead of measured values."
            isCaregiver={isCaregiver}
          />

          {/* 7a: Thermometer */}
          <SettingField
            label={isCaregiver ? "Thermometer" : "Thermometer"}
            patientInfo="Turn this on if you are able to take your temperature at home each day if needed."
            caregiverInfo="Turn this on if you are able to take the patient's temperature at home each day if needed."
            isCaregiver={isCaregiver}
            saveStatus={getStatus("has_thermometer").status}
            saveError={getStatus("has_thermometer").error}
          >
            <Toggle
              checked={profile.has_thermometer ?? false}
              onChange={(val) =>
                handleImmediateFieldChange("has_thermometer", val)
              }
            />
          </SettingField>

          {/* 7b: Pulse oximeter */}
          <SettingField
            label={isCaregiver ? "Pulse oximeter" : "Pulse oximeter"}
            patientInfo="Turn this on if you have a pulse oximeter available to check your oxygen level each day if needed."
            caregiverInfo="Turn this on if you have a pulse oximeter available to check the patient's oxygen level each day if needed."
            isCaregiver={isCaregiver}
            saveStatus={getStatus("has_pulse_oximeter").status}
            saveError={getStatus("has_pulse_oximeter").error}
          >
            <Toggle
              checked={profile.has_pulse_oximeter ?? false}
              onChange={(val) =>
                handleImmediateFieldChange("has_pulse_oximeter", val)
              }
            />
          </SettingField>

          {/* 7c: Blood pressure cuff */}
          <SettingField
            label={isCaregiver ? "Blood pressure cuff" : "Blood pressure cuff"}
            patientInfo="Turning this off means we will use your reported symptoms instead of a measured value for blood pressure."
            caregiverInfo="Turning this off means we will use reported symptoms instead of a measured value for the patient's blood pressure."
            isCaregiver={isCaregiver}
            saveStatus={getStatus("has_bp_cuff").status}
            saveError={getStatus("has_bp_cuff").error}
          >
            <Toggle
              checked={profile.has_bp_cuff ?? false}
              onChange={(val) =>
                handleImmediateFieldChange("has_bp_cuff", val)
              }
            />
          </SettingField>

          {/* 7d: Baseline systolic BP — only when has_bp_cuff */}
          {profile.has_bp_cuff && (
            <SettingField
              label={
                isCaregiver
                  ? "Patient's baseline systolic blood pressure (mmHg)"
                  : "Baseline systolic blood pressure (mmHg)"
              }
              patientInfo="Your usual blood pressure when healthy. Used to calculate your blood pressure zone during check-ins."
              caregiverInfo="The patient's usual blood pressure when healthy. Used to calculate their blood pressure zone during check-ins."
              isCaregiver={isCaregiver}
              saveStatus={getStatus("baseline_bp_systolic").status}
              saveError={getStatus("baseline_bp_systolic").error}
            >
              <div className="flex w-full items-center gap-3">
                <input
                  type="number"
                  inputMode="numeric"
                  value={profile.baseline_bp_systolic ?? ""}
                  min={60}
                  max={250}
                  onChange={(e) => {
                    const val =
                      e.target.value === ""
                        ? undefined
                        : parseInt(e.target.value);
                    setProfile((prev) =>
                      prev
                        ? { ...prev, baseline_bp_systolic: val }
                        : prev,
                    );
                    if (val !== undefined && val >= 60 && val <= 250) {
                      debouncedSave(
                        { baseline_bp_systolic: val },
                        "baseline_bp_systolic",
                      );
                    }
                  }}
                  className="h-[50px] flex-1 rounded-[14px] bg-[#f4f4f4] px-5 py-3 text-lg text-black outline-none placeholder:text-[#a0a09b] focus:ring-2 focus:ring-[#186346]"
                />
                <span className="shrink-0 text-base font-medium text-black/60">
                  mmHg
                </span>
              </div>
            </SettingField>
          )}

          {/* 7e: Heart rate monitor */}
          <SettingField
            label={isCaregiver ? "Heart rate monitor" : "Heart rate monitor"}
            patientInfo="Turn this on if you have a device that can measure your heart rate, such as a pulse oximeter, blood pressure cuff, or smartwatch."
            caregiverInfo="Turn this on if you have a device that can measure the patient's heart rate, such as a pulse oximeter, blood pressure cuff, or smartwatch."
            isCaregiver={isCaregiver}
            saveStatus={getStatus("has_hr_monitor").status}
            saveError={getStatus("has_hr_monitor").error}
          >
            <Toggle
              checked={profile.has_hr_monitor ?? false}
              onChange={(val) =>
                handleImmediateFieldChange("has_hr_monitor", val)
              }
            />
          </SettingField>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Conditions Multi-Select (with search)
// ============================================================================
function ConditionsMultiSelect({
  question,
  initialValues,
  profile,
  onDirtyChange,
  onProfileUpdate,
}: {
  question: Question;
  initialValues: string[];
  profile: PatientProfile;
  onDirtyChange: (dirty: boolean) => void;
  onProfileUpdate: (fields: Record<string, any>) => void;
}) {
  const [selected, setSelected] = useState<string[]>(initialValues);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setSelected(initialValues);
  }, [initialValues]);

  const filteredOptions = question.options?.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase()),
  );

  const handleToggle = (value: string) => {
    let newSelected: string[];
    if (value === "none") {
      newSelected = selected.includes("none") ? [] : ["none"];
    } else {
      const withoutNone = selected.filter((v) => v !== "none");
      newSelected = selected.includes(value)
        ? withoutNone.filter((v) => v !== value)
        : [...withoutNone, value];
    }
    setSelected(newSelected);

    // Run the customMapping to get DB fields
    if (question.businessLogic?.customMapping) {
      const mapped = question.businessLogic.customMapping(newSelected);
      onProfileUpdate(mapped);
    }

    // Check if dirty
    const isDirty =
      JSON.stringify([...newSelected].sort()) !==
      JSON.stringify([...initialValues].sort());
    onDirtyChange(isDirty);
  };

  return (
    <div className="flex w-full flex-col gap-3">
      <input
        type="text"
        placeholder="Search conditions..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-[50px] w-full rounded-[14px] bg-[#f4f4f4] px-5 py-3 text-lg text-black outline-none placeholder:text-[#a0a09b] focus:ring-2 focus:ring-[#186346]"
      />
      <div className="flex max-h-[300px] w-full flex-col gap-2 overflow-y-auto">
        {filteredOptions?.map((option) => {
          const isChecked = selected.includes(option.value as string);
          return (
            <button
              key={String(option.value)}
              onClick={() => handleToggle(option.value as string)}
              className={`flex w-full cursor-pointer items-center justify-center rounded-[14px] transition-colors duration-150 ${
                isChecked ? "bg-[#dcf5f0]" : "bg-[#f4f4f4]"
              }`}
            >
              <div
                className={`flex min-h-[50px] flex-1 items-center justify-center rounded-[14px] px-[19px] py-[13px] ${
                  isChecked ? "border border-solid border-[#186346]" : ""
                }`}
              >
                <span className="text-center text-lg leading-snug text-black">
                  {option.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Medications Multi-Select (with search / autocomplete)
// ============================================================================
function MedicationsMultiSelect({
  question,
  initialValues,
  profile,
  onDirtyChange,
  onProfileUpdate,
}: {
  question: Question;
  initialValues: string[];
  profile: PatientProfile;
  onDirtyChange: (dirty: boolean) => void;
  onProfileUpdate: (fields: Record<string, any>) => void;
}) {
  const [selected, setSelected] = useState<string[]>(initialValues);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setSelected(initialValues);
  }, [initialValues]);

  const filteredOptions = question.options?.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase()),
  );

  const handleToggle = (value: string) => {
    let newSelected: string[];
    if (value === "none") {
      newSelected = selected.includes("none") ? [] : ["none"];
    } else {
      const withoutNone = selected.filter((v) => v !== "none");
      newSelected = selected.includes(value)
        ? withoutNone.filter((v) => v !== value)
        : [...withoutNone, value];
    }
    setSelected(newSelected);

    // Run the customMapping to get DB fields
    if (question.businessLogic?.customMapping) {
      const mapped = question.businessLogic.customMapping(newSelected);
      onProfileUpdate(mapped);
    }

    // Check if dirty
    const isDirty =
      JSON.stringify([...newSelected].sort()) !==
      JSON.stringify([...initialValues].sort());
    onDirtyChange(isDirty);
  };

  return (
    <div className="flex w-full flex-col gap-3">
      <input
        type="text"
        placeholder="Search medications..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-[50px] w-full rounded-[14px] bg-[#f4f4f4] px-5 py-3 text-lg text-black outline-none placeholder:text-[#a0a09b] focus:ring-2 focus:ring-[#186346]"
      />
      <div className="flex max-h-[300px] w-full flex-col gap-2 overflow-y-auto">
        {filteredOptions?.map((option) => {
          const isChecked = selected.includes(option.value as string);
          return (
            <button
              key={String(option.value)}
              onClick={() => handleToggle(option.value as string)}
              className={`flex w-full cursor-pointer items-center justify-center rounded-[14px] transition-colors duration-150 ${
                isChecked ? "bg-[#dcf5f0]" : "bg-[#f4f4f4]"
              }`}
            >
              <div
                className={`flex min-h-[50px] flex-1 items-center justify-center rounded-[14px] px-[19px] py-[13px] ${
                  isChecked ? "border border-solid border-[#186346]" : ""
                }`}
              >
                <span className="text-center text-lg leading-snug text-black">
                  {option.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>
      {selected.length > 0 && selected[0] !== "none" && (
        <p className="text-sm text-black/50">
          Selected: {selected.length} medication{selected.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
