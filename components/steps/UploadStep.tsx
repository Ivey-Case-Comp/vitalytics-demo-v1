"use client"

import { useEffect, useRef, useState } from "react"
import { Upload, Database, Lock, Shield, ArrowRight, Sparkles, CheckCircle2 } from "lucide-react"
import { usePipeline } from "@/app/pipeline/context"
import { createSession, loadDemo, uploadCSV } from "@/lib/api"
import { cn } from "@/lib/utils"

export default function UploadStep() {
  const { state, dispatch } = usePipeline()
  const [loading, setLoading] = useState<"demo" | "upload" | null>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const creatingRef = useRef(false)

  // Create session on mount — guard with ref so React StrictMode's
  // double-invocation doesn't create two sessions in the same backend.
  useEffect(() => {
    if (state.sessionId || creatingRef.current) return
    creatingRef.current = true
    createSession()
      .then(({ session_id }) => {
        dispatch({ type: "SET_SESSION_ID", sessionId: session_id })
      })
      .catch(() => {
        creatingRef.current = false
        setError("Cannot connect to the server. Make sure the backend is running (see README for setup).")
      })
  }, [state.sessionId, dispatch])

  const demoPreloaded = !!(state.sessionId && state.metadata && state.demoMode)

  async function handleLoadDemo() {
    if (!state.sessionId) return
    if (demoPreloaded) {
      dispatch({ type: "SET_STEP", step: 2 })
      return
    }
    setLoading("demo")
    setError(null)
    try {
      const res = await loadDemo(state.sessionId)
      dispatch({ type: "SET_METADATA", metadata: res.metadata })
      dispatch({ type: "SET_DEMO_MODE", demo: true })
      dispatch({ type: "SET_STEP", step: 2 })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(null)
    }
  }

  async function handleFileUpload(file: File) {
    if (!state.sessionId || !file.name.endsWith(".csv")) {
      setError("Please upload a CSV file.")
      return
    }
    setLoading("upload")
    setError(null)
    try {
      const res = await uploadCSV(state.sessionId, file)
      dispatch({ type: "SET_METADATA", metadata: res.metadata })
      dispatch({ type: "SET_DEMO_MODE", demo: false })
      dispatch({ type: "SET_STEP", step: 2 })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex-1 relative overflow-auto">
      <div
        className="absolute inset-0 -z-10 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 0%, hsl(var(--primary) / 0.08), transparent 60%)",
        }}
      />

      <div className="flex flex-col items-center justify-center min-h-full p-6 sm:p-10 gap-8">
        <div className="text-center max-w-xl space-y-3">
          <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-[11px] font-medium px-3 py-1 rounded-full border border-primary/20">
            <Sparkles className="h-3 w-3" />
            Step 01 · Load Dataset
          </div>
          <h2 className="text-3xl font-bold text-foreground tracking-tight">
            Load your dataset
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Upload any healthcare CSV or use the pre-loaded Synthea Ontario demo. No real patient
            data is ever stored — only statistical metadata crosses the privacy boundary.
          </p>
        </div>

        <div className="w-full max-w-xl space-y-4">
          {/* Demo card — primary action */}
          <button
            onClick={handleLoadDemo}
            disabled={loading !== null || (!state.sessionId && !demoPreloaded)}
            className={cn(
              "group w-full text-left relative overflow-hidden rounded-xl border-2 bg-gradient-to-br to-transparent hover:shadow-md transition-all p-5 disabled:opacity-60 disabled:cursor-not-allowed",
              demoPreloaded
                ? "border-emerald-400/60 from-emerald-500/[0.06] hover:border-emerald-500/80"
                : "border-primary/30 from-primary/[0.04] hover:border-primary/60"
            )}
          >
            <div className={cn(
              "absolute inset-x-0 top-0 h-0.5",
              demoPreloaded
                ? "bg-gradient-to-r from-emerald-400/40 via-emerald-500 to-emerald-400/40"
                : "bg-gradient-to-r from-primary/40 via-primary to-primary/40"
            )} />
            <div className="flex items-center gap-4">
              <div className={cn(
                "h-12 w-12 flex-shrink-0 rounded-lg border flex items-center justify-center transition-colors",
                demoPreloaded
                  ? "bg-emerald-50 border-emerald-200/70 text-emerald-600 dark:bg-emerald-950/40 dark:border-emerald-900/50"
                  : "bg-primary/10 border-primary/20 text-primary group-hover:bg-primary/15"
              )}>
                {demoPreloaded ? <CheckCircle2 className="h-5 w-5" /> : <Database className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground">Synthea Ontario Demo</h3>
                  {demoPreloaded ? (
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 dark:text-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-900/50">
                      Ready
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-primary bg-primary/10 border border-primary/20 rounded px-1.5 py-0.5">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  1,000 synthetic patients · 17 columns · York Region demographics
                </p>
              </div>
              <div className="flex-shrink-0">
                {demoPreloaded ? (
                  <div className="inline-flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-md font-semibold text-sm group-hover:bg-emerald-700 transition-colors">
                    Continue
                    <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-md font-semibold text-sm group-hover:bg-primary/90 transition-colors">
                    {loading === "demo" ? "Loading…" : "Load"}
                    {loading !== "demo" && (
                      <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                    )}
                  </div>
                )}
              </div>
            </div>
          </button>

          <div className="flex items-center gap-3 text-xs text-muted-foreground/80 font-medium">
            <div className="flex-1 h-px bg-border" />
            <span className="uppercase tracking-widest">or upload your own</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* CSV upload */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              const f = e.dataTransfer.files[0]
              if (f) handleFileUpload(f)
            }}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "relative rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-all",
              dragging
                ? "border-primary bg-primary/5 scale-[1.01]"
                : "border-border hover:border-primary/50 hover:bg-muted/40"
            )}
          >
            <div
              className={cn(
                "h-12 w-12 mx-auto mb-3 rounded-full flex items-center justify-center transition-colors",
                dragging
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground group-hover:text-primary"
              )}
            >
              <Upload className="h-5 w-5" />
            </div>
            <p className="font-semibold text-foreground">Drop CSV here or click to browse</p>
            <p className="text-xs text-muted-foreground mt-1.5">
              Any healthcare CSV · UTF-8 · under 50 MB
            </p>
            {loading === "upload" && (
              <p className="text-sm text-primary mt-3 animate-pulse font-medium">
                Uploading and extracting metadata…
              </p>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFileUpload(f)
            }}
          />

          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center gap-x-6 gap-y-2 flex-wrap justify-center text-xs text-muted-foreground pt-2">
          <span className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-emerald-500" /> Zero PHI stored
          </span>
          <span className="flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5 text-emerald-500" /> Metadata-only extraction
          </span>
          <span className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-emerald-500" /> PHIPA-ready
          </span>
        </div>
      </div>
    </div>
  )
}
