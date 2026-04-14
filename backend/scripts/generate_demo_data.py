"""
Generate a realistic 1000-row Synthea-style demo dataset.
Includes intentional data quality issues to showcase the hygiene audit:
  - ~30 rows with ICD_PRIMARY = "ZZZ999" (invalid code) → CRITICAL hygiene fail
  - ~15 rows with ICD_PRIMARY = null (missing) → WARNING
  - ~2 rows with SYSTOLIC_BP < DIASTOLIC_BP → CRITICAL
  - SSN column present → triggers PII suppression safeguard
Run: python3 scripts/generate_demo_data.py
"""
import numpy as np
import pandas as pd
from pathlib import Path

np.random.seed(42)
N = 1000

# ─── Valid ICD-10 codes used in Ontario primary care ─────────────────────────
VALID_ICD_CODES = [
    "E11.9",  # Type 2 diabetes without complications
    "I10",    # Essential hypertension
    "J44.1",  # COPD with acute exacerbation
    "F32.1",  # Major depressive episode, moderate
    "M54.5",  # Low back pain
    "J06.9",  # Acute upper respiratory infection
    "N39.0",  # Urinary tract infection
    "K21.0",  # GERD with esophagitis
    "E78.5",  # Hyperlipidemia
    "I50.9",  # Heart failure, unspecified
    "J45.901", # Unspecified asthma with acute exacerbation
    "F41.1",  # Generalized anxiety disorder
    "Z00.00", # General adult examination
    "E66.9",  # Obesity, unspecified
    "K92.1",  # Melena
]

ICD_PROBS = [0.18, 0.15, 0.08, 0.07, 0.07, 0.06, 0.06, 0.06, 0.05, 0.05,
             0.04, 0.04, 0.04, 0.03, 0.02]

SECONDARY_ICD = ["Z96.641", "Z87.891", "Z82.49", "Z79.4", "Z96.651", None, None, None]

ENCOUNTER_TYPES = ["outpatient", "inpatient", "emergency", "preventive", "telehealth"]
PAYER_TYPES = ["OHIP", "Private", "Workplace", "Self-pay", "WSIB"]
CITIES = ["Newmarket", "Aurora", "Richmond Hill", "Barrie", "Bradford", "Innisfil", "Keswick", "Georgina", "King", "East Gwillimbury"]
GENDERS = ["M", "F"]
RACES = ["White", "South Asian", "Black", "Chinese", "Filipino", "Latin American", "Arab", "Other"]
RACE_PROBS = [0.52, 0.18, 0.08, 0.07, 0.04, 0.04, 0.03, 0.04]
ETHNICITIES = ["Non-Hispanic", "Hispanic"]

# ─── Generate columns ─────────────────────────────────────────────────────────

age = np.clip(np.random.normal(52, 18, N), 0, 95).astype(int)
gender = np.random.choice(GENDERS, N, p=[0.48, 0.52])
race = np.random.choice(RACES, N, p=RACE_PROBS)
ethnicity = np.random.choice(ETHNICITIES, N, p=[0.85, 0.15])

# BMI: bimodal (healthy population + obese population)
bmi_healthy = np.random.normal(24, 3, N)
bmi_obese = np.random.normal(33, 5, N)
obese_mask = np.random.random(N) < 0.35
bmi = np.where(obese_mask, bmi_obese, bmi_healthy)
bmi = np.clip(bmi, 14, 60).round(1)

# BP: correlated with age and BMI
systolic = (110 + 0.4 * age + 0.5 * (bmi - 25) + np.random.normal(0, 10, N)).round().astype(int)
diastolic = (65 + 0.25 * age + 0.3 * (bmi - 25) + np.random.normal(0, 8, N)).round().astype(int)
systolic = np.clip(systolic, 80, 200)
diastolic = np.clip(diastolic, 50, 130)

# Ensure systolic > diastolic (fix most, leave 2 broken for hygiene demo)
broken_bp_idx = np.random.choice(N, 2, replace=False)
for i in range(N):
    if i not in broken_bp_idx and systolic[i] <= diastolic[i]:
        systolic[i] = diastolic[i] + np.random.randint(10, 40)

# Glucose: bimodal (diabetic patients have higher glucose)
diabetic_mask = np.random.random(N) < 0.12
glucose_normal = np.random.normal(95, 15, N)
glucose_diabetic = np.random.normal(165, 35, N)
glucose = np.where(diabetic_mask, glucose_diabetic, glucose_normal)
glucose = np.clip(glucose, 40, 500).round(1)

# LOS (length of stay): mostly short, some long
los = np.clip(np.random.exponential(2, N), 0, 30).round(1)

# Claim cost: log-normal
claim_cost = np.random.lognormal(6.5, 1.2, N).round(2)
claim_cost = np.clip(claim_cost, 50, 150000)

# ICD codes: mostly valid, some issues
icd_primary = np.random.choice(VALID_ICD_CODES, N, p=ICD_PROBS)
icd_secondary = np.random.choice(SECONDARY_ICD, N)

# Inject intentional issues:
# 30 rows with invalid ICD "ZZZ999"
bad_icd_idx = np.random.choice(N, 30, replace=False)
icd_primary[bad_icd_idx] = "ZZZ999"

# 15 rows with missing ICD
null_icd_idx = np.random.choice(
    [i for i in range(N) if i not in bad_icd_idx], 15, replace=False
)
icd_primary_list = icd_primary.tolist()
for i in null_icd_idx:
    icd_primary_list[i] = None

encounter_type = np.random.choice(ENCOUNTER_TYPES, N, p=[0.45, 0.20, 0.15, 0.12, 0.08])
payer_type = np.random.choice(PAYER_TYPES, N, p=[0.72, 0.15, 0.06, 0.04, 0.03])
city = np.random.choice(CITIES, N)
postal_prefix = ["L" + str(np.random.randint(3, 7)) + "G" for _ in range(N)]  # York Region FSA pattern

# SSN — presence triggers PII suppression safeguard
ssn = [f"{np.random.randint(100,999)}-{np.random.randint(10,99)}-{np.random.randint(1000,9999)}" for _ in range(N)]

# ─── Assemble DataFrame ───────────────────────────────────────────────────────

df = pd.DataFrame({
    "SSN": ssn,
    "AGE": age,
    "GENDER": gender,
    "RACE": race,
    "ETHNICITY": ethnicity,
    "BMI": bmi,
    "SYSTOLIC_BP": systolic,
    "DIASTOLIC_BP": diastolic,
    "GLUCOSE": glucose,
    "ICD_PRIMARY": icd_primary_list,
    "ICD_SECONDARY": icd_secondary,
    "ENCOUNTER_TYPE": encounter_type,
    "LOS_DAYS": los,
    "TOTAL_CLAIM_COST": claim_cost,
    "PAYER_TYPE": payer_type,
    "CITY": city,
    "POSTAL_PREFIX": postal_prefix,
})

out_path = Path(__file__).parent.parent / "data" / "synthea" / "patients.csv"
out_path.parent.mkdir(parents=True, exist_ok=True)
df.to_csv(out_path, index=False)
print(f"✓ Generated {N} rows → {out_path}")
print(f"  Invalid ICD codes (ZZZ999): {(df['ICD_PRIMARY'] == 'ZZZ999').sum()}")
print(f"  Missing ICD codes: {df['ICD_PRIMARY'].isna().sum()}")
print(f"  Broken BP (systolic < diastolic): {(df['SYSTOLIC_BP'] < df['DIASTOLIC_BP']).sum()}")
print(f"  SSN column present: yes (triggers PII suppression)")
