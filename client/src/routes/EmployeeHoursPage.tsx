import { useState, useEffect, useMemo } from 'react'
import { Clock, Briefcase, TrendingUp, Calendar } from 'lucide-react'
import { teamsApi, getProjectsList } from '@/api/teamsClient'
import { useEffectiveEmployee } from '@/hooks/useEffectiveEmployee'
import { useAuth } from '@/contexts/AuthContext'
import type { TimeEntry } from '@/types/global'
import { dayjs } from '@/lib/date'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'

const formatTime = (date: Date) => date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
const formatDateWeek = (date: Date) => dayjs(date).format('ddd MMM D')   // Fri Mar 6
const formatDayShortWeek = (date: Date) => dayjs(date).format('ddd')     // Fri
const formatDateMonth = (date: Date) => dayjs(date).format('ddd MMM D')   // Fri Mar 6
const formatDayShortMonth = (date: Date) => dayjs(date).format('MMM D')   // Mar 6

/** Stable hex color per job for bars and rows (opacity can be appended, e.g. color + 'cc') */
const JOB_COLOR_PALETTE = ['#c0392b', '#2563eb', '#047857', '#b45309', '#6d28d9', '#6b7280']
function jobColor(jobName: string): string {
  let h = 0
  for (let i = 0; i < jobName.length; i++) h = ((h << 5) - h) + jobName.charCodeAt(i) | 0
  return JOB_COLOR_PALETTE[Math.abs(h) % JOB_COLOR_PALETTE.length]
}

interface DisplayEntry {
  id: string
  date: string
  dayShort: string
  job: string
  clockIn: string
  clockOut: string
  hours: number
  source: 'GPS' | 'Manual'
}

function WeekBar({ entries, jobColorFn }: { entries: DisplayEntry[]; jobColorFn: (job: string) => string }) {
  const max = Math.max(...entries.map((e) => e.hours), 10)
  return (
    <div className="flex items-end gap-2 h-[72px] px-1">
      {entries.map((e) => {
        const pct = (e.hours / max) * 100
        const color = jobColorFn(e.job)
        return (
          <div key={e.id} className="flex-1 flex flex-col items-center gap-1">
            <div className="text-[10px] font-bold text-muted">{e.hours}h</div>
            <div className="w-full h-12 flex items-end">
              <div
                className="w-full min-h-[4px] rounded-t rounded-b-sm transition-[height] duration-300"
                style={{
                  height: `${pct}%`,
                  background: `linear-gradient(180deg, ${color}cc, ${color}66)`,
                  border: `1px solid ${color}44`,
                }}
              />
            </div>
            <div className="text-[10px] text-muted font-semibold">{e.dayShort}</div>
          </div>
        )
      })}
    </div>
  )
}

function EntryRow({
  entry,
  jobColorFn,
}: { entry: DisplayEntry; jobColorFn: (job: string) => string }) {
  const color = jobColorFn(entry.job)
  const dateParts = entry.date.split(' ')
  return (
    <div className="flex items-center gap-4 sm:gap-6 px-5 sm:px-6 py-3.5 border-b border-border dark:border-border-dark hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
      <div
        className="w-0.5 h-9 rounded-sm flex-shrink-0"
        style={{ background: color }}
      />
      <div className="w-[72px] flex-shrink-0">
        <div className="text-xs font-bold text-gray-700 dark:text-gray-200">
          {dateParts.slice(0, 2).join(' ')}
        </div>
        <div className="text-[10px] text-muted mt-0.5">{dateParts[0]}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-gray-900 dark:text-landing-white truncate mb-0.5">
          {entry.job}
        </div>
        <div className="text-[11px] text-muted flex items-center gap-1">
          <Clock size={10} /> {entry.clockIn} – {entry.clockOut}
        </div>
      </div>
      <div className="flex-shrink-0">
        <span
          className={`text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-md border ${
            entry.source === 'GPS'
              ? 'bg-primary/10 dark:bg-primary/20 text-primary border-primary/20'
              : 'bg-white/10 dark:bg-white/5 text-muted border-border dark:border-border-dark'
          }`}
        >
          {entry.source}
        </span>
      </div>
      <div className="w-[52px] text-right flex-shrink-0">
        <div className="text-[17px] font-extrabold tracking-tight text-gray-900 dark:text-landing-white">
          {entry.hours}
        </div>
        <div className="text-[10px] text-muted mt-0.5">hrs</div>
      </div>
    </div>
  )
}

export function EmployeeHoursPage() {
  const { employeeId, employeeName } = useEffectiveEmployee()
  const { employee: authEmployee } = useAuth()
  const [period, setPeriod] = useState<'week' | 'month'>('week')
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [jobNames, setJobNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  const displayName = employeeName ?? authEmployee?.name ?? 'Employee'
  const displayRole = authEmployee?.role ?? ''

  useEffect(() => {
    getProjectsList().then((projects) => {
      const map: Record<string, string> = {}
      projects.forEach((p) => { map[p.id] = p.name; })
      setJobNames(map)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!employeeId) {
      setEntries([])
      setLoading(false)
      return
    }
    setLoading(true)
    const start = period === 'week'
      ? dayjs().startOf('week').toISOString()
      : dayjs().startOf('month').toISOString()
    const end = period === 'week'
      ? dayjs().endOf('week').toISOString()
      : dayjs().endOf('month').toISOString()
    teamsApi.timeEntries
      .list({ employee_id: employeeId, from: start, to: end })
      .then((list) => {
        const completed = list.filter((e) => e.clock_out != null && e.hours != null)
        setEntries(completed)
      })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [employeeId, period])

  const displayEntries: DisplayEntry[] = useMemo(() => {
    const sorted = [...entries].sort((a, b) => b.clock_in.localeCompare(a.clock_in))
    return sorted.map((e) => ({
      id: e.id,
      date: period === 'week' ? formatDateWeek(new Date(e.clock_in)) : formatDateMonth(new Date(e.clock_in)),
      dayShort: period === 'week' ? formatDayShortWeek(new Date(e.clock_in)) : formatDayShortMonth(new Date(e.clock_in)),
      job: jobNames[e.job_id] ?? e.job_id,
      clockIn: formatTime(new Date(e.clock_in)),
      clockOut: formatTime(new Date(e.clock_out!)),
      hours: e.hours!,
      source: e.source === 'gps_auto' ? 'GPS' as const : 'Manual' as const,
    }))
  }, [entries, jobNames, period])

  const totalHours = displayEntries.reduce((s, e) => s + e.hours, 0)
  const avgHours = displayEntries.length > 0 ? totalHours / displayEntries.length : 0

  const jobBreakdown = useMemo(() => {
    const map: Record<string, number> = {}
    displayEntries.forEach((e) => { map[e.job] = (map[e.job] ?? 0) + e.hours })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [displayEntries])

  const weekBarEntries = useMemo(() => {
    if (period !== 'week' || entries.length === 0) return []
    const byDay: Record<string, DisplayEntry[]> = {}
    displayEntries.forEach((e) => {
      const raw = entries.find((x) => x.id === e.id)
      const key = raw ? dayjs(raw.clock_in).format('YYYY-MM-DD') : e.date
      if (!byDay[key]) byDay[key] = []
      byDay[key].push(e)
    })
    const days = Object.keys(byDay).sort()
    return days.map((day) => {
      const dayEntries = byDay[day]
      const first = dayEntries[0]
      return {
        id: day,
        date: first.date,
        dayShort: first.dayShort,
        job: first.job,
        clockIn: first.clockIn,
        clockOut: first.clockOut,
        hours: dayEntries.reduce((s, x) => s + x.hours, 0),
        source: first.source,
      }
    }).reverse()
  }, [displayEntries, entries, period])

  if (!employeeId) {
    return (
      <div className="w-full px-4 sm:px-6 lg:px-8 py-10">
        <div className="rounded-xl border border-border dark:border-border-dark bg-white dark:bg-dark-3 shadow-card p-6 font-sora">
          <p className="text-muted text-sm">
            Your employer removed you from their crew. This account can't be used until you're added back and sent a new invite.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-10 pb-16 relative font-sora text-gray-900 dark:text-landing-white">
      <style>{`
        @keyframes fade-up-hours {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .hours-fade-up { animation: fade-up-hours 0.35s ease forwards; }
      `}</style>

      <div
        className="absolute inset-0 bg-[radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)] dark:bg-[radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)] bg-[size:28px_28px] pointer-events-none"
        aria-hidden
      />

      <div className="relative z-10">
        {/* Header */}
        <div className="hours-fade-up flex flex-wrap items-center justify-between gap-4 mb-7">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight mb-1">My Hours</h1>
            <div className="text-sm text-muted">{displayName}{displayRole ? ` · ${displayRole}` : ''}</div>
          </div>
          <div className="flex bg-white/10 dark:bg-white/5 border border-border dark:border-border-dark rounded-lg p-0.5 gap-0.5">
            {(['week', 'month'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setPeriod(v)}
                className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                  period === v
                    ? 'bg-accent text-white shadow-[0_2px_8px_var(--color-accent-glow)]'
                    : 'text-muted hover:text-gray-900 dark:hover:text-landing-white'
                }`}
              >
                {v === 'week' ? 'This week' : 'This month'}
              </button>
            ))}
          </div>
        </div>

        {/* Metric cards */}
        <div className="hours-fade-up grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6" style={{ animationDelay: '0.05s' }}>
          {[
            {
              label: period === 'week' ? 'This week' : 'This month',
              value: loading ? '…' : totalHours.toFixed(1),
              unit: 'hrs',
              Icon: Clock,
              borderClass: 'border-t-accent',
            },
            {
              label: 'Daily average',
              value: loading ? '…' : avgHours.toFixed(1),
              unit: 'hrs',
              Icon: TrendingUp,
              borderClass: 'border-t-primary',
            },
            {
              label: 'Shifts logged',
              value: loading ? '…' : String(displayEntries.length),
              unit: 'days',
              Icon: Calendar,
              borderClass: 'border-t-emerald-500',
            },
          ].map(({ label, value, unit, Icon, borderClass }) => (
            <div
              key={label}
              className={`rounded-2xl border border-border dark:border-border-dark bg-white/60 dark:bg-white/5 p-5 sm:p-6 border-t-[3px] ${borderClass}`}
            >
              <div className="flex items-center gap-1.5 mb-2.5">
                <Icon size={13} className="text-muted" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted">{label}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-landing-white">{value}</span>
                <span className="text-sm text-muted font-medium">{unit}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Bar chart + Job breakdown: single column on small, two columns on large */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {period === 'week' && weekBarEntries.length > 0 && (
            <div className="hours-fade-up rounded-2xl border border-border dark:border-border-dark bg-white/60 dark:bg-white/5 p-5 sm:p-6 pb-4" style={{ animationDelay: '0.1s' }}>
              <div className="text-[11px] font-bold uppercase tracking-widest text-muted mb-3.5">Daily breakdown</div>
              <WeekBar entries={weekBarEntries} jobColorFn={jobColor} />
            </div>
          )}
          {jobBreakdown.length > 0 && (
            <div className={`hours-fade-up rounded-2xl border border-border dark:border-border-dark bg-white/60 dark:bg-white/5 p-5 sm:p-6 ${period !== 'week' || weekBarEntries.length === 0 ? 'lg:col-span-2' : ''}`} style={{ animationDelay: '0.12s' }}>
              <div className="text-[11px] font-bold uppercase tracking-widest text-muted mb-3.5">By job site</div>
              <div className="flex flex-col gap-2.5">
                {jobBreakdown.map(([job, hrs]) => {
                  const color = jobColor(job)
                  const pct = totalHours > 0 ? (hrs / totalHours) * 100 : 0
                  return (
                    <div key={job}>
                      <div className="flex justify-between items-center mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: color }}
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300 font-medium truncate min-w-0">
                            {job}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-gray-900 dark:text-landing-white flex-shrink-0 ml-3">
                          {hrs.toFixed(1)} hrs
                        </span>
                      </div>
                      <div className="h-1.5 bg-black/5 dark:bg-white/10 rounded overflow-hidden">
                        <div
                          className="h-full rounded transition-[width] duration-300"
                          style={{
                            width: `${pct}%`,
                            background: `linear-gradient(90deg, ${color}, ${color}99)`,
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Time entries */}
        <div className="hours-fade-up rounded-2xl border border-border dark:border-border-dark bg-white/60 dark:bg-white/5 overflow-hidden" style={{ animationDelay: '0.15s' }}>
          <div className="px-5 sm:px-6 py-4 border-b border-border dark:border-border-dark flex items-center justify-between">
            <div className="text-[11px] font-bold uppercase tracking-widest text-muted flex items-center gap-1.5">
              <Briefcase size={12} className="text-muted" /> Time entries
            </div>
            <span className="text-xs text-muted">{loading ? '…' : `${displayEntries.length} shifts`}</span>
          </div>
          {loading ? (
            <div className="px-5 py-8">
              <LoadingSkeleton variant="inline" lines={5} />
            </div>
          ) : displayEntries.length === 0 ? (
            <div className="px-5 py-8 text-center text-muted text-sm">No entries in this period.</div>
          ) : (
            displayEntries.map((entry) => (
              <EntryRow key={entry.id} entry={entry} jobColorFn={jobColor} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
