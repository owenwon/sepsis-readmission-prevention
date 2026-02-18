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
    
    -- User Type
    -- Maps to onboarding.ts user_type question -> schemaField: ['is_patient', 'is_caregiver']
    is_patient BOOLEAN NOT NULL DEFAULT true,
    is_caregiver BOOLEAN NOT NULL DEFAULT false,
    
    -- Basic Information
    -- Maps to onboarding.ts: patient_name, birthday (age derived via calculate_age())
    patient_name VARCHAR(100) NOT NULL,
    birthday DATE NOT NULL,
    sex_assigned_at_birth sex_assigned NOT NULL,
    
    -- Sepsis Context
    -- Maps to onboarding.ts: currently_hospitalized, days_since_last_discharge,
    --   admitted_count (SurveyResponse.admitted_count used by isHighRiskPatient: > 1)
    currently_hospitalized BOOLEAN DEFAULT false,
    sepsis_status sepsis_status_type,
    days_since_last_discharge INTEGER,
    admitted_count INTEGER DEFAULT 0,  -- was: readmitted_count (renamed to match SurveyResponse.admitted_count)
    
    -- Chronic Medical Conditions
    -- Maps to onboarding.ts chronic_conditions -> has_weakened_immune used by isHighRiskPatient()
    has_asthma BOOLEAN DEFAULT false,
    has_diabetes BOOLEAN DEFAULT false,
    has_copd BOOLEAN DEFAULT false,
    has_heart_disease BOOLEAN DEFAULT false,
    has_kidney_disease BOOLEAN DEFAULT false,  -- gates urine_output_level in dailyCheckin
    has_weakened_immune BOOLEAN DEFAULT false,  -- used by isHighRiskPatient()
    chronic_conditions_other TEXT,
    
    -- Recent/Active Illnesses
    -- Maps to onboarding.ts recent_illnesses
    -- has_recent_uti gates uti_symptoms_worsening in dailyCheckin
    -- has_recent_pneumonia gates cough_worsening in dailyCheckin
    -- has_kidney_failure + has_dialysis gate urine_output_level in dailyCheckin
    has_recent_uti BOOLEAN DEFAULT false,
    has_recent_pneumonia BOOLEAN DEFAULT false,
    has_dialysis BOOLEAN DEFAULT false,
    has_kidney_failure BOOLEAN DEFAULT false,
    
    -- Medications
    current_medications JSONB,
    on_immunosuppressants BOOLEAN DEFAULT false,
    on_antibiotics BOOLEAN DEFAULT false,
    on_steroids BOOLEAN DEFAULT false,
    
    -- Care & Social Support
    has_caregiver BOOLEAN DEFAULT false,
    caregiver_availability caregiver_availability_type,
    physical_ability_level physical_ability_type,
    can_exercise_regularly BOOLEAN DEFAULT false,
    has_social_support BOOLEAN DEFAULT false,
    
    -- Monitoring Device Access
    -- These gate objective vital questions in dailyCheckin.ts
    has_thermometer BOOLEAN DEFAULT false,   -- gates temperature_value
    has_pulse_oximeter BOOLEAN DEFAULT false, -- gates oxygen_level_value
    has_bp_cuff BOOLEAN DEFAULT false,        -- gates blood_pressure_systolic
    has_hr_monitor BOOLEAN DEFAULT false,     -- gates heart_rate_value
    
    -- Baseline Measurements
    -- Used by calculateZones() in riskCalculator: BP zone relative to this baseline
    -- Defaults to 120 in riskCalculator if NULL
    baseline_bp_systolic INTEGER,
    
    -- Wound Status
    -- has_active_wound gates wound_state_level in dailyCheckin
    has_active_wound BOOLEAN DEFAULT false,
    
    -- Risk Flags
    -- Auto-calculated by trigger using: age >= 65 OR has_weakened_immune OR admitted_count > 1
    -- Mirrors isHighRiskPatient() logic in riskCalculator.ts
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

-- Index for faster lookups
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
    -- SurveyResponse: fainted_or_very_dizzy, severe_trouble_breathing,
    --                 severe_confusion, extreme_heat_or_chills
    -- Any true value → RED_EMERGENCY in checkEmergencyConditions()
    -- =========================================================================
    fainted_or_very_dizzy BOOLEAN DEFAULT false,
    severe_trouble_breathing BOOLEAN DEFAULT false,
    severe_confusion BOOLEAN DEFAULT false,
    extreme_heat_or_chills BOOLEAN DEFAULT false,
    
    -- =========================================================================
    -- ENERGY & WELL-BEING SECTION
    -- SurveyResponse: overall_feeling (tracking only), energy_level, pain_level (tracking only)
    -- energy_level: 1=normal, 2=fatigued (+5), 3=extremely fatigued (+15)
    -- =========================================================================
    overall_feeling INTEGER CHECK (overall_feeling BETWEEN 1 AND 5),
    energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 3),
    pain_level INTEGER CHECK (pain_level BETWEEN 0 AND 10),
    
    -- =========================================================================
    -- VITALS SECTION
    -- =========================================================================
    
    -- Temperature
    -- SurveyResponse: fever_chills, temperature_value, temperature_zone
    -- Zone: 1=green(96.8-99.9°F), 2=yellow(100-101.4°F), 3=red(otherwise)
    -- Hard override at >= 103.5°F → RED_EMERGENCY
    fever_chills BOOLEAN DEFAULT false,
    temperature_value NUMERIC(4, 1) CHECK (
        temperature_value IS NULL OR 
        (temperature_value >= 90.0 AND temperature_value <= 110.0)
    ),
    temperature_zone INTEGER CHECK (temperature_zone IS NULL OR temperature_zone BETWEEN 1 AND 3),
    
    -- Oxygen Level
    -- SurveyResponse: oxygen_level_value, oxygen_level_zone
    -- Zone: 1=green(>=95%), 2=yellow(92-94%), 3=red(<92%)
    -- Hard override at < 90% → RED_EMERGENCY
    oxygen_level_value INTEGER CHECK (
        oxygen_level_value IS NULL OR 
        (oxygen_level_value >= 0 AND oxygen_level_value <= 100)
    ),
    oxygen_level_zone INTEGER CHECK (oxygen_level_zone IS NULL OR oxygen_level_zone BETWEEN 1 AND 3),
    
    -- Heart Rate
    -- SurveyResponse: heart_racing, heart_rate_value, heart_rate_zone
    -- Zone: 1=green(60-100bpm), 2=yellow(101-120bpm), 3=red(otherwise)
    -- Hard override at > 140bpm → RED_EMERGENCY
    heart_racing BOOLEAN DEFAULT false,
    heart_rate_value INTEGER CHECK (
        heart_rate_value IS NULL OR 
        (heart_rate_value >= 30 AND heart_rate_value <= 250)
    ),
    heart_rate_zone INTEGER CHECK (heart_rate_zone IS NULL OR heart_rate_zone BETWEEN 1 AND 3),
    
    -- Blood Pressure
    -- SurveyResponse: blood_pressure_systolic, blood_pressure_zone
    -- Zone: 1=green(stable/elevated), 2=yellow(>=20 below baseline),
    --       3=red(<90, >180, or >=40 below baseline)
    -- Hard override at zone 3 → RED_EMERGENCY
    blood_pressure_systolic INTEGER CHECK (
        blood_pressure_systolic IS NULL OR 
        (blood_pressure_systolic >= 60 AND blood_pressure_systolic <= 250)
    ),
    blood_pressure_zone INTEGER CHECK (blood_pressure_zone IS NULL OR blood_pressure_zone BETWEEN 1 AND 3),
    
    -- =========================================================================
    -- MENTAL STATUS SECTION
    -- SurveyResponse: thinking_level (1=clear, 2=slow, 3=not making sense)
    -- Value 3 → RED_EMERGENCY; value 2 → +8 score
    -- =========================================================================
    thinking_level INTEGER CHECK (thinking_level BETWEEN 1 AND 3),
    
    -- =========================================================================
    -- BREATHING SECTION
    -- SurveyResponse: breathing_level (1=normal, 2=difficult, 3=extremely difficult)
    -- Value 3 → RED_EMERGENCY; value 2 → +8 score
    -- =========================================================================
    breathing_level INTEGER CHECK (breathing_level BETWEEN 1 AND 3),
    
    -- =========================================================================
    -- ORGAN FUNCTION SECTION
    -- SurveyResponse: urine_appearance_level, uti_symptoms_worsening, urine_output_level
    -- =========================================================================
    urine_appearance_level INTEGER CHECK (urine_appearance_level BETWEEN 1 AND 3),
    uti_symptoms_worsening uti_symptoms_type DEFAULT 'not_applicable',
    urine_output_level INTEGER CHECK (
        urine_output_level IS NULL OR 
        (urine_output_level BETWEEN 1 AND 3)
    ),
    
    -- =========================================================================
    -- INFECTION SECTION
    -- SurveyResponse: has_cough, cough_worsening, wound_state_level, discolored_skin
    -- discolored_skin → RED_EMERGENCY
    -- wound_state_level 3 → critical flag + +40 score
    -- =========================================================================
    has_cough BOOLEAN DEFAULT false,
    cough_worsening BOOLEAN,
    wound_state_level INTEGER CHECK (
        wound_state_level IS NULL OR 
        (wound_state_level BETWEEN 1 AND 3)
    ),
    discolored_skin BOOLEAN DEFAULT false,
    
    -- =========================================================================
    -- GI SYMPTOMS SECTION
    -- SurveyResponse: nausea_vomiting_diarrhea → +5 score
    -- =========================================================================
    nausea_vomiting_diarrhea BOOLEAN DEFAULT false,
    
    -- =========================================================================
    -- ADDITIONAL NOTES
    -- SurveyResponse: additional_notes (tracking only, no score impact)
    -- =========================================================================
    additional_notes TEXT,
    
    -- =========================================================================
    -- RISK LEVEL
    -- Calculated by riskCalculator.ts calculateSepsisRisk() before submission.
    -- Only the final risk_level is stored; all scoring is done client-side.
    -- Values mirror RiskLevel type: 'GREEN' | 'YELLOW' | 'RED' | 'RED_EMERGENCY'
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

-- Indexes for faster lookups
CREATE INDEX idx_daily_checkins_patient_id ON daily_checkins(patient_id);
CREATE INDEX idx_daily_checkins_date ON daily_checkins(checkin_date DESC);
-- Fixed: was WHERE risk_level IN ('HIGH', 'CRITICAL') — wrong values not in RiskLevel type
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

-- Mirrors isHighRiskPatient() in riskCalculator.ts:
--   (age !== undefined && age >= 65) || has_weakened_immune || admitted_count > 1
-- Fixed from original: was (> 65) and (readmitted_count) — now (>= 65) and (admitted_count)
CREATE OR REPLACE FUNCTION calculate_high_risk()
RETURNS TRIGGER AS $$
DECLARE
    patient_age INTEGER;
BEGIN
    patient_age := EXTRACT(YEAR FROM AGE(CURRENT_DATE, NEW.birthday));
    NEW.is_high_risk := (patient_age >= 65 OR NEW.has_weakened_immune OR NEW.admitted_count > 1);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_patient_high_risk
    BEFORE INSERT OR UPDATE ON patients
    FOR EACH ROW
    EXECUTE FUNCTION calculate_high_risk();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) - Enable for Supabase
-- =============================================================================

-- Enable RLS on both tables
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_checkins ENABLE ROW LEVEL SECURITY;

-- Policies for patients table
CREATE POLICY "Users can view their own patient record"
    ON patients FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own patient record"
    ON patients FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own patient record"
    ON patients FOR UPDATE
    USING (auth.uid() = user_id);

-- Policies for daily_checkins table
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

-- Function to calculate age from birthday
CREATE OR REPLACE FUNCTION calculate_age(birthday DATE)
RETURNS INTEGER AS $$
BEGIN
    RETURN EXTRACT(YEAR FROM AGE(CURRENT_DATE, birthday));
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to calculate temperature zone
-- Mirrors calculateZones() in riskCalculator.ts:
--   1 (Green): 96.8–99.9°F
--   2 (Yellow): 100.0–101.4°F
--   3 (Red): <96.8°F OR >101.4°F
-- Note: hard RED_EMERGENCY override at >=103.5°F is enforced in app, not DB
CREATE OR REPLACE FUNCTION calculate_temperature_zone(temp NUMERIC)
RETURNS INTEGER AS $$
BEGIN
    IF temp IS NULL THEN
        RETURN NULL;
    ELSIF temp >= 96.8 AND temp <= 99.9 THEN
        RETURN 1; -- green
    ELSIF temp >= 100.0 AND temp <= 101.4 THEN
        RETURN 2; -- yellow
    ELSE
        RETURN 3; -- red
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate oxygen level zone
-- Mirrors calculateZones() in riskCalculator.ts:
--   1 (Green): >=95%, 2 (Yellow): 92-94%, 3 (Red): <92%
-- Note: hard RED_EMERGENCY override at <90% is enforced in app, not DB
CREATE OR REPLACE FUNCTION calculate_oxygen_zone(spo2 INTEGER)
RETURNS INTEGER AS $$
BEGIN
    IF spo2 IS NULL THEN
        RETURN NULL;
    ELSIF spo2 >= 95 THEN
        RETURN 1; -- green
    ELSIF spo2 >= 92 THEN
        RETURN 2; -- yellow
    ELSE
        RETURN 3; -- red
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate heart rate zone
-- Mirrors calculateZones() in riskCalculator.ts:
--   1 (Green): 60-100bpm, 2 (Yellow): 101-120bpm, 3 (Red): <60 or >120bpm
-- Note: hard RED_EMERGENCY override at >140bpm is enforced in app, not DB
CREATE OR REPLACE FUNCTION calculate_heart_rate_zone(hr INTEGER)
RETURNS INTEGER AS $$
BEGIN
    IF hr IS NULL THEN
        RETURN NULL;
    ELSIF hr >= 60 AND hr <= 100 THEN
        RETURN 1; -- green
    ELSIF hr >= 101 AND hr <= 120 THEN
        RETURN 2; -- yellow
    ELSE
        RETURN 3; -- red
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate blood pressure zone
-- Mirrors calculateZones() in riskCalculator.ts:
--   3 (Red): <90, >180, or >=40 below baseline
--   2 (Yellow): >=20 below baseline
--   1 (Green): stable or elevated
-- baseline defaults to 120 if NULL (matches riskCalculator fallback)
-- Note: hard RED_EMERGENCY override at zone 3 is enforced in app, not DB
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
    
    -- Check absolute thresholds first
    IF current_systolic < 90 OR current_systolic > 180 THEN
        RETURN 3; -- red
    END IF;
    
    -- Calculate difference from baseline
    diff := effective_baseline - current_systolic;
    
    IF diff >= 40 THEN
        RETURN 3; -- red
    ELSIF diff >= 20 THEN
        RETURN 2; -- yellow
    ELSE
        RETURN 1; -- green
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- VIEWS FOR COMMON QUERIES
-- =============================================================================

-- View: Recent high-risk check-ins (filtered by authenticated user)
-- risk_level values from riskCalculator.ts RiskLevel type: 'GREEN' | 'YELLOW' | 'RED' | 'RED_EMERGENCY'
CREATE OR REPLACE VIEW high_risk_checkins AS
SELECT 
    dc.*,
    p.patient_name,
    calculate_age(p.birthday) as age,
    p.is_high_risk as patient_high_risk
FROM daily_checkins dc
JOIN patients p ON dc.patient_id = p.patient_id
WHERE dc.risk_level IN ('RED', 'RED_EMERGENCY')
  AND p.user_id = auth.uid()
ORDER BY dc.checkin_date DESC;

-- View: Patient summary with latest check-in (filtered by authenticated user)
CREATE OR REPLACE VIEW patient_summary AS
SELECT 
    p.*,
    dc.checkin_date as last_checkin_date,
    dc.risk_level as last_risk_level
FROM patients p
LEFT JOIN LATERAL (
    SELECT checkin_date, risk_level FROM daily_checkins
    WHERE patient_id = p.patient_id
    ORDER BY checkin_date DESC
    LIMIT 1
) dc ON true
WHERE p.user_id = auth.uid();

-- =============================================================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE patients IS 'Stores patient onboarding information and chronic conditions. Source: onboarding.ts';
COMMENT ON TABLE daily_checkins IS 'Stores daily symptom check-ins and vital measurements. Source: dailyCheckin.ts';

COMMENT ON COLUMN patients.admitted_count IS 'Total sepsis hospitalizations. Used by isHighRiskPatient() in riskCalculator: admitted_count > 1 = high risk';
COMMENT ON COLUMN patients.is_high_risk IS 'Auto-calculated by trigger: age >= 65 OR has_weakened_immune OR admitted_count > 1. Mirrors isHighRiskPatient() in riskCalculator.ts';
COMMENT ON COLUMN patients.baseline_bp_systolic IS 'Patient baseline systolic BP from onboarding. Used by calculateZones() for BP zone calculation. Defaults to 120 in riskCalculator if NULL';
COMMENT ON COLUMN daily_checkins.risk_level IS 'Final risk level from riskCalculator.ts calculateSepsisRisk(). One of: GREEN, YELLOW, RED, RED_EMERGENCY. All scoring is done client-side before insert.';
COMMENT ON COLUMN daily_checkins.uti_symptoms_worsening IS 'Only populated when patients.has_recent_uti = true. Defaults to not_applicable otherwise.';
COMMENT ON COLUMN daily_checkins.urine_output_level IS 'Only collected when patients.has_kidney_disease OR has_kidney_failure OR has_dialysis = true.';
COMMENT ON COLUMN daily_checkins.wound_state_level IS 'Only collected when patients.has_active_wound = true.';
COMMENT ON COLUMN daily_checkins.cough_worsening IS 'Only collected when has_cough = true AND patients.has_recent_pneumonia = true.';

-- =============================================================================
-- SAMPLE DATA (Optional - for testing)
-- =============================================================================

-- Uncomment to insert sample data

/*
INSERT INTO patients (
    patient_id,
    user_id,  -- Must match auth.uid() of logged-in user
    is_patient,
    is_caregiver,
    patient_name,
    birthday,
    sex_assigned_at_birth,
    currently_hospitalized,
    sepsis_status,
    days_since_last_discharge,
    admitted_count,
    has_diabetes,
    has_heart_disease,
    has_recent_uti,
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
    true,
    true,
    true,
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