"use client"

import { useEffect, useState } from "react"
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Wrench,
  Sparkles,
  ArrowRight,
  Loader2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { usePipeline } from "@/app/pipeline/context"
import { runHygiene, applyHygieneFixes } from "@/lib/api"
import { type HygieneIssue, PERSONAS } from "@/lib/types"
import { cn } from "@/lib/utils"

const SEVERITY_ICON: Record<string, React.ReactNode> = {
  CRITICAL: <AlertCircle className="h-4 w-4 text-rose-500" />,
  WARNING: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  INFO: <Info className="h-4 w-4 text-blue-500" />,
}
const SEVERITY_BADGE: Record<string, "critical" | "warning" | "secondary"> = {
  CRITICAL: "critical",
  WARNING: "warning",
  INFO: "secondary",
}
const SEVERITY_ACCENT: Record<string, string> = {
  CRITICAL: "bg-rose-400/80",
  WARNING: "bg-amber-400/80",
  INFO: "bg-blue-400/80",
}

// ─── Role-specific insight text ───────────────────────────────────────────────

function getRoleInsight(role: string, issues: HygieneIssue[]): string {
  const critical = issues.filter((i) => i.severity === "CRITICAL")
  const warnings = issues.filter((i) => i.severity === "WARNING")

  if (issues.length === 0) {
    const clear: Record<string, string> = {
      nurse: "All quality checks passed — this data is safe for care training and simulation. No coding errors or unusual gaps detected.",
      analyst: "Hygiene audit clean across all 6 categories. ICD codes valid, null rates within threshold, no demographic skew above tolerance. Proceed to generation.",
      population_health: "No demographic skew detected relative to Ontario benchmarks — the cohort appears representative. Safe to generate a synthetic population.",
      researcher: "No systematic biases detected in the source data. Clean audit — proceed to generation with confidence that source biases won't be amplified.",
      cio: "All clinical data quality gates passed. No issues require resolution before generation.",
    }
    return clear[role] ?? "All hygiene checks passed. Proceed to generation."
  }

  const topCritical = critical[0]?.description ?? ""
  const topWarning = warnings[0]?.description ?? ""

  const insights: Record<string, string> = {
    nurse: critical.length > 0
      ? `There ${critical.length === 1 ? "is" : "are"} ${critical.length} issue${critical.length === 1 ? "" : "s"} that need fixing before the synthetic patients can be created. The most important: ${topCritical}. Leaving it unfixed could produce unrealistic training scenarios. Apply the fix below, then proceed.`
      : `No critical issues — data is safe to generate from. ${warnings.length > 0 ? `${warnings.length} minor item(s) noted: ${topWarning}.` : ""}`,
    analyst: `${issues.length} issue(s) detected — ${critical.length} critical, ${warnings.length} warnings. ${critical.length > 0 ? `Critical: ${critical.slice(0, 2).map((i) => i.description).join("; ")}. Unresolved criticals propagate structural errors into the synthetic dataset.` : "No critical issues — proceed to generation."}`,
    population_health: (() => {
      const demoIssues = issues.filter(
        (i) => i.category.toLowerCase().includes("demographic") || i.description.toLowerCase().includes("skew")
      )
      if (demoIssues.length > 0) {
        return `Demographic representativeness issue(s) detected (${demoIssues.length}): ${demoIssues[0].description}. These skews carry through to the synthetic cohort — acknowledge before using for equity-focused interventions. ${critical.length > 0 ? `Fix ${critical.length} critical issue(s) first.` : ""}`
      }
      return `No demographic skew detected. ${critical.length > 0 ? `${critical.length} critical issue(s) require resolution before generation: ${topCritical}.` : `${warnings.length > 0 ? warnings.length + " warning(s) noted — low severity, can proceed." : "Ready to generate."}`}`
    })(),
    researcher: `${issues.length} issue(s) detected. ${critical.length > 0 ? `Critical: ${topCritical}. ` : ""}${warnings.length > 0 ? `${warnings.length} warning(s) represent systematic patterns that will be preserved — and amplified — in the synthetic output: ${topWarning}. Document as methodology limitations if you proceed.` : "No systematic biases that would affect research validity."}`,
    cio: critical.length > 0
      ? `${critical.length} critical issue(s) require resolution before generation (governance risk: structural errors in synthetic output). ${topCritical}. Apply all fixes before proceeding — fixes modify statistical metadata only, no raw patient data is accessed.`
      : `No critical compliance risks. ${warnings.length} warning(s) noted but within acceptable thresholds. Proceed to generation.`,
  }

  return insights[role] ?? `${issues.length} issue(s): ${critical.length} critical, ${warnings.length} warnings. ${critical.length > 0 ? "Resolve critical issues before generation." : "Ready to generate."}`
}

// ─── Persona accent colours ───────────────────────────────────────────────────

const PERSONA_ACCENT: Record<string, { bar: string; label: string }> = {
  nurse:             { bar: "bg-blue-400",    label: "text-blue-600 dark:text-blue-400" },
  analyst:           { bar: "bg-violet-400",  label: "text-violet-600 dark:text-violet-400" },
  population_health: { bar: "bg-emerald-400", label: "text-emerald-600 dark:text-emerald-400" },
  researcher:        { bar: "bg-amber-400",   label: "text-amber-600 dark:text-amber-400" },
  cio:               { bar: "bg-slate-400",   label: "text-slate-600 dark:text-slate-400" },
}

export default function HygieneStep() {
  const { state, dispatch } = usePipeline()
  const { sessionId, hygieneIssues, appliedFixes, role } = state
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState<string | null>(null)
  const persona = PERSONAS.find((p) => p.key === role)
  const accent = PERSONA_ACCENT[role] ?? PERSONA_ACCENT.analyst

  useEffect(() => {
    if (!sessionId || !state.metadata || hygieneIssues !== null) return
    setLoading(true)
    runHygiene(sessionId, state.metadata)
      .then(({ issues }) => dispatch({ type: "SET_HYGIENE_ISSUES", issues }))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [sessionId, state.metadata, hygieneIssues, dispatch])

  async function handleFix(issueId: string) {
    if (!sessionId) return
    setApplying(issueId)
    try {
      await applyHygieneFixes(sessionId, [issueId], state.metadata ?? undefined)
      dispatch({ type: "APPLY_FIX", issueId })
    } catch (e) {
      console.error(e)
    } finally {
      setApplying(null)
    }
  }

  const criticalUnresolved = (hygieneIssues || []).filter(
    (i) => i.severity === "CRITICAL" && i.fixable && !appliedFixes.includes(i.id)
  )

  const criticalCount = (hygieneIssues || []).filter((i) => i.severity === "CRITICAL").length
  const warningCount = (hygieneIssues || []).filter((i) => i.severity === "WARNING").length
  const infoCount = (hygieneIssues || []).filter((i) => i.severity === "INFO").length

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 gap-4 overflow-auto">
      {/* Step header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-[10px] font-semibold px-2 py-0.5 rounded-full border border-primary/20 uppercase tracking-widest mb-1.5">
            <Sparkles className="h-2.5 w-2.5" />
            Step 03 · Hygiene Audit
          </div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">
            Data Hygiene Review
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Auto-detected data quality and privacy issues. Resolve critical items before generation.
          </p>
        </div>
        {hygieneIssues && (
          <div className="flex gap-1.5 flex-wrap">
            <SummaryPill count={criticalCount} label="Critical" tone="rose" />
            <SummaryPill count={warningCount} label="Warnings" tone="amber" />
            <SummaryPill count={infoCount} label="Info" tone="blue" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Issues */}
        <div className="space-y-3">
          {loading && (
            <div className="rounded-xl border bg-card p-6 flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Scanning dataset for hygiene issues…
            </div>
          )}

          {hygieneIssues?.map((issue) => {
            const isFixed = appliedFixes.includes(issue.id)
            return (
              <Card
                key={issue.id}
                className={cn(
                  "relative overflow-hidden transition-all hover:shadow-sm",
                  isFixed && "opacity-75"
                )}
              >
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 w-1",
                    isFixed ? "bg-emerald-400" : SEVERITY_ACCENT[issue.severity]
                  )}
                />
                <CardContent className="pt-4 pb-4 pl-5">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {isFixed ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        SEVERITY_ICON[issue.severity]
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant={SEVERITY_BADGE[issue.severity]}
                          className="text-[10px] h-5"
                        >
                          {issue.severity}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground font-medium">
                          {issue.category}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          · {issue.affected_count.toLocaleString()} rows
                        </span>
                        {isFixed && (
                          <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold ml-auto">
                            <CheckCircle2 className="h-3 w-3" /> Fixed
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-foreground mt-1.5 leading-relaxed">
                        {issue.description}
                      </p>
                      {issue.fixable && !isFixed && (
                        <button
                          disabled={applying === issue.id}
                          onClick={() => handleFix(issue.id)}
                          className="mt-2.5 inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-medium px-3 py-1.5 transition-colors disabled:opacity-60"
                        >
                          {applying === issue.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Wrench className="h-3 w-3" />
                          )}
                          {applying === issue.id ? "Applying…" : "Apply Fix"}
                        </button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}

          {!loading && hygieneIssues?.length === 0 && (
            <Card className="relative overflow-hidden">
              <div className="absolute inset-y-0 left-0 w-1 bg-emerald-400" />
              <CardContent className="pt-5 pb-5 pl-5 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-900/50 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">All clear.</div>
                  <div className="text-xs text-muted-foreground">
                    No issues detected — data is ready for synthetic generation.
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <button
            disabled={criticalUnresolved.length > 0}
            onClick={() => dispatch({ type: "SET_STEP", step: 4 })}
            className="group w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-all shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary"
          >
            {criticalUnresolved.length > 0
              ? `Fix ${criticalUnresolved.length} critical issue${criticalUnresolved.length === 1 ? "" : "s"} first`
              : "Proceed to Generation"}
            {criticalUnresolved.length === 0 && (
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            )}
          </button>
        </div>

        {/* Right: Role insight (replaces agent panel) */}
        {!loading && hygieneIssues !== null && (
          <div className="relative overflow-hidden rounded-xl border bg-card">
            <div className={cn("absolute inset-y-0 left-0 w-1", accent.bar)} />
            <div className="pl-5 pr-4 py-4">
              <p className={cn("text-[10px] font-semibold uppercase tracking-widest mb-2.5", accent.label)}>
                {persona?.label} Perspective
              </p>
              <p className="text-sm text-foreground leading-relaxed">
                {getRoleInsight(role, hygieneIssues)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryPill({
  count,
  label,
  tone,
}: {
  count: number
  label: string
  tone: "rose" | "amber" | "blue"
}) {
  const toneClass = {
    rose: "bg-rose-50 dark:bg-rose-950/30 border-rose-200/70 dark:border-rose-900/50 text-rose-700 dark:text-rose-400",
    amber: "bg-amber-50 dark:bg-amber-950/30 border-amber-200/70 dark:border-amber-900/50 text-amber-700 dark:text-amber-400",
    blue: "bg-blue-50 dark:bg-blue-950/30 border-blue-200/70 dark:border-blue-900/50 text-blue-700 dark:text-blue-400",
  }[tone]
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium",
        toneClass
      )}
    >
      <span className="font-bold tabular-nums">{count}</span>
      <span>{label}</span>
    </div>
  )
}
