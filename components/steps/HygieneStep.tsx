"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, AlertCircle, Info, CheckCircle2, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import AgentPanel from "@/components/AgentPanel"
import { usePipeline } from "@/app/pipeline/context"
import { runHygiene, applyHygieneFixes } from "@/lib/api"
import { type HygieneIssue, PERSONAS } from "@/lib/types"
import { cn } from "@/lib/utils"

const SEVERITY_ICON: Record<string, React.ReactNode> = {
  CRITICAL: <AlertCircle className="h-4 w-4 text-red-500" />,
  WARNING: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  INFO: <Info className="h-4 w-4 text-blue-500" />,
}
const SEVERITY_BADGE: Record<string, "critical" | "warning" | "secondary"> = {
  CRITICAL: "critical",
  WARNING: "warning",
  INFO: "secondary",
}

export default function HygieneStep() {
  const { state, dispatch } = usePipeline()
  const { sessionId, hygieneIssues, appliedFixes, role } = state
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState<string | null>(null)
  const persona = PERSONAS.find((p) => p.key === role)

  useEffect(() => {
    if (!sessionId || hygieneIssues !== null) return
    setLoading(true)
    runHygiene(sessionId)
      .then(({ issues }) => dispatch({ type: "SET_HYGIENE_ISSUES", issues }))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [sessionId, hygieneIssues, dispatch])

  async function handleFix(issueId: string) {
    if (!sessionId) return
    setApplying(issueId)
    try {
      await applyHygieneFixes(sessionId, [issueId])
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

  const agentMessage = hygieneIssues
    ? `I've run the hygiene audit on this dataset for a ${persona?.label}. Found ${hygieneIssues.length} issues including ${hygieneIssues.filter((i) => i.severity === "CRITICAL").length} critical. Please explain the most important issues and what impact they would have on synthetic data quality.`
    : `Running hygiene audit for a ${persona?.label}…`

  return (
    <div className="flex-1 flex flex-col p-6 gap-6 overflow-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Issues */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Data Quality Audit</h3>
            {loading && <span className="text-sm text-muted-foreground animate-pulse">Scanning…</span>}
            {hygieneIssues && (
              <div className="flex gap-2">
                <Badge variant="critical">{hygieneIssues.filter((i) => i.severity === "CRITICAL").length} Critical</Badge>
                <Badge variant="warning">{hygieneIssues.filter((i) => i.severity === "WARNING").length} Warnings</Badge>
              </div>
            )}
          </div>

          {hygieneIssues?.map((issue) => {
            const isFixed = appliedFixes.includes(issue.id)
            return (
              <Card
                key={issue.id}
                className={cn(
                  "border-l-4 transition-all",
                  issue.severity === "CRITICAL" && !isFixed && "border-l-red-500",
                  issue.severity === "CRITICAL" && isFixed && "border-l-green-500 opacity-60",
                  issue.severity === "WARNING" && !isFixed && "border-l-amber-500",
                  issue.severity === "WARNING" && isFixed && "border-l-green-500 opacity-60",
                  issue.severity === "INFO" && "border-l-blue-400"
                )}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{SEVERITY_ICON[issue.severity]}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={SEVERITY_BADGE[issue.severity]} className="text-xs">
                          {issue.severity}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{issue.category}</span>
                        <span className="text-xs text-muted-foreground">
                          {issue.affected_count} rows affected
                        </span>
                        {isFixed && (
                          <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                            <CheckCircle2 className="h-3 w-3" /> Fixed
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-foreground mt-1.5 leading-snug">{issue.description}</p>
                      {issue.fixable && !isFixed && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 h-7 text-xs gap-1"
                          disabled={applying === issue.id}
                          onClick={() => handleFix(issue.id)}
                        >
                          <Wrench className="h-3 w-3" />
                          {applying === issue.id ? "Applying…" : "Fix in Metadata"}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}

          {!loading && hygieneIssues?.length === 0 && (
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="text-sm font-medium text-foreground">No hygiene issues detected.</span>
              </CardContent>
            </Card>
          )}

          <Button
            className="w-full"
            size="lg"
            disabled={criticalUnresolved.length > 0}
            onClick={() => dispatch({ type: "SET_STEP", step: 4 })}
          >
            {criticalUnresolved.length > 0
              ? `Fix ${criticalUnresolved.length} critical issue(s) first`
              : "Proceed to Generation →"}
          </Button>
        </div>

        {/* Right: Agent */}
        <AgentPanel
          sessionId={sessionId}
          message={agentMessage}
          role={role}
          active={!loading && hygieneIssues !== null}
          className="h-full min-h-[500px]"
        />
      </div>
    </div>
  )
}
