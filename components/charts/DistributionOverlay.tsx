"use client"

import {
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { type ColumnFidelityScore } from "@/lib/types"

interface DistributionOverlayProps {
  columns: ColumnFidelityScore[]
  selectedColumn: string
  onColumnChange: (col: string) => void
}

export default function DistributionOverlay({
  columns,
  selectedColumn,
  onColumnChange,
}: DistributionOverlayProps) {
  const col = columns.find((c) => c.column === selectedColumn) ?? columns[0]
  const data = col?.distribution_data ?? []

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Real vs. Synthetic</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Column:</span>
          <select
            value={selectedColumn}
            onChange={(e) => onColumnChange(e.target.value)}
            className="text-xs border border-border rounded-md px-2 py-1 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {columns.map((c) => (
              <option key={c.column} value={c.column}>
                {c.column}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
          <XAxis
            dataKey="bin"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 6 }}
            formatter={(v: unknown) => [typeof v === "number" ? v.toFixed(2) : String(v), ""]}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Area
            type="monotone"
            dataKey="real"
            name="Real"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.5}
            strokeWidth={1.5}
          />
          <Area
            type="monotone"
            dataKey="synthetic"
            name="Synthetic"
            stroke="#f97316"
            fill="#f97316"
            fillOpacity={0.5}
            strokeWidth={1.5}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {col && (
        <p className="text-xs text-muted-foreground text-center">
          Fidelity score: <span className="font-semibold text-foreground">{col.wasserstein_score.toFixed(1)}/100</span>
        </p>
      )}
    </div>
  )
}
