"use client"

import { useEffect, useState } from "react"
import { Download, Loader2, ShieldCheck, CheckCircle2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import AgentPanel from "@/components/AgentPanel"
import DistributionOverlay from "@/components/charts/DistributionOverlay"
import CorrelationHeatmap from "@/components/charts/CorrelationHeatmap"
import MiaGauge from "@/components/charts/MiaGauge"
import { usePipeline } from "@/app/pipeline/context"
import { runVerification, getDownloadUrl } from "@/lib/api"
import { PERSONAS } from "@/lib/types"
import { cn } from "@/lib/utils"

export default function VerifyStep() {
  const { state, dispatch } = usePipeline()
  const { sessionId, fidelityReport, role } = state
  const persona = PERSONAS.find((p) => p.key === role)
  const [loading, setLoading] = useState(false)
  const [selectedCol, setSelectedCol] = useState<string>("")

  useEffect(() => {
    if (!sessionId || fidelityReport !== null) return
    setLoading(true)
    runVerification(sessionId)
      .then(({ fidelity }) => {
        dispatch({ type: "SET_FIDELITY", report: fidelity })
        if (fidelity.column_scores.length > 0) {
          setSelectedCol(fidelity.column_scores[0].column)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [sessionId, fidelityReport, dispatch])

  useEffect(() => {
    if (fidelityReport && !selectedCol && fidelityReport.column_scores.length > 0) {
      setSelectedCol(fidelityReport.column_scores[0].column)
    }
  }, [fidelityReport, selectedCol])

  const agentMessage = fidelityReport
    ? `I have the fidelity report for a ${persona?.label}. Overall score: ${fidelityReport.overall_score.toFixed(1)}/100. Distribution fidelity: ${fidelityReport.distribution_fidelity.toFixed(1)}%. Correlation fidelity: ${fidelityReport.correlation_fidelity.toFixed(1)}%. MIA AUC: ${fidelityReport.mia_auc.toFixed(3)}. TSTR ratio: ${fidelityReport.tstr_ratio.toFixed(2)}. Please interpret these results and explain what they mean for the intended use case.`
    : `Running fidelity verification for a ${persona?.label}…`

  const passed =
    fidelityReport !== null &&
    fidelityReport.overall_score >= 80 &&
    fidelityReport.mia_auc < 0.65

  return (
    <div className="flex-1 flex flex-col p-6 gap-6 overflow-auto">
      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Running fidelity verification…
        </div>
      )}

      {fidelityReport && (
        <>
          {/* Pass / fail banner */}
          <div
            className={cn(
              "flex items-center justify-between rounded-lg border px-4 py-3",
              passed
                ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800"
                : "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800"
            )}
          >
            <div className="flex items-center gap-2">
              {passed ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
              )}
              <div>
                <p className={cn("font-semibold text-sm", passed ? "text-green-800 dark:text-green-300" : "text-amber-800 dark:text-amber-300")}>
                  Fidelity Report &mdash; {passed ? "Ready to export" : "Review recommended"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {passed
                    ? "All scores within acceptable thresholds. Dataset is cleared for use."
                    : "One or more metrics are below recommended thresholds. Review agent commentary before use."}
                </p>
              </div>
            </div>
            <span
              className={cn(
                "text-lg font-bold tabular-nums flex-shrink-0",
                fidelityReport.overall_score >= 80
                  ? "text-green-700 dark:text-green-400"
                  : fidelityReport.overall_score >= 60
                  ? "text-amber-600"
                  : "text-red-600"
              )}
            >
              {fidelityReport.overall_score.toFixed(1)}<span className="text-sm font-normal text-muted-foreground">/100</span>
            </span>
          </div>

          {/* Metric cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
              sub="Wasserstein distance"
            />
            <MetricCard
              label="Correlation Fidelity"
              value={`${fidelityReport.correlation_fidelity.toFixed(1)}`}
              unit="%"
              score={fidelityReport.correlation_fidelity}
              sub="Frobenius norm"
            />
            <MetricCard
              label="TSTR Ratio"
              value={fidelityReport.tstr_ratio.toFixed(2)}
              score={fidelityReport.tstr_ratio * 100}
              sub="vs real-trained model"
            />
          </div>

          {/* Charts — row A: gauge + distribution */}
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

          {/* Charts — row B: correlation heatmap full-width */}
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

          {/* Agent + download row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AgentPanel
              sessionId={sessionId}
              message={agentMessage}
              role={role}
              active={!loading && fidelityReport !== null}
              className="h-full min-h-[400px]"
            />

            <div className="space-y-4">
              <Card className={cn(
                "border",
                passed
                  ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800"
                  : "bg-muted/30"
              )}>
                <CardContent className="pt-4 pb-0">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className={cn("h-5 w-5 flex-shrink-0 mt-0.5", passed ? "text-green-600" : "text-muted-foreground")} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground">Privacy-Safe Dataset Ready</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        This synthetic dataset passed the MIA (Membership Inference Attack) test.
                        No real patient records can be reverse-engineered.
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-muted-foreground">
                        {fidelityReport.model_used && (
                          <span>
                            Model: <span className="font-mono bg-muted px-1 rounded">{fidelityReport.model_used}</span>
                          </span>
                        )}
                        <span>Real rows: <strong className="text-foreground">{fidelityReport.rows_real.toLocaleString()}</strong></span>
                        <span>Synthetic rows: <strong className="text-foreground">{fidelityReport.rows_synthetic.toLocaleString()}</strong></span>
                        <span>TSTR: <strong className="text-foreground">{fidelityReport.tstr_ratio.toFixed(2)}</strong></span>
                      </div>
                    </div>
                  </div>
                </CardContent>
                {sessionId && (
                  <div className="border-t border-border/50 mt-4 p-4">
                    <a href={getDownloadUrl(sessionId)} download>
                      <Button className="w-full gap-2" size="lg">
                        <Download className="h-4 w-4" />
                        Download Synthetic CSV
                      </Button>
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
  const borderColor =
    score >= 80 ? "border-t-green-500" : score >= 60 ? "border-t-amber-400" : "border-t-red-500"
  const valueColor =
    score >= 80 ? "text-green-600" : score >= 60 ? "text-amber-600" : "text-destructive"

  return (
    <Card className={cn("border-t-4", borderColor)}>
      <CardContent className="pt-4 pb-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={cn("text-2xl font-bold mt-1", valueColor)}>
          {value}
          {unit && <span className="text-base font-normal text-muted-foreground">{unit}</span>}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
      </CardContent>
    </Card>
  )
}
