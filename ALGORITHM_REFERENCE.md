# Sepsis Risk Assessment Algorithm
## Complete Calculation Guide

---

## Purpose

This algorithm categorizes post-discharge patients into four risk tiers based on self-reported symptoms and home vital signs:

| Tier | Label | Action |
|------|-------|--------|
| **GREEN** | Safe | Continue home monitoring |
| **YELLOW** | Concerning | Contact provider today |
| **RED** | Urgent | Seek immediate medical attention |
| **RED_EMERGENCY** | Emergency | Call 911 |

---

## Algorithm Flow (7 Steps)

```
INPUT: Patient survey responses
   ↓
STEP 1: Emergency Conditions → If triggered → RED_EMERGENCY (exit)
   ↓
STEP 2: Hard RED Overrides → If triggered → RED_EMERGENCY (exit)
   ↓
STEP 3: Detect Clinical Patterns → Determines pattern escalation level
   ↓
STEP 4: Calculate Base Score → Sum of individual symptom points
   ↓
STEP 5: Apply Context Bonuses → Additive adjustments from patient history
   ↓
STEP 6: Apply High-Risk Modifier → Score × 1.25 if applicable
   ↓
STEP 7: Determine Final Risk Level → MAX(score-based level, pattern-based level)
   ↓
OUTPUT: Risk tier + reasoning
```

---

## STEP 1: Emergency Conditions

**Logic:** If ANY of these are true, immediately return RED_EMERGENCY. No further calculation.

| Field | Condition | Result |
|-------|-----------|--------|
| `fainted_or_very_dizzy` | `= true` | RED_EMERGENCY |
| `breathing_level` | `= 3` (extremely difficult) | RED_EMERGENCY |
| `thinking_level` | `= 3` (not making sense) | RED_EMERGENCY |
| `extreme_heat_or_chills` | `= true` | RED_EMERGENCY |
| `discolored_skin` | `= true` (mottling/cyanosis/jaundice) | RED_EMERGENCY |

---

## STEP 2: Hard RED Overrides

**Logic:** Critical vital sign thresholds that require immediate escalation. Evaluated after Step 1. No further calculation if triggered.

| Field | Condition | Result |
|-------|-----------|--------|
| `temperature_value` | `≥ 103.5°F` | RED_EMERGENCY |
| `oxygen_level_value` | `< 90%` | RED_EMERGENCY |
| `heart_rate_value` | `> 140 bpm` | RED_EMERGENCY |
| `breathing_level` | `= 3` | RED_EMERGENCY |
| `thinking_level` | `= 3` | RED_EMERGENCY |
| `blood_pressure_zone` | `= 3` (severe hypotension/crisis) | RED_EMERGENCY |

*Note: `breathing_level = 3` and `thinking_level = 3` appear in both Step 1 and Step 2 as redundant safety nets.*

---

## STEP 3: Detect Clinical Patterns

**Logic:** Check for dangerous symptom combinations. Each pattern maps to an escalation level. Patterns can only **increase** risk, never decrease it. Priority order: `RED_EMERGENCY > RED > YELLOW`.

### Infection Context Definition

Several patterns reference `hasClearInfectionContext`, which is `true` if ANY of:
- `fever_chills = true`
- `temperature_zone ≥ 2`
- `urine_appearance_level ≥ 2`
- `wound_state_level = 3`
- `has_cough = true AND mucus_color_level ≥ 2`

### Pattern Definitions

**Pattern 1: Septic Shock** — only applies when `blood_pressure_zone = 2`; zone 3 is caught by the hard override in Step 2
```
IF blood_pressure_zone = 2 AND thinking_level ≥ 2 THEN:
   IF hasClearInfectionContext = true → RED_EMERGENCY (exit immediately, skip remaining patterns)
   ELSE                               → RED
```

**Pattern 2: Respiratory Failure**
```
IF oxygen_level_zone ≥ 2 AND breathing_level ≥ 2 → RED
```

**Pattern 3: Silent Hypoxia**
```
IF oxygen_level_zone ≥ 2 AND energy_level = 3 → RED
```

**Pattern 4: Septic Encephalopathy**
```
IF fever_chills = true AND thinking_level ≥ 2 → RED
```

**Pattern 5: Compensated Shock**
```
IF blood_pressure_zone ≥ 2
   AND blood_pressure_systolic ≤ (baseline_bp_systolic OR 120)
   AND heart_rate_zone ≥ 2
→ RED
```
*This pattern only triggers for LOW blood pressure. A hypertensive crisis (>180) produces BP zone 3, which is caught by the hard override before this pattern is evaluated.*

**Pattern 6: Septic Hypothermia**
```
IF temperature_value < 96.8°F → RED
```

**Pattern 7: SIRS Criteria**
```
IF temperature_zone ≥ 2 AND heart_rate_zone ≥ 2 → YELLOW
```

**Pattern 8: Urosepsis**
```
IF fever_chills = true AND urine_appearance_level ≥ 2 → YELLOW
```

**Pattern 9: Cardiovascular Stress**
```
IF energy_level = 3 AND heart_rate_zone ≥ 2 → YELLOW
```

**Output:** `patternEscalation` = highest level triggered (or null if none match)

---

## STEP 4: Calculate Base Score

**Logic:** Sum points for each symptom present. Several fields have amplified scores when certain patient history flags are set.

### Energy Level

| Condition | Points |
|-----------|--------|
| `energy_level = 2` (fatigued) | +5 |
| `energy_level = 2` AND `has_heart_failure = true` | +10 |
| `energy_level = 3` (extremely fatigued) | +15 |
| `energy_level = 3` AND `has_heart_failure = true` | +25 |

*Rationale: Fatigue in CHF patients signals cardiac decompensation earlier than in the general population.*

### Subjective Fever

| Condition | Points |
|-----------|--------|
| `fever_chills = true AND has_thermometer = false` | +10 |

*Only scored when no thermometer is available. When a thermometer is present, `temperature_zone` scoring applies instead.*

### Temperature

| Condition | Points |
|-----------|--------|
| `temperature_zone = 2` (100–101.4°F) | +15 |
| `temperature_zone = 3` (<96.8°F or ≥101.5°F) | +40 |

### Oxygen Level

| Condition | Points |
|-----------|--------|
| `oxygen_level_zone = 2` (92–94%) | +15 |
| `oxygen_level_zone = 3` (<92%) | +40 |

### Subjective Heart Racing

| Condition | Points |
|-----------|--------|
| `heart_racing = true AND has_hr_monitor = false` | +5 |

*Only scored when no heart rate monitor is available.*

### Heart Rate (measured)

| Condition | Points |
|-----------|--------|
| `heart_rate_zone = 2` (101–120 bpm) | +8 |
| `heart_rate_zone = 2` AND `has_heart_failure = true` | +15 |
| `heart_rate_zone = 3` (<60 or >120 bpm) | +30 |
| `heart_rate_zone = 3` AND `has_heart_failure = true` | +40 |

*Rationale: Tachycardia in CHF is a compensatory mechanism that signals decompensation earlier than in other patients.*

### Blood Pressure

| Condition | Points |
|-----------|--------|
| `blood_pressure_zone = 2` (20–39 mmHg below baseline) | +8 |
| `blood_pressure_zone = 3` (<90, >180, or 40+ below baseline) | +20 |

### Mental Status

| Condition | Points |
|-----------|--------|
| `thinking_level = 2` (slow or foggy) | +8 |

*`thinking_level = 3` triggers RED_EMERGENCY in Steps 1 and 2 before scoring is reached.*

### Breathing

| Condition | Points |
|-----------|--------|
| `breathing_level = 2` | +8 |
| `breathing_level = 2` AND (`has_lung_condition = true` OR `has_heart_failure = true`) | +16 |

*Rationale: For COPD/asthma/lung fibrosis patients, mildly difficult breathing indicates exacerbation. For CHF patients, it may signal pulmonary oedema.*

### Urine Appearance

| Condition | Points |
|-----------|--------|
| `urine_appearance_level = 2` (cloudy/dark/smelly) | +15 |
| `urine_appearance_level = 3` (very dark/bloody) | +60 |

### UTI Symptoms

Only scored when `has_recent_uti = true`.

| Condition | Points |
|-----------|--------|
| `uti_symptoms_worsening = 'same'` | +10 |
| `uti_symptoms_worsening = 'same'` AND `has_urinary_catheter = true` | +18 |
| `uti_symptoms_worsening = 'worsened'` | +30 |
| `uti_symptoms_worsening = 'worsened'` AND `has_urinary_catheter = true` | +40 |

*Rationale: Catheter-associated UTIs (CAUTI) carry higher sepsis risk than uncatheterized UTIs.*

### Mucus / Cough

| Condition | Points |
|-----------|--------|
| `has_cough = true` (mucus level 1 or null) | +3 |
| `mucus_color_level = 2` (yellow/green) | +10 |
| `mucus_color_level = 2` AND `has_lung_condition = true` | +18 |
| `mucus_color_level = 2` AND `has_recent_pneumonia = true` | +10 additional |
| `mucus_color_level = 3` (brown/pink/red) | +30 |
| `mucus_color_level = 3` AND `has_lung_condition = true` | +35 |
| `mucus_color_level = 3` AND `has_recent_pneumonia = true` | +10 additional |

*Rationale: Colored or bloody mucus in patients with COPD, asthma, or lung fibrosis more reliably indicates exacerbation or superimposed infection. The pneumonia bonus stacks on top of the base or lung-condition score.*

### Wound Status

| Condition | Points |
|-----------|--------|
| `wound_state_level = 2` (looks different) | +10 |
| `wound_state_level = 3` (infected: red/pus/swollen) | +60 |

### GI Symptoms

| Condition | Points |
|-----------|--------|
| `nausea_vomiting_diarrhea = true` | +5 |

---

## STEP 5: Apply Context Bonuses

**Logic:** Additive flat bonuses applied to the base score from Step 4. These reflect patient history risk factors independent of today's symptoms.

### Recent Discharge

| Condition | Bonus |
|-----------|-------|
| `days_since_last_discharge ≤ 7` | +15 |
| `days_since_last_discharge` 8–30 | +8 |
| `days_since_last_discharge` 31–90 | +3 |
| `days_since_last_discharge > 90` | +0 |

*Rationale: Sepsis recurrence risk is highest immediately post-discharge and decays over 90 days.*

### Prior Septic Shock

| Condition | Bonus |
|-----------|-------|
| `has_had_septic_shock = true` | +10 |

*Rationale: Prior septic shock is the strongest independent predictor of future severe sepsis. Even mild presentations warrant higher concern in this population.*

---

## STEP 6: Apply High-Risk Modifier

**Logic:** Certain patient groups receive a 25% score increase to compensate for atypical or attenuated symptom presentation.

### High-Risk Criteria

Patient is high-risk if ANY of these are true:

| Field | Condition |
|-------|-----------|
| `age` | `≥ 65` |
| `has_weakened_immune` | `= true` |
| `admitted_count` | `> 1` |
| `on_immunosuppressants` | `= true` |

*Rationale: Immunosuppressed patients may not mount a classic fever response; the score amplification compensates for attenuated symptoms. Patients admitted more than once have demonstrated recurrence risk.*

### Calculation

```
IF isHighRiskPatient = true:
   totalScore = ROUND(baseScore × 1.25)
ELSE:
   totalScore = baseScore
```

---

## STEP 7: Determine Final Risk Level

**Logic:** Combine score-based thresholds with pattern-based escalation. Patterns can only increase the final level, never decrease it.

### Part A: Score-Based Level

```
IF totalScore ≥ 60:
   scoreBasedLevel = RED

ELSE IF totalScore ≥ 30:
   scoreBasedLevel = YELLOW

ELSE:
   scoreBasedLevel = GREEN
```

### Part B: Pattern Escalation

```
IF patternEscalation = RED_EMERGENCY:
   finalLevel = RED_EMERGENCY

ELSE IF patternEscalation = RED AND scoreBasedLevel ∈ {YELLOW, GREEN}:
   finalLevel = RED

ELSE IF patternEscalation = YELLOW AND scoreBasedLevel = GREEN:
   finalLevel = YELLOW

ELSE:
   finalLevel = scoreBasedLevel
```

### Final Formula

```
finalLevel = MAX(scoreBasedLevel, patternEscalation)
```

Where priority order is: `GREEN < YELLOW < RED < RED_EMERGENCY`

---

## Zone Calculation Reference

### Temperature Zones

| Zone | Range | Interpretation |
|------|-------|----------------|
| 1 (Green) | 96.8°F – 99.9°F | Normal |
| 2 (Yellow) | 100°F – 101.4°F | Low-grade fever |
| 3 (Red) | <96.8°F or ≥101.5°F | Hypothermia or high fever |

*Hard override: temperature ≥ 103.5°F → RED_EMERGENCY (Steps 1–2, before scoring)*

### Oxygen Zones

| Zone | Range | Interpretation |
|------|-------|----------------|
| 1 (Green) | 95% – 100% | Normal |
| 2 (Yellow) | 92% – 94% | Mild hypoxia |
| 3 (Red) | <92% | Significant hypoxia |

*Hard override: oxygen < 90% → RED_EMERGENCY (Steps 1–2, before scoring)*

### Heart Rate Zones

| Zone | Range | Interpretation |
|------|-------|----------------|
| 1 (Green) | 60–100 bpm | Normal |
| 2 (Yellow) | 101–120 bpm | Tachycardia |
| 3 (Red) | <60 or >120 bpm | Bradycardia or severe tachycardia |

*Hard override: heart rate > 140 bpm → RED_EMERGENCY (Steps 1–2, before scoring)*

### Blood Pressure Zones

| Zone | Condition | Interpretation |
|------|-----------|----------------|
| 1 (Green) | Within 20 mmHg of baseline | Normal |
| 2 (Yellow) | 20–39 mmHg below baseline | Moderate drop |
| 3 (Red) | <90 mmHg, >180 mmHg, or ≥40 mmHg below baseline | Severe hypotension or crisis |

*Default baseline: 120 mmHg if `baseline_bp_systolic` not provided. Hard override: zone 3 → RED_EMERGENCY.*

---

## Complete Worked Examples

### Example A: Healthy Check-in

**Input:**
- All emergency questions: false/normal
- Age: 45, no immune issues, admitted once
- Temperature: 98.6°F → zone 1
- Oxygen: 98% → zone 1
- Heart rate: 75 bpm → zone 1
- Blood pressure: 118 mmHg (baseline 120) → zone 1
- Energy: level 1, Thinking: level 1, Breathing: level 1
- All other symptoms: negative/normal

**Calculation:**
1. Emergency conditions: none triggered
2. Hard RED overrides: none triggered
3. Patterns: none match
4. Base score: 0 (all vitals normal, no symptoms)
5. Context bonuses: none
6. High-risk modifier: no → totalScore = 0
7. Score-based level: GREEN (0 < 30)
8. Pattern escalation: none

**Final: GREEN**

---

### Example B: SIRS Pattern (Fever + Tachycardia)

**Input:**
- Temperature: 100.8°F → zone 2
- Heart rate: 112 bpm → zone 2
- All other vitals normal, no additional symptoms
- Age: 55, no high-risk flags

**Calculation:**
1. Emergency conditions: none triggered
2. Hard RED overrides: none triggered
3. Patterns:
   - Pattern 7 (SIRS): `temperature_zone ≥ 2` AND `heart_rate_zone ≥ 2` → YELLOW
4. Base score:
   - Temperature zone 2: +15
   - Heart rate zone 2: +8
   - **Base score = 23**
5. Context bonuses: none → adjusted score = 23
6. High-risk modifier: no → totalScore = 23
7. Score-based level: GREEN (23 < 30)
8. Pattern escalation: YELLOW → upgrades GREEN to YELLOW

**Final: YELLOW** — pattern escalated from GREEN

---

### Example C: Severe Hypotension (Hard Override)

**Input:**
- Blood pressure: 80 mmHg (baseline 120) → zone 3 (<90 threshold)
- All other vitals normal
- Thinking: level 1 (clear)

**Calculation:**
1. Emergency conditions: none triggered
2. Hard RED overrides: `blood_pressure_zone = 3` → **RED_EMERGENCY** (exit)

**Final: RED_EMERGENCY** — hard override triggered, no further steps

---

### Example D: Septic Shock Pattern

**Input:**
- Blood pressure: 95 mmHg (baseline 120) → zone 2 (25 mmHg below baseline)
- Thinking: level 2 (foggy)
- Temperature: 101.0°F → zone 2
- Heart rate: 105 bpm → zone 2
- No high-risk flags

**Calculation:**
1. Emergency conditions: none triggered
2. Hard RED overrides: none (BP zone = 2, not 3)
3. Patterns:
   - Pattern 1 (Septic Shock): `blood_pressure_zone = 2` AND `thinking_level ≥ 2`
     - Check `hasClearInfectionContext`: `temperature_zone ≥ 2` → **true**
     - → RED_EMERGENCY, exit immediately

**Final: RED_EMERGENCY** — septic shock pattern with confirmed infection context

---

### Example E: Multiple Symptoms, High-Risk Patient

**Input:**
- Age: 78 (high-risk: age ≥ 65)
- Temperature: 100.5°F → zone 2
- Heart rate: 108 bpm → zone 2
- Thinking: level 2 (foggy)
- Energy: level 2 (fatigued)
- Urine: level 2 (cloudy)
- Cough present, clear mucus (mucus level 1)
- GI symptoms present
- No `has_heart_failure`, no `has_lung_condition`

**Calculation:**
1. Emergency conditions: none triggered
2. Hard RED overrides: none triggered
3. Patterns:
   - Pattern 7 (SIRS): `temperature_zone ≥ 2` AND `heart_rate_zone ≥ 2` → YELLOW
4. Base score:
   - Temperature zone 2: +15
   - Heart rate zone 2: +8
   - Thinking level 2: +8
   - Energy level 2 (no CHF): +5
   - Urine level 2: +15
   - Cough, clear mucus: +3
   - GI symptoms: +5
   - **Base score = 59**
5. Context bonuses: none → adjusted score = 59
6. High-risk modifier: yes (age 78) → totalScore = ROUND(59 × 1.25) = ROUND(73.75) = **74**
7. Score-based level: RED (74 ≥ 60)
8. Pattern escalation: YELLOW (RED > YELLOW, no upgrade)

**Final: RED** — score-based level wins over pattern

---

### Example F: Compensated Shock (Tachycardia + Hypotension)

**Input:**
- Blood pressure: 98 mmHg (baseline 125) → zone 2 (27 mmHg below baseline)
- Heart rate: 118 bpm → zone 2
- Thinking: level 1 (clear)
- No fever, no infection signs, no high-risk flags

**Calculation:**
1. Emergency conditions: none triggered
2. Hard RED overrides: none triggered
3. Patterns:
   - Pattern 5 (Compensated Shock): `blood_pressure_zone ≥ 2` AND `bp_systolic (98) ≤ baseline (125)` AND `heart_rate_zone ≥ 2` → RED
4. Base score:
   - BP zone 2: +8
   - Heart rate zone 2: +8
   - **Base score = 16**
5. Context bonuses: none → adjusted score = 16
6. High-risk modifier: no → totalScore = 16
7. Score-based level: GREEN (16 < 30)
8. Pattern escalation: RED → upgrades GREEN to RED

**Final: RED** — pattern escalated from GREEN

*Clinical rationale: The heart is racing to compensate for falling blood pressure — a pre-shock state requiring urgent evaluation even though individual scores are low.*

---

## Summary Table: All Point Values

| Category | Condition | Points |
|----------|-----------|--------|
| Energy | Level 2 (fatigued) | +5 |
| Energy | Level 2 + `has_heart_failure` | +10 |
| Energy | Level 3 (extremely fatigued) | +15 |
| Energy | Level 3 + `has_heart_failure` | +25 |
| Subjective fever | `fever_chills` + no thermometer | +10 |
| Temperature | Zone 2 | +15 |
| Temperature | Zone 3 | +40 |
| Oxygen | Zone 2 | +15 |
| Oxygen | Zone 3 | +40 |
| Subjective HR | `heart_racing` + no monitor | +5 |
| Heart rate | Zone 2 | +8 |
| Heart rate | Zone 2 + `has_heart_failure` | +15 |
| Heart rate | Zone 3 | +30 |
| Heart rate | Zone 3 + `has_heart_failure` | +40 |
| Blood pressure | Zone 2 | +8 |
| Blood pressure | Zone 3 | +20 |
| Thinking | Level 2 | +8 |
| Breathing | Level 2 | +8 |
| Breathing | Level 2 + `has_lung_condition` or `has_heart_failure` | +16 |
| Urine appearance | Level 2 | +15 |
| Urine appearance | Level 3 | +60 |
| UTI symptoms | Unchanged (`has_recent_uti`) | +10 |
| UTI symptoms | Unchanged + `has_urinary_catheter` | +18 |
| UTI symptoms | Worsened (`has_recent_uti`) | +30 |
| UTI symptoms | Worsened + `has_urinary_catheter` | +40 |
| Cough | Present, clear/no mucus | +3 |
| Mucus | Level 2 (yellow/green) | +10 |
| Mucus | Level 2 + `has_lung_condition` | +18 |
| Mucus | Level 2 + `has_recent_pneumonia` | +10 additional |
| Mucus | Level 3 (brown/pink/red) | +30 |
| Mucus | Level 3 + `has_lung_condition` | +35 |
| Mucus | Level 3 + `has_recent_pneumonia` | +10 additional |
| Wound | Level 2 (different) | +10 |
| Wound | Level 3 (infected) | +60 |
| GI symptoms | Present | +5 |
| **Context bonus** | Discharged ≤7 days ago | +15 |
| **Context bonus** | Discharged 8–30 days ago | +8 |
| **Context bonus** | Discharged 31–90 days ago | +3 |
| **Context bonus** | Prior septic shock history | +10 |

---

## Summary Table: Risk Thresholds

| Condition | Result |
|-----------|--------|
| Emergency question triggered (Step 1) | RED_EMERGENCY |
| Hard vital sign override triggered (Step 2) | RED_EMERGENCY |
| Pattern = RED_EMERGENCY | RED_EMERGENCY |
| `totalScore ≥ 60` | RED |
| Pattern = RED | RED |
| `totalScore ≥ 30` | YELLOW |
| Pattern = YELLOW | YELLOW |
| Otherwise | GREEN |