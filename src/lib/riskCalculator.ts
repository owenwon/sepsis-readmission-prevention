/**
 * SEPSIS RISK CALCULATOR
 * 
 * This calculator uses a tiered decision system to accurately 
 * detect sepsis patterns while minimizing false negatives.
 * 
 * Algorithm Flow:
 * 1. Check for immediate emergency conditions (hard stops)
 * 2. Apply hard RED overrides for critical vital signs
 * 3. Calculate interaction scores (sepsis pattern detection)
 * 4. Calculate base score from individual symptoms
 * 5. Apply context-aware score bonuses 
 * 6. Apply high-risk modifier
 * 7. Return final risk level with thresholds
 */

export type RiskLevel = 'GREEN' | 'YELLOW' | 'RED' | 'RED_EMERGENCY';

export interface SurveyResponse {
  // IMMEDIATE DANGER (Q1-Q5)
  fainted_or_very_dizzy: boolean;
  extreme_heat_or_chills: boolean;
  discolored_skin: boolean;

  // ENERGY & WELL-BEING (Q6-Q8)
  overall_feeling?: number; // 1-5, tracking only
  energy_level: number; // 1=normal, 2=fatigued, 3=extremely fatigued
  pain_level?: number; // 0-10, tracking only

  // VITALS (Q9-Q14)
  fever_chills: boolean;
  has_thermometer: boolean;
  temperature_value?: number; // °F

  has_pulse_oximeter: boolean;
  oxygen_level_value?: number; // %

  heart_racing: boolean;
  has_hr_monitor: boolean;
  heart_rate_value?: number; // bpm

  has_bp_cuff: boolean;
  blood_pressure_systolic?: number; // mmHg
  baseline_bp_systolic?: number; // from onboarding

  // IMMEDIATE DANGER — continued
  thinking_level: number; // 1=clear, 2=slow, 3=not making sense
  breathing_level: number; // 1=normal, 2=difficult, 3=extremely difficult

  // ORGAN FUNCTION (Q15-Q16)
  urine_appearance_level: number; // 1=normal, 2=cloudy, 3=very dark/bloody

  has_recent_uti: boolean;
  uti_symptoms_worsening?: 'improved' | 'same' | 'worsened' | 'not_applicable';

  // INFECTION (Q17-Q19)
  has_cough: boolean;
  has_recent_pneumonia: boolean;
  mucus_color_level?: number | null; // 1=clear/white/none, 2=yellow/green, 3=brown/pink/red, null=no cough

  wound_state_level?: number | 'none' | null; // 1=healing, 2=different, 3=infected, 'none'=no wound

  // GI SYMPTOMS (Q19)
  nausea_vomiting_diarrhea: boolean;

  // ADDITIONAL NOTES (Q20)
  additional_notes?: string;

  // PATIENT CONTEXT (from onboarding)
  age?: number;
  has_weakened_immune: boolean;
  admitted_count: number;

  // NEW: Additional onboarding context fields
  days_since_last_discharge?: number;   // Days since last sepsis-related discharge
  has_lung_condition?: boolean;         // COPD, asthma, lung fibrosis, cystic fibrosis, sleep apnea
  has_heart_failure?: boolean;          // Congestive heart failure
  on_immunosuppressants?: boolean;      // Immunosuppressant medications
  has_had_septic_shock?: boolean;       // Prior history of septic shock
  has_urinary_catheter?: boolean;       // Currently has urinary catheter
}

// Zone fields are computed at runtime by calculateZones() and stored here locally —
// they are NOT persisted to the database schema.
interface ComputedZones {
  temperature_zone?: number;
  oxygen_level_zone?: number;
  heart_rate_zone?: number;
  blood_pressure_zone?: number;
}

export interface RiskCalculationResult {
  riskLevel: RiskLevel;
  totalScore: number;
  baseScore: number;
  interactionScore: number; // Kept for backwards compatibility, always 0
  highRiskModifierApplied: boolean;
  reasoning: string[];
  emergencyMessage?: string;
}

function calculateZones(response: SurveyResponse): ComputedZones {
  const zones: ComputedZones = {};

  // Temperature zones
  if (response.temperature_value !== undefined) {
    const temp = response.temperature_value;
    if (temp >= 96.8 && temp <= 99.9) {
      zones.temperature_zone = 1;
    } else if (temp >= 100 && temp <= 101.4) {
      zones.temperature_zone = 2;
    } else {
      zones.temperature_zone = 3;
    }
  }

  // Oxygen zones
  if (response.oxygen_level_value !== undefined) {
    const o2 = response.oxygen_level_value;
    if (o2 >= 95 && o2 <= 100) {
      zones.oxygen_level_zone = 1;
    } else if (o2 >= 92 && o2 <= 94) {
      zones.oxygen_level_zone = 2;
    } else {
      zones.oxygen_level_zone = 3;
    }
  }

  // Heart rate zones
  if (response.heart_rate_value !== undefined) {
    const hr = response.heart_rate_value;
    if (hr >= 60 && hr <= 100) {
      zones.heart_rate_zone = 1;
    } else if (hr >= 101 && hr <= 120) {
      zones.heart_rate_zone = 2;
    } else {
      zones.heart_rate_zone = 3;
    }
  }

  // Blood pressure zones
  // Focus on LOW BP (hypotension) as the primary sepsis concern
  if (response.blood_pressure_systolic !== undefined) {
    const bp = response.blood_pressure_systolic;
    const baseline = response.baseline_bp_systolic || 120;

    if (bp < 90) {
      zones.blood_pressure_zone = 3; // red - severe hypotension
    } else if (bp > 180) {
      zones.blood_pressure_zone = 3; // red - hypertensive crisis
    } else if (bp < baseline - 40) {
      zones.blood_pressure_zone = 3; // red - significant drop from baseline
    } else if (bp < baseline - 20) {
      zones.blood_pressure_zone = 2; // yellow - moderate drop from baseline
    } else {
      zones.blood_pressure_zone = 1;
    }
  }

  return zones;
}

/**
 * STEP 1: Check for immediate emergency conditions
 */
function checkEmergencyConditions(response: SurveyResponse): RiskCalculationResult | null {
  const reasoning: string[] = [];

  if (response.fainted_or_very_dizzy) {
    reasoning.push('EMERGENCY: Patient has fainted or is very dizzy');
    return {
      riskLevel: 'RED_EMERGENCY', totalScore: 1000, baseScore: 0, interactionScore: 0,
      highRiskModifierApplied: false, reasoning,
      emergencyMessage: 'CALL 911 IMMEDIATELY - Patient has fainted or is very dizzy'
    };
  }

  if (response.breathing_level === 3) {
    reasoning.push('EMERGENCY: Patient has severe trouble breathing');
    return {
      riskLevel: 'RED_EMERGENCY', totalScore: 1000, baseScore: 0, interactionScore: 0,
      highRiskModifierApplied: false, reasoning,
      emergencyMessage: 'CALL 911 IMMEDIATELY - Severe breathing trouble'
    };
  }

  if (response.thinking_level === 3) {
    reasoning.push('EMERGENCY: Patient is severely confused or not making sense');
    return {
      riskLevel: 'RED_EMERGENCY', totalScore: 1000, baseScore: 0, interactionScore: 0,
      highRiskModifierApplied: false, reasoning,
      emergencyMessage: 'CALL 911 IMMEDIATELY - Severe confusion'
    };
  }

  if (response.extreme_heat_or_chills) {
    reasoning.push('EMERGENCY: Patient has extreme heat or shaking chills');
    return {
      riskLevel: 'RED_EMERGENCY', totalScore: 1000, baseScore: 0, interactionScore: 0,
      highRiskModifierApplied: false, reasoning,
      emergencyMessage: 'CALL 911 IMMEDIATELY - Extreme heat or shaking chills'
    };
  }

  if (response.discolored_skin) {
    reasoning.push('EMERGENCY: Skin, lips, or nails discolored - indicates mottling, cyanosis, or jaundice');
    return {
      riskLevel: 'RED_EMERGENCY', totalScore: 1000, baseScore: 0, interactionScore: 0,
      highRiskModifierApplied: false, reasoning,
      emergencyMessage: 'CALL 911 IMMEDIATELY - Skin discoloration indicates poor perfusion or hypoxia'
    };
  }

  return null;
}

/**
 * STEP 2: Check for hard RED overrides
 */
function checkHardRedOverrides(response: SurveyResponse, zones: ComputedZones): RiskCalculationResult | null {
  const reasoning: string[] = [];

  if (response.temperature_value !== undefined && response.temperature_value >= 103.5) {
    reasoning.push(`CRITICAL: Temperature ${response.temperature_value}°F (≥103.5°F threshold)`);
    return {
      riskLevel: 'RED_EMERGENCY', totalScore: 1000, baseScore: 0, interactionScore: 0,
      highRiskModifierApplied: false, reasoning,
      emergencyMessage: 'CALL 911 IMMEDIATELY - Dangerously high temperature'
    };
  }

  if (response.oxygen_level_value !== undefined && response.oxygen_level_value < 90) {
    reasoning.push(`CRITICAL: Oxygen level ${response.oxygen_level_value}% (<90% threshold)`);
    return {
      riskLevel: 'RED_EMERGENCY', totalScore: 1000, baseScore: 0, interactionScore: 0,
      highRiskModifierApplied: false, reasoning,
      emergencyMessage: 'CALL 911 IMMEDIATELY - Dangerously low oxygen level'
    };
  }

  if (response.heart_rate_value !== undefined && response.heart_rate_value > 140) {
    reasoning.push(`CRITICAL: Heart rate ${response.heart_rate_value} bpm (>140 bpm threshold)`);
    return {
      riskLevel: 'RED_EMERGENCY', totalScore: 1000, baseScore: 0, interactionScore: 0,
      highRiskModifierApplied: false, reasoning,
      emergencyMessage: 'CALL 911 IMMEDIATELY - Dangerously high heart rate'
    };
  }

  if (response.breathing_level === 3) {
    reasoning.push('CRITICAL: Extremely difficult breathing, major shortness of breath');
    return {
      riskLevel: 'RED_EMERGENCY', totalScore: 1000, baseScore: 0, interactionScore: 0,
      highRiskModifierApplied: false, reasoning,
      emergencyMessage: 'CALL 911 IMMEDIATELY - Extreme breathing difficulty'
    };
  }

  if (response.thinking_level === 3) {
    reasoning.push('CRITICAL: Patient is not making sense, severe altered mental status');
    return {
      riskLevel: 'RED_EMERGENCY', totalScore: 1000, baseScore: 0, interactionScore: 0,
      highRiskModifierApplied: false, reasoning,
      emergencyMessage: 'CALL 911 IMMEDIATELY - Severe mental status change'
    };
  }

  if (zones.blood_pressure_zone === 3) {
    reasoning.push(`CRITICAL: Blood pressure ${response.blood_pressure_systolic} mmHg - severe hypotension or hypertensive crisis`);
    return {
      riskLevel: 'RED_EMERGENCY', totalScore: 1000, baseScore: 0, interactionScore: 0,
      highRiskModifierApplied: false, reasoning,
      emergencyMessage: 'CALL 911 IMMEDIATELY - Dangerously abnormal blood pressure'
    };
  }

  return null;
}

/**
 * STEP 3: Detect sepsis interaction patterns
 */
function detectSepsisPatterns(response: SurveyResponse, zones: ComputedZones): {
  detectedPatterns: string[];
  escalationLevel: RiskLevel | null;
  escalationReason?: string;
} {
  const detectedPatterns: string[] = [];
  let escalationLevel: RiskLevel | null = null;
  let escalationReason: string | undefined;

  const setEscalation = (level: RiskLevel, reason: string) => {
    if (escalationLevel === 'RED_EMERGENCY') return;
    if (escalationLevel === 'RED' && level !== 'RED_EMERGENCY') return;
    escalationLevel = level;
    escalationReason = reason;
  };

  const bpZone = zones.blood_pressure_zone ?? 0;
  const hasAlteredMentalStatus = response.thinking_level >= 2;
  const hasClearInfectionContext =
    response.fever_chills ||
    (zones.temperature_zone ?? 0) >= 2 ||
    response.urine_appearance_level >= 2 ||
    response.wound_state_level === 3 ||
    (response.has_cough && (response.mucus_color_level ?? 0) >= 2);

  if (bpZone === 2 && hasAlteredMentalStatus) {
    if (hasClearInfectionContext) {
      detectedPatterns.push('Septic shock pattern: Blood pressure drop with altered mental status and infection signs');
      setEscalation('RED_EMERGENCY', 'CALL 911 IMMEDIATELY - Signs of septic shock (hypotension with confusion and infection)');
      return { detectedPatterns, escalationLevel, escalationReason };
    } else {
      detectedPatterns.push('Hypotension with confusion: Blood pressure drop with altered mental status (no clear infection)');
      setEscalation('RED', 'Seek immediate medical attention - blood pressure drop with confusion requires evaluation');
    }
  }

  if ((zones.oxygen_level_zone ?? 0) >= 2 && response.breathing_level >= 2) {
    detectedPatterns.push('Respiratory failure pattern: Low oxygen with breathing difficulty');
    setEscalation('RED', 'Respiratory distress pattern detected - seek immediate medical attention');
  }

  if ((zones.oxygen_level_zone ?? 0) >= 2 && response.energy_level === 3) {
    detectedPatterns.push('Silent hypoxia pattern: Low oxygen with extreme fatigue');
    setEscalation('RED', 'Silent hypoxia detected - seek immediate medical attention');
  }

  if (response.fever_chills && response.thinking_level >= 2) {
    detectedPatterns.push('Septic encephalopathy pattern: Fever with altered mental status');
    setEscalation('RED', 'Brain function affected by infection - seek immediate medical attention');
  }

  const bpIsLow = response.blood_pressure_systolic !== undefined &&
    response.blood_pressure_systolic <= (response.baseline_bp_systolic || 120);
  if (bpZone >= 2 && bpIsLow && (zones.heart_rate_zone ?? 0) >= 2) {
    detectedPatterns.push('Compensated shock pattern: Low blood pressure with elevated heart rate');
    setEscalation('RED', 'Pre-shock state detected - seek immediate medical attention');
  }

  if (response.temperature_value !== undefined && response.temperature_value < 96.8) {
    detectedPatterns.push(`Hypothermia: ${response.temperature_value}°F - severe sepsis indicator`);
    setEscalation('RED', 'Hypothermia in infection setting - seek immediate medical attention');
  }

  if ((zones.temperature_zone ?? 0) >= 2 && (zones.heart_rate_zone ?? 0) >= 2) {
    detectedPatterns.push('SIRS criteria met: Fever with elevated heart rate');
    setEscalation('YELLOW', 'Systemic infection signs detected - contact your provider today');
  }

  if (response.fever_chills && response.urine_appearance_level >= 2) {
    detectedPatterns.push('Urosepsis pattern: Fever with abnormal urine');
    setEscalation('YELLOW', 'Urinary tract infection with systemic symptoms - contact your provider today');
  }

  if (response.energy_level === 3 && (zones.heart_rate_zone ?? 0) >= 2) {
    detectedPatterns.push('Cardiovascular stress: Extreme fatigue with elevated heart rate');
    setEscalation('YELLOW', 'Cardiovascular strain detected - contact your provider today');
  }

  return { detectedPatterns, escalationLevel, escalationReason };
}

/**
 * STEP 4: Calculate base score
 */
function calculateBaseScore(response: SurveyResponse, zones: ComputedZones): { score: number; reasoning: string[] } {
  let score = 0;
  const reasoning: string[] = [];

  // Q7: ENERGY LEVEL
  if (response.energy_level === 2) {
    let energyScore = 5;
    if (response.has_heart_failure && response.energy_level === 2) {
      energyScore = 10;
      reasoning.push('Moderate fatigue with heart failure history (+10)');
    } else {
      reasoning.push('Moderate fatigue (+5)');
    }
    score += energyScore;
  } else if (response.energy_level === 3) {
    let energyScore = 15;
    if (response.has_heart_failure) {
      energyScore = 25;
      reasoning.push('Extreme fatigue with heart failure history — high decompensation risk (+25)');
    } else {
      reasoning.push('Extreme fatigue, too weak to get out of bed (+15)');
    }
    score += energyScore;
  }

  // Q9: FEVER/CHILLS (subjective, only if no thermometer)
  if (response.fever_chills && !response.has_thermometer) {
    score += 10;
    reasoning.push('Subjective fever without measurement (+10)');
  }

  // Q10: TEMPERATURE
  if (zones.temperature_zone === 2) {
    score += 15;
    reasoning.push(`Temperature ${response.temperature_value}°F - yellow zone (+15)`);
  } else if (zones.temperature_zone === 3) {
    score += 40;
    reasoning.push(`Temperature ${response.temperature_value}°F - red zone (+40)`);
  }

  // Q11: OXYGEN LEVEL
  if (zones.oxygen_level_zone === 2) {
    score += 15;
    reasoning.push(`Oxygen ${response.oxygen_level_value}% - yellow zone (+15)`);
  } else if (zones.oxygen_level_zone === 3) {
    score += 40;
    reasoning.push(`Oxygen ${response.oxygen_level_value}% - red zone (+40)`);
  }

  // Q12: HEART RACING (subjective, only if no monitor)
  if (response.heart_racing && !response.has_hr_monitor) {
    score += 5;
    reasoning.push('Subjective heart racing (+5)');
  }

  // Q13: HEART RATE
  // has_heart_failure increases weight of elevated heart rate — tachycardia in CHF
  // is a compensatory mechanism and signals decompensation earlier than in other patients.
  if (zones.heart_rate_zone === 2) {
    let hrScore = 8;
    if (response.has_heart_failure) {
      hrScore = 15;
      reasoning.push(`Heart rate ${response.heart_rate_value} bpm - yellow zone with heart failure history (+15)`);
    } else {
      reasoning.push(`Heart rate ${response.heart_rate_value} bpm - yellow zone (+8)`);
    }
    score += hrScore;
  } else if (zones.heart_rate_zone === 3) {
    let hrScore = 30;
    if (response.has_heart_failure) {
      hrScore += 10;
      reasoning.push(`Heart rate ${response.heart_rate_value} bpm - red zone with heart failure history (+40)`);
    } else {
      reasoning.push(`Heart rate ${response.heart_rate_value} bpm - red zone (+30)`);
    }
    score += hrScore;
  }

  // Q14: BLOOD PRESSURE
  if (zones.blood_pressure_zone === 2) {
    score += 8;
    reasoning.push(`Blood pressure ${response.blood_pressure_systolic} mmHg - yellow zone (+8)`);
  } else if (zones.blood_pressure_zone === 3) {
    score += 20;
    reasoning.push(`Blood pressure ${response.blood_pressure_systolic} mmHg - red zone (+20)`);
  }

  // Q3: THINKING CLARITY
  if (response.thinking_level === 2) {
    score += 8;
    reasoning.push('Thinking slow or not quite right (+8)');
  }

  // Q2: BREATHING STATUS
  // has_lung_condition and has_heart_failure both increase the significance of
  // breathing difficulty. For a COPD patient, "slightly more difficult" may indicate
  // exacerbation; for CHF, it may signal pulmonary oedema.
  if (response.breathing_level === 2) {
    let breathScore = 8;
    const hasRespiratorySensitivity = response.has_lung_condition || response.has_heart_failure;
    if (hasRespiratorySensitivity) {
      breathScore = 16;
      const condLabel = response.has_lung_condition && response.has_heart_failure
        ? 'lung condition and heart failure history'
        : response.has_lung_condition
          ? 'lung condition'
          : 'heart failure history';
      reasoning.push(`Breathing slightly more difficult with ${condLabel} (+16)`);
    } else {
      reasoning.push('Breathing slightly more difficult (+8)');
    }
    score += breathScore;
  }

  // Q15: URINE APPEARANCE
  if (response.urine_appearance_level === 2) {
    score += 15;
    reasoning.push('Urine cloudy, dark, or smelly (+15)');
  } else if (response.urine_appearance_level === 3) {
    score += 60;
    reasoning.push('Urine very dark, bloody, or significantly different (+60)');
  }

  // Q16: UTI SYMPTOMS
  if (response.uti_symptoms_worsening === 'same' && response.has_recent_uti) {
    let utiScore = 10;
    if (response.has_urinary_catheter) {
      utiScore += 8;
      reasoning.push('UTI symptoms unchanged with urinary catheter (+18)');
    } else {
      reasoning.push('UTI symptoms unchanged (+10)');
    }
    score += utiScore;
  } else if (response.uti_symptoms_worsening === 'worsened' && response.has_recent_uti) {
    let utiScore = 30;
    if (response.has_urinary_catheter) {
      utiScore += 10;
      reasoning.push('UTI symptoms worsening with urinary catheter — high CAUTI risk (+40)');
    } else {
      reasoning.push('UTI symptoms worsening (+30)');
    }
    score += utiScore;
  }

  // Q17: COUGH — mucus_color_level scoring with lung condition amplification
  // has_lung_condition increases the weight of mucus findings. For patients with
  // COPD, asthma, or lung fibrosis, colored or bloody mucus more reliably indicates
  // exacerbation or superimposed infection than in the general population.
  if (response.mucus_color_level === 3) {
    let coughScore = 30;
    if (response.has_lung_condition) {
      coughScore = 35;
      reasoning.push('Brown/pink/red mucus with lung condition — elevated airway bleeding risk (+25)');
    } else {
      reasoning.push('Brown/pink/red mucus — possible airway bleeding (+20)');
    }
    score += coughScore;
    if (response.has_recent_pneumonia) {
      score += 10;
      reasoning.push('Pneumonia history with bloody/brown mucus — likely worsening (+10)');
    }
  } else if (response.mucus_color_level === 2) {
    let coughScore = 10;
    if (response.has_lung_condition) {
      coughScore = 18;
      reasoning.push('Yellow or green mucus with lung condition — active infection likely (+18)');
    } else {
      reasoning.push('Yellow or green mucus — active infection likely (+10)');
    }
    score += coughScore;
    if (response.has_recent_pneumonia) {
      score += 10;
      reasoning.push('Pneumonia history with colored mucus — possible worsening (+10)');
    }
  } else if (response.has_cough) {
    score += 3;
    reasoning.push('Cough present, clear or no mucus (+3)');
  }

  // Q18: WOUND STATUS
  if (response.wound_state_level === 2) {
    score += 10;
    reasoning.push('Wound looks different (+10)');
  } else if (response.wound_state_level === 3) {
    score += 60;
    reasoning.push('Wound infected: red, pus, or swollen (+60)');
  }

  // Q19: GI SYMPTOMS
  if (response.nausea_vomiting_diarrhea) {
    score += 5;
    reasoning.push('GI symptoms present (+5)');
  }

  return { score, reasoning };
}

/**
 * STEP 5: Apply context-aware score bonuses from onboarding fields
 *
 * These are additive adjustments that operate on the raw base score after all
 * individual symptom contributions have been tallied. They are kept separate
 * from calculateBaseScore() so their reasoning appears as a distinct group in
 * the output and they can be toggled / adjusted independently.
 */
function applyContextBonuses(
  baseScore: number,
  response: SurveyResponse
): { adjustedScore: number; reasoning: string[] } {
  let adjustedScore = baseScore;
  const reasoning: string[] = [];

  // --- BONUS 1: days_since_last_discharge ---
  // Sepsis recurrence risk is highest immediately post-discharge and decays
  // over 90 days. We apply a linear decay:
  //   ≤7 days  → +15 (acute post-discharge window)
  //   8–30 days → +8
  //   31–90 days → +3
  //   >90 days  → +0
  const daysSince = response.days_since_last_discharge;
  if (daysSince !== undefined) {
    if (daysSince <= 7) {
      adjustedScore += 15;
      reasoning.push(`Discharged ≤7 days ago — acute readmission risk (+15)`);
    } else if (daysSince <= 30) {
      adjustedScore += 8;
      reasoning.push(`Discharged ${daysSince} days ago — elevated readmission risk (+8)`);
    } else if (daysSince <= 90) {
      adjustedScore += 3;
      reasoning.push(`Discharged ${daysSince} days ago — moderate readmission risk (+3)`);
    }
    // >90 days: no bonus
  }

  // --- BONUS 2: has_had_septic_shock ---
  // Prior septic shock is the strongest independent predictor of future severe
  // sepsis. Apply a flat baseline increase regardless of today's symptoms —
  // even mild presentations warrant higher concern in this population.
  if (response.has_had_septic_shock) {
    adjustedScore += 10;
    reasoning.push('Prior septic shock history — baseline risk elevation (+10)');
  }

  return { adjustedScore, reasoning };
}

/**
 * STEP 6: Apply high-risk modifier
 * Includes immunosuppressed patients — they may not mount a classic fever response,
 * so their overall score is amplified to compensate for attenuated symptoms.
 */
function isHighRiskPatient(response: SurveyResponse): boolean {
  return (
    (response.age !== undefined && response.age >= 65) ||
    response.has_weakened_immune ||
    response.admitted_count > 1 ||
    (response.on_immunosuppressants ?? false)
  );
}

/**
 * STEP 7: Determine final risk level
 */
function determineFinalRiskLevel(
  baseScore: number,
  highRiskModifier: boolean,
  patternEscalation: RiskLevel | null,
): { riskLevel: RiskLevel; triggerReason: string } {

  let totalScore = baseScore;
  if (highRiskModifier) {
    totalScore = Math.round(totalScore * 1.25);
  }

  const yellowThreshold = 30;
  const redThreshold    = 60;

  let scoreBasedLevel: RiskLevel = 'GREEN';
  let scoreTrigger = '';

  if (totalScore >= redThreshold) {
    scoreBasedLevel = 'RED';
    scoreTrigger = 'High sepsis risk score';
  } else if (totalScore >= yellowThreshold) {
    scoreBasedLevel = 'YELLOW';
    scoreTrigger = 'Moderate symptoms requiring evaluation';
  }

  let finalLevel: RiskLevel = scoreBasedLevel;
  let finalTrigger = scoreTrigger;

  if (patternEscalation) {
    if (patternEscalation === 'RED_EMERGENCY') {
      finalLevel = 'RED_EMERGENCY';
      finalTrigger = 'Septic shock pattern detected';
    } else if (patternEscalation === 'RED' && (scoreBasedLevel === 'YELLOW' || scoreBasedLevel === 'GREEN')) {
      finalLevel = 'RED';
      finalTrigger = 'Dangerous sepsis pattern detected';
    } else if (patternEscalation === 'YELLOW' && scoreBasedLevel === 'GREEN') {
      finalLevel = 'YELLOW';
      finalTrigger = 'Infection pattern detected';
    }
  }

  return { riskLevel: finalLevel, triggerReason: finalTrigger };
}

/**
 * MAIN RISK CALCULATION FUNCTION
 */
export function calculateSepsisRisk(response: SurveyResponse): RiskCalculationResult {
  const allReasoning: string[] = [];

  const zones = calculateZones(response);

  // STEP 1: Emergency conditions
  const emergency = checkEmergencyConditions(response);
  if (emergency) return emergency;

  // STEP 2: Hard RED overrides
  const hardRed = checkHardRedOverrides(response, zones);
  if (hardRed) return hardRed;

  // STEP 3: Detect sepsis patterns
  const patternResult = detectSepsisPatterns(response, zones);
  if (patternResult.detectedPatterns.length > 0) {
    allReasoning.push('');
    allReasoning.push('🔍 Clinical Patterns Detected:');
    allReasoning.push(...patternResult.detectedPatterns.map(p => `  • ${p}`));
  }

  if (patternResult.escalationLevel === 'RED_EMERGENCY') {
    return {
      riskLevel: 'RED_EMERGENCY',
      totalScore: 1000,
      baseScore: 0,
      interactionScore: 0,
      
      highRiskModifierApplied: false,
      reasoning: allReasoning,
      emergencyMessage: patternResult.escalationReason
    };
  }

  // STEP 4: Calculate base score
  const baseResult = calculateBaseScore(response, zones);
  if (baseResult.reasoning.length > 0) {
    allReasoning.push('');
    allReasoning.push('📊 Individual Symptoms:');
    allReasoning.push(...baseResult.reasoning.map(r => `  • ${r}`));
  }

  // STEP 5: Apply context-aware bonuses from onboarding fields
  const { adjustedScore, reasoning: contextReasoning } = applyContextBonuses(baseResult.score, response);
  if (contextReasoning.length > 0) {
    allReasoning.push('');
    allReasoning.push('🩺 Clinical Context Adjustments:');
    allReasoning.push(...contextReasoning.map(r => `  • ${r}`));
  }

  // STEP 6: High-risk modifier
  const highRiskModifier = isHighRiskPatient(response);
  if (highRiskModifier) {
    allReasoning.push('');
    allReasoning.push('👤 High-risk patient: 25% score increase applied');
  }

  const baseScore = adjustedScore;
  let totalScore = baseScore;
  if (highRiskModifier) {
    totalScore = Math.round(totalScore * 1.25);
  }

  allReasoning.push('');
  allReasoning.push(`📈 Total Score: ${totalScore} (Base: ${baseScore}${highRiskModifier ? ' × 1.25' : ''})`);

  // STEP 7: Determine final risk level
  const { riskLevel, triggerReason } = determineFinalRiskLevel(
    baseScore,
    highRiskModifier,
    patternResult.escalationLevel,
  );

  let emergencyMessage: string | undefined;
  if (riskLevel === 'RED') {
    if (patternResult.escalationLevel === 'RED') {
      emergencyMessage = patternResult.escalationReason;
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
    interactionScore: 0,
    
    highRiskModifierApplied: highRiskModifier,
    reasoning: allReasoning,
    emergencyMessage
  };
}