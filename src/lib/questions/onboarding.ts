import { Question, QuestionSection, Survey } from './types';

export const onboardingQuestions: Question[] = [

  // ============================================================================
  // GETTING STARTED (Question 1)
  // ============================================================================

  {
    id: 'user_type',
    section: 'Getting Started',
    patientText: 'Which best describes you?',
    caregiverText: 'Which best describes you?',
    type: 'single_select',
    options: [
      { label: 'Patient', value: 'patient', iconEmoji: '👤' },
      { label: 'Caregiver', value: 'caregiver', iconEmoji: '🤝' },
    ],
    schemaField: ['is_patient', 'is_caregiver'],
    validation: { required: true },
    businessLogic: {
      mapToMultipleFields: true,
      customMapping: (value: string) => ({
        is_patient: value === 'patient',
        is_caregiver: value === 'caregiver',
      }),
    },
  },

  // ============================================================================
  // BASIC INFORMATION (Questions 2-4)
  // ============================================================================

  {
    id: 'patient_name',
    section: 'Basic Information',
    patientText: 'What should we call you?',
    caregiverText: "What is the patient's name?",
    type: 'text',
    schemaField: 'patient_name',
    validation: {
      required: true,
      minLength: 2,
      maxLength: 100,
    },
    placeholder: 'Enter full name',
  },

  {
    id: 'birthday',
    section: 'Basic Information',
    patientText: 'What is your birthday?',
    caregiverText: "What is the patient's birthday?",
    type: 'date',
    schemaField: ['birthday', 'age'],
    validation: { required: true },
    businessLogic: {
      mapToMultipleFields: true,
      customMapping: (value: string) => {
        const birthDate = new Date(value);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        return { birthday: value, age };
      },
    },
  },

  {
    id: 'sex_assigned_at_birth',
    section: 'Basic Information',
    patientText: 'What was your sex assigned at birth?',
    caregiverText: "What was the patient's sex assigned at birth?",
    type: 'single_select',
    options: [
      { label: 'Male', value: 'male' },
      { label: 'Female', value: 'female' },
      { label: 'Intersex', value: 'intersex' },
      { label: 'Prefer not to say', value: 'prefer_not_to_say' },
    ],
    schemaField: 'sex_assigned_at_birth',
    validation: { required: true },
  },

  // ============================================================================
  // SEPSIS CONTEXT (Questions 5-7)
  // ============================================================================

  {
    id: 'currently_hospitalized',
    section: 'Sepsis Context',
    patientText: 'Are you currently hospitalized for sepsis?',
    caregiverText: 'Is the patient currently hospitalized for sepsis?',
    type: 'boolean',
    schemaField: 'currently_hospitalized',
    helpText:
      'If yes, this tool is designed for post-discharge monitoring. Please consult with your healthcare team for in-hospital care.',
    validation: { required: true },
  },

  {
    id: 'days_since_last_discharge',
    section: 'Sepsis Context',
    patientText: 'If not currently hospitalized, how long ago was your last sepsis-related admission?',
    caregiverText: "If not currently hospitalized, how long ago was the patient's last sepsis-related admission?",
    type: 'single_select',
    options: [
      { label: 'Less than 7 days ago', value: '3' },
      { label: '1–4 weeks ago', value: '17' },
      { label: '1–3 months ago', value: '60' },
      { label: 'More than 3 months ago', value: '120' },
    ],
    schemaField: ['days_since_last_discharge', 'sepsis_status'],
    helpText: 'Pick the date you were released from the hospital, not when you first got sick.',
    caregiverHelpText: 'Pick the date the patient was released from the hospital, not when they first got sick.',
    prerequisites: [
      { field: 'currently_hospitalized', operator: '==', value: false },
    ],
    businessLogic: {
      mapToMultipleFields: true,
      customMapping: (value: string) => ({
        days_since_last_discharge: parseInt(value),
        sepsis_status: parseInt(value) <= 90 ? 'recently_discharged' : 'other',
      }),
    },
  },

  {
    id: 'admitted_count',
    section: 'Sepsis Context',
    patientText: 'How many total times have you been hospitalized for sepsis?',
    caregiverText: 'How many total times has the patient been hospitalized for sepsis?',
    type: 'single_select',
    options: [
      { label: '1 time', value: 1 },
      { label: '2 times', value: 2 },
      { label: '3 or more times', value: 3 },
    ],
    schemaField: ['admitted_count', 'sepsis_status'],
    helpText: 'Only count hospital stays for sepsis, not other illnesses or surgeries.',
    caregiverHelpText: "Only count the patient's hospital stays for sepsis, not other illnesses or surgeries.",
    validation: { required: true },
    businessLogic: {
      mapToMultipleFields: true,
      customMapping: (value: number) => ({
        admitted_count: value,
        sepsis_status: value > 1 ? 'readmitted' : undefined,
      }),
    },
  },

  // ============================================================================
  // MEDICAL HISTORY (Questions 8-10, 11)
  // ============================================================================

  {
    id: 'chronic_conditions',
    section: 'Medical History',
    patientText: 'Have you ever been diagnosed with any of the following conditions? Select all that apply.',
    caregiverText: 'Has the patient ever been diagnosed with any of the following conditions? Select all that apply.',
    helpText: 'Only select conditions that a doctor has told you that you have, do not guess.',
    caregiverHelpText: 'Only select conditions that a doctor has told the patient they have, do not guess.',
    type: 'multi_select',
    options: [
      { label: 'Asthma', value: 'asthma' },
      { label: 'Atrial Fibrillation or Irregular Heartbeat', value: 'afib' },
      { label: 'Bleeding or Clotting Disorder (haemophilia, thrombophilia)', value: 'bleeding_clotting_disorder' },
      { label: 'Cancer (active or in treatment)', value: 'cancer' },
      { label: 'Chronic Pain or Fibromyalgia', value: 'chronic_pain' },
      { label: 'Congestive Heart Failure', value: 'congestive_heart_failure' },
      { label: 'Coronary Heart Disease (heart attack, blocked arteries)', value: 'coronary_heart_disease' },
      { label: 'COPD (chronic obstructive pulmonary disease)', value: 'copd' },
      { label: 'Chronic Kidney Disease', value: 'kidney_disease' },
      { label: 'Cystic Fibrosis', value: 'cystic_fibrosis' },
      { label: 'Depression or Anxiety', value: 'depression_anxiety' },
      { label: 'Diabetes (Type 1 or Type 2)', value: 'diabetes' },
      { label: 'Dialysis (receiving ongoing dialysis treatment)', value: 'dialysis' },
      { label: 'Dementia or Memory Loss', value: 'dementia' },
      { label: 'Eating Disorder (anorexia, bulimia)', value: 'eating_disorder' },
      { label: 'Epilepsy', value: 'epilepsy' },
      { label: 'High Blood Pressure (Hypertension)', value: 'hypertension' },
      { label: 'HIV/AIDS', value: 'hiv_aids' },
      { label: 'Inflammatory Bowel Disease (Crohn\'s disease, ulcerative colitis)', value: 'ibd' },
      { label: 'Liver Disease (cirrhosis, hepatitis B, hepatitis C)', value: 'liver_disease' },
      { label: 'Lung Fibrosis', value: 'lung_fibrosis' },
      { label: 'Malnutrition or significant unintended weight loss', value: 'malnutrition' },
      { label: 'Multiple Sclerosis', value: 'multiple_sclerosis' },
      { label: 'Obesity (BMI ≥ 30)', value: 'obesity' },
      { label: 'Obstructive Sleep Apnea', value: 'sleep_apnea' },
      { label: 'Osteoporosis', value: 'osteoporosis' },
      { label: "Parkinson's Disease", value: 'parkinsons' },
      { label: 'Peripheral Vascular Disease (poor circulation in legs or feet)', value: 'peripheral_vascular_disease' },
      { label: 'Sickle Cell Disease', value: 'sickle_cell' },
      { label: 'Stroke or TIA (mini-stroke)', value: 'stroke_tia' },
      { label: 'Substance Use or Alcohol Use Disorder', value: 'substance_use_disorder' },
      { label: 'Thyroid or Endocrine Disorder (thyroid disease, Addison\'s, Cushing\'s)', value: 'thyroid_endocrine' },
      { label: 'Tuberculosis', value: 'tuberculosis' },
      { label: 'Weakened Immune System (organ transplant, bone marrow transplant, chemotherapy)', value: 'weakened_immune' },
      { label: 'Autoimmune Disease (lupus, rheumatoid arthritis, Crohn\'s disease, Sjögren\'s)', value: 'autoimmune' },
      { label: 'Other', value: 'other', triggersOther: true },
      { label: 'None of the above', value: 'none' },
    ],
    schemaField: [
      'has_weakened_immune',
      'has_lung_condition',
      'has_heart_failure',
      'has_hypertension',
      'has_other_chronic_conditions',
    ],
    businessLogic: {
      mapToMultipleFields: true,
      customMapping: (values: string[]) => ({
        has_weakened_immune:
          values.includes('cancer') ||
          values.includes('hiv_aids') ||
          values.includes('autoimmune') ||
          values.includes('weakened_immune'),
        has_lung_condition:
          values.includes('copd') ||
          values.includes('asthma') ||
          values.includes('lung_fibrosis') ||
          values.includes('cystic_fibrosis') ||
          values.includes('sleep_apnea'),
        has_heart_failure: values.includes('congestive_heart_failure'),
        has_hypertension: values.includes('hypertension'),
        has_other_chronic_conditions:
          values.some((v) =>
            ![
              'cancer', 'hiv_aids', 'autoimmune', 'weakened_immune',
              'copd', 'asthma', 'lung_fibrosis', 'cystic_fibrosis', 'sleep_apnea',
              'congestive_heart_failure', 'hypertension', 'none',
            ].includes(v)
          ),
      }),
    },
  },

  {
    id: 'recent_illnesses',
    section: 'Medical History',
    patientText: 'Have you been diagnosed with or treated for any of the following in the past 3 months? Select all that apply.',
    caregiverText: 'Has the patient been diagnosed with or treated for any of the following in the past 3 months? Select all that apply.',
    helpText: 'Include anything in the past 3 months you were seen by a doctor for or given medicine for, even if you feel better now.',
    caregiverHelpText: 'Include anything in the past 3 months the patient was seen by a doctor for or given medicine for, even if they feel better now.',
    type: 'multi_select',
    options: [
      { label: 'Abdominal or Gut Infection (appendicitis, diverticulitis, peritonitis)', value: 'abdominal_infection' },
      { label: 'Acute Kidney Failure', value: 'acute_kidney_failure' },
      { label: 'Bloodstream Infection (bacteremia)', value: 'bacteremia' },
      { label: 'Bone or Joint Infection (osteomyelitis, septic arthritis)', value: 'bone_joint_infection' },
      { label: 'Catheter-Associated Infection (from a urinary or IV catheter)', value: 'catheter_infection' },
      { label: 'C. diff (Clostridioides difficile — a gut infection often caused by antibiotics)', value: 'c_diff' },
      { label: 'COVID-19', value: 'covid19' },
      { label: 'Deep Vein Thrombosis or Pulmonary Embolism (blood clot in leg or lungs)', value: 'dvt_pe' },
      { label: 'Fungal Infection (candida, aspergillus)', value: 'fungal_infection' },
      { label: 'Kidney Infection (pyelonephritis)', value: 'kidney_infection' },
      { label: 'Meningitis or Brain Infection', value: 'meningitis' },
      { label: 'Peritonitis', value: 'peritonitis' },
      { label: 'Pneumonia', value: 'pneumonia' },
      { label: 'Receiving Dialysis', value: 'dialysis' },
      { label: 'Recent Hospitalization for any reason (within past 3 months)', value: 'recent_hospitalization' },
      { label: 'Recent Surgery (within past 3 months)', value: 'recent_surgery' },
      { label: 'Respiratory Infection (bronchitis, influenza)', value: 'respiratory_infection' },
      { label: 'Septic Shock (most severe form of sepsis)', value: 'septic_shock' },
      { label: 'Skin or Soft Tissue Infection (cellulitis, abscess)', value: 'skin_infection' },
      { label: 'Tuberculosis', value: 'tuberculosis' },
      { label: 'Urinary Catheter currently in use', value: 'urinary_catheter' },
      { label: 'UTI (Urinary Tract Infection)', value: 'uti' },
      { label: 'Wound Infection (infection at a surgical site or open wound)', value: 'wound_infection' },
      { label: 'None of the above', value: 'none' },
    ],
    schemaField: [
      'has_recent_uti',
      'has_recent_pneumonia',
      'has_had_septic_shock',
      'has_urinary_catheter',
      'has_other_acute_illnesses',
    ],
    businessLogic: {
      mapToMultipleFields: true,
      customMapping: (values: string[]) => ({
        has_recent_uti: values.includes('uti'),
        has_recent_pneumonia: values.includes('pneumonia'),
        has_had_septic_shock: values.includes('septic_shock'),
        has_urinary_catheter: values.includes('urinary_catheter'),
        has_other_acute_illnesses:
          values.some((v) =>
            !['uti', 'pneumonia', 'septic_shock', 'urinary_catheter', 'none'].includes(v)
          ),
      }),
    },
  },

  {
    id: 'current_medications',
    section: 'Medical History',
    patientText: 'What prescribed medications are you currently taking?',
    caregiverText: 'What prescribed medications is the patient currently taking?',
    helpText: 'Only include medicines a doctor prescribed — you do not need to list vitamins or supplements unless they are prescribed.',
    caregiverHelpText: 'Only include medicines a doctor prescribed to the patient — vitamins or supplements do not need to be listed unless prescribed.',
    type: 'autocomplete',
    options: [
      // Immunosuppressants
      { label: 'Tacrolimus', value: 'tacrolimus' },
      { label: 'Cyclosporine', value: 'cyclosporine' },
      { label: 'Azathioprine', value: 'azathioprine' },
      { label: 'Mycophenolate', value: 'mycophenolate' },
      { label: 'Sirolimus', value: 'sirolimus' },
      { label: 'Everolimus', value: 'everolimus' },
      { label: 'Methotrexate', value: 'methotrexate' },
      { label: 'Leflunomide', value: 'leflunomide' },
      // Biologics
      { label: 'Adalimumab (Humira)', value: 'adalimumab' },
      { label: 'Infliximab (Remicade)', value: 'infliximab' },
      { label: 'Etanercept (Enbrel)', value: 'etanercept' },
      { label: 'Rituximab (Rituxan)', value: 'rituximab' },
      { label: 'Tocilizumab (Actemra)', value: 'tocilizumab' },
      { label: 'Secukinumab (Cosentyx)', value: 'secukinumab' },
      { label: 'Ustekinumab (Stelara)', value: 'ustekinumab' },
      { label: 'Vedolizumab (Entyvio)', value: 'vedolizumab' },
      { label: 'Dupilumab (Dupixent)', value: 'dupilumab' },
      { label: 'Pembrolizumab (Keytruda)', value: 'pembrolizumab' },
      { label: 'Nivolumab (Opdivo)', value: 'nivolumab' },
      { label: 'Belimumab (Benlysta)', value: 'belimumab' },
      { label: 'Abatacept (Orencia)', value: 'abatacept' },
      { label: 'Baricitinib (Olumiant)', value: 'baricitinib' },
      { label: 'Tofacitinib (Xeljanz)', value: 'tofacitinib' },
      { label: 'Upadacitinib (Rinvoq)', value: 'upadacitinib' },
      // Chemotherapy
      { label: 'Cyclophosphamide', value: 'cyclophosphamide' },
      { label: 'Doxorubicin', value: 'doxorubicin' },
      { label: 'Paclitaxel', value: 'paclitaxel' },
      { label: 'Carboplatin', value: 'carboplatin' },
      { label: 'Cisplatin', value: 'cisplatin' },
      { label: 'Fluorouracil', value: 'fluorouracil' },
      { label: 'Vincristine', value: 'vincristine' },
      { label: 'Imatinib (Gleevec)', value: 'imatinib' },
      { label: 'Capecitabine (Xeloda)', value: 'capecitabine' },
      { label: 'Temozolomide', value: 'temozolomide' },
      { label: 'Oxaliplatin', value: 'oxaliplatin' },
      { label: 'Gemcitabine', value: 'gemcitabine' },
      { label: 'Docetaxel', value: 'docetaxel' },
      { label: 'Etoposide', value: 'etoposide' },
      { label: 'Hydroxyurea', value: 'hydroxyurea' },
      // Corticosteroids
      { label: 'Prednisone', value: 'prednisone' },
      { label: 'Prednisolone', value: 'prednisolone' },
      { label: 'Hydrocortisone', value: 'hydrocortisone' },
      { label: 'Dexamethasone', value: 'dexamethasone' },
      { label: 'Methylprednisolone', value: 'methylprednisolone' },
      { label: 'Budesonide', value: 'budesonide' },
      { label: 'Fludrocortisone', value: 'fludrocortisone' },
      { label: 'Betamethasone', value: 'betamethasone' },
      { label: 'Triamcinolone', value: 'triamcinolone' },
      // Antibiotics
      { label: 'Amoxicillin', value: 'amoxicillin' },
      { label: 'Amoxicillin-Clavulanate (Augmentin)', value: 'amoxicillin_clavulanate' },
      { label: 'Ampicillin', value: 'ampicillin' },
      { label: 'Azithromycin', value: 'azithromycin' },
      { label: 'Cefadroxil', value: 'cefadroxil' },
      { label: 'Cephalexin', value: 'cephalexin' },
      { label: 'Cefuroxime', value: 'cefuroxime' },
      { label: 'Ceftriaxone', value: 'ceftriaxone' },
      { label: 'Cefdinir', value: 'cefdinir' },
      { label: 'Ciprofloxacin', value: 'ciprofloxacin' },
      { label: 'Clindamycin', value: 'clindamycin' },
      { label: 'Doxycycline', value: 'doxycycline' },
      { label: 'Erythromycin', value: 'erythromycin' },
      { label: 'Levofloxacin', value: 'levofloxacin' },
      { label: 'Linezolid', value: 'linezolid' },
      { label: 'Metronidazole (Flagyl)', value: 'metronidazole' },
      { label: 'Meropenem', value: 'meropenem' },
      { label: 'Minocycline', value: 'minocycline' },
      { label: 'Moxifloxacin', value: 'moxifloxacin' },
      { label: 'Nitrofurantoin', value: 'nitrofurantoin' },
      { label: 'Piperacillin-Tazobactam (Zosyn)', value: 'piperacillin_tazobactam' },
      { label: 'Rifampin', value: 'rifampin' },
      { label: 'Trimethoprim-Sulfamethoxazole (Bactrim)', value: 'trimethoprim_sulfamethoxazole' },
      { label: 'Vancomycin', value: 'vancomycin' },
      // Antifungals
      { label: 'Fluconazole (Diflucan)', value: 'fluconazole' },
      { label: 'Itraconazole', value: 'itraconazole' },
      { label: 'Voriconazole', value: 'voriconazole' },
      { label: 'Posaconazole', value: 'posaconazole' },
      { label: 'Caspofungin', value: 'caspofungin' },
      { label: 'Micafungin', value: 'micafungin' },
      { label: 'Amphotericin B', value: 'amphotericin_b' },
      { label: 'Nystatin', value: 'nystatin' },
      { label: 'Clotrimazole', value: 'clotrimazole' },
      // Antivirals
      { label: 'Acyclovir (Zovirax)', value: 'acyclovir' },
      { label: 'Valacyclovir (Valtrex)', value: 'valacyclovir' },
      { label: 'Oseltamivir (Tamiflu)', value: 'oseltamivir' },
      { label: 'Remdesivir', value: 'remdesivir' },
      { label: 'Nirmatrelvir-Ritonavir (Paxlovid)', value: 'nirmatrelvir_ritonavir' },
      { label: 'Ganciclovir', value: 'ganciclovir' },
      { label: 'Valganciclovir', value: 'valganciclovir' },
      // Anticoagulants
      { label: 'Warfarin (Coumadin)', value: 'warfarin' },
      { label: 'Apixaban (Eliquis)', value: 'apixaban' },
      { label: 'Rivaroxaban (Xarelto)', value: 'rivaroxaban' },
      { label: 'Dabigatran (Pradaxa)', value: 'dabigatran' },
      { label: 'Edoxaban (Savaysa)', value: 'edoxaban' },
      { label: 'Enoxaparin (Lovenox)', value: 'enoxaparin' },
      { label: 'Fondaparinux (Arixtra)', value: 'fondaparinux' },
      { label: 'Heparin', value: 'heparin' },
      { label: 'Aspirin (anticoagulant use)', value: 'aspirin' },
      // NSAIDs
      { label: 'Ibuprofen (Advil/Motrin)', value: 'ibuprofen' },
      { label: 'Naproxen (Aleve)', value: 'naproxen' },
      { label: 'Diclofenac (Voltaren)', value: 'diclofenac' },
      { label: 'Celecoxib (Celebrex)', value: 'celecoxib' },
      { label: 'Meloxicam (Mobic)', value: 'meloxicam' },
      { label: 'Indomethacin', value: 'indomethacin' },
      { label: 'Ketorolac (Toradol)', value: 'ketorolac' },
      { label: 'Piroxicam', value: 'piroxicam' },
      // ACE Inhibitors / ARBs
      { label: 'Lisinopril', value: 'lisinopril' },
      { label: 'Enalapril', value: 'enalapril' },
      { label: 'Ramipril', value: 'ramipril' },
      { label: 'Captopril', value: 'captopril' },
      { label: 'Perindopril', value: 'perindopril' },
      { label: 'Losartan', value: 'losartan' },
      { label: 'Valsartan', value: 'valsartan' },
      { label: 'Irbesartan', value: 'irbesartan' },
      { label: 'Candesartan', value: 'candesartan' },
      { label: 'Olmesartan', value: 'olmesartan' },
      { label: 'Telmisartan', value: 'telmisartan' },
      // Diuretics
      { label: 'Furosemide (Lasix)', value: 'furosemide' },
      { label: 'Hydrochlorothiazide', value: 'hydrochlorothiazide' },
      { label: 'Spironolactone', value: 'spironolactone' },
      { label: 'Torsemide', value: 'torsemide' },
      { label: 'Bumetanide', value: 'bumetanide' },
      { label: 'Chlorthalidone', value: 'chlorthalidone' },
      { label: 'Metolazone', value: 'metolazone' },
      { label: 'Amiloride', value: 'amiloride' },
      // Insulin
      { label: 'Insulin Glargine (Lantus/Basaglar)', value: 'insulin_glargine' },
      { label: 'Insulin Lispro (Humalog)', value: 'insulin_lispro' },
      { label: 'Insulin Aspart (NovoLog)', value: 'insulin_aspart' },
      { label: 'Insulin Detemir (Levemir)', value: 'insulin_detemir' },
      { label: 'Insulin Degludec (Tresiba)', value: 'insulin_degludec' },
      { label: 'NPH Insulin', value: 'nph_insulin' },
      { label: 'Regular Insulin (Humulin R)', value: 'regular_insulin' },
      { label: 'Insulin Glulisine (Apidra)', value: 'insulin_glulisine' },
      // Other Diabetes Medications
      { label: 'Metformin', value: 'metformin' },
      { label: 'Glipizide', value: 'glipizide' },
      { label: 'Glimepiride', value: 'glimepiride' },
      { label: 'Glibenclamide (Glyburide)', value: 'glibenclamide' },
      { label: 'Sitagliptin (Januvia)', value: 'sitagliptin' },
      { label: 'Saxagliptin (Onglyza)', value: 'saxagliptin' },
      { label: 'Linagliptin (Tradjenta)', value: 'linagliptin' },
      { label: 'Empagliflozin (Jardiance)', value: 'empagliflozin' },
      { label: 'Dapagliflozin (Farxiga)', value: 'dapagliflozin' },
      { label: 'Canagliflozin (Invokana)', value: 'canagliflozin' },
      { label: 'Semaglutide (Ozempic/Wegovy)', value: 'semaglutide' },
      { label: 'Liraglutide (Victoza)', value: 'liraglutide' },
      { label: 'Dulaglutide (Trulicity)', value: 'dulaglutide' },
      { label: 'Pioglitazone (Actos)', value: 'pioglitazone' },
      // Heart / Blood Pressure
      { label: 'Metoprolol', value: 'metoprolol' },
      { label: 'Atenolol', value: 'atenolol' },
      { label: 'Carvedilol', value: 'carvedilol' },
      { label: 'Bisoprolol', value: 'bisoprolol' },
      { label: 'Propranolol', value: 'propranolol' },
      { label: 'Amlodipine', value: 'amlodipine' },
      { label: 'Diltiazem', value: 'diltiazem' },
      { label: 'Verapamil', value: 'verapamil' },
      { label: 'Digoxin', value: 'digoxin' },
      { label: 'Hydralazine', value: 'hydralazine' },
      { label: 'Clonidine', value: 'clonidine' },
      { label: 'Ivabradine (Corlanor)', value: 'ivabradine' },
      { label: 'Sacubitril-Valsartan (Entresto)', value: 'sacubitril_valsartan' },
      { label: 'Amiodarone', value: 'amiodarone' },
      { label: 'Flecainide', value: 'flecainide' },
      { label: 'Sotalol', value: 'sotalol' },
      // Cholesterol
      { label: 'Atorvastatin (Lipitor)', value: 'atorvastatin' },
      { label: 'Rosuvastatin (Crestor)', value: 'rosuvastatin' },
      { label: 'Simvastatin', value: 'simvastatin' },
      { label: 'Pravastatin', value: 'pravastatin' },
      { label: 'Lovastatin', value: 'lovastatin' },
      { label: 'Ezetimibe (Zetia)', value: 'ezetimibe' },
      { label: 'Fenofibrate', value: 'fenofibrate' },
      { label: 'Gemfibrozil', value: 'gemfibrozil' },
      { label: 'Evolocumab (Repatha)', value: 'evolocumab' },
      { label: 'Alirocumab (Praluent)', value: 'alirocumab' },
      // Antiseizure / Neurological
      { label: 'Gabapentin', value: 'gabapentin' },
      { label: 'Pregabalin (Lyrica)', value: 'pregabalin' },
      { label: 'Levetiracetam (Keppra)', value: 'levetiracetam' },
      { label: 'Phenytoin (Dilantin)', value: 'phenytoin' },
      { label: 'Carbamazepine', value: 'carbamazepine' },
      { label: 'Valproic Acid', value: 'valproic_acid' },
      { label: 'Lamotrigine (Lamictal)', value: 'lamotrigine' },
      { label: 'Topiramate (Topamax)', value: 'topiramate' },
      { label: 'Oxcarbazepine', value: 'oxcarbazepine' },
      { label: 'Lacosamide (Vimpat)', value: 'lacosamide' },
      { label: 'Zonisamide', value: 'zonisamide' },
      // Parkinson's Medications
      { label: 'Levodopa-Carbidopa (Sinemet)', value: 'levodopa_carbidopa' },
      { label: 'Pramipexole (Mirapex)', value: 'pramipexole' },
      { label: 'Ropinirole (Requip)', value: 'ropinirole' },
      { label: 'Rasagiline (Azilect)', value: 'rasagiline' },
      { label: 'Selegiline', value: 'selegiline' },
      { label: 'Amantadine', value: 'amantadine' },
      // Dementia Medications
      { label: 'Donepezil (Aricept)', value: 'donepezil' },
      { label: 'Rivastigmine (Exelon)', value: 'rivastigmine' },
      { label: 'Galantamine (Razadyne)', value: 'galantamine' },
      { label: 'Memantine (Namenda)', value: 'memantine' },
      // Psychiatric
      { label: 'Sertraline (Zoloft)', value: 'sertraline' },
      { label: 'Fluoxetine (Prozac)', value: 'fluoxetine' },
      { label: 'Escitalopram (Lexapro)', value: 'escitalopram' },
      { label: 'Citalopram (Celexa)', value: 'citalopram' },
      { label: 'Paroxetine (Paxil)', value: 'paroxetine' },
      { label: 'Duloxetine (Cymbalta)', value: 'duloxetine' },
      { label: 'Venlafaxine (Effexor)', value: 'venlafaxine' },
      { label: 'Bupropion (Wellbutrin)', value: 'bupropion' },
      { label: 'Mirtazapine (Remeron)', value: 'mirtazapine' },
      { label: 'Quetiapine (Seroquel)', value: 'quetiapine' },
      { label: 'Olanzapine (Zyprexa)', value: 'olanzapine' },
      { label: 'Risperidone (Risperdal)', value: 'risperidone' },
      { label: 'Aripiprazole (Abilify)', value: 'aripiprazole' },
      { label: 'Haloperidol (Haldol)', value: 'haloperidol' },
      { label: 'Lithium', value: 'lithium' },
      { label: 'Clonazepam', value: 'clonazepam' },
      { label: 'Lorazepam', value: 'lorazepam' },
      { label: 'Diazepam (Valium)', value: 'diazepam' },
      { label: 'Alprazolam (Xanax)', value: 'alprazolam' },
      { label: 'Buspirone', value: 'buspirone' },
      // Pain
      { label: 'Oxycodone', value: 'oxycodone' },
      { label: 'Hydrocodone', value: 'hydrocodone' },
      { label: 'Morphine', value: 'morphine' },
      { label: 'Hydromorphone (Dilaudid)', value: 'hydromorphone' },
      { label: 'Fentanyl', value: 'fentanyl' },
      { label: 'Tramadol', value: 'tramadol' },
      { label: 'Codeine', value: 'codeine' },
      { label: 'Acetaminophen (Tylenol)', value: 'acetaminophen' },
      { label: 'Buprenorphine (Suboxone)', value: 'buprenorphine' },
      { label: 'Naloxone (Narcan)', value: 'naloxone' },
      { label: 'Methadone', value: 'methadone' },
      { label: 'Tapentadol (Nucynta)', value: 'tapentadol' },
      // Respiratory
      { label: 'Albuterol (ProAir/Ventolin)', value: 'albuterol' },
      { label: 'Levalbuterol (Xopenex)', value: 'levalbuterol' },
      { label: 'Fluticasone (Flovent)', value: 'fluticasone' },
      { label: 'Budesonide (Pulmicort)', value: 'budesonide_inhaled' },
      { label: 'Beclomethasone (Qvar)', value: 'beclomethasone' },
      { label: 'Tiotropium (Spiriva)', value: 'tiotropium' },
      { label: 'Umeclidinium (Incruse)', value: 'umeclidinium' },
      { label: 'Aclidinium (Tudorza)', value: 'aclidinium' },
      { label: 'Salmeterol (Serevent)', value: 'salmeterol' },
      { label: 'Formoterol', value: 'formoterol' },
      { label: 'Indacaterol (Arcapta)', value: 'indacaterol' },
      { label: 'Fluticasone-Salmeterol (Advair)', value: 'fluticasone_salmeterol' },
      { label: 'Budesonide-Formoterol (Symbicort)', value: 'budesonide_formoterol' },
      { label: 'Fluticasone-Vilanterol (Breo)', value: 'fluticasone_vilanterol' },
      { label: 'Montelukast (Singulair)', value: 'montelukast' },
      { label: 'Ipratropium (Atrovent)', value: 'ipratropium' },
      { label: 'Roflumilast (Daliresp)', value: 'roflumilast' },
      { label: 'Dupilumab (Dupixent) (respiratory use)', value: 'dupilumab_respiratory' },
      // Proton Pump Inhibitors / GI
      { label: 'Omeprazole (Prilosec)', value: 'omeprazole' },
      { label: 'Pantoprazole (Protonix)', value: 'pantoprazole' },
      { label: 'Esomeprazole (Nexium)', value: 'esomeprazole' },
      { label: 'Lansoprazole (Prevacid)', value: 'lansoprazole' },
      { label: 'Rabeprazole (Aciphex)', value: 'rabeprazole' },
      { label: 'Ondansetron (Zofran)', value: 'ondansetron' },
      { label: 'Metoclopramide (Reglan)', value: 'metoclopramide' },
      { label: 'Sucralfate', value: 'sucralfate' },
      { label: 'Mesalamine (Asacol/Lialda)', value: 'mesalamine' },
      { label: 'Sulfasalazine', value: 'sulfasalazine' },
      // Thyroid
      { label: 'Levothyroxine (Synthroid)', value: 'levothyroxine' },
      { label: 'Liothyronine (Cytomel)', value: 'liothyronine' },
      { label: 'Methimazole', value: 'methimazole' },
      { label: 'Propylthiouracil (PTU)', value: 'propylthiouracil' },
      // Osteoporosis
      { label: 'Alendronate (Fosamax)', value: 'alendronate' },
      { label: 'Risedronate (Actonel)', value: 'risedronate' },
      { label: 'Ibandronate (Boniva)', value: 'ibandronate' },
      { label: 'Zoledronic Acid (Reclast)', value: 'zoledronic_acid' },
      { label: 'Denosumab (Prolia)', value: 'denosumab' },
      { label: 'Teriparatide (Forteo)', value: 'teriparatide' },
      // Vitamins / Supplements with clinical relevance
      { label: 'Vitamin D', value: 'vitamin_d' },
      { label: 'Vitamin B12', value: 'vitamin_b12' },
      { label: 'Folic Acid', value: 'folic_acid' },
      { label: 'Iron (prescribed)', value: 'iron' },
      { label: 'Potassium (prescribed)', value: 'potassium' },
      { label: 'Magnesium (prescribed)', value: 'magnesium' },
      { label: 'None', value: 'none' },
    ],
    schemaField: [
      'on_immunosuppressants',
      'has_other_medications',
    ],
    businessLogic: {
      mapToMultipleFields: true,
      customMapping: (medications: string[]) => {
        const immunosuppressants = [
          'tacrolimus', 'cyclosporine', 'azathioprine', 'mycophenolate',
          'sirolimus', 'everolimus', 'methotrexate', 'leflunomide',
          // biologics
          'adalimumab', 'infliximab', 'etanercept', 'rituximab', 'tocilizumab',
          'secukinumab', 'ustekinumab', 'vedolizumab', 'dupilumab', 'pembrolizumab',
          'nivolumab', 'belimumab', 'abatacept', 'baricitinib', 'tofacitinib', 'upadacitinib',
          // chemotherapy
          'cyclophosphamide', 'doxorubicin', 'paclitaxel', 'carboplatin', 'cisplatin',
          'fluorouracil', 'vincristine', 'imatinib', 'capecitabine', 'temozolomide',
          'oxaliplatin', 'gemcitabine', 'docetaxel', 'etoposide', 'hydroxyurea',
          // corticosteroids
          'prednisone', 'prednisolone', 'hydrocortisone', 'dexamethasone',
          'methylprednisolone', 'budesonide', 'fludrocortisone', 'betamethasone', 'triamcinolone',
        ];

        return {
          on_immunosuppressants: medications.some((m) => immunosuppressants.includes(m)),
          has_other_medications: medications.some(
            (m) => !immunosuppressants.includes(m) && m !== 'none'
          ),
        };
      },
    },
  },

  // ============================================================================
  // CARE & SUPPORT (Questions 11-14)
  // ============================================================================

  {
    id: 'has_caregiver',
    section: 'Care & Support',
    patientText: 'Do you have a caregiver to assist you?',
    caregiverText: null, // Skip for caregivers — auto-set to true
    helpText: 'A caregiver is anyone — family, friend, or hired helper — who regularly helps you with your health or daily needs.',
    type: 'boolean',
    schemaField: 'has_caregiver',
    prerequisites: [
      { field: 'is_patient', operator: '==', value: true },
    ],
  },

  {
    id: 'caregiver_availability',
    section: 'Care & Support',
    patientText: 'How often is your caregiver available to assist you?',
    caregiverText: 'How often are you available to assist the patient?',
    type: 'single_select',
    options: [
      { label: '24/7 (Full-time)', value: 'full_time', iconEmoji: '🏥' },
      { label: 'Only some days (Part-time)', value: 'part_time', iconEmoji: '📅' },
      { label: 'Occasionally', value: 'occasional', iconEmoji: '🤝' },
      { label: 'None', value: 'none' },
    ],
    schemaField: 'caregiver_availability',
    prerequisites: [
      { field: 'has_caregiver', operator: '==', value: true },
    ],
  },

  {
    id: 'physical_ability',
    section: 'Care & Support',
    patientText: 'Which best describes your current physical ability?',
    caregiverText: "Which best describes the patient's current physical ability?",
    helpText: 'Think about how you feel right now, not how you felt before getting sepsis.',
    caregiverHelpText: 'Think about how the patient feels right now, not how they felt before getting sepsis.',
    type: 'single_select',
    options: [
      { label: 'Able to walk and climb stairs without difficulty', value: 'normal' },
      { label: 'Walks and climbs stairs but tires easily', value: 'tires_easily' },
      { label: 'Needs help with walking or getting out of bed', value: 'needs_help' },
      { label: 'In bed or wheelchair most of the day', value: 'bed_or_wheelchair' },
    ],
    schemaField: ['physical_ability_level', 'can_exercise_regularly'],
    validation: { required: true },
    businessLogic: {
      mapToMultipleFields: true,
      customMapping: (value: string) => ({
        physical_ability_level: value,
        can_exercise_regularly: value === 'normal',
      }),
    },
  },

  {
    id: 'social_support',
    section: 'Care & Support',
    patientText: 'Does someone regularly check in on you, whether in person or by phone?',
    caregiverText: null, // Skipped — only shown if has_caregiver = false
    helpText: 'This means someone who would notice if you were not doing well and could help get you care.',
    type: 'single_select',
    options: [
      { label: 'Yes, daily or almost daily', value: true },
      { label: 'Yes, occasionally', value: true },
      { label: 'No regular support', value: false },
    ],
    schemaField: 'has_social_support',
    prerequisites: [
      { field: 'has_caregiver', operator: '==', value: false },
    ],
  },

  // ============================================================================
  // MONITORING DEVICES (Questions 15-19)
  // ============================================================================

  {
    id: 'has_thermometer',
    section: 'Monitoring Devices',
    patientText: 'Are you able to check your temperature (thermometer) at home each day if needed?',
    caregiverText: "Are you able to check the patient's temperature (thermometer) at home each day if needed?",
    helpText: 'Any type of thermometer counts — mouth, ear, forehead, or armpit.',
    type: 'boolean',
    schemaField: 'has_thermometer',
  },

  {
    id: 'has_pulse_oximeter',
    section: 'Monitoring Devices',
    patientText: 'Are you able to check your oxygen level (pulse oximeter) at home each day if needed?',
    caregiverText: "Are you able to check the patient's oxygen level (pulse oximeter) at home each day if needed?",
    helpText: 'A pulse oximeter is a small clip you put on your fingertip — it shows your oxygen level as a number like 98%.',
    caregiverHelpText: "A pulse oximeter is a small clip placed on the fingertip — it shows the patient's oxygen level as a number like 98%.",
    type: 'boolean',
    schemaField: 'has_pulse_oximeter',
  },

  {
    id: 'has_bp_cuff',
    section: 'Monitoring Devices',
    patientText: 'Are you able to check your blood pressure (blood pressure cuff) at home each day if needed?',
    caregiverText: "Are you able to check the patient's blood pressure (blood pressure cuff) at home each day if needed?",
    helpText: 'Automatic arm cuffs you can buy at a pharmacy work great — wrist cuffs are less accurate but still count.',
    type: 'boolean',
    schemaField: 'has_bp_cuff',
    businessLogic: {
      triggersFollowUp: 'baseline_bp_systolic',
    },
  },

  {
    id: 'baseline_bp_systolic',
    section: 'Monitoring Devices',
    patientText:
      'If possible, rest for 3 minutes, and measure your blood pressure with your arm at heart level and without speaking. Enter the top (systolic) value, or your usual value if you know it.',
    caregiverText:
      "If possible, have the patient rest for 3 minutes, and measure their blood pressure with their arm supported at heart level and without speaking. Enter the top (systolic) value, or their usual value if known.",
    helpText: 'This will be saved as your baseline.',
    caregiverHelpText: "This will be saved as the patient's baseline.",
    type: 'integer',
    schemaField: 'baseline_bp_systolic',
    prerequisites: [
      { field: 'has_bp_cuff', operator: '==', value: true },
    ],
    validation: {
      min: 60,
      max: 250,
    },
    placeholder: 'e.g., 120',
    unit: 'mmHg',
  },

  {
    id: 'has_hr_monitor',
    section: 'Monitoring Devices',
    patientText:
      'Are you able to check your heart rate at home each day if needed? (Some pulse oximeters, blood pressure cuffs, and smart watches measure this.)',
    caregiverText:
      "Are you able to check the patient's heart rate at home each day if needed? (Some pulse oximeters, blood pressure cuffs, and smart watches measure this.)",
    helpText: 'Many pulse oximeters, blood pressure cuffs, and smart watches already show your heart rate — check your device\'s screen.',
    caregiverHelpText: "Many pulse oximeters, blood pressure cuffs, and smart watches already show the patient's heart rate — check the device's screen.",
    type: 'boolean',
    schemaField: 'has_hr_monitor',
  },

];

export const onboardingSections: QuestionSection[] = [
  {
    id: 'getting_started',
    title: 'Getting Started',
    icon: '👋',
    questions: onboardingQuestions.filter((q) => q.section === 'Getting Started'),
  },
  {
    id: 'basic_information',
    title: 'Basic Information',
    icon: '📋',
    questions: onboardingQuestions.filter((q) => q.section === 'Basic Information'),
  },
  {
    id: 'sepsis_context',
    title: 'Sepsis History',
    icon: '🏥',
    questions: onboardingQuestions.filter((q) => q.section === 'Sepsis Context'),
  },
  {
    id: 'medical_history',
    title: 'Medical History',
    icon: '⚕️',
    questions: onboardingQuestions.filter((q) => q.section === 'Medical History'),
  },
  {
    id: 'care_support',
    title: 'Care & Support',
    icon: '🤝',
    questions: onboardingQuestions.filter((q) => q.section === 'Care & Support'),
  },
  {
    id: 'monitoring_devices',
    title: 'Monitoring Devices',
    icon: '🩺',
    questions: onboardingQuestions.filter((q) => q.section === 'Monitoring Devices'),
  },
];

export const onboardingSurvey: Survey = {
  id: 'onboarding',
  title: 'Sepsis Monitoring - Onboarding',
  description: 'Help us understand your health history and monitoring capabilities',
  sections: onboardingSections,
  questions: onboardingQuestions,
};

export function getOnboardingQuestion(id: string): Question | undefined {
  return onboardingQuestions.find((q) => q.id === id);
}

export function getOnboardingSection(sectionId: string): QuestionSection | undefined {
  return onboardingSections.find((s) => s.id === sectionId);
}