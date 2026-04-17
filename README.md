# Vitalytics

Privacy-safe synthetic healthcare data generation. Upload a real patient CSV, extract its statistical fingerprint, and generate an unlimited synthetic population — without a single real record ever leaving the privacy boundary.

Built on Next.js 16 + FastAPI, with a Gemini-powered agent that explains every step in plain language tailored to the clinician, analyst, or executive using it.

---

## Table of contents

1. [The pipeline](#the-pipeline)
2. [How it works: real computation vs AI commentary](#how-it-works-real-computation-vs-ai-commentary)
3. [Stack](#stack)
4. [Quick start](#quick-start)
5. [Enabling live AI](#enabling-live-ai)
6. [Deployment](#deployment)
7. [Project layout](#project-layout)
8. [Troubleshooting](#troubleshooting)
9. [Security](#security)

---

## The pipeline

```
Upload CSV  →  Profile  →  Hygiene  →  Generate  →  Verify & Download
    1              2           3            4               5
```

| Step | What happens |
|------|-------------|
| **1 Upload** | Load the Synthea Ontario demo dataset or drop any healthcare CSV |
| **2 Profile** | Extract statistical metadata — distributions, correlations, privacy actions — with no raw rows stored |
| **3 Hygiene** | Audit for ICD-10 violations, high null rates, rare categories; approve fixes before generation |
| **4 Generate** | Sample a new synthetic population from the metadata fingerprint using GaussianCopula |
| **5 Verify** | Score fidelity (Wasserstein distance, correlation preservation, MIA privacy test) and download the CSV |

Each step has an agent panel where Gemini explains the results in the voice of the selected persona (Nurse, Analyst, Population Health, Researcher, or CIO).

---

## How it works: real computation vs AI commentary

This is the most important thing to understand about how the app works:

| Layer | Always runs | Requires API key |
|-------|-------------|-----------------|
| Statistical metadata extraction (scipy, numpy) | ✓ | |
| Data quality audit (ICD-10, null rates, rare categories) | ✓ | |
| Synthetic generation (scikit-learn GaussianCopula) | ✓ | |
| Fidelity verification (Wasserstein, MIA AUC, TSTR) | ✓ | |
| **Agent explanations** (the reasoning panels in each step) | | **✓ Gemini 2.0 Flash** |

**Without a real API key**, the data science runs for real but the agent panels show pre-written canned responses that never change regardless of what you upload. This is demo mode.

**With a real API key**, Gemini reads your actual metadata, chooses tools via function calling, and generates contextual analysis specific to your dataset and the selected persona.

See [Enabling live AI](#enabling-live-ai) to swap in a real key in under a minute — the Gemini free tier is generous enough for demos and evaluation.

---

## Stack

**Frontend**
- Next.js 16 (App Router, Turbopack)
- React 19, Tailwind 4, Radix UI, Recharts

**Backend**
- FastAPI + Uvicorn
- Google Gen AI SDK (`google-genai`, Gemini 2.0 Flash)
- pandas, numpy, scipy, scikit-learn

**Deploy**
- Vercel — frontend at `/`, FastAPI backend at `/api` via `experimentalServices`

---

## Quick start

### 1. Clone and install frontend

```bash
git clone <repo-url> vitalytics-demo-v1
cd vitalytics-demo-v1
npm install
```

### 2. Set up the backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Configure environment

```bash
cp backend/.env.example backend/.env
# Then open backend/.env and fill in your values
```

| Variable | Purpose | Required |
|----------|---------|----------|
| `GEMINI_API_KEY` | Gemini API key — get a free one at [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) | For live AI |
| `FRONTEND_URL` | Next.js origin for the CORS allow-list | Yes (`http://localhost:3000`) |
| `DEMO_MOCK` | Set `true` to run without an API key | No |

> **No API key yet?** Set `DEMO_MOCK=true` in `backend/.env`. The full 5-step pipeline runs end-to-end — real data science, pre-written agent commentary. You can see every screen and all the numbers without spending a cent.
>
> **Note:** The Gemini API has a free tier (generous RPM / daily-request limits) that is sufficient for local evaluation and demos. Billing only kicks in if you exceed the free quota.

No frontend `.env` is needed locally — the API URL defaults to `http://localhost:8000`. Override if needed:

```bash
# .env.local (repo root, optional)
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 4. Run (two terminals)

```bash
# Terminal 1 — backend
cd backend && source venv/bin/activate
uvicorn main:app --reload --port 8000

# Terminal 2 — frontend
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Sanity checks

```bash
curl http://localhost:8000/health   # → {"status":"ok","model":"gemini-2.0-flash"}
curl http://localhost:8000/docs     # FastAPI Swagger UI
```

If the agent panels show identical text for every dataset you upload, `DEMO_MOCK` is on or the API key is invalid.

---

## Enabling live AI

**Locally** — edit `backend/.env`:

```bash
GEMINI_API_KEY=AIza...YOUR-REAL-KEY   # remove the placeholder
FRONTEND_URL=http://localhost:3000
# remove DEMO_MOCK or set it to false
```

**On Vercel** (dashboard — recommended):

1. Open your project → **Settings → Environment Variables**
2. Add `GEMINI_API_KEY` with your key (apply to Production, Preview, Development)
3. Set `DEMO_MOCK=false` or remove it entirely
4. Redeploy from the Deployments tab

**On Vercel** (CLI alternative):

```bash
npx vercel env rm GEMINI_API_KEY production
echo "AIza...YOUR-REAL-KEY" | npx vercel env add GEMINI_API_KEY production
npx vercel deploy --prod
```

The app detects a real key automatically — no code changes needed. `_DEMO_MODE` in `react_loop.py` becomes `false` when the key is present, longer than 20 characters, and doesn't contain the word "placeholder".

---

## Deployment

The repo deploys entirely to Vercel — no separate backend host needed.

```
vercel.json experimentalServices
  /      → Next.js (static + SSR)
  /api   → FastAPI (Python 3.12, runtime dep install for heavy packages)
```

**Vercel automatically strips the `/api` prefix before forwarding to FastAPI**, so routes in `main.py` are defined without it (e.g. `@app.post("/session")`, not `@app.post("/api/session")`). The local dev proxy in `next.config.ts` mirrors this behaviour.

File writes (CSV uploads, synthetic output) use `/tmp` on Vercel since the deployment bundle at `/var/task` is read-only.

### First deploy

```bash
npm install -g vercel
vercel login
vercel deploy --prod
```

### Set environment variables

```bash
echo "AIza...YOUR-KEY" | vercel env add GEMINI_API_KEY production
echo "https://your-project.vercel.app" | vercel env add FRONTEND_URL production

vercel deploy --prod   # redeploy to pick up the new vars
```

---

## Project layout

```
vitalytics-demo-v1/
│
├── app/                        # Next.js App Router
│   ├── page.tsx                # Landing page
│   ├── layout.tsx              # Root layout, fonts, theme
│   ├── globals.css             # Tailwind base styles
│   ├── pipeline/               # Five-step pipeline shell
│   │   ├── page.tsx            # Step router
│   │   ├── layout.tsx          # PipelineProvider wrapper
│   │   └── context.tsx         # useReducer state (session, step, metadata…)
│   └── privacy/                # Privacy policy page
│
├── components/
│   ├── steps/                  # One component per pipeline step
│   │   ├── UploadStep.tsx      # Session creation, demo load, CSV upload
│   │   ├── ProfileStep.tsx     # Metadata display + privacy actions
│   │   ├── HygieneStep.tsx     # Issue list, approve/reject fixes
│   │   ├── GenerateStep.tsx    # Progress log, generation polling
│   │   └── VerifyStep.tsx      # Fidelity scores, charts, download
│   ├── charts/
│   │   ├── MiaGauge.tsx        # Semicircle privacy gauge (responsive SVG)
│   │   ├── DistributionOverlay.tsx  # Real vs synthetic distribution chart
│   │   └── CorrelationHeatmap.tsx   # Correlation matrix comparison
│   ├── AgentPanel.tsx          # SSE streaming agent commentary
│   ├── PipelineNav.tsx         # Step breadcrumb nav
│   └── RoleSelector.tsx        # Persona picker (5 clinical roles)
│
├── lib/
│   ├── api.ts                  # All HTTP client functions + SSE stream helper
│   ├── types.ts                # Shared TypeScript types and PERSONAS constant
│   └── utils.ts                # cn() class-name helper
│
├── backend/
│   ├── main.py                 # FastAPI app — all routes, CORS, background tasks
│   ├── requirements.txt        # Python dependencies
│   ├── .env.example            # Environment variable template
│   ├── .python-version         # Pins Python 3.12 for Vercel
│   │
│   ├── agent/
│   │   ├── react_loop.py       # Gemini ReAct loop — function calling, SSE events, demo mode
│   │   ├── personas.py         # System prompts for each clinical role
│   │   └── tool_definitions.py # Gemini function-calling tool schemas
│   │
│   ├── tools/
│   │   ├── extract_metadata.py     # Statistical profiling + 5 privacy safeguards
│   │   ├── check_hygiene.py        # Data quality audit rules
│   │   ├── generate_synthetic.py   # GaussianCopula sampling engine
│   │   ├── verify_fidelity.py      # Wasserstein, MIA AUC, TSTR scoring
│   │   └── clinical_constraints.py # Post-generation clinical validity rules
│   │
│   ├── data/synthea/           # Pre-generated demo dataset (patients.csv)
│   ├── uploads/                # Uploaded CSVs (gitignored, /tmp on Vercel)
│   └── outputs/                # Generated synthetic CSVs (gitignored, /tmp on Vercel)
│
├── next.config.ts              # Dev proxy: /api/* → localhost:8000/*
├── vercel.json                 # experimentalServices routing
└── .gitignore                  # Excludes .env*, uploads/, outputs/, node_modules/, venv/
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "Cannot connect to backend" on `/pipeline` | Backend isn't running — `cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8000` |
| Load Demo button stays disabled | Session creation failed (backend not running). Start the backend first. |
| CORS error in browser console | `FRONTEND_URL` in `backend/.env` doesn't match the Next.js origin exactly — no trailing slash |
| `Gemini API error: 401` or auth failure | API key missing or invalid — set `DEMO_MOCK=true` to unblock immediately, or check the key format (`AIza...`) |
| "Generation failed" + "Start Over" button appears | The backend was restarted and the in-memory session was lost. Click "Start Over" to begin a fresh session. |
| `Gemini API error: 429` | Free-tier rate limit hit. **Make sure you're using an AI Studio key** ([aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)) — GCP Console keys have 0 quota by default. Wait a minute or check your quotas. |
| Agent panels show identical text every run | Demo mode is active — see [Enabling live AI](#enabling-live-ai) |
| Port 8000 already in use | `uvicorn main:app --reload --port 8001` and set `NEXT_PUBLIC_API_URL=http://localhost:8001` in `.env.local` |
| `ModuleNotFoundError` on backend start | Venv not activated — run `source backend/venv/bin/activate` first |
| Vercel: `[Errno 30] Read-only file system` | Means code is writing outside `/tmp` — this is fixed in current main; redeploy |

---

## Security

- `.env` files are gitignored. Never commit a real API key.
- Only statistical metadata (distributions, frequencies, correlations) crosses the privacy boundary — no raw patient rows are stored or transmitted.
- Five privacy safeguards run automatically during profiling: direct identifier suppression, rare category merging, geographic generalisation, percentile capping, and frequency noise injection.
- Each developer should generate their own key at [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey). Do not share keys over chat or email.
