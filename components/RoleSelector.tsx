"use client"

import { PERSONAS, type PersonaKey } from "@/lib/types"
import { cn } from "@/lib/utils"

const ACCENT: Record<string, string> = {
  blue: "bg-blue-400",
  violet: "bg-violet-400",
  green: "bg-emerald-400",
  amber: "bg-amber-400",
  slate: "bg-slate-400",
}

const ACTIVE_RING: Record<string, string> = {
  blue: "ring-blue-400/50 bg-blue-50/80 dark:bg-blue-950/30",
  violet: "ring-violet-400/50 bg-violet-50/80 dark:bg-violet-950/30",
  green: "ring-emerald-400/50 bg-emerald-50/80 dark:bg-emerald-950/30",
  amber: "ring-amber-400/50 bg-amber-50/80 dark:bg-amber-950/30",
  slate: "ring-slate-400/50 bg-slate-50/80 dark:bg-slate-900/40",
}

interface RoleSelectorProps {
  currentRole: PersonaKey
  onSelect: (role: PersonaKey) => void
}

export default function RoleSelector({ currentRole, onSelect }: RoleSelectorProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-0.5">
      {PERSONAS.map((persona) => {
        const active = persona.key === currentRole
        return (
          <button
            key={persona.key}
            onClick={() => onSelect(persona.key)}
            className={cn(
              "group flex-shrink-0 text-left relative rounded-lg border px-3 py-2 w-44 transition-all overflow-hidden",
              active
                ? cn("ring-2 border-transparent", ACTIVE_RING[persona.color])
                : "border-border bg-card hover:bg-muted/60 hover:border-primary/30"
            )}
          >
            <div className={cn("absolute inset-x-0 top-0 h-0.5", ACCENT[persona.color])} />
            <div className={cn("text-xs font-semibold leading-tight", active ? "text-foreground" : "text-foreground")}>
              {persona.label}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight line-clamp-2">
              {persona.description}
            </div>
          </button>
        )
      })}
    </div>
  )
}
