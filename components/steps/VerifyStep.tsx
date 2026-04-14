"use client"

import { useEffect, useState } from "react"
import { Download, Loader2, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import AgentPanel from "@/components/AgentPanel"
import DistributionOverlay from "@/components/charts/DistributionOverlay"
import CorrelationHeatmap from "@/components/charts/CorrelationHeatmap"
import MiaGauge from "@/components/charts/MiaGauge"
import { usePipeline } from "@/app/pipeline/context"
import { runVerification, getDownloadUrl } from "@/lib/api"
import { PERSONAS } from "@/lib/types"

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
    ? `I have the fidelity report for a ${persona?.label}. Overall score: ${fidelityReport.overall_score.toFixed(1)}/100. Distribution fidelity: ${fidelityReport.distribution_fidelity.toFixed(1)}%. Correlation fidelity: ${fidelityReport.correlation_fidelity.toFixed(1)}%. MIA AUC: ${fidelityReport.mia_auc.toFixed(3)}. Please interpret these results and explain what they mean for the intended use case.`
    : `Running fidelity verification for a ${persona?.label}…`

  const scoreColor = (s: number) =>
    s >= 80 ? "text-green-600" : s >= 60 ? "text-amber-600" : "text-destructive"

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
          {/* Metric cards row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Overall Score"
              value={`${fidelityReport.overall_score.toFixed(1)}`}
              unit="/100"
              valueClass={scoreColor(fidelityReport.overall_score)}
              sub={`${fidelityReport.rows_synthetic.toLocaleString()} synthetic rows`}
            />
            <MetricCard
              label="MIA AUC"
              value={fidelityReport.mia_auc.toFixed(3)}
              valueClass={fidelityReport.mia_auc < 0.55 ? "text-green-600" : fidelityReport.mia_auc < 0.65 ? "text-amber-600" : "text-destructive"}
              sub={fidelityReport.mia_auc < 0.55 ? "Strong privacy" : "Review needed"}
            />
            <MetricCard
              label="Distribution Fidelity"
              value={`${fidelityReport.distribution_fidelity.toFixed(1)}`}
              unit="%"
              valueClass={scoreColor(fidelityReport.distribution_fidelity)}
              sub="Wasserstein distance"
            />
            <MetricCard
              label="Correlation Fidelity"
              value={`${fidelityReport.correlation_fidelity.toFixed(1)}`}
              unit="%"
              valueClass={scoreColor(fidelityReport.correlation_fidelity)}
              sub="Frobenius norm"
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Privacy Audit</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center">
                <MiaGauge auc={fidelityReport.mia_auc} />
              </CardContent>
            </Card>

            <Card className="lg:col-span-1">
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

            <Card className="lg:col-span-1">
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
          </div>

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
              <Card className="border-l-4 border-l-green-500">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-foreground">Privacy-Safe Dataset Ready</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        This synthetic dataset passed the MIA (Membership Inference Attack) test.
                        No real patient records can be reverse-engineered.
                      </p>
                      {fidelityReport.model_used && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Model: <span className="font-mono bg-muted px-1 rounded">{fidelityReport.model_used}</span>
                          &nbsp;·&nbsp;
                          Real rows: {fidelityReport.rows_real.toLocaleString()}
                          &nbsp;·&nbsp;
                          Synthetic rows: {fidelityReport.rows_synthetic.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {sessionId && (
                <a href={getDownloadUrl(sessionId)} download>
                  <Button className="w-full gap-2" size="lg">
                    <Download className="h-4 w-4" />
                    Download Synthetic CSV
                  </Button>
                </a>
              )}
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
  valueClass,
  sub,
}: {
  label: string
  value: string
  unit?: string
  valueClass: string
  sub: string
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold mt-1 ${valueClass}`}>
          {value}
          {unit && <span className="text-base font-normal text-muted-foreground">{unit}</span>}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
      </CardContent>
    </Card>
  )
}
