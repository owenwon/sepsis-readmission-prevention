import { Question, QuestionSection, Survey } from './types';

export const onboardingQuestions: Question[] = [

  // ============================================================================
  // GETTING STARTED (Question 1)
  // ============================================================================

  {
    id: 'user_type',
    section: 'Getting Started',
    patientText: 'Which best describes you?',
    caregiverText: 'Which best describes you?',
    type: 'single_select',
    options: [
      { label: 'Patient', value: 'patient', iconEmoji: '👤' },
      { label: 'Caregiver', value: 'caregiver', iconEmoji: '🤝' },
    ],
    schemaField: ['is_patient', 'is_caregiver'],
    validation: { required: true },
    businessLogic: {
      mapToMultipleFields: true,
      customMapping: (value: string) => ({
        is_patient: value === 'patient',
        is_caregiver: value === 'caregiver',
      }),
    },
  },

  // ============================================================================
  // BASIC INFORMATION (Questions 2-4)
  // ============================================================================

  {
    id: 'patient_name',
    section: 'Basic Information',
    patientText: 'What is your name?',
    caregiverText: "What is the patient's name?",
    type: 'text',
    schemaField: 'patient_name',
    validation: {
      required: true,
      minLength: 2,
      maxLength: 100,
    },
    placeholder: 'Enter full name',
  },

  {
    id: 'birthday',
    section: 'Basic Information',
    patientText: 'What is your birthday?',
    caregiverText: "What is the patient's birthday?",
    type: 'date',
    schemaField: ['birthday', 'age'],
    validation: { required: true },
    businessLogic: {
      mapToMultipleFields: true,
      customMapping: (value: string) => {
        const birthDate = new Date(value);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        return { birthday: value, age };
      },
    },
  },

  {
    id: 'sex_assigned_at_birth',
    section: 'Basic Information',
    patientText: 'What was your sex assigned at birth?',
    caregiverText: "What was the patient's sex assigned at birth?",
    type: 'single_select',
    options: [
      { label: 'Male', value: 'male' },
      { label: 'Female', value: 'female' },
      { label: 'Intersex', value: 'intersex' },
      { label: 'Prefer not to say', value: 'prefer_not_to_say' },
    ],
    schemaField: 'sex_assigned_at_birth',
    validation: { required: true },
  },

  // ============================================================================
  // SEPSIS CONTEXT (Questions 5-7)
  // ============================================================================

  {
    id: 'currently_hospitalized',
    section: 'Sepsis Context',
    patientText: 'Are you currently hospitalized for sepsis?',
    caregiverText: 'Is the patient currently hospitalized for sepsis?',
    type: 'boolean',
    schemaField: 'currently_hospitalized',
    helpText:
      'If yes, this tool is designed for post-discharge monitoring. Please consult with your healthcare team for in-hospital care.',
    validation: { required: true },
  },

  {
    id: 'days_since_last_discharge',
    section: 'Sepsis Context',
    patientText: 'If not currently hospitalized, how long ago was your last sepsis-related admission?',
    caregiverText: "If not currently hospitalized, how long ago was the patient's last sepsis-related admission?",
    type: 'single_select',
    options: [
      { label: 'Less than 7 days ago', value: '3' },
      { label: '1-4 weeks ago', value: '17' },
      { label: '1-3 months ago', value: '60' },
      { label: 'More than 3 months ago', value: '120' },
    ],
    schemaField: ['days_since_last_discharge', 'sepsis_status'],
    prerequisites: [
      { field: 'currently_hospitalized', operator: '==', value: false },
    ],
    businessLogic: {
      mapToMultipleFields: true,
      customMapping: (value: string) => ({
        days_since_last_discharge: parseInt(value),
        sepsis_status: parseInt(value) <= 90 ? 'recently_discharged' : 'other',
      }),
    },
  },

  {
    id: 'admitted_count',
    section: 'Sepsis Context',
    patientText: 'How many total times have you been hospitalized for sepsis?',
    caregiverText: 'How many total times has the patient been hospitalized for sepsis?',
    type: 'single_select',
    options: [
      { label: '1 time', value: 1 },
      { label: '2 times', value: 2 },
      { label: '3 or more times', value: 3 },
    ],
    schemaField: ['admitted_count', 'sepsis_status'],
    validation: { required: true },
    businessLogic: {
      mapToMultipleFields: true,
      customMapping: (value: number) => ({
        admitted_count: value,
        sepsis_status: value > 1 ? 'readmitted' : undefined,
      }),
    },
  },

  // ============================================================================
  // MEDICAL HISTORY (Questions 8-10, 20)
  // ============================================================================

  {
    id: 'chronic_conditions',
    section: 'Medical History',
    patientText: 'What, if any, chronic disorders or disabilities do you have?',
    caregiverText: 'What, if any, chronic disorders or disabilities does the patient have?',
    helpText: 'Select all that apply',
    type: 'multi_select',
    options: [
      { label: 'Asthma', value: 'asthma' },
      { label: 'Diabetes', value: 'diabetes' },
      { label: 'COPD', value: 'copd' },
      { label: 'Heart Disease', value: 'heart_disease' },
      { label: 'Kidney Disease', value: 'kidney_disease' },
      {
        label: 'Weakened immune system',
        value: 'weakened_immune',
        description: 'Chemotherapy, transplant, long-term steroids, HIV',
      },
      { label: 'Other', value: 'other', triggersOther: true },
      { label: 'None of the above', value: 'none' },
    ],
    schemaField: [
      'has_asthma',
      'has_diabetes',
      'has_copd',
      'has_heart_disease',
      'has_kidney_disease',
      'has_weakened_immune',
      'chronic_conditions_other',
    ],
    businessLogic: {
      mapToMultipleFields: true,
      customMapping: (values: string[]) => ({
        has_asthma: values.includes('asthma'),
        has_diabetes: values.includes('diabetes'),
        has_copd: values.includes('copd'),
        has_heart_disease: values.includes('heart_disease'),
        has_kidney_disease: values.includes('kidney_disease'),
        has_weakened_immune: values.includes('weakened_immune'),
        chronic_conditions_other: values.includes('other') ? '' : null,
      }),
    },
  },

  {
    id: 'recent_illnesses',
    section: 'Medical History',
    patientText: 'What illnesses do you have or have had within the past 3 months?',
    caregiverText: 'What illnesses does the patient have or have had within the past 3 months?',
    helpText: 'Select all that apply',
    type: 'multi_select',
    options: [
      { label: 'UTI (Urinary Tract Infection)', value: 'uti' },
      { label: 'Pneumonia', value: 'pneumonia' },
      { label: 'Receiving dialysis/experiencing kidney failure', value: 'dialysis' },
      { label: 'None of the above', value: 'none' },
    ],
    schemaField: [
      'has_recent_uti',
      'has_recent_pneumonia',
      'has_dialysis',
      'has_kidney_failure',
    ],
    businessLogic: {
      mapToMultipleFields: true,
      customMapping: (values: string[]) => ({
        has_recent_uti: values.includes('uti'),
        has_recent_pneumonia: values.includes('pneumonia'),
        has_dialysis: values.includes('dialysis'),
        has_kidney_failure: values.includes('dialysis'), // dialysis implies kidney failure
      }),
    },
  },

  {
    id: 'current_medications',
    section: 'Medical History',
    patientText: 'What prescribed medications are you currently taking?',
    caregiverText: 'What prescribed medications is the patient currently taking?',
    helpText: 'Start typing to search for medications',
    type: 'autocomplete',
    schemaField: [
      'current_medications',
      'on_immunosuppressants',
      'on_antibiotics',
      'on_steroids',
    ],
    businessLogic: {
      mapToMultipleFields: true,
      customMapping: (medications: string[]) => {
        const immunosuppressants = [
          'tacrolimus',
          'cyclosporine',
          'azathioprine',
          'mycophenolate',
          'sirolimus',
        ];
        const antibiotics = [
          'amoxicillin',
          'ciprofloxacin',
          'azithromycin',
          'doxycycline',
          'levofloxacin',
          'cephalexin',
        ];
        const steroids = [
          'prednisone',
          'hydrocortisone',
          'dexamethasone',
          'methylprednisolone',
        ];

        const medLowerCase = medications.map((m) => m.toLowerCase());

        return {
          current_medications: medications,
          on_immunosuppressants: medLowerCase.some((m) =>
            immunosuppressants.some((drug) => m.includes(drug))
          ),
          on_antibiotics: medLowerCase.some((m) =>
            antibiotics.some((drug) => m.includes(drug))
          ),
          on_steroids: medLowerCase.some((m) =>
            steroids.some((drug) => m.includes(drug))
          ),
        };
      },
    },
  },

  {
    id: 'has_active_wound',
    section: 'Medical History',
    patientText: 'Do you have an active wound (surgical or non-surgical)?',
    caregiverText: 'Does the patient have an active wound (surgical or non-surgical)?',
    type: 'boolean',
    schemaField: 'has_active_wound',
  },

  // ============================================================================
  // CARE & SUPPORT (Questions 11-14)
  // ============================================================================

  {
    id: 'has_caregiver',
    section: 'Care & Support',
    patientText: 'Do you have a caregiver to assist you?',
    caregiverText: null, // Skip for caregivers — auto-set to true
    type: 'boolean',
    schemaField: 'has_caregiver',
    prerequisites: [
      { field: 'is_patient', operator: '==', value: true },
    ],
  },

  {
    id: 'caregiver_availability',
    section: 'Care & Support',
    patientText: 'How often is your caregiver available to assist you?',
    caregiverText: 'How often are you available to assist the patient?',
    type: 'single_select',
    options: [
      { label: '24/7 (Full-time)', value: 'full_time', iconEmoji: '🏥' },
      { label: 'Only some days (Part-time)', value: 'part_time', iconEmoji: '📅' },
      { label: 'Occasionally', value: 'occasional', iconEmoji: '🤝' },
      { label: 'None', value: 'none' },
    ],
    schemaField: 'caregiver_availability',
    prerequisites: [
      { field: 'has_caregiver', operator: '==', value: true },
    ],
  },

  {
    id: 'physical_ability',
    section: 'Care & Support',
    patientText: "Which best describes your current physical ability?",
    caregiverText: "Which best describes the patient's current physical ability?",
    type: 'single_select',
    options: [
      { label: 'Normal activity and stairs without difficulty', value: 'normal' },
      { label: 'Walks and climbs stairs but tires easily', value: 'tires_easily' },
      { label: 'Needs help with walking or getting out of bed', value: 'needs_help' },
      { label: 'In bed or wheelchair most of the day', value: 'bed_or_wheelchair' },
    ],
    schemaField: ['physical_ability_level', 'can_exercise_regularly'],
    validation: { required: true },
    businessLogic: {
      mapToMultipleFields: true,
      customMapping: (value: string) => ({
        physical_ability_level: value,
        can_exercise_regularly: value === 'normal',
      }),
    },
  },

  {
    id: 'social_support',
    section: 'Care & Support',
    patientText: 'Do you have someone to speak to regularly?',
    caregiverText: 'Does the patient have someone to speak to regularly?',
    type: 'single_select',
    options: [
      { label: 'Yes, daily or almost daily', value: true },
      { label: 'Yes, occasionally', value: true },
      { label: 'No regular support', value: false },
    ],
    schemaField: 'has_social_support',
  },

  // ============================================================================
  // MONITORING DEVICES (Questions 15-19)
  // ============================================================================

  {
    id: 'has_thermometer',
    section: 'Monitoring Devices',
    patientText: 'Are you able to check your temperature (thermometer) at home each day if needed?',
    caregiverText: "Are you able to check the patient's temperature (thermometer) at home each day if needed?",
    type: 'boolean',
    schemaField: 'has_thermometer',
  },

  {
    id: 'has_pulse_oximeter',
    section: 'Monitoring Devices',
    patientText: 'Are you able to check your oxygen level (pulse oximeter) at home each day if needed?',
    caregiverText: "Are you able to check the patient's oxygen level (pulse oximeter) at home each day if needed?",
    type: 'boolean',
    schemaField: 'has_pulse_oximeter',
  },

  {
    id: 'has_bp_cuff',
    section: 'Monitoring Devices',
    patientText: 'Are you able to check your blood pressure (blood pressure cuff) at home each day if needed?',
    caregiverText: "Are you able to check the patient's blood pressure (blood pressure cuff) at home each day if needed?",
    type: 'boolean',
    schemaField: 'has_bp_cuff',
    businessLogic: {
      triggersFollowUp: 'baseline_bp_systolic',
    },
  },

  {
    id: 'baseline_bp_systolic',
    section: 'Monitoring Devices',
    patientText:
      'If possible, please measure your blood pressure after resting for 3 minutes, or enter your usual value if you know it. This will be saved as your baseline.',
    caregiverText:
      "If possible, please measure the patient's blood pressure after resting for 3 minutes, or enter their usual value if you know it. This will be saved as their baseline.",
    helpText: 'Enter the top number (systolic)',
    type: 'integer',
    schemaField: 'baseline_bp_systolic',
    prerequisites: [
      { field: 'has_bp_cuff', operator: '==', value: true },
    ],
    validation: {
      min: 60,
      max: 250,
    },
    placeholder: 'e.g., 120',
    unit: 'mmHg',
  },

  {
    id: 'has_hr_monitor',
    section: 'Monitoring Devices',
    patientText:
      'Are you able to check your heart rate at home each day if needed? (Some pulse oximeters and blood pressure cuffs measure this.)',
    caregiverText:
      "Are you able to check the patient's heart rate at home each day if needed? (Some pulse oximeters and blood pressure cuffs measure this.)",
    type: 'boolean',
    schemaField: 'has_hr_monitor',
  },

];

export const onboardingSections: QuestionSection[] = [
  {
    id: 'getting_started',
    title: 'Getting Started',
    icon: '👋',
    questions: onboardingQuestions.filter((q) => q.section === 'Getting Started'),
  },
  {
    id: 'basic_information',
    title: 'Basic Information',
    icon: '📋',
    questions: onboardingQuestions.filter((q) => q.section === 'Basic Information'),
  },
  {
    id: 'sepsis_context',
    title: 'Sepsis History',
    icon: '🏥',
    questions: onboardingQuestions.filter((q) => q.section === 'Sepsis Context'),
  },
  {
    id: 'medical_history',
    title: 'Medical History',
    icon: '⚕️',
    questions: onboardingQuestions.filter((q) => q.section === 'Medical History'),
  },
  {
    id: 'care_support',
    title: 'Care & Support',
    icon: '🤝',
    questions: onboardingQuestions.filter((q) => q.section === 'Care & Support'),
  },
  {
    id: 'monitoring_devices',
    title: 'Monitoring Devices',
    icon: '🩺',
    questions: onboardingQuestions.filter((q) => q.section === 'Monitoring Devices'),
  },
];

export const onboardingSurvey: Survey = {
  id: 'onboarding',
  title: 'Sepsis Monitoring - Onboarding',
  description: 'Help us understand your health history and monitoring capabilities',
  sections: onboardingSections,
  questions: onboardingQuestions,
};

export function getOnboardingQuestion(id: string): Question | undefined {
  return onboardingQuestions.find((q) => q.id === id);
}

export function getOnboardingSection(sectionId: string): QuestionSection | undefined {
  return onboardingSections.find((s) => s.id === sectionId);
}