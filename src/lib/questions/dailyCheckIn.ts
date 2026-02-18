// lib/questions/dailyCheckin.ts

import { Question, QuestionSection, Survey } from './types';

export const dailyCheckInQuestions: Question[] = [

  // ============================================================================
  // IMMEDIATE DANGER (Questions 1-4)
  // ============================================================================

  {
    id: 'fainted_or_very_dizzy',
    section: 'Immediate Danger',
    patientText: 'Have you fainted or felt very dizzy?',
    caregiverText: 'Has the patient fainted or felt very dizzy?',
    type: 'boolean',
    schemaField: 'fainted_or_very_dizzy',
    validation: { required: true },
    businessLogic: {
      terminatesSurvey: true,
      terminationMessage: 'CALL 911 IMMEDIATELY',
      requiresEmergencyAlert: true,
    },
  },

  {
    id: 'severe_trouble_breathing',
    section: 'Immediate Danger',
    patientText: 'Are you having severe trouble breathing?',
    caregiverText: 'Is the patient having severe trouble breathing?',
    type: 'boolean',
    schemaField: 'severe_trouble_breathing',
    validation: { required: true },
    businessLogic: {
      terminatesSurvey: true,
      terminationMessage: 'CALL 911 IMMEDIATELY',
      requiresEmergencyAlert: true,
    },
  },

  {
    id: 'severe_confusion',
    section: 'Immediate Danger',
    patientText: 'Are you confused or not making sense?',
    caregiverText: 'Is the patient confused or not making sense?',
    type: 'boolean',
    schemaField: 'severe_confusion',
    validation: { required: true },
    businessLogic: {
      terminatesSurvey: true,
      terminationMessage: 'CALL 911 IMMEDIATELY',
      requiresEmergencyAlert: true,
    },
  },

  {
    id: 'extreme_heat_or_chills',
    section: 'Immediate Danger',
    patientText: 'Are you feeling extremely hot or shaking with chills?',
    caregiverText: 'Is the patient feeling extremely hot or shaking with chills?',
    type: 'boolean',
    schemaField: 'extreme_heat_or_chills',
    validation: { required: true },
    businessLogic: {
      terminatesSurvey: true,
      terminationMessage: 'CALL 911 IMMEDIATELY',
      requiresEmergencyAlert: true,
    },
  },

  // ============================================================================
  // ENERGY & WELL-BEING (Questions 5-7)
  // ============================================================================

  {
    id: 'overall_feeling',
    section: 'Energy & Well-Being',
    patientText: 'How are you feeling overall today?',
    caregiverText: 'How is the patient feeling overall today?',
    type: 'scale',
    schemaField: 'overall_feeling',
    validation: {
      required: true,
      min: 1,
      max: 5,
    },
  },

  {
    id: 'energy_level',
    section: 'Energy & Well-Being',
    patientText: 'How is your energy level?',
    caregiverText: "How is the patient's energy level?",
    type: 'single_select',
    options: [
      { label: 'Normal', value: 1, iconEmoji: '💪' },
      { label: 'Slightly fatigued, too tired to do usual activities', value: 2, iconEmoji: '😴' },
      { label: 'Extremely fatigued, too weak to get out of bed', value: 3, iconEmoji: '🛌' },
    ],
    schemaField: 'energy_level',
    validation: { required: true },
  },

  {
    id: 'pain_level',
    section: 'Energy & Well-Being',
    patientText: 'Rate your pain level',
    caregiverText: "Rate the patient's pain level",
    type: 'scale',
    schemaField: 'pain_level',
    validation: {
      required: true,
      min: 0,
      max: 10,
    },
    helpText: '0 = No pain, 10 = Worst pain imaginable',
  },

  // ============================================================================
  // VITALS — TEMPERATURE (Questions 8-9)
  // ============================================================================

  {
    id: 'fever_chills',
    section: 'Vitals',
    patientText: 'Have you experienced any fever or chills?',
    caregiverText: 'Has the patient experienced any fever or chills?',
    type: 'boolean',
    schemaField: 'fever_chills',
    businessLogic: {
      triggersFollowUp: 'temperature_value',
    },
  },

  {
    id: 'temperature_value',
    section: 'Vitals',
    patientText: 'Please enter your temperature (°F)',
    caregiverText: "Please enter the patient's temperature (°F)",
    type: 'float',
    schemaField: ['temperature_value', 'temperature_zone'],
    prerequisites: [
      { field: 'fever_chills', operator: '==', value: true, source: 'current' },
      { field: 'has_thermometer', operator: '==', value: true, source: 'onboarding' },
    ],
    validation: {
      required: true,
      min: 90.0,
      max: 110.0,
    },
    placeholder: 'e.g., 98.6',
    unit: '°F',
    businessLogic: {
      calculatesZone: true,
      zoneField: 'temperature_zone',
      terminatesSurvey: true, // if zone is red
      terminationMessage: 'CALL 911 IMMEDIATELY - Temperature is dangerously high',
      requiresEmergencyAlert: true,
    },
  },

  // ============================================================================
  // VITALS — OXYGEN (Question 10)
  // ============================================================================

  {
    id: 'oxygen_level_value',
    section: 'Vitals',
    patientText: 'Please enter your oxygen level (SpO₂ %) while resting',
    caregiverText: "Please enter the patient's oxygen level (SpO₂ %) while resting",
    type: 'integer',
    schemaField: ['oxygen_level_value', 'oxygen_level_zone'],
    prerequisites: [
      { field: 'has_pulse_oximeter', operator: '==', value: true, source: 'onboarding' },
    ],
    validation: {
      required: true,
      min: 0,
      max: 100,
    },
    placeholder: 'e.g., 98',
    unit: '%',
    businessLogic: {
      calculatesZone: true,
      zoneField: 'oxygen_level_zone',
      terminatesSurvey: true, // if zone is red
      terminationMessage: 'CALL 911 IMMEDIATELY - Oxygen level is dangerously low',
      requiresEmergencyAlert: true,
    },
  },

  // ============================================================================
  // VITALS — HEART RATE (Questions 11-12)
  // ============================================================================

  {
    id: 'heart_racing',
    section: 'Vitals',
    patientText: 'Does your heart feel like it is racing or pounding?',
    caregiverText: "Does the patient's heart feel like it is racing or pounding?",
    type: 'boolean',
    schemaField: 'heart_racing',
    businessLogic: {
      triggersFollowUp: 'heart_rate_value',
    },
  },

  {
    id: 'heart_rate_value',
    section: 'Vitals',
    patientText: 'Please take your pulse and enter your heart rate (beats per minute)',
    caregiverText: "Please take the patient's pulse and enter their heart rate (beats per minute)",
    type: 'integer',
    schemaField: ['heart_rate_value', 'heart_rate_zone'],
    prerequisites: [
      { field: 'heart_racing', operator: '==', value: true, source: 'current' },
      { field: 'has_hr_monitor', operator: '==', value: true, source: 'onboarding' },
    ],
    validation: {
      required: true,
      min: 30,
      max: 250,
    },
    placeholder: 'e.g., 72',
    unit: 'bpm',
    businessLogic: {
      calculatesZone: true,
      zoneField: 'heart_rate_zone',
      terminatesSurvey: true, // if zone is red
      terminationMessage: 'CALL 911 IMMEDIATELY - Heart rate is dangerously high',
      requiresEmergencyAlert: true,
    },
  },

  // ============================================================================
  // VITALS — BLOOD PRESSURE (Question 13)
  // ============================================================================

  {
    id: 'blood_pressure_systolic',
    section: 'Vitals',
    patientText:
      'Please measure your blood pressure after resting for 3 minutes and enter the top number (systolic)',
    caregiverText:
      "Please measure the patient's blood pressure after resting for 3 minutes and enter the top number (systolic)",
    type: 'integer',
    schemaField: ['blood_pressure_systolic', 'blood_pressure_zone'],
    prerequisites: [
      { field: 'has_bp_cuff', operator: '==', value: true, source: 'onboarding' },
    ],
    validation: {
      min: 60,
      max: 250,
    },
    placeholder: 'e.g., 120',
    unit: 'mmHg',
    businessLogic: {
      calculatesZone: true,
      zoneField: 'blood_pressure_zone',
      requiresUrgentAlert: true,
    },
  },

  // ============================================================================
  // MENTAL STATUS (Question 14)
  // ============================================================================

  {
    id: 'thinking_level',
    section: 'Mental Status',
    patientText: 'How clear is your thinking?',
    caregiverText: "How clear is the patient's thinking?",
    type: 'single_select',
    options: [
      { label: 'Clear', value: 1, iconEmoji: '✅' },
      { label: 'Feels slow or not quite right', value: 2, iconEmoji: '🤔' },
      { label: "Caregivers tell me I'm not making sense", value: 3, iconEmoji: '😵' },
    ],
    schemaField: 'thinking_level',
    validation: { required: true },
    businessLogic: {
      terminatesSurvey: true, // if value is 3
      terminationMessage: 'CALL 911 IMMEDIATELY - Severe mental status change',
      requiresEmergencyAlert: true,
    },
  },

  // ============================================================================
  // BREATHING (Question 15)
  // ============================================================================

  {
    id: 'breathing_level',
    section: 'Breathing',
    patientText: 'How is your breathing?',
    caregiverText: "How is the patient's breathing?",
    type: 'single_select',
    options: [
      { label: 'Normal', value: 1, iconEmoji: '😊' },
      { label: 'Slightly more difficult/faster than usual', value: 2, iconEmoji: '😮‍💨' },
      { label: 'Extremely difficult, major shortness of breath', value: 3, iconEmoji: '🆘' },
    ],
    schemaField: 'breathing_level',
    validation: { required: true },
    businessLogic: {
      terminatesSurvey: true, // if value is 3
      terminationMessage: 'CALL 911 IMMEDIATELY - Severe breathing difficulty',
      requiresEmergencyAlert: true,
    },
  },

  // ============================================================================
  // ORGAN FUNCTION — URINE (Questions 16-18)
  // ============================================================================

  {
    id: 'urine_appearance_level',
    section: 'Organ Function',
    patientText: 'How does your urine look?',
    caregiverText: "How does the patient's urine look?",
    type: 'single_select',
    options: [
      { label: 'Normal', value: 1, iconEmoji: '✅' },
      { label: 'Cloudy, dark, or smelly', value: 2, iconEmoji: '⚠️' },
      {
        label: 'Very dark, brown/tea-colored, red, or significantly different than usual',
        value: 3,
        iconEmoji: '🚨',
      },
    ],
    schemaField: 'urine_appearance_level',
    validation: { required: true },
  },

  {
    id: 'uti_symptoms_worsening',
    section: 'Organ Function',
    patientText: 'In the past 24 hours, your urine symptoms have:',
    caregiverText: "In the past 24 hours, the patient's urine symptoms have:",
    type: 'single_select',
    options: [
      {
        label: 'No symptoms or improving',
        value: 'improved',
        description: 'No burning, urgency, pressure, or pain, or symptoms are getting better',
      },
      {
        label: 'Mild or unchanged symptoms',
        value: 'same',
        description: 'Ongoing burning, frequent urination, pressure, or mild discomfort',
      },
      {
        label: 'Worsened',
        value: 'worsened',
        description:
          'Increased burning, severe urgency or frequency, strong odor, worsening lower abdominal or back pain',
      },
    ],
    schemaField: 'uti_symptoms_worsening',
    prerequisites: [
      { field: 'has_recent_uti', operator: '==', value: true, source: 'onboarding' },
    ],
  },

  {
    id: 'urine_output_level',
    section: 'Organ Function',
    patientText: 'How is your urine output?',
    caregiverText: "How is the patient's urine output?",
    type: 'single_select',
    options: [
      { label: 'Normal', value: 1, iconEmoji: '✅' },
      { label: 'Less than usual', value: 2, iconEmoji: '⚠️' },
      { label: 'Little to none', value: 3, iconEmoji: '🚨' },
    ],
    schemaField: 'urine_output_level',
    prerequisites: [
      {
        field: 'has_kidney_disease',
        operator: '==',
        value: true,
        source: 'onboarding',
      },
      {
        field: 'has_kidney_failure',
        operator: '==',
        value: true,
        source: 'onboarding',
      }, 
      {
        field: 'has_dialysis',
        operator: '==',
        value: true,
        source: 'onboarding',
      }
    ],
  },

  // ============================================================================
  // INFECTION (Questions 19-22)
  // ============================================================================

  {
    id: 'has_cough',
    section: 'Infection',
    patientText: 'Do you have a cough or are you producing non-clear mucus?',
    caregiverText: 'Does the patient have a cough or are they producing non-clear mucus?',
    type: 'boolean',
    schemaField: 'has_cough',
    businessLogic: {
      triggersFollowUp: 'cough_worsening',
    },
  },

  {
    id: 'cough_worsening',
    section: 'Infection',
    patientText: 'Has your cough worsened or is your mucus colored?',
    caregiverText: "Has the patient's cough worsened or is their mucus colored?",
    type: 'boolean',
    schemaField: 'cough_worsening',
    prerequisites: [
      { field: 'has_cough', operator: '==', value: true, source: 'current' },
      { field: 'has_recent_pneumonia', operator: '==', value: true, source: 'onboarding' },
    ],
  },

  {
    id: 'wound_state_level',
    section: 'Infection',
    patientText: 'If you have a wound site (surgical or non-surgical), how does it look?',
    caregiverText: "If the patient has a wound site (surgical or non-surgical), how does it look?",
    type: 'single_select',
    options: [
      { label: 'Healing', value: 1, iconEmoji: '✅' },
      { label: 'Looks different', value: 2, iconEmoji: '⚠️' },
      { label: 'Painful, red, smells, has pus, or is swollen', value: 3, iconEmoji: '🚨' },
    ],
    schemaField: 'wound_state_level',
    prerequisites: [
      { field: 'has_active_wound', operator: '==', value: true, source: 'onboarding' },
    ],
  },

  {
    id: 'discolored_skin',
    section: 'Infection',
    patientText:
      'Are your skin, lips, or nails a different color than usual? (For example: pale, bluish, purple, gray, or yellow)',
    caregiverText:
      "Are the patient's skin, lips, or nails a different color than usual? (For example: pale, bluish, purple, gray, or yellow)",
    type: 'boolean',
    schemaField: 'discolored_skin',
    businessLogic: {
      terminatesSurvey: true,
      terminationMessage: 'CALL 911 IMMEDIATELY - Skin discoloration indicates poor perfusion or hypoxia',
      requiresEmergencyAlert: true,
    },
  },

  // ============================================================================
  // GI SYMPTOMS (Question 23)
  // ============================================================================

  {
    id: 'nausea_vomiting_diarrhea',
    section: 'GI Symptoms',
    patientText: 'In the last 24 hours, have you experienced any nausea, vomiting, or diarrhea?',
    caregiverText: 'In the last 24 hours, has the patient experienced any nausea, vomiting, or diarrhea?',
    type: 'boolean',
    schemaField: 'nausea_vomiting_diarrhea',
  },

  // ============================================================================
  // ADDITIONAL NOTES (Question 24)
  // ============================================================================

  {
    id: 'additional_notes',
    section: 'Additional Notes',
    patientText: 'Anything else you would like to log?',
    caregiverText: 'Anything else you would like to log about the patient?',
    type: 'textarea',
    schemaField: 'additional_notes',
    placeholder: 'Optional - Any other symptoms, concerns, or observations...',
    validation: {
      maxLength: 1000,
    },
  },
];

export const dailyCheckInSections: QuestionSection[] = [
  {
    id: 'immediate_danger',
    title: 'Immediate Safety Check',
    description: 'Critical symptoms that require immediate attention',
    icon: '🚨',
    questions: dailyCheckInQuestions.filter((q) => q.section === 'Immediate Danger'),
  },
  {
    id: 'energy_wellbeing',
    title: 'Energy & Well-Being',
    description: "How you're feeling overall",
    icon: '💪',
    questions: dailyCheckInQuestions.filter((q) => q.section === 'Energy & Well-Being'),
  },
  {
    id: 'vitals',
    title: 'Vital Signs',
    description: 'Temperature, oxygen, heart rate, blood pressure',
    icon: '🩺',
    questions: dailyCheckInQuestions.filter((q) => q.section === 'Vitals'),
  },
  {
    id: 'mental_status',
    title: 'Mental Status',
    description: 'Mental clarity and alertness',
    icon: '🧠',
    questions: dailyCheckInQuestions.filter((q) => q.section === 'Mental Status'),
  },
  {
    id: 'breathing',
    title: 'Breathing',
    description: 'Respiratory status',
    icon: '🫁',
    questions: dailyCheckInQuestions.filter((q) => q.section === 'Breathing'),
  },
  {
    id: 'organ_function',
    title: 'Organ Function',
    description: 'Urine appearance and output',
    icon: '🩸',
    questions: dailyCheckInQuestions.filter((q) => q.section === 'Organ Function'),
  },
  {
    id: 'infection',
    title: 'Infection Signs',
    description: 'Cough, wound status, skin changes',
    icon: '🦠',
    questions: dailyCheckInQuestions.filter((q) => q.section === 'Infection'),
  },
  {
    id: 'gi_symptoms',
    title: 'GI Symptoms',
    description: 'Digestive issues',
    icon: '🤢',
    questions: dailyCheckInQuestions.filter((q) => q.section === 'GI Symptoms'),
  },
  {
    id: 'additional_notes',
    title: 'Additional Notes',
    description: 'Anything else to share',
    icon: '📝',
    questions: dailyCheckInQuestions.filter((q) => q.section === 'Additional Notes'),
  },
];

export const dailyCheckInSurvey: Survey = {
  id: 'daily_checkin',
  title: 'Daily Health Check-In',
  description: 'Monitor your symptoms and vital signs over the last 24 hours',
  sections: dailyCheckInSections,
  questions: dailyCheckInQuestions,
};

export function getDailyCheckInQuestion(id: string): Question | undefined {
  return dailyCheckInQuestions.find((q) => q.id === id);
}

export function getDailyCheckInSection(sectionId: string): QuestionSection | undefined {
  return dailyCheckInSections.find((s) => s.id === sectionId);
}

export function requiresOnboardingData(question: Question): boolean {
  return question.prerequisites?.some((p) => p.source === 'onboarding') || false;
}

export function getImmediateDangerQuestions(): Question[] {
  return dailyCheckInQuestions.filter((q) => q.section === 'Immediate Danger');
}

export function canTerminateSurvey(question: Question): boolean {
  return question.businessLogic?.terminatesSurvey || false;
}