"use client"

import { createContext, useContext, useReducer, type ReactNode } from "react"
import {
  type PipelineState,
  type PipelineAction,
  initialPipelineState,
  pipelineReducer,
} from "@/lib/types"

interface PipelineContextValue {
  state: PipelineState
  dispatch: (action: PipelineAction) => void
}

const PipelineContext = createContext<PipelineContextValue | null>(null)

export function PipelineProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(pipelineReducer, initialPipelineState)
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
