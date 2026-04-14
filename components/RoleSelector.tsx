"use client"

import { PERSONAS, type PersonaKey } from "@/lib/types"
import { cn } from "@/lib/utils"

const COLOR_MAP: Record<string, string> = {
  blue: "border-blue-500 bg-blue-50 text-blue-900",
  violet: "border-violet-500 bg-violet-50 text-violet-900",
  green: "border-green-500 bg-green-50 text-green-900",
  amber: "border-amber-500 bg-amber-50 text-amber-900",
  slate: "border-slate-500 bg-slate-50 text-slate-900",
}
const BORDER_MAP: Record<string, string> = {
  blue: "border-l-blue-500",
  violet: "border-l-violet-500",
  green: "border-l-green-500",
  amber: "border-l-amber-500",
  slate: "border-l-slate-500",
}

interface RoleSelectorProps {
  currentRole: PersonaKey
  onSelect: (role: PersonaKey) => void
}

export default function RoleSelector({ currentRole, onSelect }: RoleSelectorProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {PERSONAS.map((persona) => {
        const active = persona.key === currentRole
        return (
          <button
            key={persona.key}
            onClick={() => onSelect(persona.key)}
            className={cn(
              "flex-shrink-0 text-left rounded-md border-l-4 border border-border px-3 py-2 w-44 transition-all",
              BORDER_MAP[persona.color],
              active ? COLOR_MAP[persona.color] : "bg-card hover:bg-muted"
            )}
          >
            <div className="text-xs font-semibold leading-tight">{persona.label}</div>
            <div className="text-xs text-muted-foreground mt-0.5 leading-tight line-clamp-2">
              {persona.description}
            </div>
          </button>
        )
      })}
    </div>
  )
}
