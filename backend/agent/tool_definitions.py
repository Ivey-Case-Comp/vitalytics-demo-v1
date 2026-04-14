"""Tool schemas for the Claude API tool-use loop."""

TOOL_DEFINITIONS = [
    {
        "name": "extract_metadata",
        "description": (
            "Ingest the uploaded healthcare dataset and extract a statistical metadata profile. "
            "Applies all 5 privacy safeguards: (1) direct identifier suppression, "
            "(2) rare category suppression (<5 occurrences), (3) extreme value capping at P1/P99, "
            "(4) geographic generalization to 3-digit prefix, (5) frequency noise injection. "
            "Original row data is NOT included in the output — only aggregate statistics. "
            "Call this first before any other tool."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "check_hygiene",
        "description": (
            "Audit the current session metadata for data quality issues across 6 categories: "
            "(1) ICD coding validity — detects invalid codes like 'ZZZ999' that violate ICD-10 format, "
            "(2) missing data patterns — flags columns with >5% nulls, "
            "(3) clinical implausibility — detects values outside medically valid ranges, "
            "(4) demographic skew — compares distributions to Ontario census benchmarks, "
            "(5) temporal anomalies — checks date ordering constraints, "
            "(6) structural issues — high cardinality quasi-identifiers. "
            "For each issue, returns severity (CRITICAL/WARNING/INFO), affected row count, "
            "and a proposed metadata fix. Call this after extract_metadata."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "generate_synthetic",
        "description": (
            "Generate synthetic patient records by sampling from the metadata distributions. "
            "Automatically selects the best model: GaussianCopula for standard distributions, "
            "CTGAN when 3+ columns have complex/multimodal distributions. "
            "Applies Cholesky decomposition to preserve inter-column correlations. "
            "Runs a clinical constraint engine post-generation to reject medically implausible records. "
            "Returns row counts and model selection rationale. "
            "Call this after check_hygiene (with or without applied fixes)."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "n_rows": {
                    "type": "integer",
                    "description": "Number of synthetic records to generate. Default 1000.",
                },
                "model": {
                    "type": "string",
                    "enum": ["auto", "GaussianCopula", "CTGAN"],
                    "description": "SDV model. 'auto' selects based on distribution complexity.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "verify_fidelity",
        "description": (
            "Compare synthetic data against the original dataset and compute fidelity + privacy scores. "
            "Metrics: column-wise Wasserstein distance (distribution fidelity), "
            "Pearson correlation matrix preservation (structural fidelity), "
            "TSTR ratio (utility — train on synthetic, test on real), "
            "MIA AUC (Membership Inference Attack resistance — AUC near 0.50 = strong privacy). "
            "Returns an overall score 0–100 and per-dimension breakdown. "
            "Call this after generate_synthetic."
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
]
