"use client"

import { Check } from "lucide-react"
import { type PipelineStep } from "@/lib/types"
import { cn } from "@/lib/utils"

const STEPS: { label: string }[] = [
  { label: "Upload" },
  { label: "Profile" },
  { label: "Hygiene" },
  { label: "Generate" },
  { label: "Verify" },
]

interface PipelineNavProps {
  currentStep: PipelineStep
  onStepClick?: (step: PipelineStep) => void
}

export default function PipelineNav({ currentStep, onStepClick }: PipelineNavProps) {
  return (
    <nav className="flex items-center gap-0.5 overflow-x-auto">
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
                "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-all",
                isCurrent && "bg-primary/10 text-primary font-semibold ring-1 ring-primary/20",
                isCompleted && "text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer",
                !isCompleted && !isCurrent && "text-muted-foreground/40 cursor-not-allowed"
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold flex-shrink-0 transition-colors",
                  isCurrent && "bg-primary text-primary-foreground shadow-sm",
                  isCompleted && "bg-emerald-500 text-white",
                  !isCompleted && !isCurrent && "bg-muted text-muted-foreground border border-border"
                )}
              >
                {isCompleted ? <Check className="h-3 w-3" strokeWidth={3} /> : stepNum}
              </span>
              <span className="hidden sm:block">{step.label}</span>
            </button>
            {idx < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-px w-4 flex-shrink-0 transition-colors",
                  stepNum < currentStep ? "bg-emerald-400" : "bg-border"
                )}
              />
            )}
          </div>
        )
      })}
    </nav>
  )
}
