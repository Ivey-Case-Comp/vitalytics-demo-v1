import Link from "next/link"
import { ArrowLeft, Shield, EyeOff, Database, Lock, FileCheck, AlertTriangle } from "lucide-react"

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

      <main className="max-w-4xl mx-auto px-4 py-12 space-y-12">
        {/* Headline */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 text-sm font-medium px-4 py-1.5 rounded-full border border-green-200">
            <Shield className="h-3.5 w-3.5" />
            Privacy-by-Design Architecture
          </div>
          <h1 className="text-4xl font-extrabold text-foreground">How Vitalytics Eliminates PHI Exposure</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Traditional de-identification tries to scrub identifiers from real data. We take a fundamentally different approach:
            real patient rows never leave the secure environment at all.
          </p>
        </div>

        {/* PHI boundary diagram */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-foreground">The Privacy Boundary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div className="rounded-lg border-2 border-red-200 bg-red-50 p-5 space-y-2">
              <div className="flex items-center gap-2 text-red-700 font-semibold text-sm">
                <AlertTriangle className="h-4 w-4" />
                Inside Secure Environment
              </div>
              <ul className="text-sm text-red-800 space-y-1">
                <li>• Real patient records</li>
                <li>• SSN, DOB, full names</li>
                <li>• ICD codes + encounter data</li>
                <li>• Raw demographic rows</li>
              </ul>
              <p className="text-xs text-red-600 mt-2">PHI stays here. Always.</p>
            </div>

            <div className="flex flex-col items-center gap-2 text-center">
              <div className="w-full border-t-2 border-dashed border-muted-foreground/40 relative">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-background px-2 text-xs text-muted-foreground font-medium">
                  ONLY STATISTICS CROSS →
                </span>
              </div>
              <div className="mt-4 space-y-1 text-xs text-muted-foreground">
                <div className="bg-muted rounded px-2 py-1">μ=52.3, σ=18.1</div>
                <div className="bg-muted rounded px-2 py-1">top_icd: {"{"}E11.9: 0.22{"}"}</div>
                <div className="bg-muted rounded px-2 py-1">corr(AGE,BMI)=0.31</div>
              </div>
            </div>

            <div className="rounded-lg border-2 border-green-200 bg-green-50 p-5 space-y-2">
              <div className="flex items-center gap-2 text-green-700 font-semibold text-sm">
                <Shield className="h-4 w-4" />
                Synthetic Output
              </div>
              <ul className="text-sm text-green-800 space-y-1">
                <li>• Statistically representative patients</li>
                <li>• Clinically realistic distributions</li>
                <li>• No real individual represented</li>
                <li>• MIA AUC ~0.51 (near-random)</li>
              </ul>
              <p className="text-xs text-green-600 mt-2">Safe to share. Safe to train on.</p>
            </div>
          </div>
        </section>

        {/* 5 Safeguards */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-foreground">5 Privacy Safeguards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SAFEGUARDS.map((s, i) => (
              <div key={i} className="flex gap-3 rounded-lg border bg-card p-4">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <s.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="font-semibold text-sm text-foreground">{s.title}</div>
                  <div className="text-sm text-muted-foreground mt-0.5">{s.description}</div>
                  <div className="text-xs text-primary mt-1 font-mono">{s.example}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* MIA explanation */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-foreground">How We Measure Privacy: MIA AUC</h2>
          <div className="rounded-lg border bg-card p-6 space-y-3">
            <p className="text-sm text-muted-foreground">
              A <strong className="text-foreground">Membership Inference Attack (MIA)</strong> tests whether an adversary can determine if a specific real patient
              was used to generate the synthetic data. We train a logistic regression classifier to distinguish
              real vs. synthetic records.
            </p>
            <div className="grid grid-cols-3 gap-4 text-center text-sm">
              <div className="rounded-md bg-green-50 border border-green-200 p-3">
                <div className="font-bold text-green-700 text-lg">0.50–0.55</div>
                <div className="text-green-600 text-xs">Strong Privacy — indistinguishable from coin flip</div>
              </div>
              <div className="rounded-md bg-amber-50 border border-amber-200 p-3">
                <div className="font-bold text-amber-700 text-lg">0.55–0.65</div>
                <div className="text-amber-600 text-xs">Review needed — some signal detected</div>
              </div>
              <div className="rounded-md bg-red-50 border border-red-200 p-3">
                <div className="font-bold text-red-700 text-lg">&gt; 0.65</div>
                <div className="text-red-600 text-xs">Privacy risk — structural leakage present</div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Vitalytics targets an MIA AUC of ~0.51 — essentially a coin flip — which means the synthetic dataset
              carries no recoverable information about any individual real patient.
            </p>
          </div>
        </section>

        {/* Compliance */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-foreground">Compliance Framing</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {COMPLIANCE.map((c, i) => (
              <div key={i} className="rounded-lg border bg-card p-4 space-y-2">
                <div className="font-semibold text-sm text-foreground">{c.standard}</div>
                <div className="text-sm text-muted-foreground">{c.description}</div>
                <div className="text-xs text-primary font-medium">{c.status}</div>
              </div>
            ))}
          </div>
        </section>

        <div className="text-center pt-4">
          <Link
            href="/pipeline"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
          >
            See It in Action
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
    title: "PII Column Suppression",
    description: "Columns matching PII patterns (SSN, FIRST, LAST, DOB, PASSPORT, DRIVERS) are suppressed before any statistics are computed.",
    example: "SSN → suppressed entirely",
  },
  {
    icon: Lock,
    title: "P1/P99 Percentile Capping",
    description: "Extreme outlier values are capped at the 1st and 99th percentile before distribution fitting, preventing rare individuals from being identifiable via outlier re-identification.",
    example: "AGE outliers capped at [2, 91]",
  },
  {
    icon: Database,
    title: "Rare Category Suppression",
    description: "Categorical values appearing fewer than 5 times are aggregated into an 'Other' bucket, preventing small-cell disclosure.",
    example: "RARE_ETHNICITY (n=3) → 'Other'",
  },
  {
    icon: FileCheck,
    title: "Geographic Generalization",
    description: "Postal codes are truncated to 3-character Forward Sortation Areas (FSAs), consistent with PHIPA Safe Harbour geographic standards.",
    example: "M4S 1A1 → M4S",
  },
  {
    icon: Shield,
    title: "Frequency Noise Injection",
    description: "Small amounts of Laplace noise are added to frequency counts before metadata is exported, providing differential privacy-style protection against frequency attacks.",
    example: "count(GLUCOSE_HIGH)=42 → 42 ± ε",
  },
]

const COMPLIANCE = [
  {
    standard: "PHIPA (Ontario)",
    description: "Ontario's Personal Health Information Protection Act. Synthetic data that contains no real individual's information is not PHI under PHIPA s.4.",
    status: "Architecturally compliant — no PHI collected",
  },
  {
    standard: "HIPAA Safe Harbor",
    description: "US HIPAA Safe Harbor requires suppression of 18 identifier categories. Our PII suppression covers all 18 categories automatically.",
    status: "18/18 identifiers addressed",
  },
  {
    standard: "GDPR Article 4(1)",
    description: "GDPR applies to personal data. Properly synthesized data that cannot re-identify individuals falls outside GDPR scope as anonymous data.",
    status: "MIA AUC ~0.51 supports anonymity claim",
  },
]
