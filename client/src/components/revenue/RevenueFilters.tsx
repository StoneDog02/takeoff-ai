import type { Job } from '@/types/global'
import type { RevenueFiltersState } from '@/types/revenue'
import { dayjs, toISODate } from '@/lib/date'

interface RevenueFiltersProps {
  filters: RevenueFiltersState
  jobs: Job[]
  onFiltersChange: (next: RevenueFiltersState) => void
}

type RangeKey = 'month' | 'ytd' | 'year'

export function RevenueFilters({
  filters,
  jobs,
  onFiltersChange,
}: RevenueFiltersProps) {
  const set = (partial: Partial<RevenueFiltersState>) => {
    onFiltersChange({ ...filters, ...partial })
  }

  const setRange = (key: RangeKey) => {
    const now = dayjs()
    let dateFrom: string
    let dateTo: string
    if (key === 'month') {
      dateFrom = toISODate(now.startOf('month'))
      dateTo = toISODate(now.endOf('month'))
    } else if (key === 'ytd') {
      dateFrom = toISODate(now.startOf('year'))
      dateTo = toISODate(now)
    } else {
      dateFrom = toISODate(now.startOf('year'))
      dateTo = toISODate(now.endOf('year'))
    }
    set({ dateFrom, dateTo })
  }

  const isMonth = filters.dateFrom === toISODate(dayjs().startOf('month')) && filters.dateTo >= toISODate(dayjs())
  const isYtd = filters.dateFrom === toISODate(dayjs().startOf('year'))
  const isYear = filters.dateTo === toISODate(dayjs().endOf('year'))

  return (
    <div className="filter-bar">
      <span className="filter-label">Filters</span>

      <div className="filter-date-wrap">
        <span className="filter-date-label">From</span>
        <input
          type="date"
          className="filter-date"
          value={filters.dateFrom}
          onChange={(e) => set({ dateFrom: e.target.value })}
        />
      </div>
      <div className="filter-date-wrap">
        <span className="filter-date-label">To</span>
        <input
          type="date"
          className="filter-date"
          value={filters.dateTo}
          onChange={(e) => set({ dateTo: e.target.value })}
        />
      </div>

      <div className="filter-group">
        <button
          type="button"
          className={`filter-shortcut ${isMonth ? 'active' : ''}`}
          onClick={() => setRange('month')}
        >
          This month
        </button>
        <button
          type="button"
          className={`filter-shortcut ${isYtd && !isYear ? 'active' : ''}`}
          onClick={() => setRange('ytd')}
        >
          YTD
        </button>
        <button
          type="button"
          className={`filter-shortcut ${isYear ? 'active' : ''}`}
          onClick={() => setRange('year')}
        >
          Full year
        </button>
      </div>

      <div className="filter-sep" />

      <select
        className="filter-select"
        value={filters.jobId}
        onChange={(e) => set({ jobId: e.target.value })}
      >
        <option value="">All jobs</option>
        {jobs.map((j) => (
          <option key={j.id} value={j.id}>
            {j.name}
          </option>
        ))}
      </select>
    </div>
  )
}
