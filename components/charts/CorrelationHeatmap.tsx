"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

interface CorrelationHeatmapProps {
  real: number[][]
  synthetic: number[][]
  columns: string[]
}

function corrToColor(v: number): string {
  // Blue (negative) → White (zero) → Red (positive)
  const abs = Math.abs(v)
  if (v > 0) {
    const r = Math.round(239 + (255 - 239) * (1 - abs))
    const g = Math.round(239 - 239 * abs)
    const b = Math.round(239 - 239 * abs)
    return `rgb(${r},${g},${b})`
  } else {
    const r = Math.round(239 - 239 * abs)
    const g = Math.round(239 - 239 * abs)
    const b = Math.round(239 + (255 - 239) * (1 - abs))
    return `rgb(${r},${g},${b})`
  }
}

export default function CorrelationHeatmap({ real, synthetic, columns }: CorrelationHeatmapProps) {
  const [mode, setMode] = useState<"real" | "synthetic">("real")
  const matrix = mode === "real" ? real : synthetic
  // Show up to 8 columns
  const cols = columns.slice(0, 8)
  const mat = matrix.slice(0, 8).map((row) => row.slice(0, 8))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Correlation Matrix</span>
        <div className="flex rounded-md border border-border overflow-hidden text-xs">
          <button
            onClick={() => setMode("real")}
            className={cn("px-2.5 py-1 transition-colors", mode === "real" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted")}
          >
            Real
          </button>
          <button
            onClick={() => setMode("synthetic")}
            className={cn("px-2.5 py-1 transition-colors", mode === "synthetic" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted")}
          >
            Synthetic
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="w-16" />
              {cols.map((c) => (
                <th key={c} className="p-0.5 font-mono font-normal text-muted-foreground text-center" style={{ fontSize: 9 }}>
                  <span className="block truncate max-w-[40px]">{c}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mat.map((row, ri) => (
              <tr key={ri}>
                <td className="pr-1 font-mono text-muted-foreground text-right" style={{ fontSize: 9 }}>
                  <span className="truncate block max-w-[60px]">{cols[ri]}</span>
                </td>
                {row.map((v, ci) => (
                  <td
                    key={ci}
                    style={{ backgroundColor: corrToColor(v), width: 32, height: 28 }}
                    className="text-center border border-background/40"
                    title={`${cols[ri]} × ${cols[ci]}: ${v.toFixed(2)}`}
                  >
                    <span className="text-[9px] font-mono" style={{ color: Math.abs(v) > 0.5 ? "white" : "#374151" }}>
                      {v.toFixed(2)}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
