"use client"

import { createContext, useContext, useReducer, type ReactNode } from "react"
import {
  type PipelineState,
  type PipelineAction,
  initialPipelineState,
  pipelineReducer,
} from "@/lib/types"

const STORAGE_KEY = "vitalytics_prewarm"
const MAX_AGE_MS = 8 * 60 * 1000

function hydrateFromStorage(init: PipelineState): PipelineState {
  if (typeof window === "undefined") return init
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return init
    const parsed = JSON.parse(raw)
    if (Date.now() - parsed.timestamp > MAX_AGE_MS) {
      sessionStorage.removeItem(STORAGE_KEY)
      return init
    }
    sessionStorage.removeItem(STORAGE_KEY)
    return { ...init, sessionId: parsed.sessionId, metadata: parsed.metadata, demoMode: true }
  } catch {
    return init
  }
}

interface PipelineContextValue {
  state: PipelineState
  dispatch: (action: PipelineAction) => void
}

const PipelineContext = createContext<PipelineContextValue | null>(null)

export function PipelineProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(pipelineReducer, initialPipelineState, hydrateFromStorage)
  return (
    <PipelineContext.Provider value={{ state, dispatch }}>
      {children}
    </PipelineContext.Provider>
  )
}

export function usePipeline(): PipelineContextValue {
  const ctx = useContext(PipelineContext)
  if (!ctx) throw new Error("usePipeline must be used inside PipelineProvider")
  return ctx
}
