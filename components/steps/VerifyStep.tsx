"use client"

import { useEffect, useRef, useState } from "react"
import {
  Download,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  AlertCircle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import DistributionOverlay from "@/components/charts/DistributionOverlay"
import CorrelationHeatmap from "@/components/charts/CorrelationHeatmap"
import MiaGauge from "@/components/charts/MiaGauge"
import { usePipeline } from "@/app/pipeline/context"
import { runVerification, getDownloadUrl } from "@/lib/api"
import { type FidelityReport, PERSONAS } from "@/lib/types"
import { cn } from "@/lib/utils"

// ─── Role-specific insight text ───────────────────────────────────────────────

function getRoleInsight(role: string, report: FidelityReport): string {
  const { overall_score, distribution_fidelity, correlation_fidelity, mia_auc, tstr_ratio } = report
  const passed = overall_score >= 80 && mia_auc < 0.65

  const miaStrong = mia_auc < 0.55
  const miaOk = mia_auc < 0.65

  switch (role) {
    case "nurse": {
      const miaPlain = miaStrong
        ? "essentially impossible — like guessing heads or tails"
        : miaOk
        ? "very difficult"
        : "showing some risk — review before use"
      return passed
        ? `Score: ${overall_score.toFixed(0)}/100. Your synthetic patients match real patient patterns very closely. Most importantly, we ran a privacy test where a computer tried to guess whether any specific real patient was used — result: ${miaPlain}. Safe to use for training and simulation.`
        : `Score: ${overall_score.toFixed(0)}/100 — some differences were detected. Review the charts below before use in high-stakes training scenarios.`
    }
    case "analyst":
      return (
        `Overall: ${overall_score.toFixed(1)}/100 (${overall_score >= 80 ? "✓ above threshold" : "✗ below 80 threshold"}) · ` +
        `Distribution fidelity: ${distribution_fidelity.toFixed(1)}% · ` +
        `Correlation fidelity: ${correlation_fidelity.toFixed(1)}% · ` +
        `MIA AUC: ${mia_auc.toFixed(3)} (${miaStrong ? "strong privacy band <0.55" : miaOk ? "review band 0.55–0.65" : "exceeds 0.65 — investigate leakage"}) · ` +
        `TSTR: ${tstr_ratio.toFixed(2)} — synthetic trains at ${(tstr_ratio * 100).toFixed(0)}% of real-data performance.`
      )
    case "population_health":
      return (
        `Distribution fidelity ${distribution_fidelity.toFixed(1)}% confirms the synthetic cohort mirrors source population demographics ` +
        `${distribution_fidelity >= 85 ? "faithfully" : "with some drift — review per-column charts"}. ` +
        `Correlation fidelity ${correlation_fidelity.toFixed(1)}% — inter-variable relationships ` +
        `${correlation_fidelity >= 80 ? "well-preserved" : "show drift — check heatmap"}. ` +
        `Privacy (MIA ${mia_auc.toFixed(3)}): ${miaStrong ? "no individual patient identifiable — safe for Distributed Health Network sharing." : miaOk ? "within acceptable range." : "privacy risk — do not share externally."}`
      )
    case "researcher":
      return (
        `TSTR ratio: ${tstr_ratio.toFixed(2)} — synthetic achieves ${(tstr_ratio * 100).toFixed(0)}% of real-data utility ` +
        `${tstr_ratio >= 0.85 ? "(strong for exploratory development)" : "(below 0.85 target — limited for complex modelling)"}. ` +
        `MIA AUC: ${mia_auc.toFixed(3)} — privacy resistance is ` +
        `${miaStrong ? "excellent (effectively random)" : miaOk ? "acceptable" : "insufficient — do not use in privacy-sensitive contexts"}. ` +
        `Required: validate any model trained on this data against a held-out real cohort before clinical deployment or publication.`
      )
    case "cio": {
      const miaStatus = miaStrong
        ? "✓ Strong privacy — meets PHIPA Safe Harbour standard"
        : miaOk
        ? "✓ Within acceptable range"
        : "✗ Exceeds 0.65 — do not deploy"
      return passed
        ? `Compliance: PASS. Overall ${overall_score.toFixed(1)}/100 (≥80 ✓) · MIA AUC ${mia_auc.toFixed(3)} — ${miaStatus}. Dataset cleared for internal analytics, AI development, vendor demos, and staff training. Export ready.`
        : `One or more thresholds not met. Overall: ${overall_score.toFixed(1)}/100 · MIA AUC: ${mia_auc.toFixed(3)} — ${miaStatus}. Consult your Privacy Officer before deployment.`
    }
    default:
      return `Overall: ${overall_score.toFixed(1)}/100. MIA AUC: ${mia_auc.toFixed(3)}. TSTR: ${tstr_ratio.toFixed(2)}. ${passed ? "Ready to export." : "Review recommended."}`
  }
}

const PERSONA_ACCENT: Record<string, { bar: string; label: string }> = {
  nurse:             { bar: "bg-blue-400",    label: "text-blue-600 dark:text-blue-400" },
  analyst:           { bar: "bg-violet-400",  label: "text-violet-600 dark:text-violet-400" },
  population_health: { bar: "bg-emerald-400", label: "text-emerald-600 dark:text-emerald-400" },
  researcher:        { bar: "bg-amber-400",   label: "text-amber-600 dark:text-amber-400" },
  cio:               { bar: "bg-slate-400",   label: "text-slate-600 dark:text-slate-400" },
}

export default function VerifyStep() {
  const { state, dispatch } = usePipeline()
  const { sessionId, fidelityReport, role } = state
  const persona = PERSONAS.find((p) => p.key === role)
  const accent = PERSONA_ACCENT[role] ?? PERSONA_ACCENT.analyst
  const [loading, setLoading] = useState(false)
  const [selectedCol, setSelectedCol] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const verifyingRef = useRef(false)

  function doVerify() {
    if (!sessionId || verifyingRef.current) return
    verifyingRef.current = true
    setLoading(true)
    setError(null)
    runVerification(sessionId)
      .then(({ fidelity }) => {
        dispatch({ type: "SET_FIDELITY", report: fidelity })
        if (fidelity.column_scores.length > 0) {
          setSelectedCol(fidelity.column_scores[0].column)
        }
      })
      .catch((e: Error) => {
        setError(e.message)
        verifyingRef.current = false
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!sessionId || fidelityReport !== null) return
    doVerify()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, fidelityReport])

  useEffect(() => {
    if (fidelityReport && !selectedCol && fidelityReport.column_scores.length > 0) {
      setSelectedCol(fidelityReport.column_scores[0].column)
    }
  }, [fidelityReport, selectedCol])

  const passed =
    fidelityReport !== null &&
    fidelityReport.overall_score >= 80 &&
    fidelityReport.mia_auc < 0.65

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 gap-4 overflow-auto">
      {/* Step header */}
      <div>
        <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-[10px] font-semibold px-2 py-0.5 rounded-full border border-primary/20 uppercase tracking-widest mb-1.5">
          <Sparkles className="h-2.5 w-2.5" />
          Step 05 · Verify
        </div>
        <h2 className="text-2xl font-bold text-foreground tracking-tight">
          Fidelity & Privacy Verification
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          We test the synthetic data against the real data — on distribution, correlation, utility,
          and leakage.
        </p>
      </div>

      {loading && (
        <div className="rounded-xl border bg-card p-6 flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Running fidelity verification…
        </div>
      )}

      {error && !loading && (
        <Card className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-rose-400/80" />
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200/70 dark:border-rose-900/50 flex items-center justify-center">
                <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Verification failed</p>
                <p className="text-xs text-muted-foreground mt-1">{error}</p>
                <button
                  onClick={doVerify}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-card hover:bg-muted text-foreground text-xs font-medium px-3 py-1.5 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {fidelityReport && (
        <>
          {/* Pass / fail banner */}
          <div
            className={cn(
              "relative overflow-hidden rounded-2xl border bg-gradient-to-br from-card to-card",
              passed
                ? "from-emerald-50/60 dark:from-emerald-950/20"
                : "from-amber-50/60 dark:from-amber-950/20"
            )}
          >
            <div
              className={cn(
                "absolute inset-y-0 left-0 w-1.5",
                passed ? "bg-emerald-400" : "bg-amber-400"
              )}
            />
            <div className="flex flex-col md:flex-row md:items-center gap-5 md:gap-8 pl-7 pr-6 py-6">
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <div
                  className={cn(
                    "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border",
                    passed
                      ? "bg-emerald-50 border-emerald-200/70 dark:bg-emerald-950/40 dark:border-emerald-900/50"
                      : "bg-amber-50 border-amber-200/70 dark:bg-amber-950/40 dark:border-amber-900/50"
                  )}
                >
                  {passed ? (
                    <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-base text-foreground tracking-tight">
                      Fidelity Report
                    </h3>
                    <span
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border whitespace-nowrap",
                        passed
                          ? "text-emerald-700 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-950/60 border-emerald-300/60 dark:border-emerald-900/50"
                          : "text-amber-700 dark:text-amber-400 bg-amber-100/80 dark:bg-amber-950/60 border-amber-300/60 dark:border-amber-900/50"
                      )}
                    >
                      {passed ? "Ready to export" : "Review recommended"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {passed
                      ? "All scores within acceptable thresholds. Dataset is cleared for use."
                      : "One or more metrics are below recommended thresholds. Review the insight card before use."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-5 flex-shrink-0 md:border-l md:pl-8">
                <div>
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                    Overall
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span
                      className={cn(
                        "text-5xl font-bold tabular-nums leading-none",
                        fidelityReport.overall_score >= 80
                          ? "text-emerald-600 dark:text-emerald-400"
                          : fidelityReport.overall_score >= 60
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-destructive"
                      )}
                    >
                      {fidelityReport.overall_score.toFixed(1)}
                    </span>
                    <span className="text-lg text-muted-foreground font-medium">/100</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Metric cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard
              label="Overall Score"
              value={`${fidelityReport.overall_score.toFixed(1)}`}
              unit="/100"
              score={fidelityReport.overall_score}
              sub={`${fidelityReport.rows_synthetic.toLocaleString()} synthetic rows`}
            />
            <MetricCard
              label="Distribution Fidelity"
              value={`${fidelityReport.distribution_fidelity.toFixed(1)}`}
              unit="%"
              score={fidelityReport.distribution_fidelity}
              sub="How closely distributions match"
            />
            <MetricCard
              label="Correlation Fidelity"
              value={`${fidelityReport.correlation_fidelity.toFixed(1)}`}
              unit="%"
              score={fidelityReport.correlation_fidelity}
              sub="How well relationships are preserved"
            />
            <MetricCard
              label="TSTR Ratio"
              value={fidelityReport.tstr_ratio.toFixed(2)}
              score={fidelityReport.tstr_ratio * 100}
              sub="Synthetic trains as well as real (1.0 = identical)"
            />
          </div>

          {/* Charts row A: gauge + distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Privacy Audit</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center px-3">
                <MiaGauge auc={fidelityReport.mia_auc} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Per-Column Distributions</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Select a column to compare real vs. synthetic distributions.</p>
              </CardHeader>
              <CardContent>
                <DistributionOverlay
                  columns={fidelityReport.column_scores}
                  selectedColumn={selectedCol}
                  onColumnChange={setSelectedCol}
                />
              </CardContent>
            </Card>
          </div>

          {/* Charts row B: correlation heatmap */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Correlation Structure</CardTitle>
            </CardHeader>
            <CardContent>
              <CorrelationHeatmap
                real={fidelityReport.correlation_real}
                synthetic={fidelityReport.correlation_synthetic}
                columns={fidelityReport.correlation_columns}
              />
            </CardContent>
          </Card>

          {/* Role insight + download */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Role insight (replaces agent panel) */}
            <div className="relative overflow-hidden rounded-xl border bg-card">
              <div className={cn("absolute inset-y-0 left-0 w-1", accent.bar)} />
              <div className="pl-5 pr-4 py-4">
                <p className={cn("text-[10px] font-semibold uppercase tracking-widest mb-2.5", accent.label)}>
                  {persona?.label} Perspective
                </p>
                <p className="text-sm text-foreground leading-relaxed">
                  {getRoleInsight(role, fidelityReport)}
                </p>
              </div>
            </div>

            {/* Download */}
            <div className="space-y-4">
              <Card className="relative overflow-hidden">
                <div
                  className={cn(
                    "absolute inset-x-0 top-0 h-0.5",
                    passed ? "bg-emerald-400/80" : "bg-muted-foreground/30"
                  )}
                />
                <CardContent className="pt-5 pb-0">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "h-10 w-10 rounded-lg border flex items-center justify-center flex-shrink-0",
                        passed
                          ? "bg-emerald-50 border-emerald-200/70 dark:bg-emerald-950/40 dark:border-emerald-900/50"
                          : "bg-muted border-border"
                      )}
                    >
                      <ShieldCheck
                        className={cn(
                          "h-5 w-5",
                          passed ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                        )}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground">Privacy-Safe Dataset</p>
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                        Passed the Membership Inference Attack (MIA) test — an adversary cannot
                        determine which real patients (if any) were used to create this dataset.
                      </p>
                      <div className="grid grid-cols-2 gap-2 mt-4">
                        <KV label="Real rows" value={fidelityReport.rows_real.toLocaleString()} />
                        <KV
                          label="Synthetic rows"
                          value={fidelityReport.rows_synthetic.toLocaleString()}
                        />
                        <KV label="TSTR" value={fidelityReport.tstr_ratio.toFixed(2)} />
                        {fidelityReport.model_used && (
                          <KV label="Model" value={fidelityReport.model_used} mono />
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
                {sessionId && (
                  <div className="border-t mt-5 p-4">
                    <a
                      href={getDownloadUrl(sessionId)}
                      download
                      className="group flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-all shadow-sm hover:shadow"
                    >
                      <Download className="h-4 w-4" />
                      Download Synthetic CSV
                    </a>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function MetricCard({
  label,
  value,
  unit,
  score,
  sub,
}: {
  label: string
  value: string
  unit?: string
  score: number
  sub: string
}) {
  const accentClass =
    score >= 80 ? "bg-emerald-400/80" : score >= 60 ? "bg-amber-400/80" : "bg-rose-400/80"
  const valueClass =
    score >= 80
      ? "text-emerald-600 dark:text-emerald-400"
      : score >= 60
      ? "text-amber-600 dark:text-amber-400"
      : "text-rose-600 dark:text-rose-400"

  return (
    <div className="relative overflow-hidden rounded-xl border bg-card p-4 hover:shadow-sm transition-shadow">
      <div className={cn("absolute inset-x-0 top-0 h-0.5", accentClass)} />
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
        {label}
      </div>
      <div className={cn("text-2xl font-bold mt-1.5 tabular-nums", valueClass)}>
        {value}
        {unit && (
          <span className="text-sm font-normal text-muted-foreground ml-0.5">{unit}</span>
        )}
      </div>
      <div className="text-[11px] text-muted-foreground mt-1 leading-snug">{sub}</div>
    </div>
  )
}

function KV({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md bg-muted/40 border px-2.5 py-1.5 min-w-0">
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
        {label}
      </div>
      <div
        className={cn(
          "text-sm font-semibold text-foreground truncate",
          mono && "font-mono text-xs"
        )}
      >
        {value}
      </div>
    </div>
  )
}
