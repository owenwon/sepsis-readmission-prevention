/**
 * Question Types - All possible input types for survey questions
 */
export type QuestionType =
  | 'boolean'           // Yes/No questions
  | 'single_select'     // Radio buttons, single choice
  | 'multi_select'      // Checkboxes, multiple choices
  | 'integer'           // Whole numbers (e.g., age, heart rate)
  | 'float'             // Decimal numbers (e.g., temperature)
  | 'text'              // Short text input
  | 'textarea'          // Long text input
  | 'date'              // Date picker
  | 'scale'             // Visual scale (e.g., 1-5 smiley faces, 0-10 pain)
  | 'autocomplete';     // Autocomplete dropdown (e.g., medications)

/**
 * Comparison operators for prerequisites
 */
export type PrerequisiteOperator = '==' | '!=' | '>' | '<' | '>=' | '<=' | 'includes' | 'excludes';

/**
 * Option for single_select and multi_select questions
 */
export interface QuestionOption {
  label: string;                // Display text
  value: string | number | boolean;  // Value to store in database
  description?: string;         // Optional help text
  iconEmoji?: string;          // Optional emoji for visual display
  triggersOther?: boolean;     // If true, shows a text input for "Other" details
}

/**
 * Prerequisite condition - determines if question should be shown
 */
export interface Prerequisite {
  field: string;                      // Database field to check
  operator: PrerequisiteOperator;     // Comparison operator
  value: any;                         // Value to compare against
  source?: 'onboarding' | 'current';  // Where to get the field from (default: onboarding)
}

/**
 * Validation rules for question answers
 */
export interface ValidationRules {
  required?: boolean;           // Is this field required?
  min?: number;                 // Minimum value (for numbers)
  max?: number;                 // Maximum value (for numbers)
  minLength?: number;           // Minimum length (for text)
  maxLength?: number;           // Maximum length (for text)
  pattern?: string;             // Regex pattern (for text)
  customMessage?: string;       // Custom validation error message
}

/**
 * Trigger condition - defines exactly when a businessLogic action fires
 * Used by the check-in page to know which answer value(s) should trigger
 * an emergency alert, survey termination, etc.
 */
export interface TriggerCondition {
  operator: '==' | '!=' | '>' | '<' | '>=' | '<=';
  value: string | number | boolean;
}

/**
 * Business logic metadata - for documentation and special handling
 */
export interface BusinessLogic {
  description?: string;                      // Human-readable description
  terminatesSurvey?: boolean;               // Does this question end the survey?
  terminationMessage?: string;              // Message to show on termination
  requiresEmergencyAlert?: boolean;         // Trigger 911 call prompt
  requiresUrgentAlert?: boolean;            // Trigger PCP contact prompt
  triggerWhen?: TriggerCondition;           // Condition that activates this businessLogic
  calculatesZone?: boolean;                 // Auto-calculate green/yellow/red zone
  zoneField?: string;                       // Database field for zone storage
  autoFlags?: string[];                     // Fields to auto-populate based on answer
  triggersFollowUp?: string;                // ID of follow-up question to show
  mapToMultipleFields?: boolean;            // Maps to multiple database fields
  customMapping?: (value: any) => Record<string, any>; // Custom mapping function
}

/**
 * Complete Question definition
 */
export interface Question {
  // Identification
  id: string;                           // Unique identifier (e.g., 'user_type', 'temperature')
  section?: string;                     // Section name (e.g., 'Immediate Danger', 'Vitals')
  
  // Display text
  patientText: string;                  // Question text for patient mode
  caregiverText: string | null;         // Question text for caregiver mode (null = skip for caregivers)
  helpText?: string;                    // Additional help/explanation text
  caregiverHelpText?: string;           // Additional help text for caregivers
  
  // Question configuration
  type: QuestionType;                   // Input type
  options?: QuestionOption[];           // For select types
  
  // Database mapping
  schemaField: string | string[];       // Database field(s) this maps to
  
  // Conditional display
  prerequisites?: Prerequisite[];       // Conditions to show this question
  
  // Validation
  validation?: ValidationRules;         // Validation rules
  
  // Business logic
  businessLogic?: BusinessLogic;        // Special handling and metadata
  
  // Visual configuration
  placeholder?: string;                 // Placeholder text for inputs
  unit?: string;                        // Unit to display (e.g., '°F', 'bpm')
  defaultValue?: any;                   // Default value
}

/**
 * Survey section grouping
 */
export interface QuestionSection {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
  icon?: string;
}

/**
 * Complete survey definition
 */
export interface Survey {
  id: string;
  title: string;
  description?: string;
  sections?: QuestionSection[];
  questions: Question[];
}

// ============================================================================
// Database Schema Types - Import from centralized types
// ============================================================================

// Re-export from centralized database types for convenience
export type {
  SexAssigned,
  SepsisStatus,
  CaregiverAvailability,
  PhysicalAbility,
  ZoneType,
  UtiSymptomsType as UTISymptoms,
  RiskLevel,
  Patient,
  DailyCheckin,
} from '@/types/database';

// Import for use in this file
import type {
  ZoneType,
  RiskLevel,
  Patient,
  DailyCheckin,
} from '@/types/database';

/**
 * Patient form data (partial Patient for form submission)
 * Excludes auto-generated fields like patient_id, is_high_risk, timestamps
 */
export type PatientFormData = Partial<Omit<Patient, 'patient_id' | 'is_high_risk' | 'created_at' | 'updated_at'>> & {
  user_id: string;
};

/**
 * Daily check-in form data (partial DailyCheckin for form submission)
 * Risk calculation fields are included since they're calculated by riskCalculator.ts before submission
 * Only excludes auto-generated fields: daily_checkin_id, timestamps
 */
export type DailyCheckInFormData = Partial<Omit<DailyCheckin, 'daily_checkin_id' | 'created_at' | 'updated_at'>> & {
  patient_id: string;
};

/**
 * Answer payload for submitting questions
 */
export interface QuestionAnswer {
  questionId: string;
  value: any;
  schemaField: string | string[];
}

/**
 * Survey submission payload
 */
export interface SurveySubmission {
  surveyId: string;
  answers: QuestionAnswer[];
  patientId: string;
  submittedAt: string;
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * User mode (patient or caregiver)
 */
export type UserMode = 'patient' | 'caregiver';

/**
 * Question evaluation result
 */
export interface QuestionEvaluation {
  shouldShow: boolean;
  prerequisites: Prerequisite[];
  failedPrerequisites?: Prerequisite[];
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors?: string[];
}

/**
 * Zone calculation result
 */
export interface ZoneCalculation {
  zone: ZoneType;
  value: number;
  shouldTerminate: boolean;
  alertLevel?: 'none' | 'warning' | 'danger' | 'critical';
  message?: string;
}