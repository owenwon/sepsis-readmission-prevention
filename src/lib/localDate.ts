/**
 * Timezone-safe "today" helper.
 *
 * `new Date().toISOString().split('T')[0]` returns a UTC date — at 11 PM EST
 * that is already tomorrow.  `Intl.DateTimeFormat('en-CA')` formats the date
 * as YYYY-MM-DD in the *local* timezone, which is what we want for a
 * "calendar day" concept (one check-in per day, midnight reset, etc.).
 */
export function getLocalToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// ============================================================================
// Shared PatientProfile subset used by buildSurveyResponse
// ============================================================================

export type PatientProfileForRisk = {
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
  has_recent_uti?: boolean;
  has_thermometer?: boolean;
  has_pulse_oximeter?: boolean;
  has_bp_cuff?: boolean;
  has_hr_monitor?: boolean;
  baseline_bp_systolic?: number;
};

/**
 * Build a full SurveyResponse object for `calculateSepsisRisk()` by merging
 * check-in answers with freshly-computed onboarding context fields.
 *
 * `age` and `days_since_last_discharge` are derived from `birthday` and
 * `discharge_date` at call-time so they are always up-to-date rather than
 * stale bucketed integers stored once at onboarding.
 */
export function buildSurveyResponse(
  answers: Record<string, any>,
  patientProfile: PatientProfileForRisk,
) {
  const age = patientProfile.birthday
    ? Math.floor(
        (Date.now() - new Date(patientProfile.birthday).getTime()) /
          31_557_600_000,
      )
    : undefined;

  const daysSinceLastDischarge = patientProfile.discharge_date
    ? Math.floor(
        (Date.now() - new Date(patientProfile.discharge_date).getTime()) /
          86_400_000,
      )
    : undefined;

  return {
    ...answers,
    age,
    days_since_last_discharge: daysSinceLastDischarge,
    has_weakened_immune: patientProfile.has_weakened_immune ?? false,
    admitted_count: patientProfile.admitted_count ?? 0,
    on_immunosuppressants: patientProfile.on_immunosuppressants ?? false,
    has_lung_condition: patientProfile.has_lung_condition ?? false,
    has_heart_failure: patientProfile.has_heart_failure ?? false,
    has_had_septic_shock: patientProfile.has_had_septic_shock ?? false,
    has_urinary_catheter: patientProfile.has_urinary_catheter ?? false,
    has_recent_pneumonia: patientProfile.has_recent_pneumonia ?? false,
    has_recent_uti: patientProfile.has_recent_uti ?? false,
    has_thermometer: patientProfile.has_thermometer ?? false,
    has_pulse_oximeter: patientProfile.has_pulse_oximeter ?? false,
    has_bp_cuff: patientProfile.has_bp_cuff ?? false,
    has_hr_monitor: patientProfile.has_hr_monitor ?? false,
    baseline_bp_systolic: patientProfile.baseline_bp_systolic ?? undefined,
  };
}
