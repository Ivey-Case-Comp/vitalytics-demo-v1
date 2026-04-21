"use client"

import { Sparkles, RotateCcw } from "lucide-react"
import { usePipeline } from "@/app/pipeline/context"
import PipelineNav from "@/components/PipelineNav"
import UploadStep from "@/components/steps/UploadStep"
import ProfileStep from "@/components/steps/ProfileStep"
import HygieneStep from "@/components/steps/HygieneStep"
import GenerateStep from "@/components/steps/GenerateStep"
import VerifyStep from "@/components/steps/VerifyStep"
import type { PipelineStep } from "@/lib/types"

export default function PipelinePage() {
  const { state, dispatch } = usePipeline()
  const { currentStep } = state

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Top bar */}
      <header className="flex-shrink-0 border-b bg-card/90 backdrop-blur-sm px-4 py-2.5">
        <div className="flex items-center justify-between gap-4 max-w-screen-xl mx-auto">
          <div className="flex items-center gap-4">
            <a href="/" className="flex items-center gap-2 flex-shrink-0">
              <div className="h-6 w-6 rounded-md bg-primary/15 border border-primary/20 flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-sm font-bold tracking-tight text-foreground hidden sm:block">
                Vitalytics
              </span>
            </a>
            <div className="h-5 w-px bg-border flex-shrink-0" />
            <PipelineNav
              currentStep={currentStep}
              onStepClick={(step: PipelineStep) => dispatch({ type: "SET_STEP", step })}
            />
          </div>
          <button
            onClick={() => {
              if (window.confirm("Start over? All pipeline progress will be lost.")) {
                dispatch({ type: "RESET" })
              }
            }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-md px-2 py-1 hover:bg-muted"
          >
            <RotateCcw className="h-3 w-3" />
            <span className="hidden sm:inline">Start Over</span>
          </button>
        </div>
      </header>

      {/* Step content */}
      <main className="flex-1 overflow-auto flex flex-col">
        {currentStep === 1 && <UploadStep />}
        {currentStep === 2 && <ProfileStep />}
        {currentStep === 3 && <HygieneStep />}
        {currentStep === 4 && <GenerateStep />}
        {currentStep === 5 && <VerifyStep />}
      </main>
    </div>
  )
}
