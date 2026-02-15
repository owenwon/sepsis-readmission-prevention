/**
 * SEPSIS RISK CALCULATOR
 * 
 * This calculator uses a tiered decision system to avoid "yellow inflation"
 * and accurately detect sepsis patterns while minimizing false negatives.
 * 
 * Algorithm Flow:
 * 1. Check for immediate emergency conditions (hard stops)
 * 2. Apply hard RED overrides for critical vital signs
 * 3. Count critical flags (multiple red-zone indicators)
 * 4. Calculate interaction scores (sepsis pattern detection)
 * 5. Calculate base score from individual symptoms
 * 6. Apply high-risk modifier
 * 7. Apply escalation overrides
 * 8. Return final risk level with thresholds
 */

export type RiskLevel = 'GREEN' | 'YELLOW' | 'RED' | 'RED_EMERGENCY';

export interface SurveyResponse {
  // IMMEDIATE DANGER (Q1-Q4)
  fainted_or_very_dizzy: boolean;
  severe_trouble_breathing: boolean;
  severe_confusion: boolean;
  extreme_heat_or_chills: boolean;

  // ENERGY & WELL-BEING (Q5-Q7)
  overall_feeling?: number; // 1-5, tracking only
  energy_level: number; // 1=normal, 2=fatigued, 3=extremely fatigued
  pain_level?: number; // 0-10, tracking only

  // VITALS (Q8-Q13)
  fever_chills: boolean;
  has_thermometer: boolean;
  temperature_value?: number; // °F
  temperature_zone?: number; // 1=green, 2=yellow, 3=red

  has_pulse_oximeter: boolean;
  oxygen_level_value?: number; // %
  oxygen_level_zone?: number; // 1=green, 2=yellow, 3=red

  heart_racing: boolean;
  has_hr_monitor: boolean;
  heart_rate_value?: number; // bpm
  heart_rate_zone?: number; // 1=green, 2=yellow, 3=red

  has_bp_cuff: boolean;
  blood_pressure_systolic?: number; // mmHg
  baseline_bp_systolic?: number; // from onboarding
  blood_pressure_zone?: number; // 1=green, 2=yellow, 3=red

  // MENTAL STATUS (Q14)
  thinking_level: number; // 1=clear, 2=slow, 3=not making sense

  // BREATHING (Q15)
  breathing_level: number; // 1=normal, 2=difficult, 3=extremely difficult

  // ORGAN FUNCTION (Q16-Q18)
  urine_appearance_level: number; // 1=normal, 2=cloudy, 3=very dark/bloody

  has_recent_uti: boolean;
  uti_symptoms_worsening?: 'improved' | 'same' | 'worsened' | 'not_applicable';

  has_kidney_disease: boolean;
  has_kidney_failure: boolean;
  has_dialysis: boolean;
  urine_output_level?: number; // 1=normal, 2=low, 3=very low/none

  // INFECTION (Q19-Q22)
  has_cough: boolean;
  has_recent_pneumonia: boolean;
  cough_worsening?: boolean;

  has_active_wound: boolean;
  wound_state_level?: number; // 1=healing, 2=different, 3=infected

  discolored_skin: boolean;

  // GI SYMPTOMS (Q23)
  nausea_vomiting_diarrhea: boolean;

  // ADDITIONAL NOTES (Q24)
  additional_notes?: string;

  // PATIENT CONTEXT
  age?: number;
  weakened_immune: boolean;
  readmission_count: number;
}

export interface RiskCalculationResult {
  riskLevel: RiskLevel;
  totalScore: number;
  baseScore: number;
  interactionScore: number;
  criticalFlags: number;
  highRiskModifierApplied: boolean;
  reasoning: string[];
  emergencyMessage?: string;
}

/**
 * Calculate zones if not pre-calculated
 */
function calculateZones(response: SurveyResponse): void {
  // Temperature zones
  if (response.temperature_value !== undefined && response.temperature_zone === undefined) {
    const temp = response.temperature_value;
    if (temp >= 96.8 && temp <= 99.9) {
      response.temperature_zone = 1; // green
    } else if (temp >= 100 && temp <= 101.4) {
      response.temperature_zone = 2; // yellow
    } else {
      response.temperature_zone = 3; // red
    }
  }

  // Oxygen zones
  if (response.oxygen_level_value !== undefined && response.oxygen_level_zone === undefined) {
    const o2 = response.oxygen_level_value;
    if (o2 >= 95 && o2 <= 100) {
      response.oxygen_level_zone = 1; // green
    } else if (o2 >= 92 && o2 <= 94) {
      response.oxygen_level_zone = 2; // yellow
    } else {
      response.oxygen_level_zone = 3; // red
    }
  }

  // Heart rate zones
  if (response.heart_rate_value !== undefined && response.heart_rate_zone === undefined) {
    const hr = response.heart_rate_value;
    if (hr >= 60 && hr <= 100) {
      response.heart_rate_zone = 1; // green
    } else if (hr >= 101 && hr <= 120) {
      response.heart_rate_zone = 2; // yellow
    } else {
      response.heart_rate_zone = 3; // red
    }
  }

  // Blood pressure zones
  if (response.blood_pressure_systolic !== undefined && response.blood_pressure_zone === undefined) {
    const bp = response.blood_pressure_systolic;
    const baseline = response.baseline_bp_systolic || 120;
    const diff = baseline - bp;

    if (bp < 90 || bp > 180) {
      response.blood_pressure_zone = 3; // red - absolute thresholds
    } else if (diff >= 40) {
      response.blood_pressure_zone = 3; // red - 40+ point drop
    } else if (diff >= 20) {
      response.blood_pressure_zone = 2; // yellow - 20-39 point drop
    } else if (Math.abs(diff) <= 20) {
      response.blood_pressure_zone = 1; // green - within normal range
    } else {
      response.blood_pressure_zone = 1; // green - elevated but not critical
    }
  }
}

/**
 * STEP 1: Check for immediate emergency conditions
 * These require 911 and terminate all further processing
 */
function checkEmergencyConditions(response: SurveyResponse): RiskCalculationResult | null {
  const reasoning: string[] = [];

  // Q1-Q4: Immediate danger questions
  if (response.fainted_or_very_dizzy) {
    reasoning.push('EMERGENCY: Patient has fainted or is very dizzy');
    return {
      riskLevel: 'RED_EMERGENCY',
      totalScore: 1000,
      baseScore: 0,
      interactionScore: 0,
      criticalFlags: 0,
      highRiskModifierApplied: false,
      reasoning,
      emergencyMessage: 'CALL 911 IMMEDIATELY - Patient has fainted or is very dizzy'
    };
  }

  if (response.severe_trouble_breathing) {
    reasoning.push('EMERGENCY: Patient has severe trouble breathing');
    return {
      riskLevel: 'RED_EMERGENCY',
      totalScore: 1000,
      baseScore: 0,
      interactionScore: 0,
      criticalFlags: 0,
      highRiskModifierApplied: false,
      reasoning,
      emergencyMessage: 'CALL 911 IMMEDIATELY - Severe breathing trouble'
    };
  }

  if (response.severe_confusion) {
    reasoning.push('EMERGENCY: Patient is severely confused or not making sense');
    return {
      riskLevel: 'RED_EMERGENCY',
      totalScore: 1000,
      baseScore: 0,
      interactionScore: 0,
      criticalFlags: 0,
      highRiskModifierApplied: false,
      reasoning,
      emergencyMessage: 'CALL 911 IMMEDIATELY - Severe confusion'
    };
  }

  if (response.extreme_heat_or_chills) {
    reasoning.push('EMERGENCY: Patient has extreme heat or shaking chills');
    return {
      riskLevel: 'RED_EMERGENCY',
      totalScore: 1000,
      baseScore: 0,
      interactionScore: 0,
      criticalFlags: 0,
      highRiskModifierApplied: false,
      reasoning,
      emergencyMessage: 'CALL 911 IMMEDIATELY - Extreme heat or shaking chills'
    };
  }

  return null;
}

/**
 * STEP 2: Check for hard RED overrides
 * Critical vital signs that require immediate escalation
 */
function checkHardRedOverrides(response: SurveyResponse): RiskCalculationResult | null {
  const reasoning: string[] = [];

  // Q9: Temperature >= 103.5°F
  if (response.temperature_value !== undefined && response.temperature_value >= 103.5) {
    reasoning.push(`CRITICAL: Temperature ${response.temperature_value}°F (≥103.5°F threshold)`);
    return {
      riskLevel: 'RED_EMERGENCY',
      totalScore: 1000,
      baseScore: 0,
      interactionScore: 0,
      criticalFlags: 0,
      highRiskModifierApplied: false,
      reasoning,
      emergencyMessage: 'CALL 911 IMMEDIATELY - Dangerously high temperature'
    };
  }

  // Q10: Oxygen < 90%
  if (response.oxygen_level_value !== undefined && response.oxygen_level_value < 90) {
    reasoning.push(`CRITICAL: Oxygen level ${response.oxygen_level_value}% (<90% threshold)`);
    return {
      riskLevel: 'RED_EMERGENCY',
      totalScore: 1000,
      baseScore: 0,
      interactionScore: 0,
      criticalFlags: 0,
      highRiskModifierApplied: false,
      reasoning,
      emergencyMessage: 'CALL 911 IMMEDIATELY - Dangerously low oxygen level'
    };
  }

  // Q12: Heart rate > 140 bpm
  if (response.heart_rate_value !== undefined && response.heart_rate_value > 140) {
    reasoning.push(`CRITICAL: Heart rate ${response.heart_rate_value} bpm (>140 bpm threshold)`);
    return {
      riskLevel: 'RED_EMERGENCY',
      totalScore: 1000,
      baseScore: 0,
      interactionScore: 0,
      criticalFlags: 0,
      highRiskModifierApplied: false,
      reasoning,
      emergencyMessage: 'CALL 911 IMMEDIATELY - Dangerously high heart rate'
    };
  }

  // Q15: Breathing level = 3 (extremely difficult)
  if (response.breathing_level === 3) {
    reasoning.push('CRITICAL: Extremely difficult breathing, major shortness of breath');
    return {
      riskLevel: 'RED_EMERGENCY',
      totalScore: 1000,
      baseScore: 0,
      interactionScore: 0,
      criticalFlags: 0,
      highRiskModifierApplied: false,
      reasoning,
      emergencyMessage: 'CALL 911 IMMEDIATELY - Extreme breathing difficulty'
    };
  }

  // Q14: Thinking level = 3 (not making sense)
  if (response.thinking_level === 3) {
    reasoning.push('CRITICAL: Patient is not making sense, severe altered mental status');
    return {
      riskLevel: 'RED_EMERGENCY',
      totalScore: 1000,
      baseScore: 0,
      interactionScore: 0,
      criticalFlags: 0,
      highRiskModifierApplied: false,
      reasoning,
      emergencyMessage: 'CALL 911 IMMEDIATELY - Severe mental status change'
    };
  }

  return null;
}

/**
 * STEP 3: Count critical flags
 * Red-zone vital signs and organ dysfunction indicators
 */
function countCriticalFlags(response: SurveyResponse): number {
  let criticalFlags = 0;
  
  // Temperature in red zone
  if (response.temperature_zone === 3) {
    criticalFlags++;
  }

  // Oxygen in red zone
  if (response.oxygen_level_zone === 3) {
    criticalFlags++;
  }

  // Heart rate in red zone
  if (response.heart_rate_zone === 3) {
    criticalFlags++;
  }

  // Blood pressure in red zone
  if (response.blood_pressure_zone === 3) {
    criticalFlags++;
  }

  // Urine appearance in red zone
  if (response.urine_appearance_level === 3) {
    criticalFlags++;
  }

  // Urine output in red zone
  if (response.urine_output_level === 3) {
    criticalFlags++;
  }

  // Wound in red zone (infected)
  if (response.wound_state_level === 3) {
    criticalFlags++;
  }

  return criticalFlags;
}

/**
 * STEP 4: Calculate interaction scores
 * Detect sepsis patterns from combinations of symptoms
 */
function calculateInteractionScore(response: SurveyResponse): { score: number; reasoning: string[] } {
  let score = 0;
  const reasoning: string[] = [];

  // INTERACTION 1: Infection + vital sign abnormality (SIRS criteria)
  // Fever + tachycardia is a classic sepsis indicator
  if ((response.temperature_zone ?? 0) >= 2 && (response.heart_rate_zone ?? 0) >= 2) {
    score += 20;
    reasoning.push('Sepsis pattern: Fever with elevated heart rate (SIRS criteria)');
  }

  // INTERACTION 2: Oxygen + breathing
  // Respiratory distress with hypoxia
  if ((response.oxygen_level_zone ?? 0) >= 2 && response.breathing_level >= 2) {
    score += 20;
    reasoning.push('Respiratory sepsis pattern: Low oxygen with breathing difficulty');
  }

  // INTERACTION 3: BP drop + mental change (septic shock)
  // Hypotension with altered mental status = brain hypoperfusion
  if ((response.blood_pressure_zone ?? 0) >= 2 && response.thinking_level >= 2) {
    score += 25;
    reasoning.push('Septic shock pattern: Low blood pressure with altered mental status');
  }

  // INTERACTION 4: Infection + organ dysfunction
  // UTI symptoms with fever suggests urosepsis
  if (response.fever_chills && response.urine_appearance_level >= 2) {
    score += 15;
    reasoning.push('Urosepsis pattern: Fever with abnormal urine');
  }

  // INTERACTION 5: Fatigue + vitals
  // Extreme fatigue with cardiovascular stress
  if (response.energy_level === 3 && 
      ((response.heart_rate_zone ?? 0) >= 2 || (response.oxygen_level_zone ?? 0) >= 2)) {
    score += 20;
    reasoning.push('Systemic infection pattern: Extreme fatigue with vital sign abnormalities');
  }

  return { score, reasoning };
}

/**
 * STEP 5: Calculate base score
 * Individual symptom contributions with reduced weights for weak signals
 */
function calculateBaseScore(response: SurveyResponse): { score: number; reasoning: string[] } {
  let score = 0;
  const reasoning: string[] = [];

  // Q6: ENERGY LEVEL
  if (response.energy_level === 2) {
    score += 5;
    reasoning.push('Moderate fatigue (+5)');
  } else if (response.energy_level === 3) {
    score += 15;
    reasoning.push('Extreme fatigue, too weak to get out of bed (+15)');
  }

  // Q8: FEVER/CHILLS (subjective, only if no thermometer)
  if (response.fever_chills && !response.has_thermometer) {
    score += 10;
    reasoning.push('Subjective fever without measurement (+10)');
  }

  // Q9: TEMPERATURE (objective)
  if (response.temperature_zone === 2) {
    score += 15;
    reasoning.push(`Temperature ${response.temperature_value}°F - yellow zone (+15)`);
  } else if (response.temperature_zone === 3) {
    score += 40;
    reasoning.push(`Temperature ${response.temperature_value}°F - red zone (+40)`);
  }

  // Q10: OXYGEN LEVEL
  if (response.oxygen_level_zone === 2) {
    score += 15;
    reasoning.push(`Oxygen ${response.oxygen_level_value}% - yellow zone (+15)`);
  } else if (response.oxygen_level_zone === 3) {
    score += 40;
    reasoning.push(`Oxygen ${response.oxygen_level_value}% - red zone (+40)`);
  }

  // Q11: HEART RACING (subjective, only if no monitor)
  if (response.heart_racing && !response.has_hr_monitor) {
    score += 5;
    reasoning.push('Subjective heart racing without measurement (+5)');
  }

  // Q12: HEART RATE (objective)
  if (response.heart_rate_zone === 2) {
    score += 8;
    reasoning.push(`Heart rate ${response.heart_rate_value} bpm - yellow zone (+8)`);
  } else if (response.heart_rate_zone === 3) {
    score += 20;
    reasoning.push(`Heart rate ${response.heart_rate_value} bpm - red zone (+20)`);
  }

  // Q13: BLOOD PRESSURE
  if (response.blood_pressure_zone === 2) {
    score += 8;
    reasoning.push(`Blood pressure ${response.blood_pressure_systolic} mmHg - yellow zone (+8)`);
  } else if (response.blood_pressure_zone === 3) {
    score += 20;
    reasoning.push(`Blood pressure ${response.blood_pressure_systolic} mmHg - red zone (+20)`);
  }

  // Q14: THINKING CLARITY
  if (response.thinking_level === 2) {
    score += 8;
    reasoning.push('Thinking feels slow or not quite right (+8)');
  }
  // Level 3 caught by emergency override, won't reach here

  // Q15: BREATHING STATUS
  if (response.breathing_level === 2) {
    score += 8;
    reasoning.push('Breathing slightly more difficult or faster than usual (+8)');
  }
  // Level 3 caught by emergency override, won't reach here

  // Q16: URINE APPEARANCE
  if (response.urine_appearance_level === 2) {
    score += 15;
    reasoning.push('Urine is cloudy, dark, or smelly (+15)');
  } else if (response.urine_appearance_level === 3) {
    score += 40;
    reasoning.push('Urine is very dark, brown/tea-colored, red, or significantly different (+40)');
  }

  // Q17: UTI SYMPTOMS PROGRESSION
  if (response.uti_symptoms_worsening === 'same' && response.has_recent_uti) {
    score += 10;
    reasoning.push('UTI symptoms unchanged (+10)');
  } else if (response.uti_symptoms_worsening === 'worsened') {
    score += 30;
    reasoning.push('UTI symptoms worsening (+30)');
  }

  // Q18: URINE OUTPUT
  if (response.urine_output_level === 2) {
    score += 8;
    reasoning.push('Urine output less than usual (+8)');
  } else if (response.urine_output_level === 3) {
    score += 40;
    reasoning.push('Urine output little to none - oliguria (+40)');
  }

  // Q19: COUGH/MUCUS
  if (response.has_cough) {
    score += 3;
    reasoning.push('Cough or non-clear mucus present (+3)');
  }

  // Q20: PNEUMONIA PROGRESSION
  if (response.cough_worsening) {
    score += 5;
    reasoning.push('Pneumonia symptoms worsening (+5)');
  }

  // Q21: WOUND STATUS
  if (response.wound_state_level === 2) {
    score += 10;
    reasoning.push('Wound looks different than usual (+10)');
  } else if (response.wound_state_level === 3) {
    score += 40;
    reasoning.push('Wound shows infection signs: painful, red, smells, pus, or swollen (+40)');
  }

  // Q22: SKIN DISCOLORATION
  if (response.discolored_skin) {
    score += 30;
    reasoning.push('Skin, lips, or nails discolored - possible mottling/cyanosis (+30)');
  }

  // Q23: GI SYMPTOMS
  if (response.nausea_vomiting_diarrhea) {
    score += 5;
    reasoning.push('GI symptoms: nausea, vomiting, or diarrhea (+5)');
  }

  return { score, reasoning };
}

/**
 * STEP 6: Apply high-risk modifier
 */
function isHighRiskPatient(response: SurveyResponse): boolean {
  return (
    (response.age !== undefined && response.age >= 65) ||
    response.weakened_immune ||
    response.readmission_count >= 1
  );
}

/**
 * STEP 7: Determine final risk level with thresholds and overrides
 */
function determineFinalRiskLevel(
  baseScore: number,
  interactionScore: number,
  criticalFlags: number,
  highRiskModifier: boolean
): RiskLevel {
  // Apply high-risk multiplier
  let totalScore = baseScore + interactionScore;
  if (highRiskModifier) {
    totalScore *= 1.25;
  }

  // OVERRIDE 1: Multiple critical flags = RED
  if (criticalFlags >= 2) {
    return 'RED';
  }

  // OVERRIDE 2: High interaction score = RED
  // (Strong sepsis pattern detected)
  if (interactionScore >= 40) {
    return 'RED';
  }

  // STANDARD THRESHOLDS
  if (totalScore >= 60) {
    return 'RED';
  }

  if (totalScore >= 30) {
    // OVERRIDE 3: Yellow with 1 critical flag = RED
    if (criticalFlags >= 1) {
      return 'RED';
    }
    return 'YELLOW';
  }

  return 'GREEN';
}

/**
 * MAIN RISK CALCULATION FUNCTION
 */
export function calculateSepsisRisk(response: SurveyResponse): RiskCalculationResult {
  const allReasoning: string[] = [];

  // Ensure zones are calculated
  calculateZones(response);

  // STEP 1: Emergency conditions
  const emergency = checkEmergencyConditions(response);
  if (emergency) return emergency;

  // STEP 2: Hard RED overrides
  const hardRed = checkHardRedOverrides(response);
  if (hardRed) return hardRed;

  // STEP 3: Count critical flags
  const criticalFlags = countCriticalFlags(response);
  if (criticalFlags > 0) {
    allReasoning.push(`Critical flags detected: ${criticalFlags} vital sign(s) or organ system(s) in red zone`);
  }

  // STEP 4: Calculate interaction score
  const interactionResult = calculateInteractionScore(response);
  if (interactionResult.score > 0) {
    allReasoning.push(...interactionResult.reasoning);
  }

  // STEP 5: Calculate base score
  const baseResult = calculateBaseScore(response);
  allReasoning.push(...baseResult.reasoning);

  // STEP 6: High-risk modifier
  const highRiskModifier = isHighRiskPatient(response);
  if (highRiskModifier) {
    allReasoning.push('High-risk patient modifier applied: 25% score increase');
  }

  // Calculate raw scores
  let baseScore = baseResult.score;
  let interactionScore = interactionResult.score;
  let totalScore = baseScore + interactionScore;

  // Apply multiplier
  if (highRiskModifier) {
    totalScore = Math.round(totalScore * 1.25);
  }

  // STEP 7: Determine final risk level
  const riskLevel = determineFinalRiskLevel(baseScore, interactionScore, criticalFlags, highRiskModifier);

  // Add final reasoning
  allReasoning.push(`Base score: ${baseScore}, Interaction score: ${interactionScore}, Total: ${totalScore}`);

  // Determine emergency message if applicable
  let emergencyMessage: string | undefined;
  if (riskLevel === 'RED') {
    if (criticalFlags >= 2) {
      emergencyMessage = 'SEEK IMMEDIATE MEDICAL ATTENTION - Multiple critical vital signs detected';
    } else if (interactionScore >= 40) {
      emergencyMessage = 'SEEK IMMEDIATE MEDICAL ATTENTION - Strong sepsis pattern detected';
    } else if (criticalFlags === 1 && totalScore >= 30) {
      emergencyMessage = 'SEEK IMMEDIATE MEDICAL ATTENTION - Critical vital sign with concerning symptoms';
    } else {
      emergencyMessage = 'SEEK IMMEDIATE MEDICAL ATTENTION - High sepsis risk score';
    }
  }

  return {
    riskLevel,
    totalScore,
    baseScore,
    interactionScore,
    criticalFlags,
    highRiskModifierApplied: highRiskModifier,
    reasoning: allReasoning,
    emergencyMessage
  };
}