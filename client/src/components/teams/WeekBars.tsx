interface WeekBarsProps {
  data: number[]
  color: string
  labels?: string[]
}

const DEFAULT_LABELS = ['W-4', 'W-3', 'W-2', 'W-1', 'Now']

export function WeekBars({ data, color, labels: _labels = DEFAULT_LABELS }: WeekBarsProps) {
  const max = Math.max(...data, 1)
  return (
    <div className="teams-week-bars">
      {data.map((v, i) => (
        <div key={i} className="teams-week-bar-col">
          <div
            className="teams-week-bar"
            style={{
              height: Math.max(2, (v / max) * 24),
              background: i === data.length - 1 ? color : `${color}40`,
            }}
          />
        </div>
      ))}
    </div>
  )
}
