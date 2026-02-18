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
  has_weakened_immune: boolean;
  admitted_count: number;
}

export interface RiskCalculationResult {
  riskLevel: RiskLevel;
  totalScore: number;
  baseScore: number;
  interactionScore: number; // Kept for backwards compatibility, always 0
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
  // Focus on LOW BP (hypotension) as the primary sepsis concern
  // High BP is less critical for sepsis detection
  if (response.blood_pressure_systolic !== undefined && response.blood_pressure_zone === undefined) {
    const bp = response.blood_pressure_systolic;
    const baseline = response.baseline_bp_systolic || 120;

    if (bp < 90) {
      response.blood_pressure_zone = 3; // red - severe hypotension
    } else if (bp > 180) {
      response.blood_pressure_zone = 3; // red - hypertensive crisis
    } else if (bp < baseline - 40) {
      response.blood_pressure_zone = 3; // red - significant drop from baseline
    } else if (bp < baseline - 20) {
      response.blood_pressure_zone = 2; // yellow - moderate drop from baseline
    } else {
      response.blood_pressure_zone = 1; // green - stable or elevated (not sepsis concern)
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

  // Q13: Severe hypotension (BP zone 3)
  // BP < 90 OR > 180 OR 40+ below baseline = immediate 911
  if (response.blood_pressure_zone === 3) {
    reasoning.push(`CRITICAL: Blood pressure ${response.blood_pressure_systolic} mmHg - severe hypotension or hypertensive crisis`);
    return {
      riskLevel: 'RED_EMERGENCY',
      totalScore: 1000,
      baseScore: 0,
      interactionScore: 0,
      criticalFlags: 0,
      highRiskModifierApplied: false,
      reasoning,
      emergencyMessage: 'CALL 911 IMMEDIATELY - Dangerously abnormal blood pressure'
    };
  }

  // Q22: Skin discoloration (mottling/cyanosis)
  // This is a SERIOUS clinical sign indicating poor perfusion or hypoxia
  // Mottling = septic shock, Cyanosis = severe hypoxia, Jaundice = liver failure
  if (response.discolored_skin) {
    reasoning.push('CRITICAL: Skin, lips, or nails discolored - indicates mottling, cyanosis, or jaundice');
    return {
      riskLevel: 'RED_EMERGENCY',
      totalScore: 1000,
      baseScore: 0,
      interactionScore: 0,
      criticalFlags: 0,
      highRiskModifierApplied: false,
      reasoning,
      emergencyMessage: 'CALL 911 IMMEDIATELY - Skin discoloration indicates poor perfusion or hypoxia'
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
 * STEP 4: Detect sepsis interaction patterns
 * These patterns can escalate risk level independent of score
 * Returns the highest risk level triggered by patterns
 */
function detectSepsisPatterns(response: SurveyResponse): {
  detectedPatterns: string[];
  escalationLevel: RiskLevel | null;
  escalationReason?: string;
} {
  const detectedPatterns: string[] = [];
  let escalationLevel: RiskLevel | null = null;
  let escalationReason: string | undefined;

  // Helper to set escalation only if higher priority
  const setEscalation = (level: RiskLevel, reason: string) => {
    // Priority: RED_EMERGENCY > RED > YELLOW > null
    if (escalationLevel === 'RED_EMERGENCY') return; // Already highest
    if (escalationLevel === 'RED' && level !== 'RED_EMERGENCY') return; // RED already set
    escalationLevel = level;
    escalationReason = reason;
  };

  // PATTERN 1: SEPTIC SHOCK (Moderate BP drop + altered mental status)
  // Note: Severe hypotension (zone 3) is handled by hard RED override, so this only handles zone 2
  const bpZone = response.blood_pressure_zone ?? 0;
  const hasAlteredMentalStatus = response.thinking_level >= 2;
  const hasClearInfectionContext = 
    response.fever_chills ||
    (response.temperature_zone ?? 0) >= 2 ||
    response.urine_appearance_level >= 2 ||
    response.wound_state_level === 3 ||
    (response.has_cough && response.cough_worsening);

  if (bpZone === 2 && hasAlteredMentalStatus) {
    // Moderate BP drop (zone 2) + confusion + infection context = likely septic shock → RED_EMERGENCY
    if (hasClearInfectionContext) {
      detectedPatterns.push('Septic shock pattern: Blood pressure drop with altered mental status and infection signs');
      setEscalation('RED_EMERGENCY', 'CALL 911 IMMEDIATELY - Signs of septic shock (hypotension with confusion and infection)');
      return { detectedPatterns, escalationLevel, escalationReason };
    }
    // Moderate BP drop (zone 2) + confusion WITHOUT infection = could be dehydration/meds → RED (urgent, not 911)
    else {
      detectedPatterns.push('Hypotension with confusion: Blood pressure drop with altered mental status (no clear infection)');
      setEscalation('RED', 'Seek immediate medical attention - blood pressure drop with confusion requires evaluation');
      // Don't return - continue checking other patterns
    }
  }

  // PATTERN 2: RESPIRATORY FAILURE (Low O₂ + breathing difficulty)
  if ((response.oxygen_level_zone ?? 0) >= 2 && response.breathing_level >= 2) {
    detectedPatterns.push('Respiratory failure pattern: Low oxygen with breathing difficulty');
    setEscalation('RED', 'Respiratory distress pattern detected - seek immediate medical attention');
  }

  // PATTERN 3: SILENT HYPOXIA (Low O₂ + extreme fatigue)
  if ((response.oxygen_level_zone ?? 0) >= 2 && response.energy_level === 3) {
    detectedPatterns.push('Silent hypoxia pattern: Low oxygen with extreme fatigue');
    setEscalation('RED', 'Silent hypoxia detected - seek immediate medical attention');
  }

  // PATTERN 4: SEPTIC ENCEPHALOPATHY (Fever + altered thinking)
  if (response.fever_chills && response.thinking_level >= 2) {
    detectedPatterns.push('Septic encephalopathy pattern: Fever with altered mental status');
    setEscalation('RED', 'Brain function affected by infection - seek immediate medical attention');
  }

  // PATTERN 5: COMPENSATED SHOCK (Low BP + tachycardia)
  // Heart racing to compensate for falling blood pressure
  // NOTE: Only trigger for HYPOTENSION, not hypertensive crisis (>180)
  const bpIsLow = response.blood_pressure_systolic !== undefined && 
    response.blood_pressure_systolic <= (response.baseline_bp_systolic || 120);
  if (bpZone >= 2 && bpIsLow && (response.heart_rate_zone ?? 0) >= 2) {
    detectedPatterns.push('Compensated shock pattern: Low blood pressure with elevated heart rate');
    setEscalation('RED', 'Pre-shock state detected - seek immediate medical attention');
  }

  // PATTERN 6: SEPTIC HYPOTHERMIA (Temp < 96.8°F)
  if (response.temperature_value !== undefined && response.temperature_value < 96.8) {
    detectedPatterns.push(`Hypothermia: ${response.temperature_value}°F - severe sepsis indicator`);
    setEscalation('RED', 'Hypothermia in infection setting - seek immediate medical attention');
  }

  // PATTERN 7: SIRS CRITERIA (Fever + tachycardia)
  if ((response.temperature_zone ?? 0) >= 2 && (response.heart_rate_zone ?? 0) >= 2) {
    detectedPatterns.push('SIRS criteria met: Fever with elevated heart rate');
    setEscalation('YELLOW', 'Systemic infection signs detected - contact your provider today');
  }

  // PATTERN 8: UROSEPSIS (Fever + abnormal urine)
  if (response.fever_chills && response.urine_appearance_level >= 2) {
    detectedPatterns.push('Urosepsis pattern: Fever with abnormal urine');
    setEscalation('YELLOW', 'Urinary tract infection with systemic symptoms - contact your provider today');
  }

  // PATTERN 9: CARDIOVASCULAR DECOMPENSATION (Extreme fatigue + tachycardia)
  if (response.energy_level === 3 && (response.heart_rate_zone ?? 0) >= 2) {
    detectedPatterns.push('Cardiovascular stress: Extreme fatigue with elevated heart rate');
    setEscalation('YELLOW', 'Cardiovascular strain detected - contact your provider today');
  }

  return { detectedPatterns, escalationLevel, escalationReason };
}

/**
 * STEP 5: Calculate base score
 * Individual symptom contributions - NO CAPS, straightforward scoring
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

  // Q9: TEMPERATURE
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
    reasoning.push('Subjective heart racing (+5)');
  }

  // Q12: HEART RATE
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
    reasoning.push('Thinking slow or not quite right (+8)');
  }

  // Q15: BREATHING STATUS
  if (response.breathing_level === 2) {
    score += 8;
    reasoning.push('Breathing slightly more difficult (+8)');
  }

  // Q16: URINE APPEARANCE
  if (response.urine_appearance_level === 2) {
    score += 15;
    reasoning.push('Urine cloudy, dark, or smelly (+15)');
  } else if (response.urine_appearance_level === 3) {
    score += 40;
    reasoning.push('Urine very dark, bloody, or significantly different (+40)');
  }

  // Q17: UTI SYMPTOMS
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
    reasoning.push('Urine output little to none (+40)');
  }

  // Q19: COUGH
  if (response.has_cough) {
    score += 3;
    reasoning.push('Cough or mucus present (+3)');
  }

  // Q20: PNEUMONIA WORSENING
  if (response.cough_worsening) {
    score += 5;
    reasoning.push('Pneumonia symptoms worsening (+5)');
  }

  // Q21: WOUND STATUS
  if (response.wound_state_level === 2) {
    score += 10;
    reasoning.push('Wound looks different (+10)');
  } else if (response.wound_state_level === 3) {
    score += 40;
    reasoning.push('Wound infected: red, pus, or swollen (+40)');
  }

  // Q23: GI SYMPTOMS
  if (response.nausea_vomiting_diarrhea) {
    score += 5;
    reasoning.push('GI symptoms present (+5)');
  }

  return { score, reasoning };
}

/**
 * STEP 6: Apply high-risk modifier
 */
function isHighRiskPatient(response: SurveyResponse): boolean {
  return (
    (response.age !== undefined && response.age >= 65) ||
    response.has_weakened_immune ||
    response.admitted_count > 1
  );
}

/**
 * STEP 7: Determine final risk level
 * Combines score-based thresholds AND pattern-based escalations
 * Patterns can only INCREASE risk, never decrease
 */
function determineFinalRiskLevel(
  baseScore: number,
  criticalFlags: number,
  highRiskModifier: boolean,
  patternEscalation: RiskLevel | null
): { riskLevel: RiskLevel; triggerReason: string } {
  
  // Calculate total score with high-risk modifier
  let totalScore = baseScore;
  if (highRiskModifier) {
    totalScore = Math.round(totalScore * 1.25);
  }

  // Determine score-based risk level
  let scoreBasedLevel: RiskLevel = 'GREEN';
  let scoreTrigger = '';

  // PRIORITY 1: ORGAN FAILURE (≥2 critical flags)
  if (criticalFlags >= 2) {
    scoreBasedLevel = 'RED';
    scoreTrigger = 'Multiple organ systems in red zone';
  }
  // PRIORITY 2: HIGH SCORE THRESHOLDS
  else if (totalScore >= 60) {
    scoreBasedLevel = 'RED';
    scoreTrigger = 'High sepsis risk score';
  }
  else if (totalScore >= 30 && criticalFlags >= 1) {
    scoreBasedLevel = 'RED';
    scoreTrigger = 'Critical vital sign with concerning symptoms';
  }
  else if (totalScore >= 30) {
    scoreBasedLevel = 'YELLOW';
    scoreTrigger = 'Moderate symptoms requiring evaluation';
  }
  // CRITICAL FLAG SAFETY NET: Never allow GREEN when any organ system is in critical zone
  else if (criticalFlags >= 1) {
    scoreBasedLevel = 'YELLOW';
    scoreTrigger = 'At least one vital sign or organ system in critical zone';
  }
  // else: GREEN

  // Now ESCALATE based on patterns (patterns can only increase risk, not decrease)
  let finalLevel: RiskLevel = scoreBasedLevel;
  let finalTrigger = scoreTrigger;

  if (patternEscalation) {
    // RED_EMERGENCY always wins
    if (patternEscalation === 'RED_EMERGENCY') {
      finalLevel = 'RED_EMERGENCY';
      finalTrigger = 'Septic shock pattern detected';
    }
    // RED escalates from YELLOW or GREEN
    else if (patternEscalation === 'RED' && (scoreBasedLevel === 'YELLOW' || scoreBasedLevel === 'GREEN')) {
      finalLevel = 'RED';
      finalTrigger = 'Dangerous sepsis pattern detected';
    }
    // YELLOW escalates from GREEN
    else if (patternEscalation === 'YELLOW' && scoreBasedLevel === 'GREEN') {
      finalLevel = 'YELLOW';
      finalTrigger = 'Infection pattern detected';
    }
    // If score is already higher than pattern, keep score-based level
  }

  return { riskLevel: finalLevel, triggerReason: finalTrigger };
}

/**
 * MAIN RISK CALCULATION FUNCTION
 */
export function calculateSepsisRisk(response: SurveyResponse): RiskCalculationResult {
  const allReasoning: string[] = [];

  // Ensure zones are calculated
  calculateZones(response);

  // STEP 1: Emergency conditions (Q1-Q4)
  const emergency = checkEmergencyConditions(response);
  if (emergency) return emergency;

  // STEP 2: Hard RED overrides (critical thresholds)
  const hardRed = checkHardRedOverrides(response);
  if (hardRed) return hardRed;

  // STEP 3: Count critical flags
  const criticalFlags = countCriticalFlags(response);
  if (criticalFlags > 0) {
    allReasoning.push(`⚠️ ${criticalFlags} vital sign(s) or organ system(s) in critical zone`);
  }

  // STEP 4: Detect sepsis patterns (INDEPENDENT of scoring)
  const patternResult = detectSepsisPatterns(response);
  if (patternResult.detectedPatterns.length > 0) {
    allReasoning.push('');
    allReasoning.push('🔍 Clinical Patterns Detected:');
    allReasoning.push(...patternResult.detectedPatterns.map(p => `  • ${p}`));
  }

  // If pattern triggers RED_EMERGENCY, return immediately
  if (patternResult.escalationLevel === 'RED_EMERGENCY') {
    return {
      riskLevel: 'RED_EMERGENCY',
      totalScore: 1000,
      baseScore: 0,
      interactionScore: 0,
      criticalFlags,
      highRiskModifierApplied: false,
      reasoning: allReasoning,
      emergencyMessage: patternResult.escalationReason
    };
  }

  // STEP 5: Calculate base score (no caps)
  const baseResult = calculateBaseScore(response);
  
  if (baseResult.reasoning.length > 0) {
    allReasoning.push('');
    allReasoning.push('📊 Individual Symptoms:');
    allReasoning.push(...baseResult.reasoning.map(r => `  • ${r}`));
  }

  // STEP 6: High-risk modifier
  const highRiskModifier = isHighRiskPatient(response);
  if (highRiskModifier) {
    allReasoning.push('');
    allReasoning.push('👤 High-risk patient: 25% score increase applied');
  }

  // Calculate total score
  const baseScore = baseResult.score;
  let totalScore = baseScore;
  if (highRiskModifier) {
    totalScore = Math.round(totalScore * 1.25);
  }

  allReasoning.push('');
  allReasoning.push(`📈 Total Score: ${totalScore} (Base: ${baseScore}${highRiskModifier ? ' × 1.25' : ''})`);

  // STEP 7: Determine final risk level
  const { riskLevel, triggerReason } = determineFinalRiskLevel(
    baseScore,
    criticalFlags,
    highRiskModifier,
    patternResult.escalationLevel
  );

  // Determine emergency message
  let emergencyMessage: string | undefined;
  if (riskLevel === 'RED') {
    if (patternResult.escalationLevel === 'RED') {
      emergencyMessage = patternResult.escalationReason;
    } else if (criticalFlags >= 2) {
      emergencyMessage = 'SEEK IMMEDIATE MEDICAL ATTENTION - Multiple critical vital signs detected';
    } else {
      emergencyMessage = 'SEEK IMMEDIATE MEDICAL ATTENTION - High sepsis risk';
    }
  } else if (riskLevel === 'YELLOW') {
    if (patternResult.escalationLevel === 'YELLOW') {
      emergencyMessage = patternResult.escalationReason;
    } else {
      emergencyMessage = 'Contact your healthcare provider today for evaluation';
    }
  }

  return {
    riskLevel,
    totalScore,
    baseScore,
    interactionScore: 0, // No longer used, kept for backwards compatibility
    criticalFlags,
    highRiskModifierApplied: highRiskModifier,
    reasoning: allReasoning,
    emergencyMessage
  };
}