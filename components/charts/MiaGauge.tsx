"use client"

interface MiaGaugeProps {
  auc: number // 0.0 – 1.0
}

// Piecewise mapping: each numeric zone gets an equal visual third
// 0.50–0.55 → first third (green)
// 0.55–0.65 → middle third (yellow)
// 0.65–1.00 → last third (red)
function aucToProgress(auc: number): number {
  const v = Math.max(0.5, Math.min(1.0, auc))
  if (v <= 0.55) return ((v - 0.5) / 0.05) * (1 / 3)
  if (v <= 0.65) return 1 / 3 + ((v - 0.55) / 0.1) * (1 / 3)
  return 2 / 3 + ((v - 0.65) / 0.35) * (1 / 3)
}

// Convert progress (0–1) on a 180° semicircle arc to SVG point
function polar(progress: number, cx: number, cy: number, r: number) {
  const angleDeg = progress * 180 - 180 // -180° (left) to 0° (right)
  const rad = (angleDeg * Math.PI) / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  }
}

// Build an SVG arc path from start progress to end progress
function arc(p1: number, p2: number, cx: number, cy: number, r: number): string {
  const a = polar(p1, cx, cy, r)
  const b = polar(p2, cx, cy, r)
  return `M ${a.x} ${a.y} A ${r} ${r} 0 0 1 ${b.x} ${b.y}`
}

export default function MiaGauge({ auc }: MiaGaugeProps) {
  const cx = 100
  const cy = 100
  const r = 68

  const progress = aucToProgress(auc)
  const needle = polar(progress, cx, cy, r - 4)

  let statusColor = "#22c55e"
  let statusLabel = "Strong Privacy"
  if (auc > 0.65) {
    statusColor = "#ef4444"
    statusLabel = "Privacy Risk"
  } else if (auc > 0.55) {
    statusColor = "#f59e0b"
    statusLabel = "Moderate"
  }

  // Tick label positions (outside the arc)
  const tickR = r + 14
  const tick = (p: number) => polar(p, cx, cy, tickR)
  const t050 = tick(0)
  const t055 = tick(1 / 3)
  const t065 = tick(2 / 3)
  const t100 = tick(1)

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <span className="text-sm font-medium text-foreground">MIA AUC Score</span>
      <svg
        viewBox="0 0 200 140"
        width="100%"
        style={{ maxWidth: 240 }}
        aria-label={`MIA AUC: ${auc.toFixed(2)}`}
      >
        {/* Background arc */}
        <path
          d={arc(0, 1, cx, cy, r)}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="14"
          strokeLinecap="round"
        />
        {/* Green zone: 0.50–0.55 */}
        <path
          d={arc(0, 1 / 3, cx, cy, r)}
          fill="none"
          stroke="#86efac"
          strokeWidth="14"
          strokeLinecap="round"
        />
        {/* Yellow zone: 0.55–0.65 */}
        <path
          d={arc(1 / 3, 2 / 3, cx, cy, r)}
          fill="none"
          stroke="#fde68a"
          strokeWidth="14"
          strokeLinecap="round"
        />
        {/* Red zone: 0.65–1.00 */}
        <path
          d={arc(2 / 3, 1, cx, cy, r)}
          fill="none"
          stroke="#fca5a5"
          strokeWidth="14"
          strokeLinecap="round"
        />

        {/* Tick labels */}
        <g fontSize="8" fill="#6b7280" fontFamily="ui-monospace, monospace">
          <text x={t050.x} y={t050.y + 3} textAnchor="middle">
            0.50
          </text>
          <text x={t055.x - 2} y={t055.y} textAnchor="middle">
            0.55
          </text>
          <text x={t065.x + 2} y={t065.y} textAnchor="middle">
            0.65
          </text>
          <text x={t100.x} y={t100.y + 3} textAnchor="middle">
            1.00
          </text>
        </g>

        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={needle.x}
          y2={needle.y}
          stroke={statusColor}
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* Center hub */}
        <circle cx={cx} cy={cy} r="5" fill={statusColor} />

        {/* AUC value */}
        <text
          x={cx}
          y={cy + 30}
          textAnchor="middle"
          fontSize="20"
          fontWeight="bold"
          fill="currentColor"
        >
          {auc.toFixed(2)}
        </text>
      </svg>
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-xs font-semibold" style={{ color: statusColor }}>
          {statusLabel}
        </span>
        <span className="text-xs text-muted-foreground">0.5 = indistinguishable from real</span>
      </div>
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-1.5 rounded bg-green-300" /> 0.50–0.55
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-1.5 rounded bg-amber-200" /> 0.55–0.65
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-1.5 rounded bg-red-300" /> &gt;0.65
        </span>
      </div>
    </div>
  )
}
