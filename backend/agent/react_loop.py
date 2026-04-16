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

# ── Pre-baked mock events for demo mode ──────────────────────────────────────

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
    parts = []
    if state.get("metadata"):
        m = state["metadata"]
        parts.append(f"Dataset loaded: {m.get('row_count')} rows, {len(m.get('columns', {}))} columns")
    if state.get("hygiene_issues") is not None:
        n = len(state["hygiene_issues"])
        crit = sum(1 for i in state["hygiene_issues"] if i.get("severity") == "CRITICAL")
        parts.append(f"Hygiene audit done: {n} issues ({crit} critical)")
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
    # ── Demo mode: return pre-baked events, no API call ──────────────────────
    if _DEMO_MODE:
        step_key = "chat"
        for key in ["profile", "hygiene", "generate", "verify"]:
            if key in message.lower():
                step_key = key
                break
        for event in MOCK_EVENTS.get(step_key, MOCK_EVENTS["chat"]):
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
                # Daily free-tier quota exhausted — degrade gracefully to mock events.
                step_key = "chat"
                for key in ["profile", "hygiene", "generate", "verify"]:
                    if key in message.lower():
                        step_key = key
                        break
                yield {
                    "type": "reasoning",
                    "content": (
                        "Gemini API rate limit reached (free-tier quota exhausted). "
                        "Showing pre-written demo response. Upgrade your quota at "
                        "ai.google.dev/gemini-api/docs/rate-limits for live AI analysis."
                    ),
                }
                for event in MOCK_EVENTS.get(step_key, MOCK_EVENTS["chat"]):
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
