"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCircle2, Zap, Loader2, Sparkles, ArrowRight, AlertCircle, Brain } from "lucide-react"
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
    <div className="flex-1 flex flex-col p-4 sm:p-6 gap-4 overflow-auto">
      {/* Step header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-[10px] font-semibold px-2 py-0.5 rounded-full border border-primary/20 uppercase tracking-widest mb-1.5">
            <Sparkles className="h-2.5 w-2.5" />
            Step 04 · Generate
          </div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">
            Synthesising Patient Population
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Sampling from distributions and dependencies. No real rows are ever consulted.
          </p>
        </div>
        {generationStatus === "generating" && (
          <div className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs text-primary font-semibold">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Running
          </div>
        )}
        {generationStatus === "done" && (
          <Badge variant="success" className="gap-1 h-7 px-2.5">
            <CheckCircle2 className="h-3 w-3" /> Complete
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Generation progress */}
        <div className="space-y-4">
          {/* Progress bar with animated fill */}
          <div className="rounded-xl border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Brain className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">Generation progress</div>
                  <div className="text-[11px] text-muted-foreground">
                    Multi-stage sampling pipeline
                  </div>
                </div>
              </div>
              <div className="text-2xl font-bold text-foreground tabular-nums">
                {Math.round(progressPct)}
                <span className="text-sm text-muted-foreground font-normal">%</span>
              </div>
            </div>
            <Progress value={progressPct} className="h-2" />
          </div>

          {/* Progress log */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                  Event log
                </div>
                <div className="text-[10px] text-muted-foreground font-mono">
                  {generationProgress.length} events
                </div>
              </div>
              <div className="space-y-1 max-h-56 overflow-y-auto font-mono text-xs rounded-md bg-muted/40 border p-3">
                {generationProgress.map((msg, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="text-muted-foreground/70 flex-shrink-0 tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-foreground leading-relaxed">{msg}</span>
                  </div>
                ))}
                {generationStatus === "generating" && (
                  <div className="flex items-center gap-2.5 text-muted-foreground animate-pulse">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                    <span>Processing…</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Success result card */}
          {generationStatus === "done" && generationResult && (
            <Card className="relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-0.5 bg-emerald-400/80" />
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-900/50 flex items-center justify-center">
                    <Zap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <p className="font-semibold text-foreground">Generation Complete</p>
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                        success
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      <span className="font-semibold text-foreground tabular-nums">
                        {generationResult.rows_generated.toLocaleString()}
                      </span>{" "}
                      synthetic patients created using{" "}
                      <span className="font-mono text-xs bg-muted border rounded px-1.5 py-0.5 text-foreground">
                        {generationResult.model_used}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                      Zero real patient rows were used — only statistical metadata crossed the
                      privacy boundary.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {generationStatus === "error" && (
            <Card className="relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-0.5 bg-rose-400/80" />
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200/70 dark:border-rose-900/50 flex items-center justify-center">
                    <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">Generation failed</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Server connection lost. Start over to begin a fresh session.
                    </p>
                    <button
                      onClick={() => dispatch({ type: "RESET" })}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-card hover:bg-muted text-foreground text-xs font-medium px-3 py-1.5 transition-colors"
                    >
                      Start Over
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <button
            disabled={generationStatus !== "done"}
            onClick={() => dispatch({ type: "SET_STEP", step: 5 })}
            className="group w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-all shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary"
          >
            {generationStatus === "done" ? (
              <>
                View Fidelity Report
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </>
            ) : generationStatus === "error" ? (
              "Generation failed"
            ) : (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating…
              </>
            )}
          </button>
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
