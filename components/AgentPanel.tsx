"use client"

import React, { useEffect, useRef, useState, useCallback } from "react"
import { Brain, Wrench, CheckCircle, AlertCircle, ChevronDown, ChevronRight } from "lucide-react"

// Render the minimal markdown subset used in agent conclusions: **bold**, newlines, bullet lists.
function renderMd(text: string): React.ReactNode[] {
  return text.split("\n\n").map((para, pi) => {
    const lines = para.split("\n")
    const isList = lines.every((l) => l.trimStart().startsWith("- ") || l.trim() === "")
    if (isList) {
      return (
        <ul key={pi} className="space-y-0.5 list-none pl-0">
          {lines.filter((l) => l.trim()).map((l, li) => (
            <li key={li} className="flex gap-1.5 text-sm text-foreground leading-relaxed">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/50 flex-shrink-0" />
              <span>{inlineMd(l.replace(/^-\s+/, ""))}</span>
            </li>
          ))}
        </ul>
      )
    }
    return (
      <p key={pi} className="text-sm text-foreground leading-relaxed">
        {lines.map((l, li) => (
          <span key={li}>{inlineMd(l)}{li < lines.length - 1 ? <br /> : null}</span>
        ))}
      </p>
    )
  })
}

function inlineMd(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**")
      ? <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>
  )
}

const PERSONA_LABELS: Record<string, string> = {
  nurse: "Nurse View",
  analyst: "Analyst View",
  population_health: "Pop. Health View",
  researcher: "Researcher View",
  cio: "CIO View",
}
import { type SSEEvent, type PersonaKey } from "@/lib/types"
import { streamChat } from "@/lib/api"
import { cn } from "@/lib/utils"

interface AgentPanelProps {
  sessionId: string | null
  message: string
  role: PersonaKey
  active: boolean
  onConclusion?: (text: string) => void
  className?: string
}

function ToolCallBlock({ event }: { event: SSEEvent }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="flex gap-2 items-start">
      <Wrench className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs font-mono text-amber-700 hover:text-amber-900"
        >
          <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-xs font-semibold">
            {event.name}
          </span>
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
        {expanded && event.input && Object.keys(event.input).length > 0 && (
          <pre className="mt-1 text-xs bg-amber-50 p-2 rounded overflow-x-auto text-amber-900">
            {JSON.stringify(event.input, null, 2)}
          </pre>
        )}
      </div>
    </div>
  )
}

function EventRow({ event }: { event: SSEEvent }) {
  switch (event.type) {
    case "reasoning":
      return (
        <div className="flex gap-2 items-start">
          <Brain className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground italic leading-relaxed">{event.content}</p>
        </div>
      )
    case "tool_call":
      return <ToolCallBlock event={event} />
    case "tool_result":
      return (
        <div className="flex gap-2 items-start">
          <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-green-700 font-mono leading-relaxed break-all">{event.content}</p>
        </div>
      )
    case "conclusion":
      return (
        <div className="rounded-md bg-primary/5 border border-primary/20 p-3 space-y-2">
          {renderMd(event.content ?? "")}
        </div>
      )
    case "error":
      return (
        <div className="flex gap-2 items-start">
          <AlertCircle className="h-3.5 w-3.5 text-destructive mt-0.5 flex-shrink-0" />
          <p className="text-xs text-destructive">{event.content}</p>
        </div>
      )
    default:
      return null
  }
}

export default function AgentPanel({
  sessionId,
  message,
  role,
  active,
  onConclusion,
  className,
}: AgentPanelProps) {
  const [events, setEvents] = useState<SSEEvent[]>([])
  const [status, setStatus] = useState<"idle" | "streaming" | "done" | "error">("idle")
  const bottomRef = useRef<HTMLDivElement>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const hasStarted = useRef(false)

  const startStream = useCallback(() => {
    if (!sessionId || hasStarted.current) return
    hasStarted.current = true
    setStatus("streaming")
    setEvents([])

    cleanupRef.current = streamChat(
      sessionId,
      message,
      role,
      (event) => {
        if (event.type === "done") return
        setEvents((prev) => [...prev, event])
        if (event.type === "conclusion" && onConclusion) {
          onConclusion(event.content || "")
        }
      },
      () => setStatus("done"),
      () => setStatus("error")
    )
  }, [sessionId, message, role, onConclusion])

  useEffect(() => {
    if (active && sessionId && !hasStarted.current) {
      startStream()
    }
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current()
      }
    }
  }, [active, sessionId, startStream])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [events])

  return (
    <div className={cn("flex flex-col rounded-lg border bg-card overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/40">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Agent Reasoning</span>
          <span className="text-xs text-muted-foreground font-normal">· {PERSONA_LABELS[role] ?? role}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {status === "streaming" && (
            <>
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-muted-foreground">Live</span>
            </>
          )}
          {status === "done" && <span className="text-xs text-green-600 font-medium">Complete</span>}
          {status === "error" && <span className="text-xs text-destructive">Error</span>}
          {status === "idle" && <span className="text-xs text-muted-foreground">Ready</span>}
        </div>
      </div>

      {/* Event stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[420px] font-mono text-xs">
        {events.length === 0 && status === "idle" && (
          <p className="text-muted-foreground text-xs italic text-center pt-8">
            Analysis will appear here once the step loads.
          </p>
        )}
        {events.length === 0 && status === "streaming" && (
          <p className="text-muted-foreground text-xs italic animate-pulse">
            Connecting to agent…
          </p>
        )}
        {events.map((evt, i) => (
          <EventRow key={i} event={evt} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
