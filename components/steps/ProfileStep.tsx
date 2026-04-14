"use client"

import { Shield, Eye, EyeOff, Database } from "lucide-react"
import { Button } from "@/components/ui/button"
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
    <div className="flex-1 flex flex-col p-6 gap-6 overflow-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Dataset stats */}
        <div className="space-y-4">
          {/* Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                Dataset Profile: <span className="font-mono text-sm">{metadata.table}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Rows" value={metadata.row_count.toLocaleString()} />
                <Stat label="Columns (kept)" value={Object.keys(metadata.columns).length} />
                <Stat label="Numeric" value={numericCols.length} />
                <Stat label="Categorical" value={categoricalCols.length} />
                <Stat label="Datetime" value={datetimeCols.length} />
                <Stat label="Suppressed" value={metadata.suppressed_columns.length} />
              </div>
            </CardContent>
          </Card>

          {/* Privacy Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-600" />
                Privacy Safeguards Applied
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {metadata.privacy_actions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No identifiers detected.</p>
              ) : (
                metadata.privacy_actions.map((action, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <EyeOff className="h-3.5 w-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-foreground">{action}</span>
                  </div>
                ))
              )}
              {metadata.suppressed_columns.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {metadata.suppressed_columns.map((c) => (
                    <Badge key={c} variant="secondary" className="text-xs font-mono">{c}</Badge>
                  ))}
                  <span className="text-xs text-muted-foreground self-center">suppressed</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Column previews */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Column Statistics (top 6)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(metadata.columns).slice(0, 6).map(([col, stat]) => (
                  <div key={col} className="flex items-center justify-between text-sm border-b border-border/50 pb-1.5 last:border-0">
                    <span className="font-mono text-xs text-foreground">{col}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{stat.type}</Badge>
                      {stat.null_rate > 0 && (
                        <span className="text-xs text-muted-foreground">{(stat.null_rate * 100).toFixed(1)}% null</span>
                      )}
                      {stat.type === "continuous" && stat.mean !== undefined && (
                        <span className="text-xs text-muted-foreground">μ={stat.mean.toFixed(1)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Button
            className="w-full"
            size="lg"
            onClick={() => dispatch({ type: "SET_STEP", step: 3 })}
          >
            Proceed to Hygiene Audit →
          </Button>
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

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-muted/50 rounded-md p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-bold text-foreground">{value}</div>
    </div>
  )
}
