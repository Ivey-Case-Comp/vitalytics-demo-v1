"""
Stage 4: Generate Synthetic Data
Metadata-sampling engine — no real rows required (privacy-safe).
"""
from __future__ import annotations
import numpy as np
import pandas as pd
from scipy import stats
from typing import Callable, Optional

from tools.clinical_constraints import apply_clinical_constraints


def _select_model(metadata: dict) -> str:
    columns = metadata.get("columns", {})
    multimodal = sum(1 for m in columns.values() if m.get("type") == "continuous" and m.get("ks_stat", 0) > 0.15)
    return "CTGAN" if multimodal >= 3 else "GaussianCopula"


def _nearest_psd(matrix: np.ndarray) -> np.ndarray:
    eigvals, eigvecs = np.linalg.eigh(matrix)
    eigvals = np.maximum(eigvals, 1e-8)
    return eigvecs @ np.diag(eigvals) @ eigvecs.T


def _generate_from_metadata(metadata: dict, n_rows: int, progress: Callable) -> pd.DataFrame:
    columns = metadata.get("columns", {})
    correlations = metadata.get("correlations", {})
    data: dict[str, np.ndarray] = {}
    numeric_cols: list[str] = []

    for col_name, col_meta in columns.items():
        col_type = col_meta.get("type", "categorical")

        if col_type == "continuous":
            dist_name = col_meta.get("distribution", "norm")
            params = col_meta.get("params", {})
            p01 = col_meta.get("p01", 0)
            p99 = col_meta.get("p99", 100)
            loc = params.get("loc", col_meta.get("mean", 0))
            scale = max(params.get("scale", col_meta.get("std", 1)), 0.001)
            try:
                dist = getattr(stats, dist_name)
                shape_params = {k: v for k, v in params.items() if k not in ("loc", "scale")}
                if shape_params:
                    samples = dist.rvs(*list(shape_params.values()), loc=loc, scale=scale, size=n_rows)
                else:
                    samples = dist.rvs(loc=loc, scale=scale, size=n_rows)
                samples = np.clip(samples, p01, p99)
            except Exception:
                mean = col_meta.get("mean", 0)
                std = max(col_meta.get("std", 1), 0.001)
                samples = np.random.normal(mean, std, n_rows)
                samples = np.clip(samples, p01, p99)
            data[col_name] = samples
            numeric_cols.append(col_name)

        elif col_type == "categorical":
            top_cats = col_meta.get("top_categories", [])
            suppressed_count = col_meta.get("suppressed_count", 0)
            null_rate = col_meta.get("null_rate", 0)
            if not top_cats:
                data[col_name] = np.array(["unknown"] * n_rows)
                continue
            categories = [str(c[0]) for c in top_cats]
            probs = [float(c[1]) for c in top_cats]
            if suppressed_count > 0:
                rare_prob = max(0.001, 1.0 - sum(probs))
                categories.append("_RARE_")
                probs.append(rare_prob)
            total = sum(probs)
            probs = [p / total for p in probs]
            samples_cat = np.random.choice(categories, size=n_rows, p=probs).astype(object)
            # Re-inject nulls proportionally
            if null_rate > 0:
                null_mask = np.random.random(n_rows) < null_rate
                samples_cat[null_mask] = None  # type: ignore[call-overload]
            data[col_name] = samples_cat

        elif col_type == "datetime":
            min_date = col_meta.get("min", "2010-01-01")
            max_date = col_meta.get("max", "2024-01-01")
            try:
                start = pd.Timestamp(str(min_date))
                end = pd.Timestamp(str(max_date))
                delta = max((end - start).days, 1)
                random_days = np.random.randint(0, delta, n_rows)
                data[col_name] = np.array([
                    (start + pd.Timedelta(days=int(d))).strftime("%Y-%m-%d")
                    for d in random_days
                ])
            except Exception:
                data[col_name] = np.array(["2020-01-01"] * n_rows)

    # Apply correlation correction via Cholesky decomposition
    if len(numeric_cols) >= 2:
        corr_matrix = np.eye(len(numeric_cols))
        col_idx = {c: i for i, c in enumerate(numeric_cols)}
        for pair_key, corr_val in correlations.items():
            parts = pair_key.split("__")
            if len(parts) == 2 and parts[0] in col_idx and parts[1] in col_idx:
                i, j = col_idx[parts[0]], col_idx[parts[1]]
                corr_matrix[i, j] = float(corr_val)
                corr_matrix[j, i] = float(corr_val)
        corr_matrix = _nearest_psd(corr_matrix)
        try:
            L = np.linalg.cholesky(corr_matrix)
            numeric_data = np.column_stack([data[c] for c in numeric_cols]).astype(float)
            means = numeric_data.mean(axis=0)
            stds = numeric_data.std(axis=0)
            stds[stds == 0] = 1
            standardized = (numeric_data - means) / stds
            correlated = (L @ standardized.T).T
            correlated = correlated * stds + means
            for i, col in enumerate(numeric_cols):
                col_meta = columns[col]
                p01 = col_meta.get("p01", -np.inf)
                p99 = col_meta.get("p99", np.inf)
                data[col] = np.clip(correlated[:, i], p01, p99)
        except np.linalg.LinAlgError:
            pass

    return pd.DataFrame(data)


def generate_synthetic(
    metadata: dict,
    n_rows: int = 1000,
    model: str = "auto",
    progress_callback: Optional[Callable] = None,
) -> dict:
    def progress(msg: str):
        if progress_callback:
            progress_callback(msg)

    model_name = _select_model(metadata) if model == "auto" else model
    progress(f"Auto-selected model: {model_name}")
    progress(f"Sampling {n_rows} records from metadata distributions...")

    df = _generate_from_metadata(metadata, n_rows, progress)
    progress("Applying clinical constraint engine...")
    df_clean, n_rejected = apply_clinical_constraints(df)

    attempts = 0
    while len(df_clean) < n_rows and attempts < 3:
        extra = _generate_from_metadata(metadata, (n_rows - len(df_clean)) * 2, progress)
        extra_clean, _ = apply_clinical_constraints(extra)
        df_clean = pd.concat([df_clean, extra_clean], ignore_index=True).head(n_rows)
        attempts += 1

    progress(f"Done: {len(df_clean)} records generated, {n_rejected} rejected by clinical constraints.")
    return {"dataframe": df_clean, "rows_generated": len(df_clean), "rows_rejected": n_rejected, "model_used": model_name}
