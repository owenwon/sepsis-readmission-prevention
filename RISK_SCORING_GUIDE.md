# Sepsis Risk Scoring Guide

## Overview

This document provides complete documentation for the sepsis risk calculation algorithm. The system uses a **tiered decision logic** approach to minimize "yellow inflation" while maintaining high sensitivity for detecting sepsis patterns.

### Design Principles

1. **Hard rules dominate**: Critical vital signs trigger immediate escalation
2. **Pattern detection over point accumulation**: Interaction scores catch sepsis patterns
3. **Tiered scoring**: Strong signals (vital signs) weighted higher than weak signals (subjective symptoms)
4. **Critical flag counting**: Multiple red-zone indicators escalate risk regardless of point totals
5. **High sensitivity for safety**: Designed to catch sepsis early, tolerates some false positives

---

## Algorithm Flow

```
┌─────────────────────────────────────┐
│ STEP 1: Emergency Conditions        │
│ (Q1-Q4, immediate 911 triggers)     │
└────────────┬────────────────────────┘
             │ No emergency
             ▼
┌─────────────────────────────────────┐
│ STEP 2: Hard RED Overrides          │
│ (Temp ≥103.5, O2 <90, HR >140, etc.)│
└────────────┬────────────────────────┘
             │ No hard override
             ▼
┌─────────────────────────────────────┐
│ STEP 3: Count Critical Flags        │
│ (Red-zone vitals & organ dysfunction)│
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ STEP 4: Calculate Interaction Score │
│ (Sepsis pattern detection)          │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ STEP 5: Calculate Base Score        │
│ (Individual symptom contributions)  │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ STEP 6: Apply High-Risk Modifier    │
│ (Age ≥65, immunocompromised, etc.)  │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ STEP 7: Determine Final Risk Level  │
│ (Thresholds + escalation overrides) │
└─────────────────────────────────────┘
```

---

## Question-by-Question Breakdown

### **IMMEDIATE DANGER SECTION**

#### Q1-Q4: Emergency Conditions
**Questions:**
- Q1: Fainting/severe dizziness
- Q2: Severe trouble breathing
- Q3: Severe confusion
- Q4: Extreme heat or shaking chills

**Scoring:**
- **Points:** N/A (immediate termination)
- **Action:** If ANY = YES → Return `RED_EMERGENCY` immediately
- **Message:** "CALL 911 IMMEDIATELY"

**Rationale:** These symptoms indicate life-threatening conditions (shock, respiratory failure, altered mental status, severe sepsis) requiring emergency medical services. No further assessment needed.

---

### **ENERGY & WELL-BEING SECTION**

#### Q5: Overall Feeling
**Scale:** 1-5 (😢 to 😃)

**Scoring:**
- **Points:** 0 (tracking only)
- **Purpose:** Clinical context, trend monitoring

**Rationale:** Too subjective and influenced by psychological factors to reliably indicate sepsis. Used for longitudinal wellness tracking but not risk calculation.

---

#### Q6: Energy Level
**Options:**
- 1 = Normal
- 2 = Slightly fatigued, too tired for usual activities
- 3 = Extremely fatigued, too weak to get out of bed

**Scoring:**
- **Base Points:**
  - Level 1: 0 points
  - Level 2: 5 points
  - Level 3: 15 points
- **Interaction Bonus:**
  - If Level 3 AND (Heart Rate Zone ≥2 OR Oxygen Zone ≥2): +20 points

**Rationale:** 
- Fatigue alone is nonspecific (common in many conditions)
- **Extreme fatigue with vital sign abnormalities** suggests systemic infection/sepsis
- Low base scores prevent yellow inflation from tired but stable patients
- Interaction rule catches cardiovascular strain patterns

**Example:**
- Patient with level 2 fatigue only: 5 points → GREEN
- Patient with level 3 fatigue + tachycardia (HR zone 2): 15 base + 20 interaction = 35 → YELLOW/RED

---

#### Q7: Pain Level
**Scale:** 0-10

**Scoring:**
- **Points:** 0 (tracking only)
- **Clinical Alert:** Pain ≥7 triggers comfort monitoring (not sepsis alert)

**Rationale:** Pain severity doesn't correlate with sepsis risk. Pain location (e.g., abdominal pain with fever) matters more than intensity, but we don't capture location in this survey.

---

### **VITALS SECTION**

#### Q8: Fever or Chills
**Options:** Yes / No

**Scoring:**
- **Points:** 10 (ONLY if YES and `has_thermometer = FALSE`)
- **If thermometer available:** 0 points (Q9 will be scored instead)

**Rationale:** 
- Subjective fever is unreliable (people often misperceive body temperature)
- Worth noting but not heavily weighted
- Objective temperature measurement (Q9) is far more valuable
- Prevents double-scoring when thermometer data is available

---

#### Q9: Temperature Reading
**Input:** Float (°F)

**Zones:**
- **Green (1):** 96.8–99.9°F (normal)
- **Yellow (2):** 100–101.4°F (low-grade fever)
- **Red (3):** <96.8°F (hypothermia) OR ≥101.5°F (high fever)

**Scoring:**
- **Hard Override:** Temp ≥103.5°F → `RED_EMERGENCY` (immediate)
- **Base Points:**
  - Green: 0 points
  - Yellow: 15 points
  - Red: 40 points
- **Critical Flag:** Red zone → +1 flag
- **Interaction Bonus:**
  - If Temp Zone ≥2 AND Heart Rate Zone ≥2: +20 points (SIRS criteria)
  - If `fever_chills = true` AND Urine Appearance ≥2: +15 points (urosepsis pattern)

**Rationale:**
- Temperature is a **core vital sign** in sepsis detection
- Fever + tachycardia = **SIRS criteria** (Systemic Inflammatory Response Syndrome)
- Very high temps (≥103.5°F) are medical emergencies
- Hypothermia (<96.8°F) can indicate severe sepsis with poor thermoregulation
- Interaction with heart rate catches systemic inflammatory response
- Interaction with urine symptoms catches UTI progressing to urosepsis

**Example:**
- Temp 100.5°F alone: 15 points → GREEN
- Temp 101.8°F + HR 115 bpm: 40 + 8 + 20 interaction = 68 → RED
- Temp 104°F: Immediate `RED_EMERGENCY`

---

#### Q10: Oxygen Level (SpO₂)
**Input:** Integer 0-100%

**Zones:**
- **Green (1):** 95-100% (normal)
- **Yellow (2):** 92-94% (mild hypoxia)
- **Red (3):** <92% (significant hypoxia)

**Scoring:**
- **Hard Override:** O₂ <90% → `RED_EMERGENCY` (immediate)
- **Base Points:**
  - Green: 0 points
  - Yellow: 15 points
  - Red: 40 points
- **Critical Flag:** Red zone → +1 flag
- **Interaction Bonus:**
  - If Oxygen Zone ≥2 AND Breathing Level ≥2: +20 points (respiratory distress)
  - If Energy Level = 3 AND Oxygen Zone ≥2: +20 points (hypoxia with fatigue)

**Rationale:**
- Low oxygen indicates **respiratory compromise** (pneumonia, sepsis, ARDS)
- Oxygen <90% is a medical emergency (brain/organ damage risk)
- Interaction with breathing difficulty = respiratory sepsis pattern
- Interaction with extreme fatigue = systemic hypoxia/organ dysfunction

**Example:**
- O₂ 93% alone: 15 points → GREEN
- O₂ 91% + difficult breathing: 40 + 8 + 20 interaction = 68 → RED
- O₂ 88%: Immediate `RED_EMERGENCY`

---

#### Q11: Heart Racing/Pounding
**Options:** Yes / No

**Scoring:**
- **Points:** 5 (ONLY if YES and `has_hr_monitor = FALSE`)
- **If HR monitor available:** 0 points (Q12 will be scored instead)

**Rationale:**
- Subjective palpitations are weak signals (anxiety, caffeine, etc.)
- Objective HR measurement (Q12) is critical for sepsis detection
- Prevents double-scoring

---

#### Q12: Heart Rate Reading
**Input:** Integer (bpm)

**Zones:**
- **Green (1):** 60-100 bpm (normal)
- **Yellow (2):** 101-120 bpm (tachycardia)
- **Red (3):** >120 bpm OR <60 bpm (severe tachycardia or bradycardia)

**Scoring:**
- **Hard Override:** HR >140 bpm → `RED_EMERGENCY` (immediate)
- **Base Points:**
  - Green: 0 points
  - Yellow: 8 points
  - Red: 20 points
- **Critical Flag:** Red zone → +1 flag
- **Interaction Bonus:**
  - If Temp Zone ≥2 AND Heart Rate Zone ≥2: +20 points (SIRS criteria)
  - If Energy Level = 3 AND Heart Rate Zone ≥2: +20 points (cardiovascular strain)

**Rationale:**
- **Tachycardia (fast HR) is a primary sepsis indicator**
- Heart rate >120 suggests significant physiologic stress
- HR >140 is a medical emergency (septic shock, arrhythmia risk)
- Interaction with fever = **SIRS criteria** (key sepsis screening tool)
- Interaction with extreme fatigue = cardiovascular system under strain

**Example:**
- HR 110 bpm alone: 8 points → GREEN
- HR 125 bpm + fever (temp 101.5°F): 20 + 40 + 20 interaction = 80 → RED
- HR 145 bpm: Immediate `RED_EMERGENCY`

---

#### Q13: Blood Pressure (Systolic)
**Input:** Integer (mmHg)

**Zones:**
- **Green (1):** Within 20 points of baseline
- **Yellow (2):** 20-39 points below baseline
- **Red (3):** 40+ points below baseline OR <90 mmHg OR >180 mmHg

**Scoring:**
- **Base Points:**
  - Green: 0 points
  - Yellow: 8 points
  - Red: 20 points
- **Critical Flag:** Red zone → +1 flag
- **Interaction Bonus:**
  - If BP Zone ≥2 AND Thinking Level ≥2: +25 points (septic shock)

**Rationale:**
- **Dropping BP is a hallmark of septic shock** (vasodilation from infection)
- BP <90 mmHg = hypotension (inadequate organ perfusion)
- Comparing to baseline captures individual patient patterns
- Interaction with altered mental status = **brain hypoperfusion** (shock state)
- This interaction gets highest bonus (+25) because it's the most dangerous pattern

**Example:**
- BP 100 mmHg (baseline 120): 8 points → GREEN
- BP 75 mmHg + slow thinking: 20 + 8 + 25 interaction = 53 → RED
- This is **septic shock** - life-threatening condition

---

### **MENTAL STATUS SECTION**

#### Q14: Thinking Clarity
**Options:**
- 1 = Clear
- 2 = Feels slow or not quite right
- 3 = Caregivers say I'm not making sense / Patient not making sense

**Scoring:**
- **Hard Override:** Level 3 → `RED_EMERGENCY` (immediate)
- **Base Points:**
  - Level 1: 0 points
  - Level 2: 8 points
  - Level 3: N/A (override triggers first)
- **Interaction Bonus:**
  - If BP Zone ≥2 AND Thinking Level ≥2: +25 points (septic shock)

**Rationale:**
- **Altered mental status is a severe sepsis criterion**
- Indicates brain not getting enough oxygen/blood (hypoperfusion)
- Level 3 (not making sense) = acute encephalopathy → emergency
- Interaction with low BP = septic shock with end-organ dysfunction

**Example:**
- Slow thinking alone: 8 points → GREEN
- Slow thinking + BP drop: 8 + 8 + 25 interaction = 41 → YELLOW/RED
- Not making sense: Immediate `RED_EMERGENCY`

---

### **BREATHING SECTION**

#### Q15: Breathing Status
**Options:**
- 1 = Normal
- 2 = Slightly more difficult/faster than usual
- 3 = Extremely difficult, major shortness of breath

**Scoring:**
- **Hard Override:** Level 3 → `RED_EMERGENCY` (immediate)
- **Base Points:**
  - Level 1: 0 points
  - Level 2: 8 points
  - Level 3: N/A (override triggers first)
- **Interaction Bonus:**
  - If Oxygen Zone ≥2 AND Breathing Level ≥2: +20 points (respiratory failure)

**Rationale:**
- **Respiratory distress is a sepsis complication** (pneumonia, ARDS)
- Level 3 = severe respiratory compromise → immediate help needed
- Interaction with low oxygen = respiratory failure pattern
- Sensitive to COPD/asthma patients (lower threshold for concern)

**Example:**
- Difficult breathing alone: 8 points → GREEN
- Difficult breathing + O₂ 91%: 8 + 40 + 20 interaction = 68 → RED
- Extremely difficult breathing: Immediate `RED_EMERGENCY`

---

### **ORGAN FUNCTION SECTION**

#### Q16: Urine Appearance
**Options:**
- 1 = Normal
- 2 = Cloudy, dark, or smelly
- 3 = Very dark, brown/tea-colored, red, or significantly different

**Scoring:**
- **Base Points:**
  - Level 1: 0 points
  - Level 2: 15 points
  - Level 3: 40 points
- **Critical Flag:** Level 3 → +1 flag
- **Interaction Bonus:**
  - If `fever_chills = true` AND Urine Appearance ≥2: +15 points (urosepsis)

**Rationale:**
- **Abnormal urine indicates kidney/urinary tract issues**
- Cloudy/smelly = UTI (common infection source)
- Very dark/bloody = severe UTI, kidney stones, or kidney damage
- Interaction with fever = **urosepsis** (UTI spreading to bloodstream)
- UTIs are a leading cause of sepsis in elderly patients

**Example:**
- Cloudy urine alone: 15 points → GREEN
- Cloudy urine + fever: 15 + 20 + 15 interaction = 50 → YELLOW/RED
- Dark/bloody urine + fever: 40 + 20 + 15 interaction = 75 → RED

---

#### Q17: UTI Symptoms Progression
**Options:**
- Improved (no symptoms or getting better)
- Same (ongoing burning, urgency, pressure)
- Worsened (increased burning, severe urgency, strong odor, worsening pain)

**Scoring:**
- **Base Points:**
  - Improved: 0 points
  - Same: 10 points
  - Worsened: 30 points
- **Prerequisites:** Only shown if `has_recent_uti = true`

**Rationale:**
- **Worsening UTI symptoms suggest treatment failure or progression**
- Persistent symptoms despite treatment warrant medical review
- Worsening symptoms = possible antibiotic resistance or spreading infection
- Higher weight for worsening (30 vs 10) captures urgency

**Example:**
- UTI symptoms unchanged: 10 points → GREEN (continue monitoring)
- UTI symptoms worsening: 30 points → YELLOW (contact provider)

---

#### Q18: Urine Output
**Options:**
- 1 = Normal
- 2 = Less than usual
- 3 = Little to none

**Scoring:**
- **Base Points:**
  - Level 1: 0 points
  - Level 2: 8 points
  - Level 3: 40 points
- **Critical Flag:** Level 3 → +1 flag
- **Prerequisites:** Only shown if kidney disease/failure/dialysis

**Rationale:**
- **Oliguria (low urine output) indicates kidney dysfunction**
- Kidneys are vulnerable to sepsis (acute kidney injury)
- Little/no urine = acute kidney failure → medical emergency
- Only asked for high-risk kidney patients (more sensitive to changes)

**Example:**
- Slightly less urine: 8 points → GREEN
- Little/no urine: 40 points + critical flag → escalates to YELLOW/RED

---

### **INFECTION SECTION**

#### Q19: Cough/Mucus Production
**Options:** Yes / No

**Scoring:**
- **Base Points:**
  - No: 0 points
  - Yes: 3 points

**Rationale:**
- **Respiratory symptoms are common and often benign**
- Cough alone is weak signal (allergies, cold, chronic conditions)
- Low weight (3 points) prevents yellow inflation
- Serves as gateway to Q20 for pneumonia patients

**Example:**
- Cough alone: 3 points → GREEN

---

#### Q20: Pneumonia Symptom Progression
**Options:** Yes (worsening) / No

**Scoring:**
- **Base Points:**
  - No: 0 points
  - Yes: 5 points (worsening)
- **Prerequisites:** Only shown if `has_cough = true` AND `has_recent_pneumonia = true`

**Rationale:**
- **Worsening pneumonia can progress to respiratory sepsis**
- Colored mucus or worsening cough = bacterial infection or treatment failure
- Still relatively low weight (5 points) - context-dependent
- Combined with vitals (O₂, breathing, temp), can escalate risk

**Example:**
- Pneumonia symptoms worsening: 5 points → GREEN (but watch vitals)
- Pneumonia worsening + fever + low O₂: Could trigger RED via interactions

---

#### Q21: Wound Status
**Options:**
- 1 = Healing
- 2 = Looks different
- 3 = Painful, red, smells, pus, or swollen

**Scoring:**
- **Base Points:**
  - Level 1: 0 points
  - Level 2: 10 points
  - Level 3: 40 points
- **Critical Flag:** Level 3 → +1 flag
- **Prerequisites:** Only shown if `has_active_wound = true`

**Rationale:**
- **Infected wounds can cause sepsis** (surgical site infections, pressure ulcers)
- Level 3 symptoms = **classic infection signs** (dolor, rubor, calor, tumor, pus)
- Wound infections are serious in post-surgical/elderly/diabetic patients
- High weight (40 points) reflects serious infection risk

**Example:**
- Wound looks different: 10 points → GREEN
- Wound infected (red, pus, swelling): 40 points + critical flag → YELLOW/RED

---

#### Q22: Skin Discoloration
**Options:** Yes (pale, bluish, purple, gray, yellow) / No

**Scoring:**
- **Base Points:**
  - No: 0 points
  - Yes: 30 points

**Rationale:**
- **Skin discoloration is a severe sepsis sign**
- **Mottling** (purple/gray patches) = poor perfusion, septic shock
- **Cyanosis** (bluish) = severe hypoxia
- **Jaundice** (yellow) = liver dysfunction
- High weight (30 points) because it's a **visual emergency indicator**
- Caregivers can spot this even if vitals not available

**Example:**
- Skin discoloration present: 30 points → likely YELLOW, possibly RED with other symptoms

---

### **GI SYMPTOMS SECTION**

#### Q23: GI Symptoms
**Options:** Yes (nausea, vomiting, diarrhea) / No

**Scoring:**
- **Base Points:**
  - No: 0 points
  - Yes: 5 points

**Rationale:**
- **GI symptoms are nonspecific** (food poisoning, medication, anxiety, etc.)
- Can indicate infection but not reliable sepsis predictor alone
- Low weight (5 points) prevents yellow inflation
- Multiple GI symptoms + fever = possible GI infection source

**Example:**
- GI symptoms alone: 5 points → GREEN

---

### **ADDITIONAL NOTES SECTION**

#### Q24: Additional Notes
**Type:** Free text (optional)

**Scoring:**
- **Points:** 0 (clinical context only)

**Rationale:**
- Allows patients/caregivers to share relevant details
- Reviewed by clinical team but not algorithmically scored
- Helpful for context (new medications, recent doctor visits, etc.)

---

## Critical Flags

**Definition:** Red-zone vital signs or organ dysfunction indicators

**Count as Critical Flags:**
1. Temperature in red zone (Q9)
2. Oxygen in red zone (Q10)
3. Heart rate in red zone (Q12)
4. Blood pressure in red zone (Q13)
5. Urine appearance level 3 (Q16)
6. Urine output level 3 (Q18)
7. Wound level 3 (Q21)

**Escalation Logic:**
- **≥2 critical flags → RED** (regardless of score)
  - Multiple failing systems = high sepsis risk
- **1 critical flag + total score ≥30 → RED**
  - One red-zone vital with other concerning symptoms = escalate

**Rationale:** Point totals can miss danger when multiple systems are failing. Critical flag counting ensures multi-system dysfunction triggers escalation.

---

## Interaction Scores

**Purpose:** Detect sepsis patterns (combinations more dangerous than individual symptoms)

### Interaction Rules

#### 1. Fever + Tachycardia (SIRS Criteria)
```
If (temperature_zone >= 2) AND (heart_rate_zone >= 2):
  +20 interaction points
```
**Rationale:** This is **SIRS criteria** - fever with fast HR indicates systemic inflammatory response, a key sepsis screening tool.

#### 2. Low Oxygen + Breathing Difficulty (Respiratory Sepsis)
```
If (oxygen_zone >= 2) AND (breathing_level >= 2):
  +20 interaction points
```
**Rationale:** Hypoxia with dyspnea = respiratory failure pattern (pneumonia sepsis, ARDS).

#### 3. Low BP + Altered Mental Status (Septic Shock)
```
If (blood_pressure_zone >= 2) AND (thinking_level >= 2):
  +25 interaction points (highest bonus)
```
**Rationale:** **This is septic shock** - hypotension causing brain hypoperfusion. Most dangerous pattern.

#### 4. Fever + Abnormal Urine (Urosepsis)
```
If (fever_chills = true) AND (urine_appearance_level >= 2):
  +15 interaction points
```
**Rationale:** UTI with systemic fever = urosepsis (UTI spreading to bloodstream). Common in elderly.

#### 5. Extreme Fatigue + Vital Sign Abnormalities (Systemic Infection)
```
If (energy_level = 3) AND ((heart_rate_zone >= 2) OR (oxygen_zone >= 2)):
  +20 interaction points
```
**Rationale:** Extreme weakness with cardiovascular/respiratory stress = systemic infection with organ strain.

### Why Interaction Scores Matter

**Problem:** Individual symptoms might not cross thresholds, but combinations are dangerous.

**Example:**
- Temp 100.5°F (15 points) + HR 115 bpm (8 points) = 23 points → GREEN ❌
- **With interaction:** 15 + 8 + 20 (SIRS pattern) = 43 points → YELLOW ✅

Interaction scores **catch early sepsis** before individual vitals become critical.

---

## High-Risk Modifier

**Applies to:**
- Age ≥65
- Weakened immune system (chemotherapy, immunosuppressants, HIV, etc.)
- ≥1 hospital readmission

**Effect:** Multiply total score by **1.25** (25% increase)

**Rationale:**
- Elderly patients deteriorate faster, have atypical presentations
- Immunocompromised patients can't fight infections effectively
- Previous readmissions indicate vulnerability
- Earlier escalation ensures timely intervention for vulnerable populations

**Example:**
- Total score 48 without modifier → YELLOW
- Total score 48 × 1.25 = 60 with modifier → RED ✅

---

## Final Risk Thresholds

### Standard Thresholds

```
 0-29  → GREEN   (Safe, continue monitoring)
30-59  → YELLOW  (Concerning, contact provider within 24 hours)
 60+   → RED     (Urgent, seek immediate medical attention)
```

### Escalation Overrides

**Override 1: Multiple Critical Flags**
```
If critical_flags >= 2:
  Return RED (regardless of score)
```

**Override 2: High Interaction Score**
```
If interaction_score >= 40:
  Return RED (strong sepsis pattern)
```

**Override 3: Yellow with Critical Flag**
```
If (total_score >= 30) AND (critical_flags >= 1):
  Return RED
```

### Why These Thresholds Work

**Problem with old thresholds (0-24 green, 25-49 yellow, 50+ red):**
- Minor symptoms pushed patients into yellow unnecessarily
- Created alert fatigue
- Didn't distinguish "somewhat concerning" from "urgent"

**New thresholds (0-29, 30-59, 60+):**
- **GREEN (0-29):** Requires multiple moderate issues to exit green
- **YELLOW (30-59):** Broader range captures "needs medical review" without urgency
- **RED (60+):** Reserved for genuinely dangerous situations
- **Overrides:** Ensure critical patterns aren't missed even if score is borderline

---

## Example Cases

### Case A: Mild Cold
**Symptoms:**
- Cough (3 points)
- GI symptoms (5 points)

**Calculation:**
- Base: 8 points
- Interaction: 0
- Total: 8 points
- **Result: GREEN** ✅

---

### Case B: Fever + Fatigue (No Other Symptoms)
**Symptoms:**
- Temperature 100.8°F - yellow zone (15 points)
- Energy level 2 - fatigued (5 points)

**Calculation:**
- Base: 20 points
- Interaction: 0 (no tachycardia to pair with fever)
- Total: 20 points
- **Result: GREEN** ✅
- **Rationale:** Low-grade fever with fatigue is common, not necessarily sepsis

---

### Case C: Early Sepsis Pattern
**Symptoms:**
- Temperature 101.8°F - red zone (40 points)
- Heart rate 118 bpm - yellow zone (8 points)
- Energy level 3 - extremely fatigued (15 points)

**Calculation:**
- Base: 63 points
- Interaction: 
  - Fever + HR: +20 (SIRS)
  - Extreme fatigue + HR: +20 (cardiovascular strain)
- Total: 63 + 40 = 103 points
- **Result: RED** ✅
- **Rationale:** Classic early sepsis - fever, tachycardia, extreme fatigue

---

### Case D: Single Red-Zone Vital
**Symptoms:**
- Blood pressure 80 mmHg (baseline 120) - red zone (20 points)
- Otherwise normal

**Calculation:**
- Base: 20 points
- Interaction: 0
- Critical flags: 1 (BP in red zone)
- Total: 20 points
- **Result: YELLOW** (1 critical flag, but score <30)
- **Message:** "Contact provider - blood pressure significantly lower than baseline"

---

### Case E: Multiple Red Zones (Critical Flags)
**Symptoms:**
- Temperature 101.5°F - red zone (40 points)
- Oxygen 91% - red zone (40 points)
- Otherwise normal

**Calculation:**
- Base: 80 points
- Interaction: 0
- Critical flags: 2 (temp + oxygen)
- **Result: RED** (critical flag override: ≥2 flags)
- **Message:** "SEEK IMMEDIATE MEDICAL ATTENTION - Multiple critical vital signs"

---

### Case F: Septic Shock Pattern
**Symptoms:**
- Blood pressure 75 mmHg - red zone (20 points)
- Thinking level 2 - slow (8 points)
- Heart rate 125 bpm - red zone (20 points)

**Calculation:**
- Base: 48 points
- Interaction: 
  - BP + thinking: +25 (septic shock pattern)
- Critical flags: 2 (BP + HR)
- Total: 48 + 25 = 73 points
- **Result: RED** (both score >60 AND critical flags ≥2 AND interaction ≥25)
- **Message:** "SEEK IMMEDIATE MEDICAL ATTENTION - Signs of septic shock"
- **Rationale:** This is life-threatening - hypotension causing brain hypoperfusion

---

### Case G: Urosepsis in Elderly Patient
**Symptoms:**
- Age: 72 (high-risk)
- Temperature 100.5°F - yellow zone (15 points)
- Fever/chills present
- Urine cloudy/smelly - level 2 (15 points)
- Energy level 2 - fatigued (5 points)

**Calculation:**
- Base: 35 points
- Interaction: 
  - Fever + urine: +15 (urosepsis pattern)
- Subtotal: 35 + 15 = 50 points
- High-risk modifier: 50 × 1.25 = 62.5 → 63 points
- **Result: RED** ✅
- **Rationale:** Elderly + UTI symptoms + fever = high urosepsis risk; modifier escalates appropriately

---

### Case H: Yellow Inflation Prevention
**Symptoms:**
- Cough (3 points)
- GI symptoms (5 points)
- Subjective fever without thermometer (10 points)
- Mild fatigue - level 2 (5 points)

**Calculation:**
- Base: 23 points
- Interaction: 0
- Total: 23 points
- **Result: GREEN** ✅
- **Rationale:** Multiple minor symptoms don't cross threshold - prevents unnecessary alerts

---

## Algorithm Design Philosophy

### High Sensitivity for Safety

**Goal:** **Don't miss sepsis** (false negative worse than false positive)

**Acceptable tradeoffs:**
- Some false positives (extra provider contacts) are tolerable
- Yellow inflation was a problem, but missing sepsis is worse
- New thresholds balance sensitivity with reducing unnecessary alerts

### Why This System Works

#### 1. **Tiered Logic Prevents Yellow Inflation**
- Weak signals (cough, GI, subjective fever) have low weights
- Need multiple issues or vital sign changes to escalate
- Broad yellow range (30-59) prevents "borderline" anxiety

#### 2. **Pattern Detection Catches Sepsis Early**
- Interaction scores detect dangerous combinations
- SIRS criteria, septic shock, urosepsis patterns identified
- Catches early sepsis before individual vitals become critical

#### 3. **Critical Flags Ensure Multi-System Dysfunction Escalates**
- Point totals can miss when multiple organs failing
- ≥2 red-zone vitals = automatic RED
- Prevents "almost but not quite" scenarios

#### 4. **Hard Overrides Protect Against Emergencies**
- Life-threatening vitals bypass scoring
- Emergency conditions get immediate 911 message
- No risk of delay from threshold calculations

#### 5. **High-Risk Modifier Protects Vulnerable Populations**
- Elderly and immunocompromised escalate earlier
- Accounts for atypical presentations
- Previous readmissions signal vulnerability

---

## Implementation Notes

### Zone Calculation

If zones aren't pre-calculated in the survey response, the calculator automatically computes them based on thresholds documented in the survey schema.

### Missing Data Handling

- **Vital signs:** If device not available (no thermometer, no pulse ox, etc.), subjective symptoms scored at low weights
- **Conditional questions:** If prerequisites not met, values are `null` or `not_applicable` and contribute 0 points
- **Baseline BP:** If not available, default to 120 mmHg (population average)

### Survey Termination

Certain red-zone answers **terminate the survey early** and trigger immediate escalation:
- Q9: Temperature in red zone (but survey continues unless ≥103.5°F)
- Q10: Oxygen in red zone (but survey continues unless <90%)
- Q12: Heart rate in red zone (but survey continues unless >140 bpm)
- Q14: Thinking level 3 (survey terminates immediately)
- Q15: Breathing level 3 (survey terminates immediately)

This ensures most urgent cases get immediate attention without needing full survey completion.

---

## Clinical Context

### What is Sepsis?

Sepsis is a **life-threatening condition** where the body's response to infection causes widespread inflammation, leading to tissue damage, organ failure, and death if untreated.

### qSOFA and SIRS Criteria (Clinical Standards)

This algorithm incorporates elements of clinical sepsis screening tools:

**qSOFA (quick Sequential Organ Failure Assessment):**
- Altered mental status
- Systolic BP ≤100 mmHg
- Respiratory rate ≥22 breaths/min

**SIRS Criteria:**
- Temperature >38°C (100.4°F) or <36°C (96.8°F)
- Heart rate >90 bpm
- Respiratory rate >20 breaths/min
- WBC >12,000 or <4,000 cells/mm³

Our algorithm captures qSOFA and SIRS through interaction patterns and critical thresholds.

### Common Sepsis Sources

1. **Urinary tract infections (UTIs)** - especially in elderly
2. **Pneumonia** - respiratory infections
3. **Abdominal infections** - appendicitis, bowel perforation
4. **Skin/wound infections** - surgical sites, pressure ulcers, cellulitis
5. **Bloodstream infections** - central line infections, bacteremia

---

## Maintenance and Updates

### Tuning Thresholds

If clinical review shows too many false positives/negatives:

**Reduce false positives (too many yellows/reds):**
- Increase thresholds (e.g., 0-32 green, 33-64 yellow, 65+ red)
- Reduce interaction bonuses
- Increase critical flag requirement (≥3 instead of ≥2)

**Reduce false negatives (missed sepsis cases):**
- Decrease thresholds
- Increase interaction bonuses
- Add more interaction rules
- Lower critical flag requirement

### Adding New Questions

If new questions are added to the survey:
1. Determine if symptom is strong signal (vital sign, organ dysfunction) or weak signal (subjective symptom)
2. Assign base points accordingly (strong: 8-40, weak: 3-5)
3. Consider if symptom should count as critical flag
4. Identify potential interaction patterns with existing questions
5. Update documentation

### Validating Changes

After any algorithm changes:
1. Run through all example cases in this document
2. Verify expected outcomes haven't changed unintentionally
3. Review with clinical team for medical appropriateness
4. Consider A/B testing on non-critical population
5. Monitor for increased/decreased escalation rates

---

## Summary

This risk calculator uses a **sophisticated tiered approach** to balance sensitivity (catching sepsis) with specificity (avoiding alert fatigue). Key features:

✅ **Hard overrides** for emergencies
✅ **Critical flag counting** for multi-system dysfunction
✅ **Interaction scores** for sepsis pattern detection
✅ **Tiered base scoring** (strong signals weighted higher)
✅ **High-risk modifiers** for vulnerable populations
✅ **Broader yellow range** to reduce borderline anxiety
✅ **Escalation overrides** to catch dangerous patterns

The result is a system that prevents yellow inflation while maintaining high sensitivity for detecting sepsis in its early, treatable stages. 