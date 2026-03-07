interface HealthRingProps {
  score: number
}

export function HealthRing({ score }: HealthRingProps) {
  const r = 30
  const cx = 36
  const cy = 36
  const circumference = 2 * Math.PI * r
  const dash = (score / 100) * circumference
  const color = score >= 75 ? '#16a34a' : score >= 50 ? '#f59e0b' : '#dc2626'
  const label = score >= 75 ? 'Healthy' : score >= 50 ? 'Watch' : 'At Risk'

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="72" height="72" viewBox="0 0 72 72" className="overflow-visible">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg-base)" strokeWidth="6" />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
        <text
          x={cx}
          y={cy + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="14"
          fontWeight="700"
          fill="var(--text-primary)"
          fontFamily="var(--font-sans, system-ui, sans-serif)"
        >
          {score}
        </text>
      </svg>
      <span className="text-[11px] font-semibold" style={{ color }}>
        {label}
      </span>
    </div>
  )
}
