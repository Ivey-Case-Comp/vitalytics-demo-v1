"use client"

import { Check } from "lucide-react"
import { type PipelineStep } from "@/lib/types"
import { cn } from "@/lib/utils"

const STEPS: { label: string; description: string }[] = [
  { label: "Upload", description: "Load dataset" },
  { label: "Profile", description: "Extract metadata" },
  { label: "Hygiene", description: "Audit quality" },
  { label: "Generate", description: "Create synthetic" },
  { label: "Verify", description: "Fidelity check" },
]

interface PipelineNavProps {
  currentStep: PipelineStep
  onStepClick?: (step: PipelineStep) => void
}

export default function PipelineNav({ currentStep, onStepClick }: PipelineNavProps) {
  return (
    <nav className="flex items-center gap-1 overflow-x-auto">
      {STEPS.map((step, idx) => {
        const stepNum = (idx + 1) as PipelineStep
        const isCompleted = stepNum < currentStep
        const isCurrent = stepNum === currentStep
        const isClickable = isCompleted && onStepClick

        return (
          <div key={stepNum} className="flex items-center">
            <button
              onClick={() => isClickable && onStepClick(stepNum)}
              disabled={!isClickable}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                isCurrent && "bg-primary/10 text-primary font-semibold",
                isCompleted && "text-muted-foreground hover:bg-muted cursor-pointer",
                !isCompleted && !isCurrent && "text-muted-foreground/40 cursor-not-allowed"
              )}
            >
              <span className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold flex-shrink-0",
                isCurrent && "bg-primary text-primary-foreground",
                isCompleted && "bg-green-500 text-white",
                !isCompleted && !isCurrent && "bg-muted text-muted-foreground"
              )}>
                {isCompleted ? <Check className="h-3 w-3" /> : stepNum}
              </span>
              <span className="hidden sm:block">{step.label}</span>
            </button>
            {idx < STEPS.length - 1 && (
              <div className={cn("h-px w-6 flex-shrink-0", stepNum < currentStep ? "bg-green-400" : "bg-border")} />
            )}
          </div>
        )
      })}
    </nav>
  )
}
