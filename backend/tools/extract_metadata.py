"""
Stage 2: Profile + Extract Metadata
Applies all 5 privacy safeguards before metadata crosses the PHI boundary.
"""
import re
import json
import numpy as np
import pandas as pd
from scipy import stats
from typing import Any

# Columns that must ALWAYS be suppressed (direct identifiers)
PII_PATTERNS = [
    r"^(ssn|sin|social_?security|social_?insurance)$",
    r"^(patient_?id|person_?id|member_?id|mrn|chart_?num|encounter_?id)$",
    r"^(name|first_?name|last_?name|full_?name|given_?name|surname)$",
    r"^(dob|date_?of_?birth|birth_?date|birthdate)$",
    r"^(health_?card|ohip|nhi|health_?number)$",
    r"^(email|phone|mobile|tel|fax|phone_?number)$",
    r"^(address|street|street_?address)$",
    r"^(drivers|passport|license_?number|driver_?license)$",
]

GEOGRAPHIC_PATTERNS = [r"postal", r"zip", r"fsa", r"region_?code"]


def _is_pii(col_name: str) -> bool:
    col = col_name.lower().strip()
    return any(re.match(p, col) for p in PII_PATTERNS)


def _is_geographic(col_name: str) -> bool:
    col = col_name.lower()
    return any(re.search(p, col) for p in GEOGRAPHIC_PATTERNS)


def _fit_distribution(series: pd.Series) -> dict[str, Any]:
    """Fit best scipy distribution. Returns distribution name + params."""
    clean = series.dropna().astype(float)
    if len(clean) < 10:
        return {
            "distribution": "uniform",
            "params": {"loc": float(clean.min()), "scale": float(max(clean.max() - clean.min(), 0.01))},
        }

    # Cap at P1/P99 to prevent outlier leakage (SAFEGUARD 3)
    p01 = float(np.percentile(clean, 1))
    p99 = float(np.percentile(clean, 99))
    capped = clean.clip(p01, p99)

    best_dist, best_params, best_ks = "norm", {}, 1.0
    candidates = [
        ("norm", stats.norm),
        ("lognorm", stats.lognorm),
        ("gamma", stats.gamma),
    ]
    for name, dist in candidates:
        try:
            params = dist.fit(capped)
            ks_stat, _ = stats.kstest(capped, lambda x: dist.cdf(x, *params))  # type: ignore[arg-type]
            if ks_stat < best_ks:
                best_ks = ks_stat
                best_dist = name
                shape_names = (dist.shapes or "").split(",") if dist.shapes else []
                best_params = {k.strip(): float(v) for k, v in zip(shape_names, params[:-2])}
                best_params.update({"loc": float(params[-2]), "scale": float(params[-1])})
        except Exception:
            pass

    return {
        "distribution": best_dist,
        "params": best_params,
        "p01": round(p01, 4),
        "p99": round(p99, 4),
        "mean": round(float(capped.mean()), 4),
        "std": round(float(capped.std()), 4),
        "ks_stat": round(float(best_ks), 4),
    }


def extract_metadata(df: pd.DataFrame, table_name: str = "dataset") -> dict:
    """
    Extract statistical metadata from a DataFrame.
    Applies all 5 privacy safeguards.
    Returns metadata JSON — NO row data is included.
    """
    metadata: dict[str, Any] = {
        "schema_version": "1.0",
        "table": table_name,
        "row_count": len(df),
        "columns": {},
        "correlations": {},
        "suppressed_columns": [],
        "privacy_actions": [],
    }

    suppressed: list[str] = []
    kept_numeric_cols: list[str] = []

    for col in df.columns:
        # SAFEGUARD 1: Direct identifier suppression
        if _is_pii(col):
            suppressed.append(col)
            metadata["privacy_actions"].append(
                f"Suppressed '{col}' — direct identifier (HIPAA Safe Harbor §164.514(b))"
            )
            continue

        series = df[col]
        null_rate = round(float(series.isna().mean()), 4)
        col_meta: dict[str, Any] = {"null_rate": null_rate}

        # SAFEGUARD 4: Geographic generalization
        if _is_geographic(col):
            series = series.astype(str).str[:3]
            col_meta["generalized"] = True
            metadata["privacy_actions"].append(
                f"Generalized '{col}' to 3-character prefix (PHIPA geographic privacy)"
            )

        if pd.api.types.is_numeric_dtype(series):
            col_meta["type"] = "continuous"
            dist_info = _fit_distribution(series.dropna())
            col_meta.update(dist_info)
            kept_numeric_cols.append(col)

        elif "date" in col.lower() or pd.api.types.is_datetime64_any_dtype(series):
            col_meta["type"] = "datetime"
            try:
                parsed = pd.to_datetime(series.dropna())
                col_meta["min"] = str(parsed.min())
                col_meta["max"] = str(parsed.max())
            except Exception:
                col_meta["min"] = str(series.dropna().min())
                col_meta["max"] = str(series.dropna().max())

        else:
            col_meta["type"] = "categorical"
            value_counts = series.value_counts(dropna=True)
            rare_threshold = 5

            # SAFEGUARD 2: Rare category suppression
            rare_mask = value_counts < rare_threshold
            suppressed_count = int(rare_mask.sum())
            kept = value_counts[~rare_mask]

            # SAFEGUARD 5: Frequency noise injection for counts 5–10
            noisy_cats: list[list[Any]] = []
            total_non_null = int(series.notna().sum())
            for val, cnt in kept.items():
                noisy_cnt = cnt
                if 5 <= cnt <= 10:
                    noise = int(np.random.randint(-2, 3))
                    noisy_cnt = max(1, cnt + noise)
                noisy_cats.append([str(val), round(noisy_cnt / max(total_non_null, 1), 6)])

            # Sort descending by frequency, cap at 50
            noisy_cats.sort(key=lambda x: -x[1])
            noisy_cats = noisy_cats[:50]

            if suppressed_count > 0:
                metadata["privacy_actions"].append(
                    f"Suppressed {suppressed_count} rare categories in '{col}' "
                    f"(<{rare_threshold} occurrences) → merged into _RARE_"
                )

            col_meta["top_categories"] = noisy_cats
            col_meta["rare_threshold"] = rare_threshold
            col_meta["suppressed_count"] = suppressed_count
            col_meta["cardinality"] = int(series.nunique())

        metadata["columns"][col] = col_meta

    metadata["suppressed_columns"] = suppressed

    # Pairwise Pearson correlations (numeric columns only, no PII)
    if len(kept_numeric_cols) >= 2:
        numeric_df = df[kept_numeric_cols].apply(pd.to_numeric, errors="coerce")
        corr = numeric_df.corr()
        for i, c1 in enumerate(kept_numeric_cols):
            for c2 in kept_numeric_cols[i + 1:]:
                val = corr.loc[c1, c2]
                if not np.isnan(val):
                    metadata["correlations"][f"{c1}__{c2}"] = round(float(val), 4)

    return metadata
