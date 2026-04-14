"use client"

interface MiaGaugeProps {
  auc: number // 0.0 – 1.0
}

export default function MiaGauge({ auc }: MiaGaugeProps) {
  // Semicircle: 0.5 → left end, 1.0 → right end
  // Map auc [0.5, 1.0] → angle [-180°, 0°]
  const clampedAuc = Math.max(0.5, Math.min(1.0, auc))
  const angleDeg = ((clampedAuc - 0.5) / 0.5) * 180 - 180 // -180 to 0

  // Convert angle to SVG coordinates (cx=100, cy=100, r=70)
  const rad = (angleDeg * Math.PI) / 180
  const cx = 100
  const cy = 100
  const r = 68
  const nx = cx + r * Math.cos(rad)
  const ny = cy + r * Math.sin(rad)

  let statusColor = "#22c55e" // green
  let statusLabel = "Strong Privacy"
  if (auc > 0.65) {
    statusColor = "#ef4444"
    statusLabel = "Privacy Risk"
  } else if (auc > 0.55) {
    statusColor = "#f59e0b"
    statusLabel = "Moderate"
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-sm font-medium text-foreground">MIA AUC Score</span>
      <svg viewBox="0 0 200 120" width="200" height="120" aria-label={`MIA AUC: ${auc.toFixed(2)}`}>
        {/* Background arc (gray) */}
        <path
          d="M 24 100 A 76 76 0 0 1 176 100"
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="14"
          strokeLinecap="round"
        />
        {/* Green zone: 0.50–0.55 (left segment) */}
        <path
          d="M 24 100 A 76 76 0 0 1 64 36"
          fill="none"
          stroke="#86efac"
          strokeWidth="14"
          strokeLinecap="round"
        />
        {/* Yellow zone: 0.55–0.65 */}
        <path
          d="M 64 36 A 76 76 0 0 1 136 36"
          fill="none"
          stroke="#fde68a"
          strokeWidth="14"
          strokeLinecap="round"
        />
        {/* Red zone: 0.65–1.00 */}
        <path
          d="M 136 36 A 76 76 0 0 1 176 100"
          fill="none"
          stroke="#fca5a5"
          strokeWidth="14"
          strokeLinecap="round"
        />
        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={nx}
          y2={ny}
          stroke={statusColor}
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* Center dot */}
        <circle cx={cx} cy={cy} r="5" fill={statusColor} />
        {/* AUC value */}
        <text x={cx} y={cy + 22} textAnchor="middle" fontSize="18" fontWeight="bold" fill="currentColor">
          {auc.toFixed(2)}
        </text>
      </svg>
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-xs font-semibold" style={{ color: statusColor }}>
          {statusLabel}
        </span>
        <span className="text-xs text-muted-foreground">0.5 = indistinguishable from real</span>
      </div>
      <div className="flex gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-1.5 rounded bg-green-300" /> 0.50–0.55</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-1.5 rounded bg-amber-200" /> 0.55–0.65</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-1.5 rounded bg-red-300" /> &gt;0.65</span>
      </div>
    </div>
  )
}
