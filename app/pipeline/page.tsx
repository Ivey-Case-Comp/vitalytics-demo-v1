"use client"

import { usePipeline } from "@/app/pipeline/context"
import PipelineNav from "@/components/PipelineNav"
import RoleSelector from "@/components/RoleSelector"
import UploadStep from "@/components/steps/UploadStep"
import ProfileStep from "@/components/steps/ProfileStep"
import HygieneStep from "@/components/steps/HygieneStep"
import GenerateStep from "@/components/steps/GenerateStep"
import VerifyStep from "@/components/steps/VerifyStep"
import type { PipelineStep } from "@/lib/types"

export default function PipelinePage() {
  const { state, dispatch } = usePipeline()
  const { currentStep, role } = state

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      {/* Top bar */}
      <header className="flex-shrink-0 border-b bg-card px-4 py-3">
        <div className="flex items-center justify-between gap-4 max-w-screen-xl mx-auto">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-2">
              <span className="text-lg font-bold text-primary">Vitalytics</span>
            </a>
            <span className="text-muted-foreground/40 text-sm">|</span>
            <PipelineNav
              currentStep={currentStep}
              onStepClick={(step: PipelineStep) => dispatch({ type: "SET_STEP", step })}
            />
          </div>
          <button
            onClick={() => dispatch({ type: "RESET" })}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Reset
          </button>
        </div>
      </header>

      {/* Role selector bar */}
      {currentStep > 1 && (
        <div className="flex-shrink-0 border-b bg-muted/30 px-4 py-2">
          <div className="max-w-screen-xl mx-auto">
            <RoleSelector
              currentRole={role}
              onSelect={(r) => dispatch({ type: "SET_ROLE", role: r })}
            />
          </div>
        </div>
      )}

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
