// TypeScript types for the database tables
// Auto-generate with: npx supabase gen types typescript --project-id your-project-id > src/types/database.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type SexAssigned = "male" | "female" | "intersex" | "prefer_not_to_say";
export type SepsisStatus = "recently_discharged" | "readmitted" | "other";
export type CaregiverAvailability = "full_time" | "part_time" | "occasional" | "none";
export type PhysicalAbility = "normal" | "tires_easily" | "needs_help" | "bed_or_wheelchair";
export type ZoneType = "green" | "yellow" | "red";
export type UtiSymptomsType = "improved" | "same" | "worsened" | "not_applicable";
export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export interface Patient {
  patient_id: string;
  user_id: string;
  is_patient: boolean;
  is_caregiver: boolean;
  patient_name: string;
  birthday: string;
  sex_assigned_at_birth: SexAssigned;
  currently_hospitalized: boolean;
  sepsis_status: SepsisStatus | null;
  days_since_last_discharge: number | null;
  readmitted_count: number;
  has_asthma: boolean;
  has_diabetes: boolean;
  has_copd: boolean;
  has_heart_disease: boolean;
  has_kidney_disease: boolean;
  has_weakened_immune: boolean;
  chronic_conditions_other: string | null;
  has_recent_uti: boolean;
  has_recent_pneumonia: boolean;
  has_dialysis: boolean;
  has_kidney_failure: boolean;
  current_medications: Json | null;
  on_immunosuppressants: boolean;
  on_antibiotics: boolean;
  on_steroids: boolean;
  has_caregiver: boolean;
  caregiver_availability: CaregiverAvailability | null;
  physical_ability_level: PhysicalAbility | null;
  can_exercise_regularly: boolean;
  has_social_support: boolean;
  has_thermometer: boolean;
  has_pulse_oximeter: boolean;
  has_bp_cuff: boolean;
  has_hr_monitor: boolean;
  baseline_bp_systolic: number | null;
  has_active_wound: boolean;
  is_high_risk: boolean;
  created_at: string;
  updated_at: string;
}

export interface DailyCheckin {
  daily_checkin_id: string;
  patient_id: string;
  checkin_date: string;
  fainted_or_very_dizzy: boolean;
  severe_trouble_breathing: boolean;
  severe_confusion: boolean;
  extreme_heat_or_chills: boolean;
  survey_terminated_early: boolean;
  termination_reason: string | null;
  overall_feeling: number | null;
  energy_level: number | null;
  pain_level: number | null;
  fever_chills: boolean;
  temperature_value: number | null;
  temperature_zone: ZoneType | null;
  oxygen_level_value: number | null;
  oxygen_level_zone: ZoneType | null;
  heart_racing: boolean;
  heart_rate_value: number | null;
  heart_rate_zone: ZoneType | null;
  blood_pressure_systolic: number | null;
  blood_pressure_zone: ZoneType | null;
  thinking_level: number | null;
  breathing_level: number | null;
  urine_appearance_level: number | null;
  uti_symptoms_worsening: UtiSymptomsType;
  urine_output_level: number | null;
  has_cough: boolean;
  cough_worsening: boolean | null;
  wound_state_level: number | null;
  discolored_skin: boolean;
  nausea_vomiting_diarrhea: boolean;
  additional_notes: string | null;
  risk_score: number;
  risk_level: RiskLevel;
  created_at: string;
  updated_at: string;
}

// Database table types for Supabase client
export interface Database {
  public: {
    Tables: {
      patients: {
        Row: Patient;
        Insert: Omit<Patient, "patient_id" | "is_high_risk" | "created_at" | "updated_at">;
        Update: Partial<Omit<Patient, "patient_id" | "is_high_risk" | "created_at" | "updated_at">>;
      };
      daily_checkins: {
        Row: DailyCheckin;
        Insert: Omit<DailyCheckin, "daily_checkin_id" | "risk_score" | "risk_level" | "created_at" | "updated_at">;
        Update: Partial<Omit<DailyCheckin, "daily_checkin_id" | "risk_score" | "risk_level" | "created_at" | "updated_at">>;
      };
    };
  };
}
