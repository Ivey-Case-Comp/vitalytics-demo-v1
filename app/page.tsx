import Link from "next/link"
import { ArrowRight, Shield, Brain, BarChart3, Lock, CheckCircle } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="text-lg font-bold text-primary">Vitalytics</span>
          <div className="flex gap-4 items-center text-sm">
            <Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
              Privacy Architecture
            </Link>
            <Link
              href="/pipeline"
              className="bg-primary text-primary-foreground px-4 py-1.5 rounded-md font-medium hover:bg-primary/90 transition-colors"
            >
              Launch Demo
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-4 py-24 gap-8">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-medium px-4 py-1.5 rounded-full border border-primary/20">
          <Shield className="h-3.5 w-3.5" />
          Southlake Health Hackathon — April 2026
        </div>

        <div className="max-w-3xl space-y-4">
          <h1 className="text-5xl font-extrabold leading-tight tracking-tight text-foreground">
            We didn&apos;t try to climb<br />
            <span className="text-primary">the privacy wall.</span><br />
            We made it irrelevant.
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Real patient data goes in. Only statistical metadata crosses the privacy boundary.
            A whole new synthetic patient population is born on the other side — PHIPA-ready, clinically realistic.
          </p>
        </div>

        <div className="flex gap-4 flex-wrap justify-center">
          <Link
            href="/pipeline"
            className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg text-base font-semibold hover:bg-primary/90 transition-colors shadow-sm"
          >
            Launch Demo <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/privacy"
            className="flex items-center gap-2 border border-border bg-card text-foreground px-6 py-3 rounded-lg text-base font-medium hover:bg-muted transition-colors"
          >
            Privacy Architecture
          </Link>
        </div>

        {/* Trust signals */}
        <div className="flex gap-6 flex-wrap justify-center text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5"><CheckCircle className="h-4 w-4 text-green-500" /> Zero PHI Exposure</span>
          <span className="flex items-center gap-1.5"><CheckCircle className="h-4 w-4 text-green-500" /> MIA AUC ~0.51</span>
          <span className="flex items-center gap-1.5"><CheckCircle className="h-4 w-4 text-green-500" /> PHIPA-Ready</span>
          <span className="flex items-center gap-1.5"><CheckCircle className="h-4 w-4 text-green-500" /> Metadata-Only Extraction</span>
        </div>
      </section>

      {/* Pipeline steps */}
      <section className="bg-muted/30 border-y py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-foreground mb-10">How It Works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-6">
            {PIPELINE_STEPS.map((step, i) => (
              <div key={i} className="flex flex-col items-center text-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
                  <step.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Step {i + 1}</div>
                  <div className="font-semibold text-foreground text-sm mt-0.5">{step.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{step.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Persona row */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-foreground mb-3">Built for Every Healthcare Role</h2>
          <p className="text-center text-muted-foreground mb-10 max-w-xl mx-auto">
            The AI agent adapts its explanations to your role — from bedside nurses to hospital CIOs.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {PERSONAS.map((p) => (
              <div key={p.key} className={`rounded-lg border-l-4 border border-border p-3 ${p.borderColor}`}>
                <div className="font-semibold text-sm text-foreground">{p.label}</div>
                <div className="text-xs text-muted-foreground mt-1">{p.focus}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Vitalytics · Southlake Health Hackathon · April 2026 · Built with Next.js + FastAPI + Claude claude-opus-4-6
      </footer>
    </div>
  )
}

const PIPELINE_STEPS = [
  {
    label: "Upload",
    description: "Load any healthcare CSV or use the Synthea demo dataset",
    icon: Lock,
  },
  {
    label: "Profile",
    description: "Extract statistical metadata — no raw rows stored",
    icon: BarChart3,
  },
  {
    label: "Hygiene Audit",
    description: "Detect ICD errors, missing data, clinical implausibility",
    icon: Shield,
  },
  {
    label: "Generate",
    description: "Sample new patients from fitted statistical distributions",
    icon: Brain,
  },
  {
    label: "Verify",
    description: "Fidelity scoring + MIA privacy audit + download",
    icon: CheckCircle,
  },
]

const PERSONAS = [
  { key: "nurse", label: "Nurse", focus: "Plain-language safety insights", borderColor: "border-l-blue-500" },
  { key: "analyst", label: "Data Analyst", focus: "Statistical precision & metrics", borderColor: "border-l-violet-500" },
  { key: "population_health", label: "Pop. Health", focus: "Cohort & demographic analysis", borderColor: "border-l-green-500" },
  { key: "researcher", label: "Researcher", focus: "IRB-ready, TSTR ratio", borderColor: "border-l-amber-500" },
  { key: "cio", label: "CIO", focus: "PHIPA compliance & roadmap", borderColor: "border-l-slate-500" },
]
