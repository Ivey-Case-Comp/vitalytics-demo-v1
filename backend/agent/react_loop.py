"""
Claude ReAct (Reason + Act) loop.
Emits SSE-ready event dicts as an async generator.
Uses synchronous messages.create (no streaming) — simpler and reliable for demo.
"""
import json
import os
from typing import AsyncGenerator

import anthropic
import pandas as pd

from agent.personas import SYSTEM_PROMPTS
from agent.tool_definitions import TOOL_DEFINITIONS
from tools.extract_metadata import extract_metadata
from tools.check_hygiene import check_hygiene
from tools.generate_synthetic import generate_synthetic
from tools.verify_fidelity import verify_fidelity

_client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", ""))

# Pre-baked mock events for DEMO_MOCK=true mode (fallback if API unavailable)
MOCK_EVENTS = {
    "profile": [
        {"type": "reasoning", "content": "Analyzing the dataset schema... I can see 17 columns including demographic, clinical, and administrative data."},
        {"type": "tool_call", "name": "extract_metadata", "input": {}},
        {"type": "tool_result", "name": "extract_metadata", "content": "Metadata extracted: 1000 rows, 16 columns (SSN suppressed). Privacy actions applied."},
        {"type": "conclusion", "content": "I've profiled the dataset. Key findings: 1,000 patient records across 16 clinical and demographic columns. The SSN column was automatically suppressed as a direct identifier — no patient identifiers cross the privacy boundary. Age follows a log-normal distribution (mean 52 years), BMI shows a bimodal distribution suggesting a mixed healthy/obese population. Ready to proceed to hygiene audit."},
    ],
    "hygiene": [
        {"type": "reasoning", "content": "Running hygiene audit across 6 categories..."},
        {"type": "tool_call", "name": "check_hygiene", "input": {}},
        {"type": "tool_result", "name": "check_hygiene", "content": "Found issues: CRITICAL — 30 rows with invalid ICD code 'ZZZ999'. WARNING — 15 rows with missing ICD_PRIMARY."},
        {"type": "conclusion", "content": "Hygiene audit complete. I found 2 significant issues:\n\n**CRITICAL**: 30 records contain 'ZZZ999' in ICD_PRIMARY — this is not a valid ICD-10 code (format: letter + 2 digits + optional decimal). If these propagate into synthetic data, they will create clinically invalid patients. I recommend replacing them with '_RARE_' before generation.\n\n**WARNING**: 15 records have missing ICD_PRIMARY values (1.5% null rate). This is within acceptable range but worth noting.\n\nI recommend approving the ICD fix before proceeding to generation."},
    ],
    "generate": [
        {"type": "reasoning", "content": "Selecting generation model... BMI shows bimodal distribution (KS stat 0.18), AGE is log-normal (KS 0.06). Auto-selecting GaussianCopula."},
        {"type": "tool_call", "name": "generate_synthetic", "input": {"n_rows": 1000, "model": "auto"}},
        {"type": "tool_result", "name": "generate_synthetic", "content": "Generated 1000 records, 0 rejected. Model: GaussianCopula."},
        {"type": "conclusion", "content": "Synthetic data generation complete. Generated 1,000 new patient records using the GaussianCopula model. Correlation structure preserved via Cholesky decomposition (AGE–BMI r=0.31, BMI–SYSTOLIC_BP r=0.28). Clinical constraint engine applied — 0 records rejected. No real patient data was used in this process; all records were sampled from the statistical metadata."},
    ],
    "verify": [
        {"type": "reasoning", "content": "Running fidelity verification: Wasserstein distance per column, correlation matrix comparison, MIA resistance test..."},
        {"type": "tool_call", "name": "verify_fidelity", "input": {}},
        {"type": "tool_result", "name": "verify_fidelity", "content": "Overall: 91/100. Distribution fidelity: 93%. Correlation fidelity: 88%. MIA AUC: 0.51."},
        {"type": "conclusion", "content": "Fidelity verification complete. **Overall score: 91/100.**\n\n- Distribution fidelity: 93% — synthetic patients follow the same statistical patterns as real patients across all clinical columns.\n- Correlation fidelity: 88% — inter-variable relationships (e.g., AGE→BP, BMI→GLUCOSE) are preserved.\n- MIA AUC: 0.51 — essentially random chance, meaning no real patient record can be inferred from the synthetic data. This is the gold-standard privacy test.\n- TSTR ratio: 0.93 — a model trained on this synthetic data performs at 93% of one trained on real data.\n\nThis dataset is ready for population analytics, digital twin development, and AI model prototyping."},
    ],
    "chat": [
        {"type": "reasoning", "content": "Processing your question..."},
        {"type": "conclusion", "content": "Vitalytics eliminates the data bottleneck that blocks healthcare AI innovation. By converting real patient statistics into a metadata fingerprint and generating entirely new synthetic patients from that fingerprint, we achieve full statistical fidelity without any PHI exposure. The 8-week deployment roadmap gets Southlake from prototype to production with real patient data through parallel compliance and technical work — no rebuild required."},
    ],
}


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
            summary = []
            for issue in issues[:5]:
                summary.append(f"{issue['severity']}: {issue['description'][:100]}")
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
            n_rows = tool_input.get("n_rows", 500)
            model = tool_input.get("model", "auto")
            result = generate_synthetic(meta, n_rows=n_rows, model=model)
            # Save synthetic data to session
            import tempfile, os
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


def _build_state_context(state: dict) -> str:
    parts = []
    if state.get("metadata"):
        m = state["metadata"]
        parts.append(f"Dataset loaded: {m.get('row_count')} rows, {len(m.get('columns', {}))} columns")
    if state.get("hygiene_issues") is not None:
        n = len(state["hygiene_issues"])
        crit = sum(1 for i in state["hygiene_issues"] if i.get("severity") == "CRITICAL")
        parts.append(f"Hygiene audit done: {n} issues ({crit} critical)")
        # Include applied fixes
        applied = state.get("applied_fixes", [])
        if applied:
            parts.append(f"Fixes applied: {len(applied)} hygiene fixes approved by user")
    if state.get("synthetic_path"):
        res = state.get("generation_result", {})
        parts.append(f"Synthetic data generated: {res.get('rows_generated', '?')} rows, model={res.get('model_used', '?')}")
    if state.get("fidelity"):
        f = state["fidelity"]
        parts.append(f"Fidelity verified: {f.get('overall_score')}/100, MIA AUC={f.get('mia_auc')}")
    return "; ".join(parts) if parts else "Pipeline not started"


async def run_pipeline(
    message: str,
    role: str,
    session_state: dict,
) -> AsyncGenerator[dict, None]:
    """
    Async generator that runs the Claude ReAct loop and yields SSE event dicts.
    Event types: reasoning, tool_call, tool_result, conclusion, error, done
    """
    # Mock mode: return pre-baked events if DEMO_MOCK=true
    if os.environ.get("DEMO_MOCK", "").lower() == "true":
        step_key = "chat"
        for key in ["profile", "hygiene", "generate", "verify"]:
            if key in message.lower():
                step_key = key
                break
        for event in MOCK_EVENTS.get(step_key, MOCK_EVENTS["chat"]):
            yield event
        yield {"type": "done"}
        return

    system = SYSTEM_PROMPTS.get(role, SYSTEM_PROMPTS["analyst"])
    context = _build_state_context(session_state)
    full_message = f"{message}\n\n[Pipeline state: {context}]"

    conversation = session_state.get("conversation", [])
    conversation.append({"role": "user", "content": full_message})

    max_iterations = 8
    for _ in range(max_iterations):
        try:
            response = _client.messages.create(
                model="claude-opus-4-6",
                max_tokens=2048,
                system=system,
                tools=TOOL_DEFINITIONS,  # type: ignore[arg-type]
                messages=conversation,
            )
        except Exception as e:
            yield {"type": "error", "content": f"Claude API error: {str(e)}"}
            yield {"type": "done"}
            return

        tool_blocks = []
        for block in response.content:
            if block.type == "text":
                event_type = "conclusion" if response.stop_reason == "end_turn" else "reasoning"
                yield {"type": event_type, "content": block.text}
            elif block.type == "tool_use":
                yield {"type": "tool_call", "name": block.name, "input": block.input}
                tool_blocks.append(block)

        if response.stop_reason == "end_turn":
            conversation.append({"role": "assistant", "content": response.content})
            session_state["conversation"] = conversation
            break

        if response.stop_reason == "tool_use":
            conversation.append({"role": "assistant", "content": response.content})
            tool_results = []
            for tb in tool_blocks:
                result_content = _execute_tool(tb.name, tb.input, session_state)  # type: ignore[arg-type]
                # Emit truncated result for UI
                try:
                    parsed = json.loads(result_content)
                    display = json.dumps(parsed, indent=None)[:400]
                except Exception:
                    display = result_content[:400]
                yield {"type": "tool_result", "name": tb.name, "content": display}
                tool_results.append({"type": "tool_result", "tool_use_id": tb.id, "content": result_content})
            conversation.append({"role": "user", "content": tool_results})

    session_state["conversation"] = conversation
    yield {"type": "done"}
