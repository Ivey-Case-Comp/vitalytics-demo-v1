import Link from "next/link"
import {
  ArrowLeft,
  ArrowRight,
  Shield,
  EyeOff,
  Database,
  Lock,
  FileCheck,
  Info,
  XCircle,
  CheckCircle2,
  Sparkles,
} from "lucide-react"

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <span className="font-semibold text-foreground text-sm">Privacy Architecture</span>
          <Link
            href="/pipeline"
            className="text-sm bg-primary text-primary-foreground px-3.5 py-1.5 rounded-md font-medium hover:bg-primary/90 transition-colors"
          >
            Launch Demo
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <div
          className="absolute inset-0 -z-10 opacity-60"
          style={{
            background:
              "radial-gradient(ellipse at 50% 0%, hsl(var(--primary) / 0.12), transparent 60%)",
          }}
        />
        <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-6">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-medium px-3.5 py-1.5 rounded-full border border-primary/20">
            <Shield className="h-3.5 w-3.5" />
            Privacy-by-Design Architecture
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-foreground tracking-tight leading-[1.1]">
            Patient data never leaves
            <br className="hidden sm:block" />{" "}
            <span className="text-primary">your environment.</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Most tools require you to upload sensitive records to a cloud service. Vitalytics works
            differently: only statistical summaries — never individual rows — cross the privacy
            boundary.
          </p>
        </div>
      </section>

      <main className="max-w-5xl mx-auto px-4 py-16 space-y-20">
        {/* Privacy Boundary */}
        <section className="space-y-8">
          <div className="max-w-2xl">
            <div className="text-xs font-semibold text-primary uppercase tracking-widest mb-2">
              01 — The Boundary
            </div>
            <h2 className="text-3xl font-bold text-foreground tracking-tight">
              What crosses. What doesn&apos;t.
            </h2>
            <p className="text-muted-foreground mt-3 leading-relaxed">
              Think of it like a census: the government learns that 52% of a neighbourhood is over
              65, without ever knowing which house belongs to which family. Vitalytics does the
              same thing with your dataset.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 md:gap-6 items-stretch">
            {/* Left — stays inside */}
            <div className="rounded-xl border bg-card p-6 space-y-4 relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-0.5 bg-rose-400/70" />
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200/70 dark:border-rose-900/50">
                  <XCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                </div>
                <div className="font-semibold text-sm text-foreground">Stays in your environment</div>
              </div>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex gap-2"><span className="text-rose-500">·</span> Real patient records</li>
                <li className="flex gap-2"><span className="text-rose-500">·</span> Names, dates of birth, SSNs</li>
                <li className="flex gap-2"><span className="text-rose-500">·</span> ICD codes and encounter data</li>
                <li className="flex gap-2"><span className="text-rose-500">·</span> Any row-level information</li>
              </ul>
              <p className="text-xs text-rose-600 dark:text-rose-400 font-medium pt-3 border-t border-border">
                Never transmitted. Never stored externally.
              </p>
            </div>

            {/* Middle — what crosses */}
            <div className="flex flex-col items-center justify-center gap-3 text-center py-4 md:px-2 md:min-w-[220px]">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.15em]">
                Only statistics cross
              </p>
              <div className="w-full flex items-center gap-2 text-muted-foreground/60">
                <div className="flex-1 border-t border-dashed border-border" />
                <ArrowRight className="h-4 w-4" />
                <div className="flex-1 border-t border-dashed border-border" />
              </div>
              <div className="space-y-1.5 text-[11px] w-full">
                <div className="bg-muted/60 border border-border rounded-md px-3 py-1.5 font-mono text-foreground">
                  avg_age = 52.3, σ = 18.1
                </div>
                <div className="bg-muted/60 border border-border rounded-md px-3 py-1.5 font-mono text-foreground">
                  top_icd: E11.9 (22%)
                </div>
                <div className="bg-muted/60 border border-border rounded-md px-3 py-1.5 font-mono text-foreground">
                  corr(age, bmi) = 0.31
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Distributions, not individuals</p>
            </div>

            {/* Right — synthetic output */}
            <div className="rounded-xl border bg-card p-6 space-y-4 relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-0.5 bg-emerald-400/70" />
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-900/50">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="font-semibold text-sm text-foreground">Synthetic output</div>
              </div>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex gap-2"><span className="text-emerald-500">·</span> Realistic patient-like records</li>
                <li className="flex gap-2"><span className="text-emerald-500">·</span> Statistically representative</li>
                <li className="flex gap-2"><span className="text-emerald-500">·</span> No real individual represented</li>
                <li className="flex gap-2"><span className="text-emerald-500">·</span> Privacy score: MIA AUC ~0.51</li>
              </ul>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium pt-3 border-t border-border">
                Safe to share. Safe to train models on.
              </p>
            </div>
          </div>
        </section>

        {/* 5 Safeguards */}
        <section className="space-y-8">
          <div className="max-w-2xl">
            <div className="text-xs font-semibold text-primary uppercase tracking-widest mb-2">
              02 — Safeguards
            </div>
            <h2 className="text-3xl font-bold text-foreground tracking-tight">
              Five layers, applied automatically.
            </h2>
            <p className="text-muted-foreground mt-3 leading-relaxed">
              Each layer runs during profiling — before any statistics leave your environment.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SAFEGUARDS.map((s, i) => (
              <div
                key={i}
                className="group relative rounded-xl border bg-card p-5 hover:border-primary/40 hover:shadow-sm transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary group-hover:bg-primary/15 transition-colors">
                    <s.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground/70">
                        0{i + 1}
                      </span>
                      <div className="font-semibold text-sm text-foreground">{s.title}</div>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                      {s.description}
                    </div>
                    <div className="text-xs text-primary mt-3 font-mono bg-primary/5 border border-primary/15 rounded-md px-2 py-1 inline-block">
                      {s.example}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* MIA */}
        <section className="space-y-8">
          <div className="max-w-2xl">
            <div className="text-xs font-semibold text-primary uppercase tracking-widest mb-2">
              03 — Adversary Test
            </div>
            <h2 className="text-3xl font-bold text-foreground tracking-tight">
              We try to break it ourselves.
            </h2>
            <p className="text-muted-foreground mt-3 leading-relaxed">
              We don&apos;t just claim the synthetic data is private — we prove it with an attack
              simulation.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-8 space-y-6">
            <div className="space-y-3 max-w-3xl">
              <p className="text-sm text-muted-foreground leading-relaxed">
                A{" "}
                <strong className="text-foreground">Membership Inference Attack (MIA)</strong>{" "}
                asks: if an adversary knows a real patient exists, can they look at the synthetic
                dataset and determine that this person&apos;s information was used to generate it?
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                We test this by training a machine learning classifier to distinguish real records
                from synthetic ones. If the synthetic data is truly private, the classifier
                performs no better than random guessing — an AUC of 0.50.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border bg-background p-4 relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-0.5 bg-emerald-400/70" />
                <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                  Strong privacy
                </div>
                <div className="font-bold text-foreground text-2xl mt-2">0.50–0.55</div>
                <div className="text-xs text-muted-foreground mt-1">No better than a coin flip</div>
              </div>
              <div className="rounded-lg border bg-background p-4 relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-0.5 bg-amber-400/70" />
                <div className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-widest">
                  Review needed
                </div>
                <div className="font-bold text-foreground text-2xl mt-2">0.55–0.65</div>
                <div className="text-xs text-muted-foreground mt-1">Some signal detected</div>
              </div>
              <div className="rounded-lg border bg-background p-4 relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-0.5 bg-rose-400/70" />
                <div className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-widest">
                  Privacy risk
                </div>
                <div className="font-bold text-foreground text-2xl mt-2">&gt; 0.65</div>
                <div className="text-xs text-muted-foreground mt-1">Structural leakage present</div>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg bg-primary/5 border border-primary/15 px-4 py-3">
              <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
              <p className="text-xs text-foreground">
                Vitalytics targets an{" "}
                <strong className="text-primary">MIA AUC of ~0.51</strong>. Computed in real time
                with scikit-learn — not a fixed value.
              </p>
            </div>
          </div>
        </section>

        {/* Compliance */}
        <section className="space-y-8">
          <div className="max-w-2xl">
            <div className="text-xs font-semibold text-primary uppercase tracking-widest mb-2">
              04 — Regulatory Alignment
            </div>
            <h2 className="text-3xl font-bold text-foreground tracking-tight">
              Designed for the frameworks that matter.
            </h2>
            <p className="text-muted-foreground mt-3 leading-relaxed">
              Architectural design principles — not legal certifications. Consult your privacy and
              legal teams before deploying in a regulated environment.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {COMPLIANCE.map((c, i) => (
              <div
                key={i}
                className="rounded-xl border bg-card p-5 space-y-3 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <div className="font-semibold text-sm text-foreground">{c.standard}</div>
                </div>
                <div className="text-sm text-muted-foreground leading-relaxed">
                  {c.description}
                </div>
                <div className="text-xs text-primary font-medium bg-primary/5 border border-primary/15 rounded-md px-2.5 py-1 inline-block">
                  {c.status}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-start gap-3 rounded-xl border bg-muted/30 p-5">
            <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Transparency note:</strong> The TSTR ratio (how
              well models trained on synthetic data perform on real data) and MIA AUC are computed
              from your actual data during the verification step — they are not pre-set numbers.
              All five privacy safeguards run as code during profiling. You can inspect the
              open-source backend to verify every claim on this page.
            </p>
          </div>
        </section>

        {/* CTA */}
        <div className="rounded-2xl border bg-gradient-to-br from-primary/5 via-card to-card p-10 text-center space-y-4">
          <h3 className="text-2xl font-bold text-foreground tracking-tight">See it in action.</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Walk through the pipeline with sample data and watch the privacy boundary hold.
          </p>
          <Link
            href="/pipeline"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors shadow-sm"
          >
            Launch Demo
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </div>
  )
}

const SAFEGUARDS = [
  {
    icon: EyeOff,
    title: "Direct Identifier Removal",
    description:
      "Columns containing names, social security numbers, health card numbers, dates of birth, and other personal identifiers are detected automatically and stripped before any statistics are computed.",
    example: "SSN, DOB, OHIP → removed entirely",
  },
  {
    icon: Lock,
    title: "Outlier Protection",
    description:
      "Extreme values at the edges of a distribution can make rare individuals identifiable. We cap numeric values at the 1st and 99th percentile before fitting any distributions, eliminating that risk.",
    example: "AGE outliers capped to [2, 91]",
  },
  {
    icon: Database,
    title: "Small Group Protection",
    description:
      "If a category value appears fewer than 5 times in your data — say, a rare ethnicity or an unusual diagnosis code — it gets merged into a generic group. This prevents someone from targeting a known individual in a small subgroup.",
    example: "RARE_ETHNICITY (n=3) → 'Other'",
  },
  {
    icon: FileCheck,
    title: "Geographic Generalization",
    description:
      "Postal codes are shortened to their first three characters (the Forward Sortation Area), which represents a region of roughly 8,000 people. This matches the geographic privacy standard in PHIPA Safe Harbour.",
    example: "M4S 1A1 → M4S",
  },
  {
    icon: Shield,
    title: "Frequency Noise",
    description:
      "For category counts between 5 and 10 — the zone where an attacker might narrow down who contributed to a value — a small random offset is added. The statistics remain accurate at a population level while individual contribution becomes undetectable.",
    example: "count = 7 → 7 ± random offset",
  },
]

const COMPLIANCE = [
  {
    standard: "PHIPA (Ontario)",
    description:
      "Ontario's health privacy law defines PHI as information that identifies an individual. Synthetic data with no recoverable link to any real person does not qualify as PHI under PHIPA s.4.",
    status: "No PHI collected or transmitted",
  },
  {
    standard: "HIPAA Safe Harbor",
    description:
      "US HIPAA Safe Harbor requires suppression of 18 specific identifier types before data can be considered de-identified. Our PII detection covers all 18 categories.",
    status: "All 18 identifiers addressed",
  },
  {
    standard: "GDPR Article 4(1)",
    description:
      "GDPR applies to personal data — information that can be linked to an identifiable person. Properly synthesized data with an MIA AUC near 0.50 falls outside this definition as truly anonymous data.",
    status: "MIA AUC ~0.51 supports anonymity",
  },
]
