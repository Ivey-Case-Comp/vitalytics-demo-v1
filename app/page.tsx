import Link from "next/link"
import {
  ArrowRight,
  Shield,
  Brain,
  BarChart3,
  Lock,
  CheckCircle,
  Sparkles,
  Upload,
  FileSearch,
  ShieldCheck,
  LineChart,
} from "lucide-react"
import DemoPreloader from "@/components/DemoPreloader"

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <DemoPreloader />
      {/* Nav */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-primary/15 border border-primary/20 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-base font-bold tracking-tight text-foreground">Vitalytics</span>
          </Link>
          <div className="flex gap-5 items-center text-sm">
            <Link
              href="/privacy"
              className="text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
            >
              Privacy Architecture
            </Link>
            <Link
              href="/pipeline"
              className="bg-primary text-primary-foreground px-3.5 py-1.5 rounded-md font-medium hover:bg-primary/90 transition-colors inline-flex items-center gap-1.5"
            >
              Launch Demo
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% 0%, hsl(var(--primary) / 0.14), transparent 60%)",
          }}
        />
        <div
          className="absolute inset-0 -z-10 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--border) / 0.6) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border) / 0.6) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage:
              "radial-gradient(ellipse 70% 50% at 50% 0%, black 30%, transparent 75%)",
          }}
        />

        <div className="max-w-5xl mx-auto px-4 py-24 sm:py-32 flex flex-col items-center text-center gap-8">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-medium px-3.5 py-1.5 rounded-full border border-primary/20">
            <Shield className="h-3.5 w-3.5" />
            Southlake Health · Ivey MSc Hackathon 2026
          </div>

          <div className="max-w-3xl space-y-5">
            <h1 className="text-5xl sm:text-6xl font-extrabold leading-[1.05] tracking-tight text-foreground">
              We didn&apos;t climb
              <br />
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                the privacy wall.
              </span>
              <br />
              We made it irrelevant.
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              Real patient data goes in. Only statistical metadata crosses the privacy boundary. A
              whole new synthetic patient population is born on the other side — PHIPA-ready,
              clinically realistic.
            </p>
          </div>

          <div className="flex gap-3 flex-wrap justify-center">
            <Link
              href="/pipeline"
              className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg text-base font-semibold hover:bg-primary/90 transition-all shadow-sm hover:shadow-md"
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
          <div className="flex gap-x-6 gap-y-2 flex-wrap justify-center text-sm text-muted-foreground pt-4">
            {TRUST_SIGNALS.map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Pipeline steps */}
      <section className="border-b py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="text-xs font-semibold text-primary uppercase tracking-widest mb-2">
              How It Works
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
              Five steps from raw data to shareable synthetic.
            </h2>
            <p className="text-muted-foreground mt-3 leading-relaxed">
              Each stage runs locally. Only anonymous statistics leave your environment.
            </p>
          </div>

          <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Connector line (desktop only) */}
            <div className="hidden lg:block absolute top-7 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-border to-transparent -z-10" />
            {PIPELINE_STEPS.map((step, i) => (
              <div
                key={i}
                className="group relative rounded-xl border bg-card p-5 hover:border-primary/40 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary group-hover:bg-primary/15 transition-colors">
                    <step.icon className="h-4 w-4" />
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground/70 tabular-nums">
                    0{i + 1}
                  </span>
                </div>
                <div className="font-semibold text-foreground text-sm">{step.label}</div>
                <div className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  {step.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Persona row */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="text-xs font-semibold text-primary uppercase tracking-widest mb-2">
              Role-Aware AI
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
              Every role gets a tailored explanation.
            </h2>
            <p className="text-muted-foreground mt-3 leading-relaxed">
              The AI agent adapts its reasoning and language — from bedside nurses to hospital
              CIOs.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {PERSONAS.map((p) => (
              <div
                key={p.key}
                className="group relative rounded-xl border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all overflow-hidden"
              >
                <div className={`absolute inset-x-0 top-0 h-0.5 ${p.accent}`} />
                <div className="font-semibold text-sm text-foreground">{p.label}</div>
                <div className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  {p.focus}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-20">
        <div className="max-w-5xl mx-auto rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-card p-10 sm:p-14 relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-50"
            style={{
              background:
                "radial-gradient(circle at 80% 20%, hsl(var(--primary) / 0.18), transparent 50%)",
            }}
          />
          <div className="relative text-center max-w-xl mx-auto space-y-4">
            <h3 className="text-3xl font-bold text-foreground tracking-tight">
              Try it with sample data.
            </h3>
            <p className="text-muted-foreground">
              No upload required. Walk through the full pipeline with Synthea-generated records in
              under two minutes.
            </p>
            <Link
              href="/pipeline"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors shadow-sm mt-2"
            >
              Launch Demo <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Vitalytics · Southlake Health Ivey MSc Hackathon 2026 · Built with Next.js + FastAPI +
        Gemini 2.0 Flash
      </footer>
    </div>
  )
}

const TRUST_SIGNALS = [
  "Zero PHI Exposure",
  "Clinically Realistic Output",
  "PHIPA-Ready",
  "Metadata-Only Extraction",
]

const PIPELINE_STEPS = [
  {
    label: "Upload",
    description: "Load the Synthea demo or upload your own healthcare CSV.",
    icon: Upload,
  },
  {
    label: "Profile",
    description: "Extract statistical metadata — no raw patient rows stored.",
    icon: BarChart3,
  },
  {
    label: "Hygiene Audit",
    description: "Auto-detect data quality issues and apply privacy fixes.",
    icon: ShieldCheck,
  },
  {
    label: "Generate",
    description: "Synthesize a new patient population from distributions.",
    icon: Brain,
  },
  {
    label: "Verify",
    description: "Score fidelity, run privacy audit, download the CSV.",
    icon: LineChart,
  },
]

const PERSONAS = [
  { key: "nurse", label: "Nurse", focus: "Plain-language safety insights", accent: "bg-blue-400" },
  {
    key: "analyst",
    label: "Data Analyst",
    focus: "Statistical precision & metrics",
    accent: "bg-violet-400",
  },
  {
    key: "population_health",
    label: "Pop. Health",
    focus: "Cohort & demographic analysis",
    accent: "bg-emerald-400",
  },
  {
    key: "researcher",
    label: "Researcher",
    focus: "IRB-ready, TSTR ratio",
    accent: "bg-amber-400",
  },
  {
    key: "cio",
    label: "CIO",
    focus: "PHIPA compliance & roadmap",
    accent: "bg-slate-400",
  },
]
