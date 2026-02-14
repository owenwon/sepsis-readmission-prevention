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

CREATE TYPE zone_type AS ENUM (
    'green',
    'yellow',
    'red'
);

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
    is_patient BOOLEAN NOT NULL DEFAULT true,
    is_caregiver BOOLEAN NOT NULL DEFAULT false,
    
    -- Basic Information
    patient_name VARCHAR(100) NOT NULL,
    birthday DATE NOT NULL,
    sex_assigned_at_birth sex_assigned NOT NULL,
    
    -- Sepsis Context
    currently_hospitalized BOOLEAN DEFAULT false,
    sepsis_status sepsis_status_type,
    days_since_last_discharge INTEGER,
    readmitted_count INTEGER DEFAULT 0,
    
    -- Chronic Medical Conditions
    has_asthma BOOLEAN DEFAULT false,
    has_diabetes BOOLEAN DEFAULT false,
    has_copd BOOLEAN DEFAULT false,
    has_heart_disease BOOLEAN DEFAULT false,
    has_kidney_disease BOOLEAN DEFAULT false,
    has_weakened_immune BOOLEAN DEFAULT false,
    chronic_conditions_other TEXT,
    
    -- Recent/Active Illnesses
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
    has_thermometer BOOLEAN DEFAULT false,
    has_pulse_oximeter BOOLEAN DEFAULT false,
    has_bp_cuff BOOLEAN DEFAULT false,
    has_hr_monitor BOOLEAN DEFAULT false,
    
    -- Baseline Measurements
    baseline_bp_systolic INTEGER,
    
    -- Wound Status
    has_active_wound BOOLEAN DEFAULT false,
    
    -- Risk Flags (calculated by trigger)
    is_high_risk BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_user_type CHECK (
        (is_patient = true AND is_caregiver = false) OR 
        (is_patient = false AND is_caregiver = true)
    ),
    CONSTRAINT valid_readmitted_count CHECK (readmitted_count >= 0),
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
    -- =========================================================================
    fainted_or_very_dizzy BOOLEAN DEFAULT false,
    severe_trouble_breathing BOOLEAN DEFAULT false,
    severe_confusion BOOLEAN DEFAULT false,
    extreme_heat_or_chills BOOLEAN DEFAULT false,
    
    -- Survey Completion Status
    survey_terminated_early BOOLEAN DEFAULT false,
    termination_reason TEXT,
    
    -- =========================================================================
    -- ENERGY & WELL-BEING SECTION
    -- =========================================================================
    overall_feeling INTEGER CHECK (overall_feeling BETWEEN 1 AND 5),
    energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 3),
    pain_level INTEGER CHECK (pain_level BETWEEN 0 AND 10),
    
    -- =========================================================================
    -- VITALS SECTION
    -- =========================================================================
    
    -- Temperature
    fever_chills BOOLEAN DEFAULT false,
    temperature_value NUMERIC(4, 1) CHECK (
        temperature_value IS NULL OR 
        (temperature_value >= 90.0 AND temperature_value <= 110.0)
    ),
    temperature_zone zone_type,
    
    -- Oxygen Level
    oxygen_level_value INTEGER CHECK (
        oxygen_level_value IS NULL OR 
        (oxygen_level_value >= 0 AND oxygen_level_value <= 100)
    ),
    oxygen_level_zone zone_type,
    
    -- Heart Rate
    heart_racing BOOLEAN DEFAULT false,
    heart_rate_value INTEGER CHECK (
        heart_rate_value IS NULL OR 
        (heart_rate_value >= 30 AND heart_rate_value <= 250)
    ),
    heart_rate_zone zone_type,
    
    -- Blood Pressure
    blood_pressure_systolic INTEGER CHECK (
        blood_pressure_systolic IS NULL OR 
        (blood_pressure_systolic >= 60 AND blood_pressure_systolic <= 250)
    ),
    blood_pressure_zone zone_type,
    
    -- =========================================================================
    -- MENTAL STATUS SECTION
    -- =========================================================================
    thinking_level INTEGER CHECK (thinking_level BETWEEN 1 AND 3),
    
    -- =========================================================================
    -- BREATHING SECTION
    -- =========================================================================
    breathing_level INTEGER CHECK (breathing_level BETWEEN 1 AND 3),
    
    -- =========================================================================
    -- ORGAN FUNCTION SECTION
    -- =========================================================================
    urine_appearance_level INTEGER CHECK (urine_appearance_level BETWEEN 1 AND 3),
    uti_symptoms_worsening uti_symptoms_type DEFAULT 'not_applicable',
    urine_output_level INTEGER CHECK (
        urine_output_level IS NULL OR 
        (urine_output_level BETWEEN 1 AND 3)
    ),
    
    -- =========================================================================
    -- INFECTION SECTION
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
    -- =========================================================================
    nausea_vomiting_diarrhea BOOLEAN DEFAULT false,
    
    -- =========================================================================
    -- ADDITIONAL NOTES
    -- =========================================================================
    additional_notes TEXT,
    
    -- =========================================================================
    -- RISK SCORING (Auto-calculated)
    -- =========================================================================
    risk_score INTEGER GENERATED ALWAYS AS (
        -- Start with base score
        0 +
        -- Immediate danger flags (100 points each)
        CASE WHEN fainted_or_very_dizzy THEN 100 ELSE 0 END +
        CASE WHEN severe_trouble_breathing THEN 100 ELSE 0 END +
        CASE WHEN severe_confusion THEN 100 ELSE 0 END +
        CASE WHEN extreme_heat_or_chills THEN 100 ELSE 0 END +
        -- Red zone vitals (50 points each)
        CASE WHEN temperature_zone = 'red' THEN 50 ELSE 0 END +
        CASE WHEN oxygen_level_zone = 'red' THEN 50 ELSE 0 END +
        CASE WHEN heart_rate_zone = 'red' THEN 50 ELSE 0 END +
        CASE WHEN blood_pressure_zone = 'red' THEN 50 ELSE 0 END +
        -- Red zone symptoms (30 points each)
        CASE WHEN thinking_level = 3 THEN 30 ELSE 0 END +
        CASE WHEN breathing_level = 3 THEN 30 ELSE 0 END +
        CASE WHEN energy_level = 3 THEN 30 ELSE 0 END +
        CASE WHEN urine_appearance_level = 3 THEN 30 ELSE 0 END +
        CASE WHEN wound_state_level = 3 THEN 30 ELSE 0 END +
        -- Yellow zone (10 points each)
        CASE WHEN temperature_zone = 'yellow' THEN 10 ELSE 0 END +
        CASE WHEN oxygen_level_zone = 'yellow' THEN 10 ELSE 0 END +
        CASE WHEN heart_rate_zone = 'yellow' THEN 10 ELSE 0 END +
        CASE WHEN blood_pressure_zone = 'yellow' THEN 10 ELSE 0 END +
        -- Other high-risk indicators (20 points each)
        CASE WHEN discolored_skin THEN 20 ELSE 0 END +
        CASE WHEN pain_level >= 7 THEN 20 ELSE 0 END +
        -- Moderate indicators (10 points each)
        CASE WHEN cough_worsening = true THEN 10 ELSE 0 END +
        CASE WHEN uti_symptoms_worsening = 'worsened' THEN 10 ELSE 0 END +
        CASE WHEN nausea_vomiting_diarrhea THEN 10 ELSE 0 END
    ) STORED,
    
    risk_level VARCHAR(20) GENERATED ALWAYS AS (
        CASE 
            WHEN (
                0 +
                CASE WHEN fainted_or_very_dizzy THEN 100 ELSE 0 END +
                CASE WHEN severe_trouble_breathing THEN 100 ELSE 0 END +
                CASE WHEN severe_confusion THEN 100 ELSE 0 END +
                CASE WHEN extreme_heat_or_chills THEN 100 ELSE 0 END +
                CASE WHEN temperature_zone = 'red' THEN 50 ELSE 0 END +
                CASE WHEN oxygen_level_zone = 'red' THEN 50 ELSE 0 END +
                CASE WHEN heart_rate_zone = 'red' THEN 50 ELSE 0 END +
                CASE WHEN blood_pressure_zone = 'red' THEN 50 ELSE 0 END +
                CASE WHEN thinking_level = 3 THEN 30 ELSE 0 END +
                CASE WHEN breathing_level = 3 THEN 30 ELSE 0 END +
                CASE WHEN energy_level = 3 THEN 30 ELSE 0 END +
                CASE WHEN urine_appearance_level = 3 THEN 30 ELSE 0 END +
                CASE WHEN wound_state_level = 3 THEN 30 ELSE 0 END +
                CASE WHEN temperature_zone = 'yellow' THEN 10 ELSE 0 END +
                CASE WHEN oxygen_level_zone = 'yellow' THEN 10 ELSE 0 END +
                CASE WHEN heart_rate_zone = 'yellow' THEN 10 ELSE 0 END +
                CASE WHEN blood_pressure_zone = 'yellow' THEN 10 ELSE 0 END +
                CASE WHEN discolored_skin THEN 20 ELSE 0 END +
                CASE WHEN pain_level >= 7 THEN 20 ELSE 0 END +
                CASE WHEN cough_worsening = true THEN 10 ELSE 0 END +
                CASE WHEN uti_symptoms_worsening = 'worsened' THEN 10 ELSE 0 END +
                CASE WHEN nausea_vomiting_diarrhea THEN 10 ELSE 0 END
            ) >= 100 THEN 'CRITICAL'
            WHEN (
                0 +
                CASE WHEN fainted_or_very_dizzy THEN 100 ELSE 0 END +
                CASE WHEN severe_trouble_breathing THEN 100 ELSE 0 END +
                CASE WHEN severe_confusion THEN 100 ELSE 0 END +
                CASE WHEN extreme_heat_or_chills THEN 100 ELSE 0 END +
                CASE WHEN temperature_zone = 'red' THEN 50 ELSE 0 END +
                CASE WHEN oxygen_level_zone = 'red' THEN 50 ELSE 0 END +
                CASE WHEN heart_rate_zone = 'red' THEN 50 ELSE 0 END +
                CASE WHEN blood_pressure_zone = 'red' THEN 50 ELSE 0 END +
                CASE WHEN thinking_level = 3 THEN 30 ELSE 0 END +
                CASE WHEN breathing_level = 3 THEN 30 ELSE 0 END +
                CASE WHEN energy_level = 3 THEN 30 ELSE 0 END +
                CASE WHEN urine_appearance_level = 3 THEN 30 ELSE 0 END +
                CASE WHEN wound_state_level = 3 THEN 30 ELSE 0 END +
                CASE WHEN temperature_zone = 'yellow' THEN 10 ELSE 0 END +
                CASE WHEN oxygen_level_zone = 'yellow' THEN 10 ELSE 0 END +
                CASE WHEN heart_rate_zone = 'yellow' THEN 10 ELSE 0 END +
                CASE WHEN blood_pressure_zone = 'yellow' THEN 10 ELSE 0 END +
                CASE WHEN discolored_skin THEN 20 ELSE 0 END +
                CASE WHEN pain_level >= 7 THEN 20 ELSE 0 END +
                CASE WHEN cough_worsening = true THEN 10 ELSE 0 END +
                CASE WHEN uti_symptoms_worsening = 'worsened' THEN 10 ELSE 0 END +
                CASE WHEN nausea_vomiting_diarrhea THEN 10 ELSE 0 END
            ) >= 50 THEN 'HIGH'
            WHEN (
                0 +
                CASE WHEN fainted_or_very_dizzy THEN 100 ELSE 0 END +
                CASE WHEN severe_trouble_breathing THEN 100 ELSE 0 END +
                CASE WHEN severe_confusion THEN 100 ELSE 0 END +
                CASE WHEN extreme_heat_or_chills THEN 100 ELSE 0 END +
                CASE WHEN temperature_zone = 'red' THEN 50 ELSE 0 END +
                CASE WHEN oxygen_level_zone = 'red' THEN 50 ELSE 0 END +
                CASE WHEN heart_rate_zone = 'red' THEN 50 ELSE 0 END +
                CASE WHEN blood_pressure_zone = 'red' THEN 50 ELSE 0 END +
                CASE WHEN thinking_level = 3 THEN 30 ELSE 0 END +
                CASE WHEN breathing_level = 3 THEN 30 ELSE 0 END +
                CASE WHEN energy_level = 3 THEN 30 ELSE 0 END +
                CASE WHEN urine_appearance_level = 3 THEN 30 ELSE 0 END +
                CASE WHEN wound_state_level = 3 THEN 30 ELSE 0 END +
                CASE WHEN temperature_zone = 'yellow' THEN 10 ELSE 0 END +
                CASE WHEN oxygen_level_zone = 'yellow' THEN 10 ELSE 0 END +
                CASE WHEN heart_rate_zone = 'yellow' THEN 10 ELSE 0 END +
                CASE WHEN blood_pressure_zone = 'yellow' THEN 10 ELSE 0 END +
                CASE WHEN discolored_skin THEN 20 ELSE 0 END +
                CASE WHEN pain_level >= 7 THEN 20 ELSE 0 END +
                CASE WHEN cough_worsening = true THEN 10 ELSE 0 END +
                CASE WHEN uti_symptoms_worsening = 'worsened' THEN 10 ELSE 0 END +
                CASE WHEN nausea_vomiting_diarrhea THEN 10 ELSE 0 END
            ) >= 20 THEN 'MODERATE'
            ELSE 'LOW'
        END
    ) STORED,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_patient_date UNIQUE (patient_id, checkin_date),
    CONSTRAINT zone_consistency_temp CHECK (
        (temperature_value IS NULL AND temperature_zone IS NULL) OR
        (temperature_value IS NOT NULL AND temperature_zone IS NOT NULL)
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
CREATE INDEX idx_daily_checkins_risk_level ON daily_checkins(risk_level) 
    WHERE risk_level IN ('HIGH', 'CRITICAL');
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

-- Function to calculate is_high_risk based on age, immune status, and readmissions
CREATE OR REPLACE FUNCTION calculate_high_risk()
RETURNS TRIGGER AS $$
DECLARE
    patient_age INTEGER;
BEGIN
    patient_age := EXTRACT(YEAR FROM AGE(CURRENT_DATE, NEW.birthday));
    NEW.is_high_risk := (patient_age > 65 OR NEW.has_weakened_immune OR NEW.readmitted_count > 1);
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
CREATE OR REPLACE FUNCTION calculate_temperature_zone(temp NUMERIC)
RETURNS zone_type AS $$
BEGIN
    IF temp IS NULL THEN
        RETURN NULL;
    ELSIF temp < 96.8 OR temp >= 101.5 THEN
        RETURN 'red';
    ELSIF temp >= 100.0 AND temp < 101.5 THEN
        RETURN 'yellow';
    ELSE
        RETURN 'green';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate oxygen level zone
CREATE OR REPLACE FUNCTION calculate_oxygen_zone(spo2 INTEGER)
RETURNS zone_type AS $$
BEGIN
    IF spo2 IS NULL THEN
        RETURN NULL;
    ELSIF spo2 < 92 THEN
        RETURN 'red';
    ELSIF spo2 >= 92 AND spo2 < 95 THEN
        RETURN 'yellow';
    ELSE
        RETURN 'green';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate heart rate zone
CREATE OR REPLACE FUNCTION calculate_heart_rate_zone(hr INTEGER)
RETURNS zone_type AS $$
BEGIN
    IF hr IS NULL THEN
        RETURN NULL;
    ELSIF hr > 120 OR hr < 60 THEN
        RETURN 'red';
    ELSIF hr >= 101 AND hr <= 120 THEN
        RETURN 'yellow';
    ELSE
        RETURN 'green';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate blood pressure zone
CREATE OR REPLACE FUNCTION calculate_bp_zone(
    current_systolic INTEGER, 
    baseline_systolic INTEGER
)
RETURNS zone_type AS $$
DECLARE
    diff INTEGER;
BEGIN
    IF current_systolic IS NULL OR baseline_systolic IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Check absolute thresholds first
    IF current_systolic < 90 OR current_systolic > 180 THEN
        RETURN 'red';
    END IF;
    
    -- Calculate difference from baseline
    diff := baseline_systolic - current_systolic;
    
    IF diff >= 40 THEN
        RETURN 'red';
    ELSIF diff >= 20 THEN
        RETURN 'yellow';
    ELSE
        RETURN 'green';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- VIEWS FOR COMMON QUERIES
-- =============================================================================

-- View: Recent high-risk check-ins (filtered by authenticated user)
CREATE OR REPLACE VIEW high_risk_checkins AS
SELECT 
    dc.*,
    p.patient_name,
    calculate_age(p.birthday) as age,
    p.is_high_risk as patient_high_risk
FROM daily_checkins dc
JOIN patients p ON dc.patient_id = p.patient_id
WHERE dc.risk_level IN ('HIGH', 'CRITICAL')
  AND p.user_id = auth.uid()
ORDER BY dc.checkin_date DESC, dc.risk_score DESC;

-- View: Patient summary with latest check-in (filtered by authenticated user)
CREATE OR REPLACE VIEW patient_summary AS
SELECT 
    p.*,
    dc.checkin_date as last_checkin_date,
    dc.risk_level as last_risk_level,
    dc.risk_score as last_risk_score
FROM patients p
LEFT JOIN LATERAL (
    SELECT * FROM daily_checkins
    WHERE patient_id = p.patient_id
    ORDER BY checkin_date DESC
    LIMIT 1
) dc ON true
WHERE p.user_id = auth.uid();

-- =============================================================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE patients IS 'Stores patient onboarding information and chronic conditions';
COMMENT ON TABLE daily_checkins IS 'Stores daily symptom check-ins and vital measurements';

COMMENT ON COLUMN patients.is_high_risk IS 'Auto-calculated based on age, immune status, and readmission count';
COMMENT ON COLUMN daily_checkins.risk_score IS 'Auto-calculated weighted risk score (0-400+)';
COMMENT ON COLUMN daily_checkins.risk_level IS 'Auto-calculated risk category: LOW, MODERATE, HIGH, CRITICAL';
COMMENT ON COLUMN daily_checkins.survey_terminated_early IS 'True if survey stopped due to critical symptoms';

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
    readmitted_count,
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
