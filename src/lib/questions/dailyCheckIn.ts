// lib/questions/dailyCheckin.ts

import { Question, QuestionSection, Survey } from './types';

export const dailyCheckInQuestions: Question[] = [

  // ============================================================================
  // IMMEDIATE DANGER (Questions 1-5)
  // ============================================================================

  {
    id: 'fainted_or_very_dizzy',
    section: 'Immediate Danger',
    patientText: 'Have you fainted or felt very dizzy?',
    caregiverText: 'Has the patient fainted or felt very dizzy?',
    helpText: 'Answer yes if you passed out, almost passed out, or feel so dizzy you cannot stand safely.',
    caregiverHelpText: 'Answer yes if the patient passed out, almost passed out, or seems too dizzy to stand safely.',
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
    id: 'breathing_level',
    section: 'Immediate Danger',
    patientText: 'How is your breathing right now?',
    caregiverText: "How is the patient's breathing right now?",
    helpText: 'Compare how your breathing feels right now to how it normally feels when you are sitting and at rest.',
    caregiverHelpText: "Compare how the patient's breathing seems right now to how it normally looks when they are sitting and at rest.",
    type: 'single_select',
    options: [
      { label: 'Normal', value: 1, iconEmoji: '😊' },
      { label: 'Slightly more difficult or faster than usual', value: 2, iconEmoji: '😮‍💨' },
      { label: 'Extremely difficult, major shortness of breath', value: 3, iconEmoji: '🆘' },
    ],
    schemaField: 'breathing_level',
    validation: { required: true },
    businessLogic: {
      terminatesSurvey: true,
      terminationMessage: 'CALL 911 IMMEDIATELY',
      requiresEmergencyAlert: true,
    },
  },

  {
    id: 'thinking_level',
    section: 'Immediate Danger',
    patientText: 'How clear is your thinking right now?',
    caregiverText: "How clear is the patient's thinking right now?",
    helpText: 'Ask yourself whether you know where you are, what day it is, and what you were just doing.',
    caregiverHelpText: 'Ask yourself whether the patient knows where they are, what day it is, and what is going on around them.',
    type: 'single_select',
    options: [
      { label: 'Thinking clearly', value: 1, iconEmoji: '✅' },
      { label: 'Thinking feels slow, foggy, or hard to concentrate', value: 2, iconEmoji: '🤔' },
      { label: 'Confused, unsure of surroundings, or unsure of what is going on', value: 3, iconEmoji: '😵' },
    ],
    schemaField: 'thinking_level',
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
    patientText: 'Are you feeling extremely hot or are you shaking with chills?',
    caregiverText: 'Is the patient feeling extremely hot or are they shaking with chills?',
    helpText: 'Answer yes if you are shaking so hard you cannot stop, or feel so intensely hot that it will not go away no matter what you do.',
    caregiverHelpText: 'Answer yes if the patient is shaking so hard they cannot stop, or seems so intensely hot that it will not go away no matter what you do.',
    type: 'boolean',
    schemaField: 'extreme_heat_or_chills',
    validation: { required: true },
    businessLogic: {
      terminatesSurvey: true,
      terminationMessage: 'CALL 911 IMMEDIATELY',
      requiresEmergencyAlert: true,
    },
  },

  {
    id: 'discolored_skin',
    section: 'Immediate Danger',
    patientText: 'Are your skin or lips an unusual shade of blue, purple, or gray?',
    caregiverText: "Are the patient's skin or lips an unusual shade of blue, purple, or gray?",
    helpText: 'Check your face, lips, and fingernails in good lighting — bluish or grayish color can be a sign your body is not getting enough oxygen.',
    caregiverHelpText: "Check the patient's face, lips, and fingernails in good lighting — bluish or grayish color can be a sign their body is not getting enough oxygen.",
    type: 'boolean',
    schemaField: 'discolored_skin',
    businessLogic: {
      terminatesSurvey: true,
      terminationMessage: 'CALL 911 IMMEDIATELY - Skin discoloration indicates poor perfusion or hypoxia',
      requiresEmergencyAlert: true,
    },
  },

  // ============================================================================
  // ENERGY & WELL-BEING (Questions 6-8)
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
    helpText: 'Compare your energy to a normal day before you got sepsis, not to how you felt in the hospital.',
    caregiverHelpText: "Compare the patient's energy to a normal day before they got sepsis, not to how they seemed in the hospital.",
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
    patientText: 'Rate your pain on a scale of 0 to 10, where 0 is no pain and 10 is the worst pain imaginable.',
    caregiverText: "Rate the patient's pain on a scale of 0 to 10, where 0 is no pain and 10 is the worst pain imaginable.",
    helpText: 'Think about any pain anywhere in your body, including headaches, chest pain, belly pain, or pain at a wound site.',
    caregiverHelpText: 'Think about any pain anywhere in the patient\'s body — look for signs like wincing, guarding, or verbal reports of headaches, chest pain, belly pain, or wound pain.',
    type: 'scale',
    schemaField: 'pain_level',
    validation: {
      required: true,
      min: 0,
      max: 10,
    },
  },

  // ============================================================================
  // VITALS — TEMPERATURE (Questions 9-10)
  // ============================================================================

  {
    id: 'fever_chills',
    section: 'Vitals',
    patientText: 'Have you experienced any fever or chills?',
    caregiverText: 'Has the patient experienced any fever or chills?',
    helpText: 'Answer yes even if you only feel hot or cold — you do not need a thermometer to answer this question.',
    caregiverHelpText: 'Answer yes even if the patient only feels hot or cold to the touch — a thermometer is not needed to answer this question.',
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
    helpText: 'Wait at least 30 minutes after eating, drinking, or smoking before taking your temperature for the most accurate reading.',
    caregiverHelpText: "Wait at least 30 minutes after the patient has eaten, drunk, or smoked before taking their temperature for the most accurate reading.",
    type: 'float',
    schemaField: 'temperature_value',
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
      terminatesSurvey: true,
      terminationMessage: 'CALL 911 IMMEDIATELY - Temperature is dangerously high',
      requiresEmergencyAlert: true,
    },
  },

  // ============================================================================
  // VITALS — OXYGEN (Question 11)
  // ============================================================================

  {
    id: 'oxygen_level_value',
    section: 'Vitals',
    patientText: 'Please enter your oxygen level (SpO₂ %) while resting',
    caregiverText: "Please enter the patient's oxygen level (SpO₂ %) while resting",
    helpText: 'Make sure your hand is warm and still, and remove any nail polish — these can cause a wrong reading.',
    caregiverHelpText: "Make sure the patient's hand is warm and still, and remove any nail polish from the finger being used — these can cause a wrong reading.",
    type: 'integer',
    schemaField: 'oxygen_level_value',
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
      terminatesSurvey: true,
      terminationMessage: 'CALL 911 IMMEDIATELY - Oxygen level is dangerously low',
      requiresEmergencyAlert: true,
    },
  },

  // ============================================================================
  // VITALS — HEART RATE (Questions 12-13)
  // ============================================================================

  {
    id: 'heart_racing',
    section: 'Vitals',
    patientText: 'Does your heart feel like it is racing or pounding?',
    caregiverText: "Does the patient's heart feel like it is racing or pounding?",
    helpText: 'Answer yes if your heart feels like it is beating very fast, pounding hard, or skipping or fluttering.',
    caregiverHelpText: 'Answer yes if the patient says their heart feels like it is racing, pounding, or skipping — or if you can visibly see or feel a rapid or irregular pulse.',
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
    helpText: 'Sit still and rest for 1 minute before measuring for the most accurate reading.',
    caregiverHelpText: 'Have the patient sit still and rest for 1 minute before measuring for the most accurate reading.',
    type: 'integer',
    schemaField: 'heart_rate_value',
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
      terminatesSurvey: true,
      terminationMessage: 'CALL 911 IMMEDIATELY - Heart rate is dangerously high',
      requiresEmergencyAlert: true,
    },
  },

  // ============================================================================
  // VITALS — BLOOD PRESSURE (Question 14)
  // ============================================================================

  {
    id: 'blood_pressure_systolic',
    section: 'Vitals',
    patientText:
      'Please rest for 3 minutes, then measure your blood pressure with your arm supported at heart level and without speaking. Enter the top number (systolic).',
    caregiverText:
      "Please have the patient rest for 3 minutes, then measure their blood pressure with their arm supported at heart level and without speaking. Enter the top number (systolic).",
    helpText: 'Sit quietly for 3 minutes first, rest your arm on a flat surface at heart level, and do not talk while the cuff is measuring.',
    caregiverHelpText: "Have the patient sit quietly for 3 minutes first, rest their arm on a flat surface at heart level, and make sure they do not talk while the cuff is measuring.",
    type: 'integer',
    schemaField: 'blood_pressure_systolic',
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
      requiresUrgentAlert: true,
    },
  },

  // ============================================================================
  // ORGAN FUNCTION — URINE (Questions 15-17)
  // ============================================================================

  {
    id: 'urine_appearance_level',
    section: 'Organ Function',
    patientText: 'How does your urine look?',
    caregiverText: "How does the patient's urine look?",
    helpText: 'Check your urine in good lighting — the first time you go in the morning gives the clearest picture.',
    caregiverHelpText: "Check the patient's urine in good lighting — the first time they go in the morning gives the clearest picture.",
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
    helpText: 'Burning means a painful or stinging feeling when you urinate — urgency means feeling like you cannot wait to go.',
    caregiverHelpText: 'Burning means a painful or stinging feeling when urinating — urgency means the patient feels like they cannot wait to go.',
    type: 'single_select',
    options: [
      {
        label: 'No symptoms or getting better',
        value: 'improved',
        description: 'No burning, urgency, pressure, or pain, or symptoms are improving',
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

  // ============================================================================
  // INFECTION (Questions 17-19)
  // ============================================================================

  {
    id: 'has_cough',
    section: 'Infection',
    patientText: 'If you have a cough, what color is your mucus?',
    caregiverText: "If the patient has a cough, what color is their mucus?",
    helpText: 'Mucus is the wet or sticky stuff that comes up when you cough — if you cough but nothing comes up, select "clear, white, or no mucus."',
    caregiverHelpText: 'Mucus is the wet or sticky stuff that comes up when the patient coughs — if they cough but nothing comes up, select "clear, white, or no mucus."',
    type: 'single_select',
    options: [
      { label: 'Clear, white, or no mucus', value: 1 },
      { label: 'Yellow', value: 2 },
      { label: 'Green', value: 2 },
      { label: 'Brown, pink, or red', value: 3 },
      { label: 'No cough', value: 'none' },
    ],
    schemaField: ['has_cough', 'mucus_color_level'],
    businessLogic: {
      mapToMultipleFields: true,
      customMapping: (value: number | string) => ({
        has_cough: value !== 'none',
        mucus_color_level: value === 'none' ? null : value,
      }),
    },
  },

  {
    id: 'wound_state_level',
    section: 'Infection',
    patientText: 'If you have any wound(s), how does it look compared to yesterday?',
    caregiverText: "If the patient has any wound(s), how does it look compared to yesterday?",
    helpText: 'A wound includes any cut, surgery site, sore, or broken skin — including IV sites from your hospital stay.',
    caregiverHelpText: "A wound includes any cut, surgery site, sore, or broken skin on the patient — including IV sites from their hospital stay.",
    type: 'single_select',
    options: [
      { label: 'Looks the same or better than yesterday', value: 1, iconEmoji: '✅' },
      { label: 'Color, size, or feel has changed', value: 2, iconEmoji: '⚠️' },
      { label: 'Painful, red, swollen, has pus, or smells unusual', value: 3, iconEmoji: '🚨' },
      { label: 'No wound present', value: 'none' },
    ],
    schemaField: 'wound_state_level',
  },

  {
    id: 'nausea_vomiting_diarrhea',
    section: 'GI Symptoms',
    patientText: 'In the last 24 hours, have you experienced any nausea, vomiting, or diarrhea?',
    caregiverText: 'In the last 24 hours, has the patient experienced any nausea, vomiting, or diarrhea?',
    type: 'boolean',
    schemaField: 'nausea_vomiting_diarrhea',
  },

  // ============================================================================
  // ADDITIONAL NOTES (Question 20)
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