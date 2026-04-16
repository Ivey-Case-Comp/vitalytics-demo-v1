# Vitalytics

Privacy-safe synthetic healthcare data generation. Upload a real patient CSV, extract its statistical fingerprint, and generate an unlimited synthetic population — without a single real record ever leaving the privacy boundary.

Built on Next.js 16 + FastAPI, with a Claude-powered agent that explains every step in plain language tailored to the clinician, analyst, or executive using it.

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

Each step has an agent panel where Claude explains the results in the voice of the selected persona (Nurse, Analyst, Population Health, Researcher, or CIO).

---

## Real computation vs AI commentary

This is the most important thing to understand about how the app works:

| Layer | Always runs | Requires API key |
|-------|-------------|-----------------|
| Statistical metadata extraction (scipy, numpy) | ✓ | |
| Data quality audit (ICD-10, null rates, rare categories) | ✓ | |
| Synthetic generation (scikit-learn GaussianCopula) | ✓ | |
| Fidelity verification (Wasserstein, MIA AUC, TSTR) | ✓ | |
| **Agent explanations** (the reasoning panels in each step) | | **✓ Claude Opus 4.6** |

**Without a real API key**, the data science runs for real but the agent panels show pre-written canned responses that never change regardless of what you upload. This is demo mode.

**With a real API key**, Claude reads your actual metadata, chooses tools, and generates contextual analysis specific to your dataset and the selected persona.

See [Enabling live AI](#enabling-live-ai) to swap in a real key in under a minute.

---

## Stack

**Frontend**
- Next.js 16 (App Router, Turbopack)
- React 19, Tailwind 4, Radix UI, Recharts

**Backend**
- FastAPI + Uvicorn
- Anthropic SDK (Claude Opus 4.6)
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
| `ANTHROPIC_API_KEY` | Claude API key — get one at [console.anthropic.com](https://console.anthropic.com) | For live AI |
| `FRONTEND_URL` | Next.js origin for the CORS allow-list | Yes (`http://localhost:3000`) |
| `DEMO_MOCK` | Set `true` to run without an API key | No |

> **No API key yet?** Set `DEMO_MOCK=true` in `backend/.env`. The full 5-step pipeline runs end-to-end — real data science, pre-written agent commentary. You can see every screen and all the numbers without spending a cent.
>
> **Note:** Claude Pro (the chat subscription) does not include API access. Keys are billed separately and created at the Anthropic Console.

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
curl http://localhost:8000/health   # → {"status":"ok","model":"claude-opus-4-6"}
curl http://localhost:8000/docs     # FastAPI Swagger UI
```

If the agent panels show identical text for every dataset you upload, `DEMO_MOCK` is on or the API key is invalid.

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
│   │   ├── react_loop.py       # Claude ReAct loop — tool use, SSE events, demo mode
│   │   ├── personas.py         # System prompts for each clinical role
│   │   └── tool_definitions.py # Anthropic tool schemas
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
└── .gitignore                  # Excludes .env*, uploads/, outputs/, node_modules/
```

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
echo "sk-ant-api03-..." | vercel env add ANTHROPIC_API_KEY production
echo "https://your-project.vercel.app" | vercel env add FRONTEND_URL production

vercel deploy --prod   # redeploy to pick up the new vars
```

---

## Enabling live AI

**Locally** — edit `backend/.env`:

```bash
ANTHROPIC_API_KEY=sk-ant-api03-YOUR-REAL-KEY   # remove the placeholder
FRONTEND_URL=http://localhost:3000
# remove DEMO_MOCK or set it to false
```

**On Vercel**:

```bash
npx vercel env rm ANTHROPIC_API_KEY production
echo "sk-ant-api03-YOUR-REAL-KEY" | npx vercel env add ANTHROPIC_API_KEY production
npx vercel deploy --prod
```

The app detects a real key automatically — no code changes needed. `_DEMO_MODE` in `react_loop.py` becomes `false` when the key is present, longer than 20 characters, and doesn't contain the word "placeholder".

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "Cannot connect to backend" on `/pipeline` | Backend isn't running — `cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8000` |
| Load Demo button stays disabled | Session creation failed (backend not running). Start the backend first. |
| CORS error in browser console | `FRONTEND_URL` in `backend/.env` doesn't match the Next.js origin exactly — no trailing slash |
| `anthropic.AuthenticationError` | API key missing or invalid — set `DEMO_MOCK=true` to unblock immediately |
| Agent panels show identical text every run | Demo mode is active — see [Enabling live AI](#enabling-live-ai) |
| Port 8000 already in use | `uvicorn main:app --reload --port 8001` and set `NEXT_PUBLIC_API_URL=http://localhost:8001` in `.env.local` |
| `ModuleNotFoundError` on backend start | Venv not activated — run `source backend/venv/bin/activate` first |
| Vercel: `[Errno 30] Read-only file system` | Means code is writing outside `/tmp` — this is fixed in current main; redeploy |

---

## Security

- `.env` files are gitignored. Never commit a real API key.
- Only statistical metadata (distributions, frequencies, correlations) crosses the privacy boundary — no raw patient rows are stored or transmitted.
- Five privacy safeguards run automatically during profiling: direct identifier suppression, rare category merging, geographic generalisation, percentile capping, and frequency noise injection.
- Each developer should generate their own key at [console.anthropic.com](https://console.anthropic.com). Do not share keys over chat or email.
