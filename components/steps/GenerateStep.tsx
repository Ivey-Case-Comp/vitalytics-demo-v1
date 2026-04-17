"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCircle2, Zap, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import AgentPanel from "@/components/AgentPanel"
import { usePipeline } from "@/app/pipeline/context"
import { startGeneration, pollGenerationStatus } from "@/lib/api"
import { PERSONAS } from "@/lib/types"

export default function GenerateStep() {
  const { state, dispatch } = usePipeline()
  const { sessionId, generationStatus, generationProgress, generationResult, role } = state
  const persona = PERSONAS.find((p) => p.key === role)
  const genStartedRef = useRef(false)
  const dispatchedMsgCount = useRef(0)
  const [progressPct, setProgressPct] = useState(0)

  useEffect(() => {
    if (!sessionId) return

    // Guard startGeneration with a ref so it fires only once even under
    // React StrictMode (which double-invokes effects in dev mode).
    if (!genStartedRef.current) {
      genStartedRef.current = true
      dispatch({ type: "SET_GEN_STATUS", status: "generating" })
      dispatch({ type: "ADD_GEN_PROGRESS", message: "Initialising generation engine…" })
      startGeneration(sessionId).catch((e: Error) => {
        if (e.message.includes("404")) {
          // Session was lost (e.g. backend restart) — reset and let user start over
          dispatch({ type: "RESET" })
        } else {
          dispatch({ type: "SET_GEN_STATUS", status: "error" })
        }
      })
    }

    // Poll is NOT guarded — it must restart on every effect invocation so
    // that StrictMode's cleanup+remount cycle ends with a live poll.
    const interval = setInterval(async () => {
      try {
        const data = await pollGenerationStatus(sessionId)
        const newMsgs = data.progress.slice(dispatchedMsgCount.current)
        for (const msg of newMsgs) {
          dispatch({ type: "ADD_GEN_PROGRESS", message: msg })
          dispatchedMsgCount.current++
        }
        if (data.status === "generated") {
          clearInterval(interval)
          if (data.result) {
            dispatch({
              type: "SET_GEN_RESULT",
              result: { rows_generated: data.result.rows_generated, model_used: data.result.model_used },
            })
          }
          dispatch({ type: "SET_GEN_STATUS", status: "done" })
        } else if (data.status === "error") {
          clearInterval(interval)
          dispatch({ type: "SET_GEN_STATUS", status: "error" })
        }
      } catch (e: unknown) {
        if (e instanceof Error && e.message.includes("404")) {
          clearInterval(interval)
          dispatch({ type: "RESET" })
        }
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [sessionId, dispatch])

  // Animate progress bar while generating
  useEffect(() => {
    if (generationStatus === "generating") {
      const t = setInterval(() => {
        setProgressPct((p) => Math.min(p + Math.random() * 8, 90))
      }, 800)
      return () => clearInterval(t)
    }
    if (generationStatus === "done") {
      setProgressPct(100)
    }
  }, [generationStatus])

  const agentMessage = generationResult
    ? `I've generated ${generationResult.rows_generated.toLocaleString()} synthetic patients using the ${generationResult.model_used} approach for a ${persona?.label}. Please explain what this synthetic dataset is, how privacy was preserved, and what it can be used for.`
    : `Generating synthetic patient data for a ${persona?.label}. Please explain the generation process, what model is being used, and how the metadata-sampling approach protects patient privacy.`

  return (
    <div className="flex-1 flex flex-col p-6 gap-6 overflow-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Generation progress */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Synthetic Data Generation</h3>
            {generationStatus === "generating" && (
              <div className="flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Running…</span>
              </div>
            )}
            {generationStatus === "done" && (
              <Badge variant="success" className="gap-1">
                <CheckCircle2 className="h-3 w-3" /> Complete
              </Badge>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{Math.round(progressPct)}%</span>
            </div>
            <Progress value={progressPct} className="h-2" />
          </div>

          {/* Progress log */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="space-y-1.5 max-h-48 overflow-y-auto font-mono text-xs">
                {generationProgress.map((msg, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-muted-foreground flex-shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-foreground">{msg}</span>
                  </div>
                ))}
                {generationStatus === "generating" && (
                  <div className="flex items-center gap-2 text-muted-foreground animate-pulse">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    <span>Processing…</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Success result card */}
          {generationStatus === "done" && generationResult && (
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-full bg-green-100">
                    <Zap className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">Generation Complete</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {generationResult.rows_generated.toLocaleString()} synthetic patients created
                      using <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">{generationResult.model_used}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Zero real patient rows were used — only statistical metadata crossed the privacy boundary.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {generationStatus === "error" && (
            <Card className="border-l-4 border-l-destructive">
              <CardContent className="pt-4 pb-4">
                <p className="text-sm text-destructive font-medium">Generation failed.</p>
                <p className="text-xs text-muted-foreground mt-1">Server connection lost. Click Start Over to begin a fresh session.</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => dispatch({ type: "RESET" })}
                >
                  Start Over
                </Button>
              </CardContent>
            </Card>
          )}

          <Button
            className="w-full"
            size="lg"
            disabled={generationStatus !== "done"}
            onClick={() => dispatch({ type: "SET_STEP", step: 5 })}
          >
            {generationStatus === "done" ? "View Fidelity Report →" : "Generating…"}
          </Button>
        </div>

        {/* Right: Agent */}
        <AgentPanel
          sessionId={sessionId}
          message={agentMessage}
          role={role}
          active={generationStatus === "generating" || generationStatus === "done"}
          className="h-full min-h-[500px]"
        />
      </div>
    </div>
  )
}
