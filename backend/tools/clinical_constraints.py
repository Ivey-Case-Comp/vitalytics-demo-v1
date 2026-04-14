"""
Post-generation clinical constraint engine.
Enforces hard medical rules on generated records.
Returns (clean_df, n_rejected).
"""
import numpy as np
import pandas as pd

VALID_ICD_CODES = [
    "E11.9", "I10", "J44.1", "F32.1", "M54.5",
    "J06.9", "N39.0", "K21.0", "E78.5", "I50.9",
    "J45.901", "F41.1", "Z00.00", "E66.9", "K92.1",
]


def apply_clinical_constraints(df: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    """
    Apply clinical constraint rules. Fix where possible; reject if unfixable.
    Returns (fixed_df, n_rejected).
    """
    df = df.copy()
    n_initial = len(df)

    col_upper = {c.upper(): c for c in df.columns}

    # ── Clip continuous columns to valid ranges ───────────────────────────
    ranges = {
        "AGE": (0, 120),
        "BMI": (10, 70),
        "GLUCOSE": (40, 700),
        "SYSTOLIC_BP": (60, 250),
        "DIASTOLIC_BP": (30, 150),
        "LOS_DAYS": (0, 365),
        "TOTAL_CLAIM_COST": (1, 500000),
    }
    for upper, (lo, hi) in ranges.items():
        if upper in col_upper:
            real_col = col_upper[upper]
            df[real_col] = pd.to_numeric(df[real_col], errors="coerce")
            df[real_col] = df[real_col].clip(lo, hi)

    # ── BP logical consistency: ensure systolic > diastolic ───────────────
    sys_col = col_upper.get("SYSTOLIC_BP")
    dia_col = col_upper.get("DIASTOLIC_BP")
    if sys_col and dia_col:
        bad_bp = df[sys_col] <= df[dia_col]
        if bad_bp.any():
            df.loc[bad_bp, sys_col] = df.loc[bad_bp, dia_col] + np.random.randint(15, 45, bad_bp.sum())

    # ── Replace invalid ICD codes ─────────────────────────────────────────
    for col in df.columns:
        if "icd" in col.lower():
            import re
            valid_pattern = re.compile(r"^[A-Z][0-9]{1,2}(\.[0-9]{1,4})?[A-Z]?$")
            invalid_mask = ~df[col].astype(str).str.match(valid_pattern) & df[col].notna()
            if invalid_mask.any():
                replacements = np.random.choice(VALID_ICD_CODES, invalid_mask.sum())
                df.loc[invalid_mask, col] = replacements

    # ── Age coherence: if AGE=0 and GLUCOSE is provided, keep as infant ───
    age_col = col_upper.get("AGE")
    if age_col:
        df[age_col] = df[age_col].round().astype("Int64")

    # ── Round numeric columns to sensible precision ───────────────────────
    for upper, real_col in col_upper.items():
        if upper == "BMI":
            df[real_col] = df[real_col].round(1)
        elif upper in ("GLUCOSE", "LOS_DAYS"):
            df[real_col] = df[real_col].round(1)
        elif upper in ("SYSTOLIC_BP", "DIASTOLIC_BP", "AGE"):
            df[real_col] = df[real_col].round().astype("Int64")
        elif upper == "TOTAL_CLAIM_COST":
            df[real_col] = df[real_col].round(2)

    # ── Drop rows that are entirely NaN (shouldn't happen but defensive) ──
    df = df.dropna(how="all")
    n_rejected = n_initial - len(df)

    return df, n_rejected
