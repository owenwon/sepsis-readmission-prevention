-- Sepsis Monitoring Application - PostgreSQL Schema for Supabase
-- Run this migration to create all necessary tables and types

-- =============================================================================
-- ENUMS (Custom Types)
-- =============================================================================

CREATE TYPE sex_assigned AS ENUM (
    'male',
    'female',
    'intersex',
    'prefer_not_to_say'
);

CREATE TYPE sepsis_status_type AS ENUM (
    'recently_discharged',
    'readmitted',
    'other'
);

CREATE TYPE caregiver_availability_type AS ENUM (
    'full_time',
    'part_time',
    'occasional',
    'none'
);

CREATE TYPE physical_ability_type AS ENUM (
    'normal',
    'tires_easily',
    'needs_help',
    'bed_or_wheelchair'
);

-- Zone type uses INTEGER: 1=green, 2=yellow, 3=red
-- (No enum needed - using INTEGER with CHECK constraints)

CREATE TYPE uti_symptoms_type AS ENUM (
    'improved',
    'same',
    'worsened',
    'not_applicable'
);

-- =============================================================================
-- PATIENTS TABLE (Onboarding Data)
-- =============================================================================

CREATE TABLE patients (
    -- Primary Key
    patient_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Link to Supabase Auth
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- =========================================================================
    -- USER TYPE
    -- Maps to onboarding.ts user_type question -> schemaField: ['is_patient', 'is_caregiver']
    -- customMapping: { is_patient: value === 'patient', is_caregiver: value === 'caregiver' }
    -- =========================================================================
    is_patient BOOLEAN NOT NULL DEFAULT true,
    is_caregiver BOOLEAN NOT NULL DEFAULT false,

    -- =========================================================================
    -- BASIC INFORMATION
    -- Maps to onboarding.ts: patient_name, birthday
    -- age is derived at query time via calculate_age(birthday); not stored separately
    -- =========================================================================
    patient_name VARCHAR(100) NOT NULL,
    birthday DATE NOT NULL,
    sex_assigned_at_birth sex_assigned NOT NULL,

    -- =========================================================================
    -- SEPSIS CONTEXT
    -- Maps to onboarding.ts: currently_hospitalized, days_since_last_discharge,
    --   admitted_count (SurveyResponse.admitted_count used by isHighRiskPatient: > 1)
    -- =========================================================================
    currently_hospitalized BOOLEAN DEFAULT false,
    sepsis_status sepsis_status_type,
    days_since_last_discharge INTEGER,
    admitted_count INTEGER DEFAULT 0,

    -- =========================================================================
    -- CHRONIC MEDICAL CONDITIONS
    -- Maps to onboarding.ts chronic_conditions (multi_select) via customMapping:
    --
    --   has_weakened_immune   ← cancer | hiv_aids | autoimmune | weakened_immune
    --                           Used by isHighRiskPatient() in riskCalculator
    --
    --   has_lung_condition    ← copd | asthma | lung_fibrosis | cystic_fibrosis | sleep_apnea
    --                           Amplifies breathing_level=2 score: +8 → +16
    --                           Amplifies mucus_color_level=2 score: +10 → +18
    --                           Amplifies mucus_color_level=3 score: +30 → +35
    --
    --   has_heart_failure     ← congestive_heart_failure
    --                           Amplifies energy_level=2 score: +5 → +10
    --                           Amplifies energy_level=3 score: +15 → +25
    --                           Amplifies heart_rate_zone=2 score: +8 → +15
    --                           Amplifies heart_rate_zone=3 score: +30 → +40
    --                           Amplifies breathing_level=2 score: +8 → +16 (same as lung)
    --
    --   has_hypertension      ← hypertension (UI/tracking only, no riskCalculator effect)
    --   has_diabetes          ← diabetes (UI/tracking only, no riskCalculator effect)
    --   chronic_conditions_other ← any other selected condition
    -- =========================================================================
    has_weakened_immune BOOLEAN DEFAULT false,
    has_lung_condition BOOLEAN DEFAULT false,
    has_heart_failure BOOLEAN DEFAULT false,
    has_hypertension BOOLEAN DEFAULT false,
    has_diabetes BOOLEAN DEFAULT false,
    chronic_conditions_other BOOLEAN DEFAULT false,

    -- =========================================================================
    -- RECENT / ACTIVE ILLNESSES
    -- Maps to onboarding.ts recent_illnesses (multi_select) via customMapping:
    --
    --   has_recent_uti        ← uti
    --                           Gates uti_symptoms_worsening question in dailyCheckin.ts
    --                           riskCalculator uses uti_symptoms_worsening with this flag
    --
    --   has_recent_pneumonia  ← pneumonia
    --                           riskCalculator adds +10 to mucus score when true
    --
    --   has_had_septic_shock  ← septic_shock
    --                           riskCalculator context bonus: +10 flat (applyContextBonuses)
    --
    --   has_urinary_catheter  ← urinary_catheter
    --                           Amplifies uti_symptoms_worsening='same' score: +10 → +18
    --                           Amplifies uti_symptoms_worsening='worsened' score: +30 → +40
    --
    --   has_other_acute_illnesses ← any other selected illness (UI/tracking only)
    -- =========================================================================
    has_recent_uti BOOLEAN DEFAULT false,
    has_recent_pneumonia BOOLEAN DEFAULT false,
    has_had_septic_shock BOOLEAN DEFAULT false,
    has_urinary_catheter BOOLEAN DEFAULT false,
    has_other_acute_illnesses BOOLEAN DEFAULT false,

    -- =========================================================================
    -- MEDICATIONS
    -- Maps to onboarding.ts current_medications (autocomplete) via customMapping:
    --
    --   on_immunosuppressants ← any immunosuppressant, biologic, chemotherapy, or
    --                           corticosteroid medication in the list
    --                           Used by isHighRiskPatient() in riskCalculator:
    --                           triggers 25% score multiplier
    --
    --   has_other_medications ← any other selected medication (UI/tracking only)
    -- =========================================================================
    current_medications JSONB,
    on_immunosuppressants BOOLEAN DEFAULT false,
    has_other_medications BOOLEAN DEFAULT false,

    -- =========================================================================
    -- CARE & SOCIAL SUPPORT
    -- Maps to onboarding.ts: has_caregiver, caregiver_availability,
    --   physical_ability (→ physical_ability_level + can_exercise_regularly), social_support
    -- UI/tracking only — no riskCalculator effect
    -- =========================================================================
    has_caregiver BOOLEAN DEFAULT false,
    caregiver_availability caregiver_availability_type,
    physical_ability_level physical_ability_type,
    can_exercise_regularly BOOLEAN DEFAULT false,
    has_social_support BOOLEAN DEFAULT false,

    -- =========================================================================
    -- MONITORING DEVICE ACCESS
    -- Maps to onboarding.ts: has_thermometer, has_pulse_oximeter, has_bp_cuff, has_hr_monitor
    -- These gate the corresponding objective vital questions in dailyCheckin.ts:
    --   has_thermometer   → gates temperature_value input
    --   has_pulse_oximeter → gates oxygen_level_value input
    --   has_bp_cuff       → gates blood_pressure_systolic input
    --   has_hr_monitor    → gates heart_rate_value input
    -- riskCalculator uses them to decide subjective vs objective scoring:
    --   !has_thermometer + fever_chills → +10 (subjective fever)
    --   !has_hr_monitor  + heart_racing → +5  (subjective tachycardia)
    -- =========================================================================
    has_thermometer BOOLEAN DEFAULT false,
    has_pulse_oximeter BOOLEAN DEFAULT false,
    has_bp_cuff BOOLEAN DEFAULT false,
    has_hr_monitor BOOLEAN DEFAULT false,

    -- =========================================================================
    -- BASELINE MEASUREMENTS
    -- Maps to onboarding.ts baseline_bp_systolic question (shown when has_bp_cuff = true)
    -- Used by calculateZones() in riskCalculator to compute blood_pressure_zone:
    --   zone 2 if current BP is 20–39 below baseline
    --   zone 3 if current BP is 40+ below baseline
    -- Defaults to 120 in riskCalculator if NULL
    -- =========================================================================
    baseline_bp_systolic INTEGER,

    -- =========================================================================
    -- RISK FLAG (derived / cached)
    -- Auto-calculated by calculate_high_risk() trigger on INSERT and UPDATE.
    -- Mirrors isHighRiskPatient() in riskCalculator.ts exactly:
    --   age >= 65 OR has_weakened_immune OR admitted_count > 1 OR on_immunosuppressants
    -- =========================================================================
    is_high_risk BOOLEAN DEFAULT false,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_user_type CHECK (
        (is_patient = true AND is_caregiver = false) OR
        (is_patient = false AND is_caregiver = true)
    ),
    CONSTRAINT valid_admitted_count CHECK (admitted_count >= 0),
    CONSTRAINT valid_days_since_discharge CHECK (
        days_since_last_discharge IS NULL OR days_since_last_discharge >= 0
    ),
    CONSTRAINT valid_baseline_bp CHECK (
        baseline_bp_systolic IS NULL OR
        (baseline_bp_systolic >= 60 AND baseline_bp_systolic <= 250)
    )
);

-- Indexes
CREATE INDEX idx_patients_created_at ON patients(created_at);
CREATE INDEX idx_patients_high_risk ON patients(is_high_risk) WHERE is_high_risk = true;
CREATE UNIQUE INDEX idx_patients_user_id ON patients(user_id);

-- =============================================================================
-- DAILY CHECK-INS TABLE
-- =============================================================================

CREATE TABLE daily_checkins (
    -- Primary Key
    daily_checkin_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign Key
    patient_id UUID NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,

    -- Check-in Date
    checkin_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- =========================================================================
    -- IMMEDIATE DANGER SECTION
    -- Maps to dailyCheckin.ts questions: fainted_or_very_dizzy, breathing_level,
    --   thinking_level, extreme_heat_or_chills, discolored_skin
    -- Any trigger condition → RED_EMERGENCY in checkEmergencyConditions()
    -- =========================================================================
    fainted_or_very_dizzy BOOLEAN DEFAULT false,
    -- breathing_level and thinking_level are integers stored below (under their
    -- respective sections) but both serve double duty as immediate danger triggers:
    --   breathing_level = 3 → RED_EMERGENCY
    --   thinking_level  = 3 → RED_EMERGENCY
    extreme_heat_or_chills BOOLEAN DEFAULT false,
    discolored_skin BOOLEAN DEFAULT false,
    -- Note: discolored_skin triggers RED_EMERGENCY in checkEmergencyConditions().
    -- It is grouped here logically even though it appears last in the survey UI.

    -- =========================================================================
    -- ENERGY & WELL-BEING SECTION
    -- Maps to dailyCheckin.ts: overall_feeling, energy_level, pain_level
    --
    --   overall_feeling  — tracking only, no riskCalculator score impact
    --   energy_level     — 1=normal, 2=fatigued (+5, or +10 with has_heart_failure),
    --                                3=extremely fatigued (+15, or +25 with has_heart_failure)
    --   pain_level       — tracking only, no riskCalculator score impact
    -- =========================================================================
    overall_feeling INTEGER CHECK (overall_feeling BETWEEN 1 AND 5),
    energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 3),
    pain_level INTEGER CHECK (pain_level BETWEEN 0 AND 10),

    -- =========================================================================
    -- VITALS — TEMPERATURE
    -- Maps to dailyCheckin.ts: fever_chills, temperature_value
    -- temperature_zone is computed client-side by calculateZones() and stored here
    -- for efficient querying (not re-derived server-side).
    --
    --   fever_chills     — subjective; if true AND !has_thermometer → +10 score
    --   temperature_value — objective (°F); only collected when has_thermometer = true
    --   temperature_zone  — 1=green(96.8–99.9°F), 2=yellow(100–101.4°F), 3=red(otherwise)
    --                       Hard override: value ≥ 103.5°F → RED_EMERGENCY (app-enforced)
    -- =========================================================================
    fever_chills BOOLEAN DEFAULT false,
    temperature_value NUMERIC(4, 1) CHECK (
        temperature_value IS NULL OR
        (temperature_value >= 90.0 AND temperature_value <= 110.0)
    ),
    temperature_zone INTEGER CHECK (temperature_zone IS NULL OR temperature_zone BETWEEN 1 AND 3),

    -- =========================================================================
    -- VITALS — OXYGEN
    -- Maps to dailyCheckin.ts: oxygen_level_value
    -- Only collected when patients.has_pulse_oximeter = true
    --
    --   oxygen_level_value — objective (%); zone 2 → +15, zone 3 → +40
    --   oxygen_level_zone  — 1=green(95–100%), 2=yellow(92–94%), 3=red(<92%)
    --                        Hard override: value < 90% → RED_EMERGENCY (app-enforced)
    -- =========================================================================
    oxygen_level_value INTEGER CHECK (
        oxygen_level_value IS NULL OR
        (oxygen_level_value >= 0 AND oxygen_level_value <= 100)
    ),
    oxygen_level_zone INTEGER CHECK (oxygen_level_zone IS NULL OR oxygen_level_zone BETWEEN 1 AND 3),

    -- =========================================================================
    -- VITALS — HEART RATE
    -- Maps to dailyCheckin.ts: heart_racing, heart_rate_value
    --
    --   heart_racing     — subjective; if true AND !has_hr_monitor → +5 score
    --   heart_rate_value — objective (bpm); only collected when heart_racing = true
    --                      AND has_hr_monitor = true
    --   heart_rate_zone  — 1=green(60–100bpm), 2=yellow(101–120bpm), 3=red(<60 or >120bpm)
    --                      Zone 2 → +8 (or +15 with has_heart_failure)
    --                      Zone 3 → +30 (or +40 with has_heart_failure)
    --                      Hard override: value > 140bpm → RED_EMERGENCY (app-enforced)
    -- =========================================================================
    heart_racing BOOLEAN DEFAULT false,
    heart_rate_value INTEGER CHECK (
        heart_rate_value IS NULL OR
        (heart_rate_value >= 30 AND heart_rate_value <= 250)
    ),
    heart_rate_zone INTEGER CHECK (heart_rate_zone IS NULL OR heart_rate_zone BETWEEN 1 AND 3),

    -- =========================================================================
    -- VITALS — BLOOD PRESSURE
    -- Maps to dailyCheckin.ts: blood_pressure_systolic
    -- Only collected when patients.has_bp_cuff = true
    --
    --   blood_pressure_systolic — objective (mmHg); zone 2 → +8, zone 3 → +20
    --   blood_pressure_zone     — computed relative to patients.baseline_bp_systolic
    --                             (or 120 if NULL):
    --                             1=green (within 20 of baseline)
    --                             2=yellow (20–39 below baseline)
    --                             3=red (<90, >180, or ≥40 below baseline)
    --                             Hard override: zone 3 → RED_EMERGENCY (app-enforced)
    -- =========================================================================
    blood_pressure_systolic INTEGER CHECK (
        blood_pressure_systolic IS NULL OR
        (blood_pressure_systolic >= 60 AND blood_pressure_systolic <= 250)
    ),
    blood_pressure_zone INTEGER CHECK (blood_pressure_zone IS NULL OR blood_pressure_zone BETWEEN 1 AND 3),

    -- =========================================================================
    -- MENTAL STATUS
    -- Maps to dailyCheckin.ts: thinking_level
    --   1=clear, 2=slow or foggy (+8), 3=not making sense (→ RED_EMERGENCY)
    -- =========================================================================
    thinking_level INTEGER CHECK (thinking_level BETWEEN 1 AND 3),

    -- =========================================================================
    -- BREATHING
    -- Maps to dailyCheckin.ts: breathing_level
    --   1=normal, 2=slightly difficult (+8, or +16 with has_lung_condition or has_heart_failure),
    --   3=extremely difficult (→ RED_EMERGENCY)
    -- =========================================================================
    breathing_level INTEGER CHECK (breathing_level BETWEEN 1 AND 3),

    -- =========================================================================
    -- ORGAN FUNCTION — URINE
    -- Maps to dailyCheckin.ts: urine_appearance_level, uti_symptoms_worsening
    --
    --   urine_appearance_level   — 1=normal, 2=cloudy/dark/smelly (+15),
    --                              3=very dark/bloody (+60)
    --   uti_symptoms_worsening   — only collected when patients.has_recent_uti = true
    --                              'same' + has_recent_uti → +10 (or +18 with has_urinary_catheter)
    --                              'worsened' + has_recent_uti → +30 (or +40 with has_urinary_catheter)
    -- =========================================================================
    urine_appearance_level INTEGER CHECK (urine_appearance_level BETWEEN 1 AND 3),
    uti_symptoms_worsening uti_symptoms_type DEFAULT 'not_applicable',

    -- =========================================================================
    -- INFECTION — COUGH
    -- Maps to dailyCheckin.ts: has_cough question (single_select with customMapping)
    -- The question maps a single answer to two schema fields:
    --   { has_cough: value !== 'none', mucus_color_level: value === 'none' ? null : value }
    --
    --   has_cough        — true when any non-none option is selected
    --   mucus_color_level — 1=clear/white/none, 2=yellow/green, 3=brown/pink/red, null=no cough
    --                       Level 2 → +10 (or +18 with has_lung_condition)
    --                                  +10 additional if has_recent_pneumonia
    --                       Level 3 → +30 (or +35 with has_lung_condition)
    --                                  +10 additional if has_recent_pneumonia
    --                       null or 1 with has_cough=true → +3
    -- =========================================================================
    has_cough BOOLEAN DEFAULT false,
    mucus_color_level INTEGER CHECK (
        mucus_color_level IS NULL OR
        mucus_color_level BETWEEN 1 AND 3
    ),

    -- =========================================================================
    -- INFECTION — WOUND
    -- Maps to dailyCheckin.ts: wound_state_level
    -- Only collected when any wound is present (UI shows 'No wound present' option)
    --   1=healing/same, 2=looks different (+10), 3=infected: red/pus/swollen (+60)
    -- =========================================================================
    wound_state_level INTEGER CHECK (
        wound_state_level IS NULL OR
        wound_state_level BETWEEN 1 AND 3
    ),

    -- =========================================================================
    -- GI SYMPTOMS
    -- Maps to dailyCheckin.ts: nausea_vomiting_diarrhea → +5 score
    -- =========================================================================
    nausea_vomiting_diarrhea BOOLEAN DEFAULT false,

    -- =========================================================================
    -- ADDITIONAL NOTES
    -- Maps to dailyCheckin.ts: additional_notes
    -- Tracking only — no riskCalculator score impact
    -- =========================================================================
    additional_notes TEXT,

    -- =========================================================================
    -- RISK LEVEL (OUTPUT)
    -- Calculated by riskCalculator.ts calculateSepsisRisk() client-side before insert.
    -- Only the final risk_level is stored; all scoring logic runs in the app.
    -- Mirrors RiskLevel type: 'GREEN' | 'YELLOW' | 'RED' | 'RED_EMERGENCY'
    -- =========================================================================
    risk_level VARCHAR(20) DEFAULT 'GREEN' CHECK (
        risk_level IN ('GREEN', 'YELLOW', 'RED', 'RED_EMERGENCY')
    ),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_patient_date UNIQUE (patient_id, checkin_date),
    CONSTRAINT zone_consistency_temp CHECK (
        (temperature_value IS NULL AND temperature_zone IS NULL) OR
        (temperature_value IS NOT NULL AND temperature_zone IS NOT NULL)
    ),
    CONSTRAINT zone_consistency_o2 CHECK (
        (oxygen_level_value IS NULL AND oxygen_level_zone IS NULL) OR
        (oxygen_level_value IS NOT NULL AND oxygen_level_zone IS NOT NULL)
    ),
    CONSTRAINT zone_consistency_hr CHECK (
        (heart_rate_value IS NULL AND heart_rate_zone IS NULL) OR
        (heart_rate_value IS NOT NULL AND heart_rate_zone IS NOT NULL)
    ),
    CONSTRAINT zone_consistency_bp CHECK (
        (blood_pressure_systolic IS NULL AND blood_pressure_zone IS NULL) OR
        (blood_pressure_systolic IS NOT NULL AND blood_pressure_zone IS NOT NULL)
    )
);

-- Indexes
CREATE INDEX idx_daily_checkins_patient_id ON daily_checkins(patient_id);
CREATE INDEX idx_daily_checkins_date ON daily_checkins(checkin_date DESC);
CREATE INDEX idx_daily_checkins_risk_level ON daily_checkins(risk_level)
    WHERE risk_level IN ('RED', 'RED_EMERGENCY');
CREATE INDEX idx_daily_checkins_patient_date ON daily_checkins(patient_id, checkin_date DESC);

-- =============================================================================
-- TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_patients_updated_at
    BEFORE UPDATE ON patients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_checkins_updated_at
    BEFORE UPDATE ON daily_checkins
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- HIGH-RISK TRIGGER
-- Mirrors isHighRiskPatient() in riskCalculator.ts exactly:
--   (age !== undefined && age >= 65) || has_weakened_immune || admitted_count > 1
--   || (on_immunosuppressants ?? false)
-- Runs on every INSERT and UPDATE so is_high_risk is always current.
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_high_risk()
RETURNS TRIGGER AS $$
DECLARE
    patient_age INTEGER;
BEGIN
    patient_age := EXTRACT(YEAR FROM AGE(CURRENT_DATE, NEW.birthday));
    NEW.is_high_risk := (
        patient_age >= 65
        OR NEW.has_weakened_immune
        OR NEW.admitted_count > 1
        OR NEW.on_immunosuppressants
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_patient_high_risk
    BEFORE INSERT OR UPDATE ON patients
    FOR EACH ROW
    EXECUTE FUNCTION calculate_high_risk();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own patient record"
    ON patients FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own patient record"
    ON patients FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own patient record"
    ON patients FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own check-ins"
    ON daily_checkins FOR SELECT
    USING (
        patient_id IN (
            SELECT patient_id FROM patients WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own check-ins"
    ON daily_checkins FOR INSERT
    WITH CHECK (
        patient_id IN (
            SELECT patient_id FROM patients WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own check-ins"
    ON daily_checkins FOR UPDATE
    USING (
        patient_id IN (
            SELECT patient_id FROM patients WHERE user_id = auth.uid()
        )
    );

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Returns integer age from birthday (used in views and the high-risk trigger)
CREATE OR REPLACE FUNCTION calculate_age(birthday DATE)
RETURNS INTEGER AS $$
BEGIN
    RETURN EXTRACT(YEAR FROM AGE(CURRENT_DATE, birthday));
END;
$$ LANGUAGE plpgsql STABLE;

-- Mirrors calculateZones() temperature logic in riskCalculator.ts:
--   1 (green):  96.8–99.9°F
--   2 (yellow): 100.0–101.4°F
--   3 (red):    <96.8°F or ≥101.5°F
-- Hard RED_EMERGENCY override at ≥103.5°F is enforced in the app, not the DB.
CREATE OR REPLACE FUNCTION calculate_temperature_zone(temp NUMERIC)
RETURNS INTEGER AS $$
BEGIN
    IF temp IS NULL THEN
        RETURN NULL;
    ELSIF temp >= 96.8 AND temp <= 99.9 THEN
        RETURN 1;
    ELSIF temp >= 100.0 AND temp <= 101.4 THEN
        RETURN 2;
    ELSE
        RETURN 3;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Mirrors calculateZones() oxygen logic in riskCalculator.ts:
--   1 (green):  95–100%
--   2 (yellow): 92–94%
--   3 (red):    <92%
-- Hard RED_EMERGENCY override at <90% is enforced in the app, not the DB.
CREATE OR REPLACE FUNCTION calculate_oxygen_zone(spo2 INTEGER)
RETURNS INTEGER AS $$
BEGIN
    IF spo2 IS NULL THEN
        RETURN NULL;
    ELSIF spo2 >= 95 THEN
        RETURN 1;
    ELSIF spo2 >= 92 THEN
        RETURN 2;
    ELSE
        RETURN 3;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Mirrors calculateZones() heart rate logic in riskCalculator.ts:
--   1 (green):  60–100 bpm
--   2 (yellow): 101–120 bpm
--   3 (red):    <60 or >120 bpm
-- Hard RED_EMERGENCY override at >140 bpm is enforced in the app, not the DB.
CREATE OR REPLACE FUNCTION calculate_heart_rate_zone(hr INTEGER)
RETURNS INTEGER AS $$
BEGIN
    IF hr IS NULL THEN
        RETURN NULL;
    ELSIF hr >= 60 AND hr <= 100 THEN
        RETURN 1;
    ELSIF hr >= 101 AND hr <= 120 THEN
        RETURN 2;
    ELSE
        RETURN 3;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Mirrors calculateZones() blood pressure logic in riskCalculator.ts:
--   3 (red):    <90, >180, or ≥40 below baseline
--   2 (yellow): 20–39 below baseline
--   1 (green):  otherwise (stable or elevated within 20 of baseline)
-- baseline_systolic defaults to 120 if NULL (matches riskCalculator fallback).
-- Hard RED_EMERGENCY override at zone 3 is enforced in the app, not the DB.
CREATE OR REPLACE FUNCTION calculate_bp_zone(
    current_systolic INTEGER,
    baseline_systolic INTEGER
)
RETURNS INTEGER AS $$
DECLARE
    effective_baseline INTEGER;
    diff INTEGER;
BEGIN
    IF current_systolic IS NULL THEN
        RETURN NULL;
    END IF;

    effective_baseline := COALESCE(baseline_systolic, 120);

    IF current_systolic < 90 OR current_systolic > 180 THEN
        RETURN 3;
    END IF;

    diff := effective_baseline - current_systolic;

    IF diff >= 40 THEN
        RETURN 3;
    ELSIF diff >= 20 THEN
        RETURN 2;
    ELSE
        RETURN 1;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- VIEWS FOR COMMON QUERIES
-- =============================================================================

-- Recent high-risk check-ins for the authenticated user
CREATE OR REPLACE VIEW high_risk_checkins AS
SELECT
    dc.*,
    p.patient_name,
    calculate_age(p.birthday) AS age,
    p.is_high_risk AS patient_high_risk
FROM daily_checkins dc
JOIN patients p ON dc.patient_id = p.patient_id
WHERE dc.risk_level IN ('RED', 'RED_EMERGENCY')
  AND p.user_id = auth.uid()
ORDER BY dc.checkin_date DESC;

-- Patient summary with most recent check-in for the authenticated user
CREATE OR REPLACE VIEW patient_summary AS
SELECT
    p.*,
    dc.checkin_date AS last_checkin_date,
    dc.risk_level AS last_risk_level
FROM patients p
LEFT JOIN LATERAL (
    SELECT checkin_date, risk_level FROM daily_checkins
    WHERE patient_id = p.patient_id
    ORDER BY checkin_date DESC
    LIMIT 1
) dc ON true
WHERE p.user_id = auth.uid();

-- =============================================================================
-- COLUMN COMMENTS
-- =============================================================================

COMMENT ON TABLE patients IS 'Patient onboarding data. Populated by onboarding.ts survey. Source of truth for all patient context fields read by riskCalculator.ts.';
COMMENT ON TABLE daily_checkins IS 'Daily symptom check-ins and vitals. Populated by dailyCheckin.ts survey. risk_level is computed client-side by riskCalculator.ts before insert.';

COMMENT ON COLUMN patients.admitted_count IS 'Total sepsis hospitalizations. isHighRiskPatient() in riskCalculator: admitted_count > 1 → high risk (25% score multiplier).';
COMMENT ON COLUMN patients.has_lung_condition IS 'True if patient has COPD, asthma, lung fibrosis, cystic fibrosis, or sleep apnea. Amplifies breathing_level=2 score (+8→+16) and mucus_color_level scores in riskCalculator.';
COMMENT ON COLUMN patients.has_heart_failure IS 'True if patient has congestive heart failure. Amplifies energy_level, heart_rate_zone, and breathing_level scores in riskCalculator.';
COMMENT ON COLUMN patients.has_had_septic_shock IS 'True if patient has prior septic shock history. riskCalculator applyContextBonuses() adds flat +10 regardless of todays symptoms.';
COMMENT ON COLUMN patients.has_urinary_catheter IS 'True if patient currently has a urinary catheter. Amplifies uti_symptoms_worsening scores: same→+18 (was +10), worsened→+40 (was +30).';
COMMENT ON COLUMN patients.on_immunosuppressants IS 'True if patient takes any immunosuppressant, biologic, chemotherapy, or corticosteroid. Used by isHighRiskPatient() → 25% score multiplier.';
COMMENT ON COLUMN patients.is_high_risk IS 'Auto-calculated by trigger on INSERT/UPDATE. Mirrors isHighRiskPatient() in riskCalculator.ts: age >= 65 OR has_weakened_immune OR admitted_count > 1 OR on_immunosuppressants.';
COMMENT ON COLUMN patients.baseline_bp_systolic IS 'Baseline systolic BP from onboarding. Used by calculateZones() for blood pressure zone calculation. Defaults to 120 in riskCalculator if NULL.';

COMMENT ON COLUMN daily_checkins.risk_level IS 'Final risk level from calculateSepsisRisk() in riskCalculator.ts. One of: GREEN, YELLOW, RED, RED_EMERGENCY. All scoring runs client-side before insert.';
COMMENT ON COLUMN daily_checkins.mucus_color_level IS 'Mapped from dailyCheckin.ts has_cough question. 1=clear/white/none, 2=yellow/green, 3=brown/pink/red, NULL=no cough. Level 2 → +10 (or +18 with has_lung_condition). Level 3 → +30 (or +35 with has_lung_condition). +10 additional for either level if has_recent_pneumonia.';
COMMENT ON COLUMN daily_checkins.uti_symptoms_worsening IS 'Only collected when patients.has_recent_uti = true. Defaults to not_applicable otherwise.';
COMMENT ON COLUMN daily_checkins.wound_state_level IS 'NULL when no wound present. 1=healing/same, 2=looks different (+10), 3=infected (+60).';
COMMENT ON COLUMN daily_checkins.discolored_skin IS 'Blue, purple, or gray discoloration of skin/lips/nails. Triggers RED_EMERGENCY in checkEmergencyConditions() regardless of other scores.';

-- =============================================================================
-- SAMPLE DATA (Optional — uncomment to test)
-- =============================================================================

/*
INSERT INTO patients (
    patient_id,
    user_id,
    is_patient,
    is_caregiver,
    patient_name,
    birthday,
    sex_assigned_at_birth,
    currently_hospitalized,
    sepsis_status,
    days_since_last_discharge,
    admitted_count,
    has_weakened_immune,
    has_lung_condition,
    has_heart_failure,
    has_diabetes,
    has_recent_uti,
    has_recent_pneumonia,
    has_had_septic_shock,
    has_urinary_catheter,
    on_immunosuppressants,
    has_caregiver,
    caregiver_availability,
    physical_ability_level,
    has_social_support,
    has_thermometer,
    has_pulse_oximeter,
    has_bp_cuff,
    has_hr_monitor,
    baseline_bp_systolic
) VALUES (
    gen_random_uuid(),
    '<user_id_here>',
    true,
    false,
    'John Doe',
    '1950-06-15',
    'male',
    false,
    'recently_discharged',
    14,
    1,
    false,
    true,   -- has COPD
    false,
    true,   -- has diabetes
    true,   -- recent UTI
    false,
    false,
    false,
    false,
    true,
    'full_time',
    'tires_easily',
    true,
    true,
    true,
    true,
    true,
    130
);
*/