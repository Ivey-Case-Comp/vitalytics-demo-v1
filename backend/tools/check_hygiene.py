"""
Stage 3: Hygiene Audit
Scans metadata for 6 categories of data quality issues.
"""
from __future__ import annotations
import re
import uuid
from typing import Any, Optional

# Valid ICD-10 pattern
ICD10_PATTERN = re.compile(r"^[A-Z][0-9]{1,2}(\.[0-9]{1,4})?[A-Z]?$")

# Ontario/Canada census benchmarks (rough, for demo)
GENDER_BENCHMARK = {"M": 0.495, "F": 0.505}
RACE_BENCHMARK = {
    "White": 0.52,
    "South Asian": 0.18,
    "Black": 0.08,
    "Chinese": 0.07,
    "Filipino": 0.04,
    "Latin American": 0.04,
    "Arab": 0.03,
    "Other": 0.04,
}


def _make_issue(
    category: str,
    severity: str,
    description: str,
    affected_count: int,
    fixable: bool,
    metadata_fix: Optional[dict] = None,
) -> dict[str, Any]:
    return {
        "id": str(uuid.uuid4())[:8],
        "category": category,
        "severity": severity,
        "description": description,
        "affected_count": affected_count,
        "fixable": fixable,
        "metadata_fix": metadata_fix or {},
        "applied": False,
    }


def check_hygiene(metadata: dict) -> list[dict]:
    """
    Scan metadata JSON for 6 categories of data quality issues.
    Returns list of HygieneIssue dicts.
    """
    issues: list[dict] = []
    columns: dict[str, dict] = metadata.get("columns", {})
    row_count: int = metadata.get("row_count", 1)

    # ── Category 1: ICD Coding Validity ────────────────────────────────────
    for col_name, col_meta in columns.items():
        if "icd" not in col_name.lower():
            continue
        if col_meta.get("type") != "categorical":
            continue

        bad_cats: list[str] = []
        for cat, _freq in col_meta.get("top_categories", []):
            if cat in ("_RARE_", "None", "nan", ""):
                continue
            if not ICD10_PATTERN.match(str(cat)):
                bad_cats.append(cat)

        if bad_cats:
            n_affected = sum(
                round(freq * row_count)
                for cat, freq in col_meta.get("top_categories", [])
                if cat in bad_cats
            )
            issues.append(
                _make_issue(
                    category="ICD Coding",
                    severity="CRITICAL",
                    description=(
                        f"Column '{col_name}' contains {len(bad_cats)} invalid ICD-10 code(s): "
                        f"{', '.join(bad_cats[:5])}. "
                        f"Valid ICD-10 format: letter + 2 digits + optional decimal."
                    ),
                    affected_count=n_affected,
                    fixable=True,
                    metadata_fix={
                        col_name: {
                            "invalid_categories": bad_cats,
                            "action": "replace_with_RARE",
                            "recommendation": "Replace invalid codes with '_RARE_' to prevent them propagating into synthetic data.",
                        }
                    },
                )
            )

        # Check null rate for ICD columns
        null_rate = col_meta.get("null_rate", 0)
        if null_rate > 0.05:
            issues.append(
                _make_issue(
                    category="Missing Data",
                    severity="WARNING",
                    description=(
                        f"Column '{col_name}' has {null_rate*100:.1f}% missing values. "
                        f"This will cause systematic underrepresentation in synthetic data."
                    ),
                    affected_count=round(null_rate * row_count),
                    fixable=True,
                    metadata_fix={
                        col_name: {
                            "null_rate": null_rate,
                            "action": "impute_with_mode",
                            "recommendation": "Adjust null_rate to 0.02 to reduce underrepresentation.",
                        }
                    },
                )
            )

    # ── Category 2: Missing Data Patterns ──────────────────────────────────
    for col_name, col_meta in columns.items():
        if "icd" in col_name.lower():
            continue  # already handled above
        null_rate = col_meta.get("null_rate", 0)
        if null_rate > 0.20:
            issues.append(
                _make_issue(
                    category="Missing Data",
                    severity="CRITICAL" if null_rate > 0.40 else "WARNING",
                    description=(
                        f"Column '{col_name}' has {null_rate*100:.1f}% missing values — "
                        f"{'high' if null_rate > 0.20 else 'moderate'} missing rate. "
                        f"Synthetic data will underrepresent patients with this data."
                    ),
                    affected_count=round(null_rate * row_count),
                    fixable=True,
                    metadata_fix={
                        col_name: {
                            "null_rate": null_rate,
                            "action": "cap_null_rate",
                            "recommendation": "Cap null_rate at 0.05 to improve synthetic representativeness.",
                        }
                    },
                )
            )
        elif 0.05 < null_rate <= 0.20:
            issues.append(
                _make_issue(
                    category="Missing Data",
                    severity="INFO",
                    description=f"Column '{col_name}' has {null_rate*100:.1f}% missing values — within acceptable range.",
                    affected_count=round(null_rate * row_count),
                    fixable=False,
                )
            )

    # ── Category 3: Clinical Implausibility (from continuous column ranges) ─
    clinical_rules = {
        "AGE": (0, 120, "Age must be between 0 and 120"),
        "BMI": (10, 70, "BMI must be between 10 and 70"),
        "GLUCOSE": (40, 700, "Glucose must be between 40 and 700 mg/dL"),
        "SYSTOLIC_BP": (60, 250, "Systolic BP must be between 60 and 250 mmHg"),
        "DIASTOLIC_BP": (30, 150, "Diastolic BP must be between 30 and 150 mmHg"),
        "LOS_DAYS": (0, 365, "Length of stay must be 0–365 days"),
    }
    for col_name, col_meta in columns.items():
        col_upper = col_name.upper()
        if col_upper not in clinical_rules:
            continue
        if col_meta.get("type") != "continuous":
            continue
        lo, hi, msg = clinical_rules[col_upper]
        p01 = col_meta.get("p01", lo)
        p99 = col_meta.get("p99", hi)
        mean = col_meta.get("mean", (lo + hi) / 2)
        outlier_count = 0
        if p01 < lo:
            outlier_count += round(0.01 * row_count)
        if p99 > hi:
            outlier_count += round(0.01 * row_count)
        if outlier_count > 0:
            issues.append(
                _make_issue(
                    category="Clinical Implausibility",
                    severity="WARNING",
                    description=(
                        f"Column '{col_name}' has outlier values outside clinically valid range "
                        f"[{lo}, {hi}]. {msg}. Observed range: [{p01:.1f}, {p99:.1f}]."
                    ),
                    affected_count=outlier_count,
                    fixable=True,
                    metadata_fix={
                        col_name: {
                            "action": "clip_to_clinical_range",
                            "p01": max(p01, lo),
                            "p99": min(p99, hi),
                        }
                    },
                )
            )

    # ── Category 4: Demographic Skew ───────────────────────────────────────
    for col_name, col_meta in columns.items():
        if col_meta.get("type") != "categorical":
            continue
        col_upper = col_name.upper()
        benchmark = None
        if col_upper == "GENDER":
            benchmark = GENDER_BENCHMARK
        elif col_upper == "RACE":
            benchmark = RACE_BENCHMARK
        if not benchmark:
            continue

        top_cats = dict(col_meta.get("top_categories", []))
        skewed: list[str] = []
        for demo_val, expected_freq in benchmark.items():
            observed = top_cats.get(demo_val, 0)
            if observed < expected_freq * 0.3 or observed > expected_freq * 3:
                skewed.append(f"{demo_val} (observed {observed*100:.1f}% vs expected {expected_freq*100:.1f}%)")

        if skewed:
            issues.append(
                _make_issue(
                    category="Demographic Skew",
                    severity="WARNING",
                    description=(
                        f"Column '{col_name}' has significant skew vs Ontario census benchmarks: "
                        + "; ".join(skewed)
                        + ". Synthetic cohort may underrepresent these groups."
                    ),
                    affected_count=row_count,
                    fixable=False,
                )
            )

    # ── Category 5: Temporal Anomalies (placeholder) ───────────────────────
    datetime_cols = [c for c, m in columns.items() if m.get("type") == "datetime"]
    if len(datetime_cols) >= 2:
        issues.append(
            _make_issue(
                category="Temporal Anomalies",
                severity="INFO",
                description=(
                    f"Detected {len(datetime_cols)} date columns. "
                    f"Temporal ordering constraints are enforced during generation "
                    f"(admission ≤ discharge, birth ≤ death)."
                ),
                affected_count=0,
                fixable=False,
            )
        )

    # ── Category 6: Structural (cardinality check) ─────────────────────────
    for col_name, col_meta in columns.items():
        if col_meta.get("type") != "categorical":
            continue
        cardinality = col_meta.get("cardinality", 0)
        if cardinality > row_count * 0.5:
            issues.append(
                _make_issue(
                    category="Structural",
                    severity="WARNING",
                    description=(
                        f"Column '{col_name}' has very high cardinality ({cardinality} unique values "
                        f"in {row_count} rows). May indicate a quasi-identifier or free-text field "
                        f"that should be generalized or excluded."
                    ),
                    affected_count=cardinality,
                    fixable=False,
                )
            )

    return issues
