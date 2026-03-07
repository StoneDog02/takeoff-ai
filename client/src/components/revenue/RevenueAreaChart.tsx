import { useState, useRef } from 'react'
import type { TrendPoint, LastYearPoint } from '@/data/revenueSeedData'

const fmt = (n: number) =>
  '$' + Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0 })
const fmtK = (n: number) => (n >= 1000 ? '$' + (n / 1000).toFixed(0) + 'k' : fmt(n))
const pct = (a: number, b: number) => (b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0)

interface RevenueAreaChartProps {
  data: TrendPoint[]
  showComparison: boolean
  comparisonData: LastYearPoint[] | null
  viewMode: 'overview' | 'margin'
}

export function RevenueAreaChart({
  data,
  showComparison,
  comparisonData,
  viewMode,
}: RevenueAreaChartProps) {
  const [tooltip, setTooltip] = useState<{ idx: number; x: number; d: TrendPoint } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const W = 900
  const H = 260
  const PL = 54
  const PR = 20
  const PT = 16
  const PB = 40
  const IW = W - PL - PR
  const IH = H - PT - PB

  const allVals = data.flatMap((d) =>
    viewMode === 'margin' ? [pct(d.profit, d.revenue)] : [d.revenue, d.expenses]
  )
  const maxVal = Math.max(...allVals, 1)
  const yTicks = 5

  const scaleX = (i: number) => PL + (i / Math.max(data.length - 1, 1)) * IW
  const scaleY = (v: number) => PT + IH - (v / maxVal) * IH
  const scaleYPct = (v: number) => PT + IH - (v / 100) * IH

  const linePath = (arr: TrendPoint[], key: keyof TrendPoint, scaleFn: (v: number) => number) =>
    arr
      .map((d, i) => `${i === 0 ? 'M' : 'L'}${scaleX(i)},${scaleFn(Number(d[key]))}`)
      .join(' ')

  const areaPath = (arr: TrendPoint[], key: keyof TrendPoint, scaleFn: (v: number) => number) =>
    `${linePath(arr, key, scaleFn)} L${scaleX(arr.length - 1)},${PT + IH} L${scaleX(0)},${PT + IH} Z`

  const revPath = linePath(data, 'revenue', scaleY)
  const expPath = linePath(data, 'expenses', scaleY)
  const profPath = linePath(data, 'profit', scaleY)
  const revArea = areaPath(data, 'revenue', scaleY)
  const expArea = areaPath(data, 'expenses', scaleY)

  const marginPts = data
    .map((d, i) => `${scaleX(i)},${scaleYPct(pct(d.profit, d.revenue))}`)
    .join(' ')
  const marginArea = `M ${marginPts.split(' ').join(' L ')} L${scaleX(data.length - 1)},${PT + IH} L${scaleX(0)},${PT + IH} Z`

  const compPath =
    comparisonData && showComparison
      ? comparisonData
          .map((d, i) => `${i === 0 ? 'M' : 'L'}${scaleX(i)},${scaleY(d.revenue)}`)
          .join(' ')
      : null

  const handleMove = (e: React.MouseEvent) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const svgX = (e.clientX - rect.left) * (W / rect.width) - PL
    const idx = Math.round((svgX / IW) * Math.max(data.length - 1, 0))
    if (idx >= 0 && idx < data.length) setTooltip({ idx, x: scaleX(idx), d: data[idx] })
  }

  return (
    <div style={{ position: 'relative' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', overflow: 'visible' }}
        onMouseMove={handleMove}
        onMouseLeave={() => setTooltip(null)}
      >
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#EF4444" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="margGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {Array.from({ length: yTicks + 1 }, (_, i) => {
          const y = PT + (i / yTicks) * IH
          const val =
            viewMode === 'margin'
              ? Math.round(100 - (i / yTicks) * 100)
              : Math.round(maxVal - (i / yTicks) * maxVal)
          return (
            <g key={i}>
              <line
                x1={PL}
                y1={y}
                x2={W - PR}
                y2={y}
                stroke="var(--border, #F3F4F6)"
                strokeWidth="1"
              />
              <text
                x={PL - 6}
                y={y + 4}
                textAnchor="end"
                fontSize="10"
                fill="var(--text-muted, #9CA3AF)"
              >
                {viewMode === 'margin' ? `${val}%` : fmtK(val)}
              </text>
            </g>
          )
        })}

        {/* X axis labels */}
        {data.map((d, i) => (
          <text
            key={i}
            x={scaleX(i)}
            y={H - 6}
            textAnchor="middle"
            fontSize="10"
            fill="var(--text-muted, #9CA3AF)"
          >
            {d.label}
          </text>
        ))}

        {viewMode === 'margin' ? (
          <>
            <path d={marginArea} fill="url(#margGrad)" />
            <polyline
              points={marginPts}
              fill="none"
              stroke="#10B981"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : (
          <>
            <path d={revArea} fill="url(#revGrad)" />
            <path d={expArea} fill="url(#expGrad)" />
            <path
              d={revPath}
              fill="none"
              stroke="#3B82F6"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={expPath}
              fill="none"
              stroke="#EF4444"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="4 3"
            />
            <path
              d={profPath}
              fill="none"
              stroke="#10B981"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {compPath && (
              <path
                d={compPath}
                fill="none"
                stroke="#CBD5E1"
                strokeWidth="1.5"
                strokeDasharray="5 4"
                strokeLinecap="round"
              />
            )}
          </>
        )}

        {/* Tooltip crosshair */}
        {tooltip && (
          <>
            <line
              x1={tooltip.x}
              y1={PT}
              x2={tooltip.x}
              y2={PT + IH}
              stroke="var(--border, #E5E7EB)"
              strokeWidth="1"
              strokeDasharray="3 2"
            />
            {viewMode !== 'margin' && (
              <>
                <circle
                  cx={tooltip.x}
                  cy={scaleY(tooltip.d.revenue)}
                  r="4"
                  fill="#3B82F6"
                  stroke="#fff"
                  strokeWidth="2"
                />
                <circle
                  cx={tooltip.x}
                  cy={scaleY(tooltip.d.expenses)}
                  r="4"
                  fill="#EF4444"
                  stroke="#fff"
                  strokeWidth="2"
                />
                <circle
                  cx={tooltip.x}
                  cy={scaleY(tooltip.d.profit)}
                  r="4"
                  fill="#10B981"
                  stroke="#fff"
                  strokeWidth="2"
                />
              </>
            )}
          </>
        )}
      </svg>

      {/* Tooltip box */}
      {tooltip && (
        <div
          className="revenue-area-tooltip"
          style={{
            position: 'absolute',
            top: 10,
            left: `clamp(10px, calc(${(tooltip.x / W) * 100}% - 70px), calc(100% - 150px))`,
            background: 'var(--bg-tooltip, #1A1A1A)',
            borderRadius: 10,
            padding: '10px 14px',
            pointerEvents: 'none',
            zIndex: 10,
            minWidth: 140,
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text-muted, #888)',
              marginBottom: 8,
            }}
          >
            {tooltip.d.label}
          </div>
          {viewMode === 'margin' ? (
            <div style={{ fontSize: 14, fontWeight: 700, color: '#10B981' }}>
              {pct(tooltip.d.profit, tooltip.d.revenue)}% margin
            </div>
          ) : (
            <>
              {[
                { label: 'Revenue', val: tooltip.d.revenue, color: '#3B82F6' },
                { label: 'Expenses', val: tooltip.d.expenses, color: '#EF4444' },
                { label: 'Profit', val: tooltip.d.profit, color: '#10B981' },
              ].map((r) => (
                <div
                  key={r.label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 16,
                    marginBottom: 4,
                  }}
                >
                  <span style={{ fontSize: 11, color: 'var(--text-muted, #888)' }}>{r.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: r.color }}>{fmt(r.val)}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
