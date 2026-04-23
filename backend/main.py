import sys
import uuid
import asyncio
import json
import os
from pathlib import Path

# Ensure backend/ is on sys.path so that `from tools.x import ...` and
# `from agent.x import ...` resolve correctly both locally (uvicorn run from
# inside backend/) and on Vercel (working directory is the project root).
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

from tools.extract_metadata import extract_metadata
from tools.check_hygiene import check_hygiene
from tools.generate_synthetic import generate_synthetic
from tools.verify_fidelity import verify_fidelity
from agent.react_loop import run_pipeline

app = FastAPI(title="Vitalytics API")

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    os.getenv("FRONTEND_URL", ""),
]
# Allow all Vercel preview URLs
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory job store (sufficient for demo)
jobs: dict[str, dict] = {}

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data" / "synthea"

# Vercel's deployment bundle at /var/task is read-only; only /tmp is writable.
# Locally (no VERCEL env var) keep files next to the backend directory.
_on_vercel = bool(os.environ.get("VERCEL"))
UPLOAD_DIR = Path("/tmp/vitalytics_uploads") if _on_vercel else BASE_DIR / "uploads"
OUTPUT_DIR = Path("/tmp/vitalytics_outputs") if _on_vercel else BASE_DIR / "outputs"
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)


# ─── Pydantic Models ──────────────────────────────────────────────────────────

class HygieneApprovalRequest(BaseModel):
    session_id: str
    approved_fixes: list[str]

class GenerateRequest(BaseModel):
    session_id: str
    n_rows: int = 1000
    model: str = "auto"

class ChatRequest(BaseModel):
    session_id: str
    message: str
    role: str = "population_health"


# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "model": "gemini-2.0-flash"}


# ─── Session ─────────────────────────────────────────────────────────────────

@app.post("/session")
async def create_session():
    sid = str(uuid.uuid4())
    jobs[sid] = {
        "session_id": sid,
        "status": "created",
        "step": 0,
        "real_path": None,
        "metadata": None,
        "table_name": "dataset",
        "hygiene_issues": None,
        "applied_fixes": [],
        "synthetic_path": None,
        "generation_result": None,
        "generation_progress": [],
        "fidelity": None,
        "conversation": [],
    }
    return {"session_id": sid}


# ─── Upload ───────────────────────────────────────────────────────────────────

def _read_csv_robust(path: Path) -> pd.DataFrame:
    """Try common encodings and delimiters so any real-world healthcare CSV parses."""
    for encoding in ("utf-8-sig", "utf-8", "latin-1", "cp1252"):
        for sep in (",", ";", "\t", "|"):
            try:
                df = pd.read_csv(path, encoding=encoding, sep=sep, low_memory=False)
                if df.shape[1] >= 2 or (df.shape[1] == 1 and sep == ","):
                    return df
            except Exception:
                continue
    raise ValueError(
        "Could not parse the CSV file. Make sure it is UTF-8 or Latin-1 encoded "
        "with comma, semicolon, tab, or pipe delimiters."
    )


@app.post("/upload/{session_id}")
async def upload_file(session_id: str, file: UploadFile = File(...)):
    _ensure_session(session_id)
    filename = (file.filename or "upload.csv").strip()
    if not filename.lower().endswith(".csv"):
        raise HTTPException(400, "Only CSV files are supported. Please upload a .csv file.")

    content = await file.read()
    if not content:
        raise HTTPException(400, "The uploaded file is empty.")
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(400, "File exceeds the 50 MB limit.")

    file_path = UPLOAD_DIR / f"{session_id}_{filename}"
    file_path.write_bytes(content)

    try:
        df = _read_csv_robust(file_path)
    except ValueError as e:
        raise HTTPException(400, str(e))

    if df.empty or len(df) < 5:
        raise HTTPException(400, f"Dataset too small — only {len(df)} row(s) found. Need at least 5 rows.")

    # Drop columns that are 100 % empty so they don't confuse metadata extraction
    df = df.dropna(axis=1, how="all")
    if df.empty:
        raise HTTPException(400, "All columns in the CSV are empty.")

    try:
        table = filename.removesuffix(".csv").removesuffix(".CSV") or "dataset"
        meta = extract_metadata(df, table_name=table)
        if not meta.get("columns"):
            raise HTTPException(
                400,
                "No usable columns found after privacy filtering. "
                "Ensure the CSV contains non-identifier columns (not just names/IDs/dates)."
            )
        jobs[session_id].update({
            "metadata": meta,
            "real_path": str(file_path),
            "table_name": table,
            "step": 1,
        })
        return {
            "session_id": session_id,
            "rows": meta["row_count"],
            "columns": list(meta["columns"].keys()),
            "privacy_actions": meta["privacy_actions"],
            "metadata": meta,
            "demo": False,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Metadata extraction failed: {str(e)}")


@app.post("/load-demo/{session_id}")
async def load_demo(session_id: str):
    _ensure_session(session_id)
    demo_path = DATA_DIR / "patients.csv"
    if not demo_path.exists():
        raise HTTPException(404, "Demo data not found. Run backend/scripts/generate_demo_data.py first.")
    try:
        df = pd.read_csv(demo_path)
        meta = extract_metadata(df, table_name="synthea_patients")
        jobs[session_id].update({
            "metadata": meta,
            "real_path": str(demo_path),
            "table_name": "synthea_patients",
            "step": 1,
        })
        return {
            "session_id": session_id,
            "rows": meta["row_count"],
            "columns": list(meta["columns"].keys()),
            "privacy_actions": meta["privacy_actions"],
            "metadata": meta,
            "demo": True,
        }
    except Exception as e:
        raise HTTPException(500, f"Demo load failed: {str(e)}")


# ─── Hygiene ─────────────────────────────────────────────────────────────────

@app.get("/hygiene/{session_id}")
async def run_hygiene(session_id: str):
    _ensure_session(session_id)
    meta = jobs[session_id].get("metadata")
    if not meta:
        raise HTTPException(400, "No metadata. Upload a file first.")
    issues = check_hygiene(meta)
    jobs[session_id]["hygiene_issues"] = issues
    jobs[session_id]["step"] = 2
    return {"session_id": session_id, "issues": issues}


@app.post("/hygiene/apply/{session_id}")
async def apply_hygiene_fixes(session_id: str, req: HygieneApprovalRequest):
    _ensure_session(session_id)
    issues = jobs[session_id].get("hygiene_issues") or []
    meta = jobs[session_id].get("metadata") or {}
    for issue in issues:
        if issue["id"] in req.approved_fixes:
            for col, adj in (issue.get("metadata_fix") or {}).items():
                if col in meta.get("columns", {}):
                    meta["columns"][col].update(adj)
            issue["applied"] = True
    jobs[session_id]["metadata"] = meta
    jobs[session_id]["applied_fixes"] = list(set(
        jobs[session_id].get("applied_fixes", []) + req.approved_fixes
    ))
    return {"session_id": session_id, "applied": req.approved_fixes, "metadata": meta}


# ─── Generation ──────────────────────────────────────────────────────────────

@app.post("/generate/{session_id}")
async def start_generation(session_id: str, req: GenerateRequest, background_tasks: BackgroundTasks):
    _ensure_session(session_id)
    meta = jobs[session_id].get("metadata")
    if not meta:
        raise HTTPException(400, "No metadata. Upload a file first.")
    jobs[session_id]["status"] = "generating"
    jobs[session_id]["generation_progress"] = []
    background_tasks.add_task(_run_generation, session_id, meta, req.n_rows, req.model)
    return {"session_id": session_id, "status": "generating"}


async def _run_generation(session_id: str, meta: dict, n_rows: int, model: str):
    def progress(msg: str):
        jobs[session_id]["generation_progress"].append(msg)
    try:
        result = await asyncio.get_running_loop().run_in_executor(
            None, lambda: generate_synthetic(meta, n_rows=n_rows, model=model, progress_callback=progress)
        )
        output_path = OUTPUT_DIR / f"{session_id}_synthetic.csv"
        result["dataframe"].to_csv(output_path, index=False)
        jobs[session_id].update({
            "synthetic_path": str(output_path),
            "generation_result": {
                "rows_generated": result["rows_generated"],
                "rows_rejected": result["rows_rejected"],
                "model_used": result["model_used"],
            },
            "status": "generated",
            "step": 3,
        })
    except Exception as e:
        jobs[session_id]["status"] = "error"
        jobs[session_id]["generation_progress"].append(f"Error: {str(e)}")


@app.get("/generate/status/{session_id}")
async def generation_status(session_id: str):
    _ensure_session(session_id)
    job = jobs[session_id]
    return {
        "status": job.get("status"),
        "progress": job.get("generation_progress", []),
        "result": job.get("generation_result"),
        "synthetic_path": job.get("synthetic_path"),
    }


# ─── Verification ─────────────────────────────────────────────────────────────

@app.get("/verify/{session_id}")
async def run_verification(session_id: str):
    _ensure_session(session_id)
    real_path = jobs[session_id].get("real_path")
    synth_path = jobs[session_id].get("synthetic_path")
    if not real_path or not synth_path:
        raise HTTPException(400, "Need both real and synthetic data. Generate first.")
    try:
        result = await asyncio.get_running_loop().run_in_executor(
            None, lambda: verify_fidelity(real_path, synth_path)
        )
        jobs[session_id]["fidelity"] = result
        jobs[session_id]["step"] = 4
        return {"session_id": session_id, "fidelity": result}
    except Exception as e:
        raise HTTPException(500, f"Verification failed: {str(e)}")


# ─── Preview / Download ───────────────────────────────────────────────────────

@app.get("/preview/{session_id}")
async def get_preview(session_id: str, n: int = 20):
    _ensure_session(session_id)
    path = jobs[session_id].get("synthetic_path")
    if not path or not Path(path).exists():
        raise HTTPException(404, "Synthetic data not found. Generate first.")
    df = pd.read_csv(path, nrows=n)
    return {"columns": list(df.columns), "rows": df.fillna("").to_dict(orient="records")}


@app.get("/download/{session_id}")
async def download_synthetic(session_id: str):
    _ensure_session(session_id)
    path = jobs[session_id].get("synthetic_path")
    if not path or not Path(path).exists():
        raise HTTPException(404, "Synthetic data not found.")
    return FileResponse(path, media_type="text/csv", filename=f"vitalytics_synthetic_{session_id[:8]}.csv")


# ─── Agent Chat Stream (SSE) ──────────────────────────────────────────────────

@app.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    _ensure_session(req.session_id)
    job = jobs[req.session_id]
    # Pass full session state to agent (including applied fixes)
    agent_state = {**job, "session_id": req.session_id}

    async def event_generator():
        try:
            async for event in run_pipeline(
                message=req.message,
                role=req.role,
                session_state=agent_state,
            ):
                yield f"data: {json.dumps(event)}\n\n"
                await asyncio.sleep(0)
                if event.get("type") == "done":
                    break
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        # Sync any state changes back to jobs store.
        # synthetic_path is written directly by _run_generation — only overwrite if the agent set it.
        for key in ("metadata", "hygiene_issues", "generation_result", "fidelity", "conversation"):
            if key in agent_state:
                jobs[req.session_id][key] = agent_state[key]
        if agent_state.get("synthetic_path"):
            jobs[req.session_id]["synthetic_path"] = agent_state["synthetic_path"]

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ─── Jobs status ─────────────────────────────────────────────────────────────

@app.get("/jobs/{session_id}")
async def get_job(session_id: str):
    _ensure_session(session_id)
    job = {k: v for k, v in jobs[session_id].items() if k != "conversation"}
    return job


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _ensure_session(session_id: str):
    if session_id not in jobs:
        raise HTTPException(404, f"Session '{session_id}' not found. Create one via POST /api/session.")
