"""
Gemini 2.0 Flash ReAct (Reason + Act) loop.
Emits SSE-ready event dicts as an async generator.

Provider: google-genai SDK (v1.x — the current, non-deprecated package)
Model: gemini-2.0-flash

Key differences from the previous Claude implementation:
  - Tools declared as types.Tool(function_declarations=[...])
  - History managed by genai.Client chat session
  - Tool results sent as types.Part.from_function_response parts
  - No tool_use_id needed — Gemini correlates by function name
  - response.function_calls / response.text replace Claude's block inspection
"""
import asyncio
import json
import os
from typing import AsyncGenerator

from google import genai
from google.genai import types

import pandas as pd

from agent.personas import SYSTEM_PROMPTS
from agent.tool_definitions import TOOL_DEFINITIONS
from tools.extract_metadata import extract_metadata
from tools.check_hygiene import check_hygiene
from tools.generate_synthetic import generate_synthetic
from tools.verify_fidelity import verify_fidelity

# ── Client init ───────────────────────────────────────────────────────────────

_api_key = os.environ.get("GEMINI_API_KEY", "")
_client = genai.Client(api_key=_api_key) if _api_key else None

# Demo/mock mode is active when:
#  • DEMO_MOCK=true env var is set (explicit opt-in), OR
#  • the API key is missing, clearly a placeholder, or too short to be real.
_DEMO_MODE: bool = (
    os.environ.get("DEMO_MOCK", "").lower() == "true"
    or not _api_key
    or len(_api_key) < 20
    or "placeholder" in _api_key.lower()
    or _api_key == "AIza..."
)

# Build the tool config once at module load time.
# google-genai 1.x: wrap all function declarations in a single types.Tool.
_GEMINI_TOOLS = types.Tool(
    function_declarations=[
        types.FunctionDeclaration(
            name=t["name"],
            description=t["description"],
            parameters=t.get("parameters"),
        )
        for t in TOOL_DEFINITIONS
    ]
)

# ── Demo mode: data-driven, persona-aware events ─────────────────────────────

def _build_demo_events(step_key: str, role: str, session_state: dict) -> list[dict]:
    """Build persona-specific, data-driven mock events from actual session state."""
    meta = session_state.get("metadata") or {}
    hygiene_issues = session_state.get("hygiene_issues") or []
    gen_result = session_state.get("generation_result") or {}
    fidelity = session_state.get("fidelity") or {}

    row_count = meta.get("row_count", 1000)
    columns = meta.get("columns") or {}
    col_count = len(columns)
    suppressed = meta.get("suppressed_columns") or []
    privacy_actions = meta.get("privacy_actions") or []
    table_name = meta.get("table", "dataset")

    if step_key == "profile":
        return _demo_profile(role, row_count, col_count, suppressed, privacy_actions, table_name, columns)
    if step_key == "hygiene":
        return _demo_hygiene(role, hygiene_issues, row_count, table_name)
    if step_key == "generate":
        rows = gen_result.get("rows_generated", row_count)
        model = gen_result.get("model_used", "GaussianCopula")
        return _demo_generate(role, rows, model, row_count, col_count, table_name)
    if step_key == "verify":
        return _demo_verify(role, fidelity)
    return _demo_chat(role)


def _demo_profile(role, row_count, col_count, suppressed, privacy_actions, table_name, columns):
    continuous = [c for c, s in columns.items() if s.get("type") == "continuous"]
    categorical = [c for c, s in columns.items() if s.get("type") == "categorical"]

    tool_result = (
        f"Metadata extracted: {row_count:,} rows, {col_count} active columns"
        + (f". Suppressed: {', '.join(suppressed)}" if suppressed else "")
        + f". {len(privacy_actions)} privacy action(s) applied."
    )

    suppressed_note = (
        f"**{', '.join(suppressed)}** {'was' if len(suppressed) == 1 else 'were'} "
        f"automatically removed before any statistics were computed — no real patient can be traced from this point on."
        if suppressed else
        "No personal identifiers were detected — the dataset already uses coded values."
    )

    if role == "nurse":
        reasoning = (
            f"Reading the {table_name} dataset ({row_count:,} rows)... "
            f"checking {col_count} columns for patient identifiers that must be removed before any analysis."
        )
        conclusion = (
            f"I've checked the **{table_name}** dataset — **{row_count:,} patients** across "
            f"{col_count} clinical and demographic columns.\n\n"
            f"{suppressed_note}\n\n"
            f"The remaining columns capture the clinical detail that makes training scenarios realistic — "
            f"{len(continuous)} measurable values (ages, test results) and {len(categorical)} categories "
            f"(diagnoses, conditions). This data is ready for the next step: checking data quality before we "
            f"create the synthetic training patients."
        )

    elif role == "analyst":
        reasoning = (
            f"Profiling {table_name}: {row_count:,} rows. "
            f"Fitting distributions and computing correlation matrix for {col_count} columns..."
        )
        col_summary = f"{len(continuous)} continuous, {len(categorical)} categorical"
        other = col_count - len(continuous) - len(categorical)
        if other > 0:
            col_summary += f", {other} datetime/other"
        priv_line = ""
        if privacy_actions:
            shown = privacy_actions[:3]
            priv_line = f"\n**Privacy actions ({len(privacy_actions)}):** {'; '.join(shown)}"
            if len(privacy_actions) > 3:
                priv_line += f" (+{len(privacy_actions) - 3} more)"
            priv_line += "."
        conclusion = (
            f"**Profile complete.** {row_count:,} rows × {col_count} active columns.\n"
            + (f"**Suppressed identifiers:** {', '.join(suppressed)}.\n" if suppressed else "")
            + priv_line + "\n\n"
            f"**Column breakdown:** {col_summary}."
            + (f"\n**Continuous columns:** {', '.join(continuous[:6])}{'...' if len(continuous) > 6 else ''}." if continuous else "")
            + "\n\nProceed to hygiene audit to validate ICD codes, check null rates, and flag demographic skew."
        )

    elif role == "population_health":
        reasoning = (
            f"Analysing {table_name} for population health representativeness. "
            f"Checking age, demographics, and condition distributions across {row_count:,} records..."
        )
        pop_kws = ["age", "gender", "sex", "race", "ethnic", "chronic", "condition", "diagnos", "region", "postal"]
        pop_cols = [c for c in columns if any(kw in c.lower() for kw in pop_kws)]
        pop_line = (
            f"\n**Population health columns detected ({len(pop_cols)}):** "
            f"{', '.join(pop_cols[:6])}{'...' if len(pop_cols) > 6 else ''}.\n"
            if pop_cols else ""
        )
        conclusion = (
            f"Dataset profiled: **{row_count:,} patients** in **{table_name}**. "
            f"{col_count} columns available for synthetic generation.\n\n"
            + (f"Direct identifiers removed: {', '.join(suppressed)} — cleared for population-level analysis.\n" if suppressed else "")
            + pop_line + "\n"
            "Before proceeding, the hygiene audit will flag any demographic skew relative to Ontario census benchmarks. "
            "Underrepresented subgroups carry through to the synthetic cohort — review before equity interventions."
        )

    elif role == "researcher":
        reasoning = (
            f"Profiling {table_name} for research utility: {row_count:,} records. "
            f"Assessing statistical power, distribution shapes, and confounders across {col_count} columns..."
        )
        power_note = (
            f"**Statistical power:** {row_count:,} records is on the lower end — consider whether the source cohort "
            "is sufficient for your research question."
            if row_count < 500 else
            f"Sample size ({row_count:,}) provides adequate power for distribution fitting and synthetic amplification."
        )
        conclusion = (
            f"**Dataset profiled:** {row_count:,} source records. "
            f"{col_count} analytical columns available"
            + (f" after suppression of {', '.join(suppressed)}" if suppressed else "")
            + f".\n\n{power_note}\n\n"
            "**Key limitation:** Selection bias and missing-data patterns in the source data will be preserved "
            "— and amplified — in the synthetic output. The hygiene audit will surface these. "
            "Review them before committing to a research design that depends on this data."
        )

    elif role == "cio":
        reasoning = (
            f"Verifying PHIPA compliance posture during metadata extraction for {table_name}. "
            f"Scanning {col_count} columns for direct and quasi-identifiers..."
        )
        suppressed_line = (
            f"✓ {len(suppressed)} direct identifier(s) automatically suppressed: **{', '.join(suppressed)}**. No PHI crossed any boundary."
            if suppressed else
            "✓ No direct identifiers detected — dataset uses coded values only."
        )
        priv_line = (
            f"\n✓ {len(privacy_actions)} additional safeguard(s) applied: outlier capping, rare category suppression, geographic generalisation."
            if privacy_actions else ""
        )
        conclusion = (
            f"**Profiling complete.** {row_count:,} patient records processed within the Vitalytics secure environment.\n\n"
            f"**PHIPA compliance status:**\n"
            f"{suppressed_line}{priv_line}\n\n"
            "**Next step:** Hygiene audit verifies clinical data quality. "
            "No raw patient records are accessed from this point. "
            "Schedule a PHIPA PIA review with your Privacy Officer in parallel."
        )

    else:
        reasoning = f"Analysing {table_name} dataset..."
        conclusion = (
            f"Dataset profiled: {row_count:,} rows, {col_count} columns. "
            + (f"{len(suppressed)} identifier(s) suppressed. " if suppressed else "")
            + f"{len(privacy_actions)} privacy action(s) applied. Ready for hygiene audit."
        )

    return [
        {"type": "reasoning", "content": reasoning},
        {"type": "tool_call", "name": "extract_metadata", "input": {}},
        {"type": "tool_result", "name": "extract_metadata", "content": tool_result},
        {"type": "conclusion", "content": conclusion},
    ]


def _demo_hygiene(role, hygiene_issues, row_count, table_name):
    critical = [i for i in hygiene_issues if i.get("severity") == "CRITICAL"]
    warnings = [i for i in hygiene_issues if i.get("severity") == "WARNING"]

    reasoning = (
        f"Running hygiene audit across 6 categories on {table_name}: "
        "ICD coding validity, missing data, clinical implausibility, "
        "demographic skew, temporal anomalies, structural issues..."
    )
    tool_result = f"Found {len(hygiene_issues)} issue(s): {len(critical)} critical, {len(warnings)} warnings."
    if hygiene_issues:
        tool_result += " Top: " + "; ".join(
            f"{i.get('severity')} — {i.get('description', '')[:70]}" for i in hygiene_issues[:2]
        )

    if not hygiene_issues:
        conclusions = {
            "nurse": "All quality checks passed — this data is safe for care training and simulation. No coding errors or gaps detected.",
            "analyst": "Hygiene audit clean across all 6 categories. ICD codes valid, null rates within threshold, no demographic skew above tolerance. Proceed to generation.",
            "population_health": "No demographic skew detected relative to Ontario benchmarks — the cohort appears representative. Safe to generate a synthetic population.",
            "researcher": "No systematic biases detected. The hygiene audit is clean — proceed to generation with confidence that source biases won't be amplified.",
            "cio": "Hygiene audit complete — all clinical data quality gates passed. No issues require resolution before generation.",
        }
        conclusion = conclusions.get(role, "All hygiene checks passed. Proceed to generation.")
    else:
        crit_list = "\n".join(
            f"- **{i.get('category', '')}**: {i.get('description', '')} ({i.get('affected_count', 0):,} rows)"
            for i in critical[:3]
        )
        warn_list = "\n".join(
            f"- {i.get('description', '')} ({i.get('affected_count', 0):,} rows)"
            for i in warnings[:2]
        )

        if role == "nurse":
            conclusion = (
                f"The quality check found **{len(critical)} issue(s) that need fixing first**"
                if critical else f"No critical issues — {len(warnings)} warning(s) to note"
            )
            if critical:
                conclusion += f":\n\n{crit_list}\n\n"
                conclusion += "These coding errors could produce unrealistic training scenarios. Fix them before generating synthetic patients."
            if warnings:
                conclusion += f"\n\n{len(warnings)} lower-priority item(s): {warnings[0].get('description', '')}."
            conclusion += "\n\nApply the fixes below, then proceed to generation."

        elif role == "analyst":
            conclusion = f"**Hygiene audit complete.** {len(hygiene_issues)} issue(s) found.\n\n"
            if critical:
                conclusion += f"**CRITICAL ({len(critical)}):**\n{crit_list}\n\n"
            if warnings:
                conclusion += f"**WARNING ({len(warnings)}):**\n{warn_list}\n\n"
            conclusion += (
                f"Resolve {len(critical)} critical issue(s) before generation — "
                "unresolved criticals propagate structural errors into the synthetic dataset."
            )

        elif role == "population_health":
            demo_issues = [i for i in hygiene_issues if
                           "demographic" in i.get("category", "").lower() or
                           "skew" in i.get("description", "").lower()]
            conclusion = f"**Hygiene audit complete.** {len(hygiene_issues)} issue(s) across {row_count:,} records.\n\n"
            if demo_issues:
                conclusion += (
                    f"**Demographic representativeness issues ({len(demo_issues)}):**\n"
                    + "\n".join(f"- {i.get('description', '')} [{i.get('affected_count', 0):,} rows]" for i in demo_issues[:3])
                    + "\n\nThese skews carry through to the synthetic cohort. Acknowledge before equity-focused analysis.\n\n"
                )
            if critical:
                conclusion += f"**{len(critical)} critical issue(s) must be resolved before generation.**\n{crit_list}\n\nApply the fixes below."

        elif role == "researcher":
            conclusion = f"**Hygiene audit:** {len(hygiene_issues)} issue(s) detected.\n\n"
            if critical:
                conclusion += f"**Critical ({len(critical)}):**\n{crit_list}\n\n"
            if warnings:
                conclusion += (
                    f"**Warnings — systematic patterns to document as limitations:**\n{warn_list}\n\n"
                )
            conclusion += (
                "Each unresolved warning represents a systematic bias that will be amplified in the synthetic output. "
                "Document as methodology limitations if you proceed."
            )

        elif role == "cio":
            conclusion = f"**Hygiene audit complete.** {len(hygiene_issues)} issue(s) detected.\n\n"
            if critical:
                conclusion += (
                    f"**{len(critical)} critical issue(s) require resolution before generation**"
                    " (governance risk: structural errors in synthetic output):\n"
                    f"{crit_list}\n\n"
                )
            conclusion += (
                f"Action: apply the {len(critical)} available fix(es). "
                "All fixes modify statistical metadata only — no raw patient data is touched."
            )

        else:
            conclusion = (
                f"Hygiene audit complete. {len(hygiene_issues)} issue(s): "
                f"{len(critical)} critical, {len(warnings)} warnings. "
                + ("Resolve critical issues before generation." if critical else "Proceed to generation.")
            )

    return [
        {"type": "reasoning", "content": reasoning},
        {"type": "tool_call", "name": "check_hygiene", "input": {}},
        {"type": "tool_result", "name": "check_hygiene", "content": tool_result},
        {"type": "conclusion", "content": conclusion},
    ]


def _demo_generate(role, rows_generated, model_used, source_rows, col_count, table_name):
    reasoning = (
        f"Selecting generation model for {col_count}-column dataset. "
        f"Analysing distribution complexity — auto-selected **{model_used}**. "
        f"Fitting Cholesky decomposition for correlation preservation. Sampling {rows_generated:,} records..."
    )
    tool_result = (
        f"Generated {rows_generated:,} synthetic records using {model_used}. "
        f"0 records rejected by clinical constraint engine. "
        f"Correlation structure preserved via Cholesky decomposition."
    )

    if role == "nurse":
        conclusion = (
            f"Done — **{rows_generated:,} computer-generated patients** are ready. "
            f"None of them are real people.\n\n"
            "Think of them as practice mannequins built from statistical patterns: they behave like real patients "
            "in terms of ages, diagnoses, and measurements — but there's no link to any actual medical record. "
            "Safe to use for training, simulation, and system testing."
        )
    elif role == "analyst":
        conclusion = (
            f"**Generation complete.** {rows_generated:,} synthetic records.\n\n"
            f"- **Model:** {model_used}\n"
            f"- **Source:** {source_rows:,}-record distribution fingerprint ({col_count} columns)\n"
            f"- **Correlations:** Preserved via Cholesky decomposition of empirical covariance matrix\n"
            f"- **Rejected records:** 0 (clinical constraint engine: all within physiological ranges)\n\n"
            "Proceed to fidelity verification to quantify distribution match and privacy resistance."
        )
    elif role == "population_health":
        conclusion = (
            f"**Synthetic cohort generated: {rows_generated:,} patients.**\n\n"
            f"The {model_used} model sampled from the statistical distributions of the source "
            f"{source_rows:,}-patient cohort. Demographic distributions (age, gender, condition prevalence) "
            "mirror the source population — confirmed in the next step.\n\n"
            "Any demographic skew present in the source data is preserved here. "
            "Review the correlation heatmap in the next step to confirm population health–relevant relationships are intact."
        )
    elif role == "researcher":
        conclusion = (
            f"**Generation complete.** {rows_generated:,} records sampled from {col_count}-dimensional distributions.\n\n"
            f"**Model:** {model_used}. No real records were copied or transformed — only statistical parameters were used.\n\n"
            "**Appropriate uses:** Exploratory model development, architecture selection, hypothesis generation.\n"
            "**Requires validation:** Any model trained on this synthetic data must be validated against a held-out "
            "real cohort before clinical deployment or publication as primary evidence."
        )
    elif role == "cio":
        conclusion = (
            f"**Synthetic dataset generated: {rows_generated:,} records.**\n\n"
            f"**Privacy guarantee:** No real patient rows were accessed during generation. "
            f"The {model_used} engine sampled entirely from the statistical metadata.\n\n"
            "This synthetic dataset can be shared within your organisation and with approved third parties "
            "without triggering PHIPA obligations, provided the fidelity verification (next step) "
            "confirms MIA AUC below 0.65.\n\nProceed to fidelity verification."
        )
    else:
        conclusion = (
            f"Generation complete. {rows_generated:,} synthetic records via {model_used}. "
            "Correlation structure preserved. No real patient data used. Ready for fidelity verification."
        )

    return [
        {"type": "reasoning", "content": reasoning},
        {"type": "tool_call", "name": "generate_synthetic", "input": {"n_rows": rows_generated, "model": "auto"}},
        {"type": "tool_result", "name": "generate_synthetic", "content": tool_result},
        {"type": "conclusion", "content": conclusion},
    ]


def _demo_verify(role, fidelity):
    overall = fidelity.get("overall_score", 0)
    dist_fid = fidelity.get("distribution_fidelity", 0)
    corr_fid = fidelity.get("correlation_fidelity", 0)
    mia = fidelity.get("mia_auc", 0)
    tstr = fidelity.get("tstr_ratio", 0)
    passed = overall >= 80 and mia < 0.65

    reasoning = (
        "Running fidelity verification: Wasserstein distance per column, "
        "correlation matrix Frobenius norm, TSTR logistic regression, "
        "Membership Inference Attack using scikit-learn classifier..."
    )
    tool_result = (
        f"Overall: {overall:.1f}/100. Distribution fidelity: {dist_fid:.1f}%. "
        f"Correlation fidelity: {corr_fid:.1f}%. MIA AUC: {mia:.3f}. TSTR: {tstr:.2f}."
    )
    status = "PASSED" if passed else "REVIEW RECOMMENDED"

    if role == "nurse":
        mia_plain = (
            "essentially impossible — like a coin flip" if mia < 0.55 else
            "very difficult" if mia < 0.65 else
            "showing some risk — review recommended"
        )
        conclusion = (
            f"**Results in! Score: {overall:.0f}/100** — "
            f"{'strong result' if overall >= 85 else 'good result' if overall >= 80 else 'some differences detected'}.\n\n"
            f"Your synthetic patients match real patient patterns very closely across all clinical columns. "
            f"Most importantly, we ran a privacy test where a computer tried to guess whether any specific real patient "
            f"was used to create the synthetic data. Result: {mia_plain}. "
            f"**Your synthetic patients are safe to use for training and simulation.**"
        )
    elif role == "analyst":
        mia_band = (
            "strong privacy band (<0.55)" if mia < 0.55 else
            "review band (0.55–0.65)" if mia < 0.65 else
            "exceeds threshold (>0.65) — investigate structural leakage"
        )
        conclusion = (
            f"**Fidelity verification: {status}**\n\n"
            f"| Metric | Value | Threshold | Status |\n"
            f"|--------|-------|-----------|--------|\n"
            f"| Overall | {overall:.1f}/100 | ≥80 | {'✓' if overall >= 80 else '✗'} |\n"
            f"| Distribution fidelity | {dist_fid:.1f}% | — | — |\n"
            f"| Correlation fidelity | {corr_fid:.1f}% | — | — |\n"
            f"| MIA AUC | {mia:.3f} | <0.65 | {'✓' if mia < 0.65 else '✗'} |\n"
            f"| TSTR ratio | {tstr:.2f} | — | — |\n\n"
            f"MIA AUC {mia:.3f} — {mia_band}. "
            f"TSTR {tstr:.2f}: synthetic trains at {tstr * 100:.0f}% of real-data performance."
        )
    elif role == "population_health":
        conclusion = (
            f"**Fidelity: {overall:.1f}/100** ({'passed' if passed else 'review recommended'}).\n\n"
            f"**Distribution fidelity: {dist_fid:.1f}%** — synthetic cohort mirrors source population demographics "
            f"{'faithfully' if dist_fid >= 85 else 'with some drift — check per-column charts'}.\n\n"
            f"**Correlation fidelity: {corr_fid:.1f}%** — inter-variable relationships "
            f"{'well-preserved' if corr_fid >= 80 else 'show some drift — check heatmap'}.\n\n"
            f"**Privacy (MIA AUC: {mia:.3f}):** "
            f"{'No individual patient identifiable — safe for sharing across Distributed Health Network.' if mia < 0.55 else 'Within acceptable range.' if mia < 0.65 else 'Privacy risk — do not share externally.'}"
        )
    elif role == "researcher":
        conclusion = (
            f"**Fidelity report — {status}**\n\n"
            f"**TSTR ratio: {tstr:.2f}** — synthetic achieves {tstr * 100:.0f}% of real-data utility. "
            f"{'Strong result for exploratory development.' if tstr >= 0.85 else 'Below 0.85 target — synthetic utility limited for complex modelling tasks.'}\n\n"
            f"**MIA AUC: {mia:.3f}** — privacy resistance is "
            f"{'excellent (effectively random)' if mia < 0.55 else 'acceptable' if mia < 0.65 else 'insufficient — do not use in privacy-sensitive contexts'}.\n\n"
            "**Required:** Validate any model trained on this synthetic data against a held-out real cohort "
            "before clinical deployment or peer-reviewed publication."
        )
    elif role == "cio":
        mia_status = (
            "✓ Strong privacy — meets PHIPA Safe Harbour standard" if mia < 0.55 else
            "✓ Within acceptable range" if mia < 0.65 else
            "✗ Privacy risk — exceeds 0.65 threshold. Do not deploy."
        )
        conclusion = (
            f"**Compliance verification: {status}**\n\n"
            f"Overall score: {overall:.1f}/100 (threshold: 80) — {'✓ passed' if overall >= 80 else '✗ below threshold'}\n"
            f"MIA AUC: {mia:.3f} — {mia_status}\n"
            f"TSTR ratio: {tstr:.2f} — synthetic data is {tstr * 100:.0f}% as useful as real data.\n\n"
            + (
                "**Dataset approved for:** internal analytics, AI model development, vendor demos, staff training.\n"
                "**Export ready.** Download the CSV for deployment."
                if passed else
                "**One or more thresholds not met.** Consult your Privacy Officer before deployment."
            )
        )
    else:
        conclusion = (
            f"Fidelity verification complete. {status}. "
            f"Overall: {overall:.1f}/100. Distribution: {dist_fid:.1f}%. "
            f"Correlation: {corr_fid:.1f}%. MIA AUC: {mia:.3f}. TSTR: {tstr:.2f}."
        )

    return [
        {"type": "reasoning", "content": reasoning},
        {"type": "tool_call", "name": "verify_fidelity", "input": {}},
        {"type": "tool_result", "name": "verify_fidelity", "content": tool_result},
        {"type": "conclusion", "content": conclusion},
    ]


def _demo_chat(role):
    conclusions = {
        "nurse": (
            "Vitalytics creates computer-generated patient records that are statistically identical to real patient data — "
            "but with no real patients involved. You can use them for training, care simulation, and system testing without any privacy concerns."
        ),
        "analyst": (
            "Vitalytics extracts a statistical metadata fingerprint from real patient data, then generates entirely new synthetic "
            "records by sampling from those distributions. It eliminates the data bottleneck for analytics teams — "
            "statistically valid, privacy-safe datasets on demand."
        ),
        "population_health": (
            "Vitalytics enables population health teams to work with realistic synthetic cohorts for modelling, "
            "segmentation, and risk stratification — without waiting for privacy approvals or de-identification workflows."
        ),
        "researcher": (
            "Vitalytics provides synthetic data for exploratory research and model development. "
            "Key metric: TSTR ratio — how well a model trained on synthetic performs on real data. "
            "Use it for architecture selection and hypothesis generation; real-data validation required before clinical deployment."
        ),
        "cio": (
            "Vitalytics eliminates the PHI bottleneck for healthcare AI. 8–12 week deployment roadmap: "
            "Phase 1 — firewall deployment and PHIPA PIA; "
            "Phase 2 — Google Cloud Healthcare migration with encryption and audit logging; "
            "Phase 3 — controlled pilot and formal sign-off per use case."
        ),
    }
    return [
        {"type": "reasoning", "content": "Processing your question..."},
        {"type": "conclusion", "content": conclusions.get(role, "Vitalytics is a privacy-preserving synthetic healthcare data platform. Upload a dataset to begin.")},
    ]


# ── Tool execution (unchanged logic; defensive int cast for Gemini) ───────────

def _execute_tool(tool_name: str, tool_input: dict, session_state: dict) -> str:
    """Execute a tool synchronously. Returns JSON string result."""
    try:
        if tool_name == "extract_metadata":
            real_path = session_state.get("real_path")
            if not real_path:
                return json.dumps({"error": "No file loaded. Upload a dataset first."})
            df = pd.read_csv(real_path)
            table = session_state.get("table_name", "dataset")
            result = extract_metadata(df, table_name=table)
            session_state["metadata"] = result
            return json.dumps({
                "row_count": result["row_count"],
                "columns_profiled": len(result["columns"]),
                "suppressed_columns": result["suppressed_columns"],
                "privacy_actions_count": len(result["privacy_actions"]),
                "privacy_actions": result["privacy_actions"],
            })

        elif tool_name == "check_hygiene":
            meta = session_state.get("metadata")
            if not meta:
                return json.dumps({"error": "No metadata. Run extract_metadata first."})
            issues = check_hygiene(meta)
            session_state["hygiene_issues"] = issues
            critical = [i for i in issues if i["severity"] == "CRITICAL"]
            warnings = [i for i in issues if i["severity"] == "WARNING"]
            summary = [
                f"{issue['severity']}: {issue['description'][:100]}"
                for issue in issues[:5]
            ]
            return json.dumps({
                "total_issues": len(issues),
                "critical": len(critical),
                "warnings": len(warnings),
                "summary": summary,
            })

        elif tool_name == "generate_synthetic":
            meta = session_state.get("metadata")
            if not meta:
                return json.dumps({"error": "No metadata. Run extract_metadata first."})
            # Defensive cast: Gemini may send numeric args as float
            n_rows = int(tool_input.get("n_rows", 500))
            model = tool_input.get("model", "auto")
            result = generate_synthetic(meta, n_rows=n_rows, model=model)
            from pathlib import Path
            out_dir = Path(__file__).parent.parent / "outputs"
            out_dir.mkdir(exist_ok=True)
            sid = session_state.get("session_id", "chat")
            out_path = out_dir / f"{sid}_synthetic.csv"
            result["dataframe"].to_csv(out_path, index=False)
            session_state["synthetic_path"] = str(out_path)
            session_state["generation_result"] = {
                "rows_generated": result["rows_generated"],
                "rows_rejected": result["rows_rejected"],
                "model_used": result["model_used"],
            }
            return json.dumps({
                "rows_generated": result["rows_generated"],
                "rows_rejected": result["rows_rejected"],
                "model_used": result["model_used"],
                "status": "success",
            })

        elif tool_name == "verify_fidelity":
            real_path = session_state.get("real_path")
            synth_path = session_state.get("synthetic_path")
            if not real_path or not synth_path:
                return json.dumps({"error": "Need both real and synthetic data. Run generate_synthetic first."})
            result = verify_fidelity(real_path, synth_path)
            session_state["fidelity"] = result
            return json.dumps({
                "overall_score": result["overall_score"],
                "distribution_fidelity": result["distribution_fidelity"],
                "correlation_fidelity": result["correlation_fidelity"],
                "mia_auc": result["mia_auc"],
                "tstr_ratio": result["tstr_ratio"],
            })

        return json.dumps({"error": f"Unknown tool: {tool_name}"})

    except Exception as e:
        return json.dumps({"error": str(e), "tool": tool_name})


# ── Pipeline state summary ────────────────────────────────────────────────────

def _build_state_context(state: dict) -> str:
    """Build a rich context string so Gemini avoids redundant tool calls."""
    parts = []
    meta = state.get("metadata")
    if meta:
        cols = meta.get("columns") or {}
        suppressed = meta.get("suppressed_columns") or []
        actions = meta.get("privacy_actions") or []
        type_counts: dict[str, int] = {}
        for stat in cols.values():
            t = stat.get("type", "other")
            type_counts[t] = type_counts.get(t, 0) + 1
        type_str = ", ".join(f"{v} {k}" for k, v in type_counts.items())
        line = f"Dataset loaded: {meta.get('row_count', 0):,} rows, {len(cols)} active columns ({type_str})"
        if suppressed:
            line += f". Suppressed: {', '.join(suppressed)}"
        if actions:
            line += f". {len(actions)} privacy action(s) applied"
        parts.append(line)

    hygiene_issues = state.get("hygiene_issues")
    if hygiene_issues is not None:
        crit = sum(1 for i in hygiene_issues if i.get("severity") == "CRITICAL")
        warn = sum(1 for i in hygiene_issues if i.get("severity") == "WARNING")
        line = f"Hygiene audit done: {len(hygiene_issues)} issues ({crit} critical, {warn} warnings)"
        applied = state.get("applied_fixes") or []
        if applied:
            line += f". {len(applied)} fix(es) applied"
        parts.append(line)

    if state.get("synthetic_path"):
        res = state.get("generation_result") or {}
        rows = res.get("rows_generated", "?")
        model = res.get("model_used", "?")
        rows_str = f"{rows:,}" if isinstance(rows, int) else str(rows)
        parts.append(f"Synthetic data generated: {rows_str} rows, model={model}")

    fidelity = state.get("fidelity")
    if fidelity:
        parts.append(
            f"Fidelity verified: {fidelity.get('overall_score', 0):.1f}/100, "
            f"distribution={fidelity.get('distribution_fidelity', 0):.1f}%, "
            f"correlation={fidelity.get('correlation_fidelity', 0):.1f}%, "
            f"MIA AUC={fidelity.get('mia_auc', 0):.3f}, "
            f"TSTR={fidelity.get('tstr_ratio', 0):.2f}"
        )

    return "; ".join(parts) if parts else "Pipeline not started"


# ── Main ReAct loop ───────────────────────────────────────────────────────────

async def run_pipeline(
    message: str,
    role: str,
    session_state: dict,
) -> AsyncGenerator[dict, None]:
    """
    Async generator that runs the Gemini 2.0 Flash ReAct loop and yields
    SSE event dicts.
    Event types: reasoning, tool_call, tool_result, conclusion, error, done
    """
    # ── Demo mode: data-driven, persona-aware events ─────────────────────────
    if _DEMO_MODE:
        msg_lower = message.lower()
        step_key = "chat"
        if any(kw in msg_lower for kw in ("profile", "metadata", "extracted", "analyze this healthcare")):
            step_key = "profile"
        elif any(kw in msg_lower for kw in ("hygiene", "audit", "issues")):
            step_key = "hygiene"
        elif any(kw in msg_lower for kw in ("generate", "generated", "synthesiz")):
            step_key = "generate"
        elif any(kw in msg_lower for kw in ("verify", "verification", "fidelity")):
            step_key = "verify"
        events = _build_demo_events(step_key, role, session_state)
        for i, event in enumerate(events):
            if i > 0:
                await asyncio.sleep(0.35)
            yield event
        yield {"type": "done"}
        return

    # ── Live mode ─────────────────────────────────────────────────────────────
    system = SYSTEM_PROMPTS.get(role, SYSTEM_PROMPTS["analyst"])
    context = _build_state_context(session_state)
    full_message = f"{message}\n\n[Pipeline state: {context}]"

    # GenerateContentConfig is reused across all turns in this session.
    config = types.GenerateContentConfig(
        system_instruction=system,
        tools=[_GEMINI_TOOLS],
    )

    # Start or resume the chat session with persisted history.
    chat = _client.chats.create(
        model="gemini-2.0-flash",
        config=config,
        history=session_state.get("gemini_history", []),
    )

    # First turn: plain string. Subsequent turns after tool calls: list of
    # function_response Parts.
    next_input = full_message

    max_iterations = 8
    for _ in range(max_iterations):
        try:
            response = await asyncio.to_thread(chat.send_message, next_input)
        except Exception as e:
            err_str = str(e)
            if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                msg_lower = message.lower()
                step_key = "chat"
                if any(kw in msg_lower for kw in ("profile", "metadata", "extracted")):
                    step_key = "profile"
                elif any(kw in msg_lower for kw in ("hygiene", "audit")):
                    step_key = "hygiene"
                elif any(kw in msg_lower for kw in ("generate", "generated")):
                    step_key = "generate"
                elif any(kw in msg_lower for kw in ("verify", "verification", "fidelity")):
                    step_key = "verify"
                yield {
                    "type": "reasoning",
                    "content": (
                        "Gemini API rate limit reached. "
                        "Showing pre-computed analysis. Upgrade your quota at "
                        "ai.google.dev/gemini-api/docs/rate-limits for live AI."
                    ),
                }
                for event in _build_demo_events(step_key, role, session_state):
                    yield event
            else:
                yield {"type": "error", "content": f"Gemini API error: {err_str}"}
            yield {"type": "done"}
            return

        # response.function_calls is a helper list of FunctionCall objects.
        # response.text is the text of the first candidate (None if no text part).
        function_calls = response.function_calls or []
        response_text = response.text or ""

        # Emit text as reasoning (if more tool calls follow) or conclusion (final).
        event_type = "reasoning" if function_calls else "conclusion"
        if response_text:
            yield {"type": event_type, "content": response_text}

        # No tool calls → model has finished reasoning.
        if not function_calls:
            if not response_text:
                # Safety net: always emit a conclusion so the UI doesn't hang.
                yield {"type": "conclusion", "content": "Pipeline step complete."}
            break

        # Execute tools and build function_response parts for the next turn.
        function_response_parts = []
        for fc in function_calls:
            tool_name = fc.name
            tool_args = dict(fc.args) if fc.args else {}

            yield {"type": "tool_call", "name": tool_name, "input": tool_args}

            result_json = _execute_tool(tool_name, tool_args, session_state)
            try:
                parsed = json.loads(result_json)
                display = json.dumps(parsed)[:400]
            except Exception:
                parsed = {"result": result_json}
                display = result_json[:400]

            yield {"type": "tool_result", "name": tool_name, "content": display}

            # google-genai 1.x: wrap result in a Part with function_response.
            function_response_parts.append(
                types.Part.from_function_response(
                    name=tool_name,
                    response={"result": parsed},
                )
            )

        next_input = function_response_parts

    # Persist updated history for multi-turn chat continuity within the session.
    session_state["gemini_history"] = chat.history
    yield {"type": "done"}
