import { useState } from 'react'
import type { ExpenditureRow } from '@/data/revenueSeedData'

const fmt = (n: number) =>
  '$' + Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0 })
const fmtK = (n: number) => (n >= 1000 ? '$' + (n / 1000).toFixed(0) + 'k' : fmt(n))
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0)

interface RevenueDonutChartProps {
  data: ExpenditureRow[]
}

export function RevenueDonutChart({ data }: RevenueDonutChartProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  const total = data.reduce((s, d) => s + d.amount, 0)
  const R = 52
  const CX = 72
  const CY = 72
  const stroke = 22
  let cumulative = 0

  const slices = data.map((d) => {
    const startAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2
    cumulative += d.amount
    const endAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2
    const x1 = CX + R * Math.cos(startAngle)
    const y1 = CY + R * Math.sin(startAngle)
    const x2 = CX + R * Math.cos(endAngle)
    const y2 = CY + R * Math.sin(endAngle)
    const large = endAngle - startAngle > Math.PI ? 1 : 0
    return { ...d, x1, y1, x2, y2, large }
  })

  const hov = hovered !== null ? data[hovered] : null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      <svg width={144} height={144} style={{ flexShrink: 0 }}>
        {slices.map((s, i) => (
          <path
            key={i}
            d={`M ${CX} ${CY} L ${s.x1} ${s.y1} A ${R} ${R} 0 ${s.large} 1 ${s.x2} ${s.y2} Z`}
            fill={s.color}
            opacity={hovered === null || hovered === i ? 1 : 0.3}
            style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
        <circle cx={CX} cy={CY} r={R - stroke} fill="var(--bg-surface, #fff)" />
        <text
          x={CX}
          y={CY - 6}
          textAnchor="middle"
          fontSize="11"
          fontWeight="700"
          fill="var(--text-primary, #111)"
        >
          {hov ? fmtK(hov.amount) : fmtK(total)}
        </text>
        <text
          x={CX}
          y={CY + 10}
          textAnchor="middle"
          fontSize="9"
          fill="var(--text-muted, #9CA3AF)"
        >
          {hov ? hov.category : 'total'}
        </text>
      </svg>
      <div style={{ flex: 1 }}>
        {data.map((d, i) => (
          <div
            key={i}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 0',
              cursor: 'default',
              opacity: hovered === null || hovered === i ? 1 : 0.4,
              transition: 'opacity 0.15s',
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                background: d.color,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-secondary, #555)', flex: 1 }}>
              {d.category}
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-primary, #111)',
              }}
            >
              {fmt(d.amount)}
            </span>
            <span
              style={{
                fontSize: 10,
                color: 'var(--text-muted, #9CA3AF)',
                width: 32,
                textAlign: 'right',
              }}
            >
              {pct(d.amount, total)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
