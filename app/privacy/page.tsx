import Link from "next/link"
import { ArrowLeft, Shield, EyeOff, Database, Lock, FileCheck, AlertTriangle, Info } from "lucide-react"

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <span className="text-muted-foreground/40">|</span>
          <span className="font-semibold text-foreground text-sm">Privacy Architecture</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12 space-y-14">

        {/* Hero */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-medium px-4 py-1.5 rounded-full border border-primary/20">
            <Shield className="h-3.5 w-3.5" />
            Privacy-by-Design
          </div>
          <h1 className="text-4xl font-extrabold text-foreground tracking-tight">
            Your patient data never leaves<br className="hidden sm:block" /> your environment
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Most tools require you to upload sensitive records to a cloud service. Vitalytics works differently:
            only statistical summaries — never individual rows — cross the privacy boundary.
          </p>
        </div>

        {/* Privacy Boundary */}
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">The Privacy Boundary</h2>
            <p className="text-muted-foreground mt-1">
              Think of it like a census: the government learns that 52% of a neighbourhood is over 65, without ever knowing which house belongs to which family. Vitalytics does the same thing with your dataset.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
            {/* Left — stays inside */}
            <div className="rounded-lg border-2 border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 p-5 space-y-3">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-semibold text-sm">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                Stays in your environment
              </div>
              <ul className="text-sm text-red-800 dark:text-red-300 space-y-1.5">
                <li>• Real patient records</li>
                <li>• Names, dates of birth, SSNs</li>
                <li>• ICD codes and encounter data</li>
                <li>• Any row-level information</li>
              </ul>
              <p className="text-xs text-red-600 dark:text-red-400 font-medium pt-1 border-t border-red-200 dark:border-red-800">
                Never transmitted. Never stored externally.
              </p>
            </div>

            {/* Middle — what crosses */}
            <div className="flex flex-col items-center justify-center gap-3 text-center py-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Only statistics cross</p>
              <div className="w-full border-t-2 border-dashed border-muted-foreground/30 relative">
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-background px-2 text-muted-foreground/50 text-lg">→</span>
              </div>
              <div className="space-y-1.5 text-xs text-muted-foreground w-full">
                <div className="bg-muted rounded px-3 py-1.5 font-mono">avg_age = 52.3, σ = 18.1</div>
                <div className="bg-muted rounded px-3 py-1.5 font-mono">top_icd: E11.9 (22%)</div>
                <div className="bg-muted rounded px-3 py-1.5 font-mono">corr(age, bmi) = 0.31</div>
              </div>
              <p className="text-xs text-muted-foreground">Distributions, not individuals</p>
            </div>

            {/* Right — synthetic output */}
            <div className="rounded-lg border-2 border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 p-5 space-y-3">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-semibold text-sm">
                <Shield className="h-4 w-4 flex-shrink-0" />
                Synthetic output
              </div>
              <ul className="text-sm text-green-800 dark:text-green-300 space-y-1.5">
                <li>• Realistic patient-like records</li>
                <li>• Statistically representative</li>
                <li>• No real individual represented</li>
                <li>• Privacy score: MIA AUC ~0.51</li>
              </ul>
              <p className="text-xs text-green-600 dark:text-green-400 font-medium pt-1 border-t border-green-200 dark:border-green-800">
                Safe to share. Safe to train models on.
              </p>
            </div>
          </div>
        </section>

        {/* 5 Safeguards */}
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Five Privacy Safeguards</h2>
            <p className="text-muted-foreground mt-1">
              Applied automatically during the profiling step — before any statistics leave your environment.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SAFEGUARDS.map((s, i) => (
              <div key={i} className="flex gap-4 rounded-lg border bg-card p-4">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
                  <s.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="font-semibold text-sm text-foreground">{s.title}</div>
                  <div className="text-sm text-muted-foreground mt-1 leading-relaxed">{s.description}</div>
                  <div className="text-xs text-primary mt-2 font-mono bg-primary/5 rounded px-2 py-0.5 inline-block">{s.example}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* MIA */}
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">The Adversary Test</h2>
            <p className="text-muted-foreground mt-1">
              We don&apos;t just claim the synthetic data is private — we prove it by trying to break it.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              A <strong className="text-foreground">Membership Inference Attack (MIA)</strong> asks: if an adversary knows a real patient exists, can they look at the synthetic dataset and determine that this person&apos;s information was used to generate it?
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We test this by training a machine learning classifier to distinguish real records from synthetic ones. If the synthetic data is truly private, the classifier performs no better than random guessing — an AUC of 0.50.
            </p>
            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              <div className="rounded-md border-2 border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800 p-3">
                <div className="font-bold text-green-700 dark:text-green-400 text-lg">0.50–0.55</div>
                <div className="text-green-700 dark:text-green-400 text-xs mt-1 font-medium">Strong privacy</div>
                <div className="text-muted-foreground text-xs mt-0.5">No better than a coin flip</div>
              </div>
              <div className="rounded-md border-2 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3">
                <div className="font-bold text-amber-700 dark:text-amber-400 text-lg">0.55–0.65</div>
                <div className="text-amber-700 dark:text-amber-400 text-xs mt-1 font-medium">Review needed</div>
                <div className="text-muted-foreground text-xs mt-0.5">Some signal detected</div>
              </div>
              <div className="rounded-md border-2 border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 p-3">
                <div className="font-bold text-red-700 dark:text-red-400 text-lg">&gt; 0.65</div>
                <div className="text-red-700 dark:text-red-400 text-xs mt-1 font-medium">Privacy risk</div>
                <div className="text-muted-foreground text-xs mt-0.5">Structural leakage present</div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground border-t pt-3">
              Vitalytics targets an MIA AUC of ~0.51. This score is computed in real time using scikit-learn — it is not a fixed value.
            </p>
          </div>
        </section>

        {/* Compliance */}
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Regulatory Alignment</h2>
            <p className="text-muted-foreground mt-1">
              Vitalytics is designed to support compliance with major health privacy frameworks. These are architectural design principles — not legal certifications. Consult your privacy and legal teams before deploying in a regulated environment.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {COMPLIANCE.map((c, i) => (
              <div key={i} className="rounded-lg border bg-card p-5 space-y-2">
                <div className="font-semibold text-sm text-foreground">{c.standard}</div>
                <div className="text-sm text-muted-foreground leading-relaxed">{c.description}</div>
                <div className="text-xs text-primary font-medium mt-1 bg-primary/5 rounded px-2 py-0.5 inline-block">{c.status}</div>
              </div>
            ))}
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
            <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Transparency note:</strong> The TSTR ratio (how well models trained on synthetic data perform on real data) and MIA AUC are computed from your actual data during the verification step — they are not pre-set numbers. All five privacy safeguards run as code during profiling. You can inspect the open-source backend to verify every claim on this page.
            </p>
          </div>
        </section>

        <div className="text-center pt-4">
          <Link
            href="/pipeline"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
          >
            See it in action
            <Shield className="h-4 w-4" />
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
    description: "Columns containing names, social security numbers, health card numbers, dates of birth, and other personal identifiers are detected automatically and stripped before any statistics are computed.",
    example: "SSN, DOB, OHIP → removed entirely",
  },
  {
    icon: Lock,
    title: "Outlier Protection",
    description: "Extreme values at the edges of a distribution can make rare individuals identifiable. We cap numeric values at the 1st and 99th percentile before fitting any distributions, eliminating that risk.",
    example: "AGE outliers capped to [2, 91]",
  },
  {
    icon: Database,
    title: "Small Group Protection",
    description: "If a category value appears fewer than 5 times in your data — say, a rare ethnicity or an unusual diagnosis code — it gets merged into a generic group. This prevents someone from targeting a known individual in a small subgroup.",
    example: "RARE_ETHNICITY (n=3) → 'Other'",
  },
  {
    icon: FileCheck,
    title: "Geographic Generalization",
    description: "Postal codes are shortened to their first three characters (the Forward Sortation Area), which represents a region of roughly 8,000 people. This matches the geographic privacy standard in PHIPA Safe Harbour.",
    example: "M4S 1A1 → M4S",
  },
  {
    icon: Shield,
    title: "Frequency Noise",
    description: "For category counts between 5 and 10 — the zone where an attacker might narrow down who contributed to a value — a small random offset is added. The statistics remain accurate at a population level while individual contribution becomes undetectable.",
    example: "count = 7 → 7 ± random offset",
  },
]

const COMPLIANCE = [
  {
    standard: "PHIPA (Ontario)",
    description: "Ontario's health privacy law defines PHI as information that identifies an individual. Synthetic data with no recoverable link to any real person does not qualify as PHI under PHIPA s.4.",
    status: "No PHI collected or transmitted",
  },
  {
    standard: "HIPAA Safe Harbor",
    description: "US HIPAA Safe Harbor requires suppression of 18 specific identifier types before data can be considered de-identified. Our PII detection covers all 18 categories.",
    status: "All 18 identifiers addressed",
  },
  {
    standard: "GDPR Article 4(1)",
    description: "GDPR applies to personal data — information that can be linked to an identifiable person. Properly synthesized data with an MIA AUC near 0.50 falls outside this definition as truly anonymous data.",
    status: "MIA AUC ~0.51 supports anonymity claim",
  },
]
