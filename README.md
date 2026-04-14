# Vitalytics

Synthetic healthcare data generation pipeline. Next.js frontend + FastAPI backend with a Claude-powered agent loop.

## Stack

- **Frontend:** Next.js 16, React 19, Tailwind 4, Radix UI, Recharts
- **Backend:** FastAPI, Anthropic SDK, pandas/numpy/scipy/scikit-learn
- **Deploy:** Vercel (frontend) + Render (backend) — see [vercel.json](vercel.json) and [render.yaml](render.yaml)

## Prerequisites

- Node.js 20+
- Python 3.9+
- git

## Quick Setup

### 1. Clone and install the frontend

```bash
git clone <repo-url> vitalytics-demo-v1
cd vitalytics-demo-v1
npm install
```

### 2. Install the backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. Configure environment variables

Create `backend/.env`:

```bash
ANTHROPIC_API_KEY=sk-ant-...   # get your own at https://console.anthropic.com
FRONTEND_URL=http://localhost:3000
```

> **No API key yet?** Set `DEMO_MOCK=true` in `backend/.env` instead — the agent returns canned responses so you can run the full app end-to-end without a key. See [backend/agent/react_loop.py:173](backend/agent/react_loop.py:173).
>
> **Note:** Claude Pro (the chat subscription) does not include API access. API keys are billed separately via the Anthropic Console.

No frontend `.env` is needed for local dev — the API URL defaults to `http://localhost:8000` per [next.config.ts:9](next.config.ts:9). To override, create `.env.local` at the repo root:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 4. Run it (two terminals)

**Terminal 1 — backend:**

```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

**Terminal 2 — frontend:**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Sanity checks

- `curl http://localhost:8000/docs` — FastAPI Swagger UI loads
- Frontend home page loads with no console errors
- Upload a CSV and run the agent — if you see mock output, `DEMO_MOCK` is on

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| CORS error in browser console | Confirm `FRONTEND_URL` in `backend/.env` matches the Next.js origin |
| `anthropic.AuthenticationError` | API key missing or invalid — set `DEMO_MOCK=true` to unblock |
| Port 8000 already in use | Run `uvicorn main:app --reload --port 8001` and set `NEXT_PUBLIC_API_URL=http://localhost:8001` in `.env.local` |
| `ModuleNotFoundError` on backend start | Make sure the venv is activated (`source backend/venv/bin/activate`) |

## Project layout

```
app/          Next.js app router pages and layouts
components/   React components (Radix + Tailwind)
lib/          Frontend utilities
backend/
  main.py           FastAPI entry point
  agent/            Claude ReAct loop
  tools/            Pipeline tools (metadata, hygiene, generate, verify)
  data/synthea/     Sample healthcare data
```

## Deployment

- **Frontend** → Vercel (auto-routes `/api/*` to the backend — see [vercel.json](vercel.json))
- **Backend** → Render (config in [render.yaml](render.yaml)). Set `ANTHROPIC_API_KEY` and `FRONTEND_URL` in the Render dashboard.

## Secrets

**Do not share `.env` files or API keys over chat/email.** Each developer should generate their own key at [console.anthropic.com](https://console.anthropic.com), or use `DEMO_MOCK=true` while getting set up.
