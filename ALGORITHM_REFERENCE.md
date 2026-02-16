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
STEP 1: Emergency Conditions → If YES → RED_EMERGENCY (exit)
   ↓
STEP 2: Hard RED Overrides → If triggered → RED or RED_EMERGENCY (exit)
   ↓
STEP 3: Count Critical Flags
   ↓
STEP 4: Detect Clinical Patterns → Determines pattern escalation level
   ↓
STEP 5: Calculate Base Score → Sum of individual symptom points
   ↓
STEP 6: Apply High-Risk Modifier → Score × 1.25 if applicable
   ↓
STEP 7: Determine Final Risk Level → MAX(score-based level, pattern-based level)
   ↓
OUTPUT: Risk tier + reasoning
```

---

## STEP 1: Emergency Conditions

**Logic:** If ANY of these are TRUE, immediately return RED_EMERGENCY.

| Question | Condition | Result |
|----------|-----------|--------|
| Q1: Fainting/dizziness | `fainted_or_very_dizzy = true` | RED_EMERGENCY |
| Q2: Severe breathing trouble | `severe_trouble_breathing = true` | RED_EMERGENCY |
| Q3: Severe confusion | `severe_confusion = true` | RED_EMERGENCY |
| Q4: Extreme heat/chills | `extreme_heat_or_chills = true` | RED_EMERGENCY |

**If triggered:** Algorithm terminates. No further calculation needed.

---

## STEP 2: Hard RED Overrides

**Logic:** Critical vital sign thresholds that require immediate escalation.

| Condition | Threshold | Result |
|-----------|-----------|--------|
| Temperature | ≥ 103.5°F | RED_EMERGENCY |
| Oxygen level | < 90% | RED_EMERGENCY |
| Heart rate | > 140 bpm | RED_EMERGENCY |
| Breathing level | = 3 (extremely difficult) | RED_EMERGENCY |
| Thinking level | = 3 (not making sense) | RED_EMERGENCY |
| Blood pressure zone | = 3 (severe hypotension/crisis) | RED_EMERGENCY |
| Skin discoloration | = true (mottling/cyanosis/jaundice) | RED_EMERGENCY |

**If triggered:** Algorithm terminates. No further calculation needed.

---

## STEP 3: Count Critical Flags

**Logic:** Count how many organ systems are in "red zone" (zone 3).

| Vital/Organ | Counts as Critical Flag if... |
|-------------|------------------------------|
| Temperature | `temperature_zone = 3` |
| Oxygen | `oxygen_level_zone = 3` |
| Heart rate | `heart_rate_zone = 3` |
| Blood pressure | `blood_pressure_zone = 3` |
| Urine appearance | `urine_appearance_level = 3` |
| Urine output | `urine_output_level = 3` |
| Wound status | `wound_state_level = 3` |

**Formula:**
```
criticalFlags = (count of conditions above that are TRUE)
```

**Range:** 0 to 7

---

## STEP 4: Detect Clinical Patterns

**Logic:** Check for dangerous symptom combinations. Each pattern maps to an escalation level.

### Pattern Definitions

**Pattern 1: Septic Shock** (only applies to BP zone 2; zone 3 handled by hard override)
```
IF blood_pressure_zone = 2
   AND thinking_level ≥ 2
THEN:
   IF hasClearInfectionContext = TRUE → RED_EMERGENCY (exit immediately)
   ELSE → RED (continue checking other patterns)
```

Where `hasClearInfectionContext` is TRUE if ANY of:
- `fever_chills = true`
- `temperature_zone ≥ 2`
- `urine_appearance_level ≥ 2`
- `wound_state_level = 3`
- `has_cough = true AND cough_worsening = true`

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

**Pattern 5: Compensated Shock** (tachycardia compensating for hypotension)
```
IF blood_pressure_zone ≥ 2 
   AND blood_pressure_systolic ≤ baseline
   AND heart_rate_zone ≥ 2 
→ RED
```
*Note: Only triggers for LOW blood pressure, not hypertensive crisis (>180)*

**Pattern 6: Septic Hypothermia**
```
IF temperature_value < 96.8°F → RED
```

**Pattern 7: SIRS Criteria** (Systemic Inflammatory Response Syndrome)
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

### Pattern Priority Resolution

If multiple patterns match, keep the highest priority:
```
RED_EMERGENCY > RED > YELLOW > null
```

**Output:** `patternEscalation` = highest level triggered (or null if none)

---

## STEP 5: Calculate Base Score

**Logic:** Sum points for each symptom present.

### Energy & Well-being

| Condition | Points |
|-----------|--------|
| `energy_level = 2` (fatigued) | +5 |
| `energy_level = 3` (extremely fatigued) | +15 |

### Fever/Chills

| Condition | Points |
|-----------|--------|
| `fever_chills = true AND has_thermometer = false` | +10 |

*Note: If thermometer available, temperature_zone scoring applies instead*

### Temperature

| Condition | Points |
|-----------|--------|
| `temperature_zone = 2` (100-101.4°F) | +15 |
| `temperature_zone = 3` (<96.8°F or ≥101.5°F) | +40 |

### Oxygen Level

| Condition | Points |
|-----------|--------|
| `oxygen_level_zone = 2` (92-94%) | +15 |
| `oxygen_level_zone = 3` (<92%) | +40 |

### Heart Rate (subjective)

| Condition | Points |
|-----------|--------|
| `heart_racing = true AND has_hr_monitor = false` | +5 |

### Heart Rate (measured)

| Condition | Points |
|-----------|--------|
| `heart_rate_zone = 2` (101-120 bpm) | +8 |
| `heart_rate_zone = 3` (<60 or >120 bpm) | +20 |

### Blood Pressure

| Condition | Points |
|-----------|--------|
| `blood_pressure_zone = 2` (20-39 below baseline) | +8 |
| `blood_pressure_zone = 3` (<90, >180, or 40+ below baseline) | +20 |

### Mental Status

| Condition | Points |
|-----------|--------|
| `thinking_level = 2` (slow or foggy) | +8 |

*Note: thinking_level = 3 triggers hard RED override in Step 2*

### Breathing

| Condition | Points |
|-----------|--------|
| `breathing_level = 2` (slightly difficult) | +8 |

*Note: breathing_level = 3 triggers hard RED override in Step 2*

### Urine Appearance

| Condition | Points |
|-----------|--------|
| `urine_appearance_level = 2` (cloudy/dark/smelly) | +15 |
| `urine_appearance_level = 3` (very dark/bloody) | +40 |

### UTI Symptoms

| Condition | Points |
|-----------|--------|
| `uti_symptoms_worsening = 'same' AND has_recent_uti = true` | +10 |
| `uti_symptoms_worsening = 'worsened'` | +30 |

### Urine Output

| Condition | Points |
|-----------|--------|
| `urine_output_level = 2` (less than usual) | +8 |
| `urine_output_level = 3` (little to none) | +40 |

### Respiratory Infection

| Condition | Points |
|-----------|--------|
| `has_cough = true` | +3 |
| `cough_worsening = true` | +5 |

### Wound Status

| Condition | Points |
|-----------|--------|
| `wound_state_level = 2` (looks different) | +10 |
| `wound_state_level = 3` (infected: red, pus, swollen) | +40 |

### GI Symptoms

| Condition | Points |
|-----------|--------|
| `nausea_vomiting_diarrhea = true` | +5 |

### Base Score Formula

```
baseScore = SUM of all applicable points above
```

**Range:** 0 to ~300+ (theoretical maximum if all symptoms present)

---

## STEP 6: Apply High-Risk Modifier

**Logic:** Vulnerable patients get a 25% score increase.

### High-Risk Criteria

Patient is high-risk if ANY of these are true:
- `age ≥ 65`
- `weakened_immune = true`
- `readmission_count ≥ 1`

### Calculation

```
IF highRiskPatient = TRUE:
   totalScore = ROUND(baseScore × 1.25)
ELSE:
   totalScore = baseScore
```

**Example:**
- Base score = 48
- Patient age = 72 (high-risk)
- Total score = ROUND(48 × 1.25) = ROUND(60) = 60

---

## STEP 7: Determine Final Risk Level

**Logic:** Combine score-based thresholds with pattern-based escalation.

### Part A: Score-Based Level

Evaluate in this order (first match wins):

```
IF criticalFlags ≥ 2:
   scoreBasedLevel = RED
   
ELSE IF totalScore ≥ 60:
   scoreBasedLevel = RED
   
ELSE IF totalScore ≥ 30 AND criticalFlags ≥ 1:
   scoreBasedLevel = RED
   
ELSE IF totalScore ≥ 30:
   scoreBasedLevel = YELLOW
   
ELSE IF criticalFlags ≥ 1:
   scoreBasedLevel = YELLOW  // Safety net: never GREEN with a critical flag
   
ELSE:
   scoreBasedLevel = GREEN
```

### Part B: Pattern Escalation

Apply pattern escalation (patterns can only INCREASE risk, never decrease):

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

Where priority order is: GREEN < YELLOW < RED < RED_EMERGENCY

---

## Zone Calculation Reference

### Temperature Zones

| Zone | Range | Interpretation |
|------|-------|----------------|
| 1 (Green) | 96.8°F – 99.9°F | Normal |
| 2 (Yellow) | 100°F – 101.4°F | Low-grade fever |
| 3 (Red) | <96.8°F or ≥101.5°F | Hypothermia or high fever |

### Oxygen Zones

| Zone | Range | Interpretation |
|------|-------|----------------|
| 1 (Green) | 95% – 100% | Normal |
| 2 (Yellow) | 92% – 94% | Mild hypoxia |
| 3 (Red) | <92% | Significant hypoxia |

### Heart Rate Zones

| Zone | Range | Interpretation |
|------|-------|----------------|
| 1 (Green) | 60 – 100 bpm | Normal |
| 2 (Yellow) | 101 – 120 bpm | Tachycardia |
| 3 (Red) | <60 or >120 bpm | Severe bradycardia/tachycardia |

### Blood Pressure Zones

| Zone | Condition | Interpretation |
|------|-----------|----------------|
| 1 (Green) | Stable (within 20 of baseline) | Normal |
| 2 (Yellow) | 20-39 mmHg below baseline | Moderate drop |
| 3 (Red) | <90 mmHg, >180 mmHg, or 40+ below baseline | Severe hypotension/crisis |

**Default baseline:** 120 mmHg (if not provided)

---

## Complete Worked Examples

### Example A: Healthy Check-in

**Input:**
- All emergency questions: false
- Temperature: 98.6°F → zone 1
- Oxygen: 98% → zone 1
- Heart rate: 75 bpm → zone 1
- Blood pressure: 118 mmHg (baseline 120) → zone 1
- Thinking: level 1 (clear)
- Breathing: level 1 (normal)
- Energy: level 1 (normal)
- All other symptoms: negative
- Age: 45, no immune issues, no readmissions

**Calculation:**
1. Emergency conditions: None triggered
2. Hard RED overrides: None triggered
3. Critical flags: 0
4. Patterns: None detected
5. Base score: 0
6. High-risk modifier: No → totalScore = 0
7. Score-based level: GREEN (score < 30, no critical flags)
8. Pattern escalation: None
9. **Final: GREEN**

---

### Example B: SIRS Pattern (Fever + Tachycardia)

**Input:**
- Temperature: 100.8°F → zone 2
- Heart rate: 112 bpm → zone 2
- All other vitals normal
- Age: 55

**Calculation:**
1. Emergency conditions: None
2. Hard RED overrides: None
3. Critical flags: 0
4. Patterns detected:
   - Pattern 7 (SIRS): temp_zone ≥ 2 AND hr_zone ≥ 2 → YELLOW
5. Base score:
   - Temperature zone 2: +15
   - Heart rate zone 2: +8
   - **Total: 23**
6. High-risk modifier: No → totalScore = 23
7. Score-based level: GREEN (23 < 30)
8. Pattern escalation: YELLOW
9. **Final: YELLOW** (pattern escalated from GREEN)

---

### Example C: Severe Hypotension (Hard Override)

**Input:**
- Blood pressure: 80 mmHg (baseline 120) → zone 3
- All other vitals normal
- Thinking: level 1 (clear)

**Calculation:**
1. Emergency conditions: None
2. Hard RED overrides: 
   - BP zone = 3 → **RED_EMERGENCY** (exit)
3. **Final: RED_EMERGENCY** (hard override triggered)

---

### Example D: Septic Shock Pattern

**Input:**
- Blood pressure: 95 mmHg (baseline 120) → zone 2 (25 below baseline)
- Thinking: level 2 (foggy)
- Temperature: 101.0°F → zone 2
- Heart rate: 105 bpm → zone 2

**Calculation:**
1. Emergency conditions: None
2. Hard RED overrides: None (BP zone = 2, not 3)
3. Critical flags: 0
4. Patterns detected:
   - Pattern 1 (Septic Shock): BP zone 2 + thinking ≥ 2
     - Check infection context: temp_zone ≥ 2 = TRUE
     - → **RED_EMERGENCY** (exit immediately)
5. **Final: RED_EMERGENCY**

---

### Example E: Multiple Symptoms, High-Risk Patient

**Input:**
- Age: 78 (high-risk)
- Temperature: 100.5°F → zone 2 (+15)
- Heart rate: 108 bpm → zone 2 (+8)
- Thinking: level 2 (+8)
- Energy: level 2 (+5)
- Urine: level 2 (+15)
- Has cough (+3)
- GI symptoms (+5)

**Calculation:**
1. Emergency conditions: None
2. Hard RED overrides: None
3. Critical flags: 0
4. Patterns detected:
   - Pattern 7 (SIRS): temp ≥ 2 + HR ≥ 2 → YELLOW
5. Base score: 15 + 8 + 8 + 5 + 15 + 3 + 5 = **59**
6. High-risk modifier: Yes (age 78)
   - totalScore = ROUND(59 × 1.25) = ROUND(73.75) = **74**
7. Score-based level: RED (74 ≥ 60)
8. Pattern escalation: YELLOW (but RED > YELLOW)
9. **Final: RED** (score-based level wins)

---

### Example F: Compensated Shock (Tachycardia + Hypotension)

**Input:**
- Blood pressure: 98 mmHg (baseline 125) → zone 2 (27 below baseline)
- Heart rate: 118 bpm → zone 2
- Thinking: level 1 (clear)
- No fever, no infection signs

**Calculation:**
1. Emergency conditions: None
2. Hard RED overrides: None
3. Critical flags: 0
4. Patterns detected:
   - Pattern 5 (Compensated Shock): BP zone ≥ 2 AND HR zone ≥ 2 → RED
5. Base score:
   - BP zone 2: +8
   - HR zone 2: +8
   - **Total: 16**
6. High-risk modifier: No → totalScore = 16
7. Score-based level: GREEN (16 < 30)
8. Pattern escalation: RED
9. **Final: RED** (pattern escalated from GREEN)

**Clinical rationale:** Even though individual scores are low, the heart is racing to compensate for falling blood pressure—a pre-shock state requiring urgent evaluation.

---

## Summary Table: All Point Values

| Category | Condition | Points |
|----------|-----------|--------|
| Energy | Level 2 (fatigued) | +5 |
| Energy | Level 3 (extremely fatigued) | +15 |
| Subjective fever | No thermometer | +10 |
| Temperature | Zone 2 | +15 |
| Temperature | Zone 3 | +40 |
| Oxygen | Zone 2 | +15 |
| Oxygen | Zone 3 | +40 |
| Subjective HR | No monitor | +5 |
| Heart rate | Zone 2 | +8 |
| Heart rate | Zone 3 | +20 |
| Blood pressure | Zone 2 | +8 |
| Blood pressure | Zone 3 | +20 |
| Thinking | Level 2 | +8 |
| Breathing | Level 2 | +8 |
| Urine appearance | Level 2 | +15 |
| Urine appearance | Level 3 | +40 |
| UTI symptoms | Unchanged | +10 |
| UTI symptoms | Worsened | +30 |
| Urine output | Level 2 | +8 |
| Urine output | Level 3 | +40 |
| Cough | Present | +3 |
| Pneumonia | Worsening | +5 |
| Wound | Level 2 (different) | +10 |
| Wound | Level 3 (infected) | +40 |
| GI symptoms | Present | +5 |

---

## Summary Table: Risk Thresholds

| Condition | Result |
|-----------|--------|
| Emergency question = true | RED_EMERGENCY |
| Hard override triggered | RED_EMERGENCY |
| Pattern = RED_EMERGENCY | RED_EMERGENCY |
| criticalFlags ≥ 2 | RED |
| totalScore ≥ 60 | RED |
| totalScore ≥ 30 AND criticalFlags ≥ 1 | RED |
| Pattern = RED | RED |
| totalScore ≥ 30 | YELLOW |
| criticalFlags ≥ 1 | YELLOW |
| Pattern = YELLOW | YELLOW |
| Otherwise | GREEN |
