"use client"

import { Shield, EyeOff, Database, ArrowRight, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import AgentPanel from "@/components/AgentPanel"
import { usePipeline } from "@/app/pipeline/context"
import { PERSONAS } from "@/lib/types"

export default function ProfileStep() {
  const { state, dispatch } = usePipeline()
  const { metadata, sessionId, role } = state
  const persona = PERSONAS.find((p) => p.key === role)

  if (!metadata) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-muted-foreground">
        No metadata loaded. Go back to Upload.
      </div>
    )
  }

  const numericCols = Object.entries(metadata.columns).filter(([, m]) => m.type === "continuous")
  const categoricalCols = Object.entries(metadata.columns).filter(([, m]) => m.type === "categorical")
  const datetimeCols = Object.entries(metadata.columns).filter(([, m]) => m.type === "datetime")

  const agentMessage = `Please analyze this healthcare dataset profile for a ${persona?.label}.
Explain the key statistical findings, what the privacy safeguards detected, and whether this data
is ready for synthetic generation. Dataset: ${metadata.table}, ${metadata.row_count} rows.`

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 gap-4 overflow-auto">
      {/* Step header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-[10px] font-semibold px-2 py-0.5 rounded-full border border-primary/20 uppercase tracking-widest mb-1.5">
            <Sparkles className="h-2.5 w-2.5" />
            Step 02 · Profile
          </div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">
            Statistical Metadata Extracted
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="font-mono text-foreground">{metadata.table}</span> ·{" "}
            {metadata.row_count.toLocaleString()} rows ·{" "}
            {Object.keys(metadata.columns).length} active columns
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Dataset stats */}
        <div className="space-y-4">
          {/* Summary stat tiles */}
          <div className="grid grid-cols-3 gap-2.5">
            <Stat label="Rows" value={metadata.row_count.toLocaleString()} tone="primary" />
            <Stat label="Columns" value={Object.keys(metadata.columns).length} />
            <Stat label="Suppressed" value={metadata.suppressed_columns.length} tone={metadata.suppressed_columns.length > 0 ? "emerald" : "neutral"} />
            <Stat label="Numeric" value={numericCols.length} />
            <Stat label="Categorical" value={categoricalCols.length} />
            <Stat label="Datetime" value={datetimeCols.length} />
          </div>

          {/* Privacy Actions */}
          <Card className="relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-emerald-400/70" />
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-900/50 flex items-center justify-center">
                  <Shield className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                Privacy Safeguards Applied
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {metadata.privacy_actions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No sensitive identifiers detected — data is safe to profile.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {metadata.privacy_actions.map((action, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <EyeOff className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                      <span className="text-foreground leading-relaxed">{action}</span>
                    </li>
                  ))}
                </ul>
              )}
              {metadata.suppressed_columns.length > 0 && (
                <div className="mt-3 pt-3 border-t flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mr-1">
                    Suppressed
                  </span>
                  {metadata.suppressed_columns.map((c) => (
                    <Badge
                      key={c}
                      variant="secondary"
                      className="text-[10px] font-mono"
                    >
                      {c}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Column previews */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Database className="h-3.5 w-3.5 text-primary" />
                  </div>
                  Column Overview
                </span>
                <span className="text-[10px] font-normal text-muted-foreground font-mono">
                  6 of {Object.keys(metadata.columns).length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border/60">
                {Object.entries(metadata.columns).slice(0, 6).map(([col, stat]) => (
                  <div
                    key={col}
                    className="flex items-center justify-between text-sm py-2 first:pt-0 last:pb-0"
                  >
                    <span className="font-mono text-xs text-foreground truncate">{col}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant="outline" className="text-[10px] h-5">
                        {stat.type}
                      </Badge>
                      {stat.null_rate > 0 && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {(stat.null_rate * 100).toFixed(1)}% null
                        </span>
                      )}
                      {stat.type === "continuous" && stat.mean !== undefined && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          avg {stat.mean.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <button
            onClick={() => dispatch({ type: "SET_STEP", step: 3 })}
            className="group w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-all shadow-sm hover:shadow"
          >
            Proceed to Hygiene Audit
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {/* Right: Agent panel */}
        <AgentPanel
          sessionId={sessionId}
          message={agentMessage}
          role={role}
          active={true}
          className="h-full min-h-[500px]"
        />
      </div>
    </div>
  )
}

type StatTone = "primary" | "emerald" | "neutral"

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string
  value: string | number
  tone?: StatTone
}) {
  const toneClass = {
    primary: "from-primary/10 to-primary/5 border-primary/20",
    emerald: "from-emerald-500/10 to-emerald-500/5 border-emerald-500/20",
    neutral: "from-muted/60 to-muted/20 border-border",
  }[tone]
  const valueClass = {
    primary: "text-primary",
    emerald: "text-emerald-600 dark:text-emerald-400",
    neutral: "text-foreground",
  }[tone]

  return (
    <div
      className={`rounded-lg border bg-gradient-to-br ${toneClass} p-3`}
    >
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
        {label}
      </div>
      <div className={`text-xl font-bold ${valueClass} mt-0.5 tabular-nums`}>{value}</div>
    </div>
  )
}
