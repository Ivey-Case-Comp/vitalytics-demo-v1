"use client"

import { useEffect, useRef, useState } from "react"
import { Upload, Database, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
        setError("Cannot connect to backend. Make sure FastAPI is running on port 8000.")
      })
  }, [state.sessionId, dispatch])

  async function handleLoadDemo() {
    if (!state.sessionId) return
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
    <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8">
      <div className="text-center max-w-lg">
        <h2 className="text-2xl font-bold text-foreground mb-2">Load Your Dataset</h2>
        <p className="text-muted-foreground">
          Upload any healthcare CSV or use the pre-loaded Synthea Ontario demo dataset.
          No real patient data is ever stored — only statistical metadata crosses the privacy boundary.
        </p>
      </div>

      <div className="w-full max-w-xl space-y-4">
        {/* Demo button — primary action */}
        <Card className="border-2 border-primary/30 hover:border-primary/60 transition-colors">
          <CardContent className="pt-6 pb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Database className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Synthea Ontario Demo Dataset</h3>
                <p className="text-sm text-muted-foreground">
                  1,000 synthetic patients · 17 columns · York Region demographics
                </p>
              </div>
              <Button
                size="lg"
                onClick={handleLoadDemo}
                disabled={loading !== null || !state.sessionId}
                className="flex-shrink-0"
              >
                {loading === "demo" ? "Loading…" : "Load Demo"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <div className="flex-1 h-px bg-border" />
          <span>or upload your own</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* CSV upload */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f) }}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
            dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/50"
          )}
        >
          <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <p className="font-medium text-foreground">Drop CSV here or click to browse</p>
          <p className="text-sm text-muted-foreground mt-1">Accepts any healthcare CSV file</p>
          {loading === "upload" && (
            <p className="text-sm text-primary mt-2 animate-pulse">Uploading and extracting metadata…</p>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f) }}
        />

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>

      <div className="flex items-center gap-6 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> Zero PHI stored</span>
        <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> Metadata-only extraction</span>
        <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> PHIPA-ready</span>
      </div>
    </div>
  )
}
