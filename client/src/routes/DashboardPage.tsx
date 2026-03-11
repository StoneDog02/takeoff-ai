import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppLayout } from '@/contexts/AppLayoutContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuth } from '@/contexts/AuthContext'
import { dayjs, formatDate } from '@/lib/date'
import { api } from '@/api/client'
import type { ScheduleItem } from '@/types/global'
import type { ConversationListItem } from '@/api/client'

// --- Icons (inline SVGs) ---
function IconPlus({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}
function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}
// --- Dashboard live data (replaces mocks) ---
const PROJECT_COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#EF4444'] as const
type ProjectStatusKey = 'active' | 'planning' | 'completed' | 'on-hold'

const STATUS_CONFIG: Record<ProjectStatusKey, { label: string; color: string; bg: string }> = {
  active: { label: 'Active', color: '#10B981', bg: '#ECFDF5' },
  planning: { label: 'Planning', color: '#3B82F6', bg: '#EFF6FF' },
  completed: { label: 'Completed', color: '#9CA3AF', bg: '#F9FAFB' },
  'on-hold': { label: 'On Hold', color: '#EF4444', bg: '#FEF2F2' },
}

const URGENCY_STYLES: Record<'high' | 'medium' | 'low', { color: string; bg: string; border: string }> = {
  high: { color: '#EF4444', bg: '#FEF2F2', border: '#FECACA' },
  medium: { color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A' },
  low: { color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE' },
}

const SCHEDULE_TYPE_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  meeting: { color: '#3B82F6', bg: '#EFF6FF', label: 'Meeting' },
  delivery: { color: '#10B981', bg: '#ECFDF5', label: 'On-site' },
  call: { color: '#3B82F6', bg: '#EFF6FF', label: 'Meeting' },
  admin: { color: '#EAB308', bg: '#FEF9C3', label: 'Pending' },
  task: { color: '#0EA5E9', bg: '#E0F2FE', label: 'Task' },
  milestone: { color: '#8B5CF6', bg: '#F5F3FF', label: 'Task' },
}

function toDateKey(d: dayjs.Dayjs) {
  return d.format('YYYY-MM-DD')
}
const now = dayjs()
const todayKey = toDateKey(now)

const CHAT_COLORS = ['#6B7280', '#8B5CF6', '#F59E0B', '#10B981', '#3B82F6']
const fmt = (n: number) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })
const pct = (a: number, b: number) => (b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0)

/** Sparkline chart for KPI cards */
function Sparkline({ data, color, height = 32, width = 80 }: { data: number[]; color: string; height?: number; width?: number }) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * height
    return `${x},${y}`
  })
  const area = `0,${height} ${pts.join(' ')} ${width},${height}`
  const id = `spark-${color.replace('#', '')}`
  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.15} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${id})`} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Project health card with budget and timeline bars */
type ProjectCardData = {
  id: string
  name: string
  client: string
  initials: string
  color: string
  budget: number
  spent: number
  timelineStart: string
  timelineEnd: string
  pctTime: number
  status: ProjectStatusKey
}
function ProjectHealthCard({
  project,
  onClick,
}: {
  project: ProjectCardData
  onClick?: () => void
}) {
  const budgetPct = pct(project.spent, project.budget)
  const budgetColor = budgetPct > 95 ? '#EF4444' : budgetPct > 80 ? '#F59E0B' : '#10B981'
  const st = STATUS_CONFIG[project.status]
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      className="rounded-xl border border-gray-200 dark:border-border-dark bg-white dark:bg-dark-3 p-4 cursor-pointer transition-all duration-150 hover:shadow-md hover:-translate-y-px focus:outline-none focus:ring-2 focus:ring-accent/30"
    >
      <div className="flex items-start justify-between gap-2 mb-3.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0"
            style={{ background: project.color + '20', color: project.color }}
          >
            {project.initials}
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-gray-900 dark:text-landing-white truncate">{project.name}</div>
            <div className="text-[11px] text-gray-500 dark:text-white-dim">{project.id} · {project.client}</div>
          </div>
        </div>
        <span
          className="text-[10px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
          style={{ background: st.bg, color: st.color }}
        >
          {st.label}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="flex justify-between mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-white-dim">Budget</span>
            <span className="text-[10px] font-bold" style={{ color: budgetColor }}>{budgetPct}%</span>
          </div>
          <div className="h-1 bg-gray-100 dark:bg-dark-4 rounded overflow-hidden">
            <div className="h-full rounded transition-all duration-500" style={{ width: `${budgetPct}%`, background: budgetColor }} />
          </div>
          <div className="text-[10px] text-gray-500 dark:text-white-dim mt-1">{fmt(project.spent)} of {fmt(project.budget)}</div>
        </div>
        <div>
          <div className="flex justify-between mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-white-dim">Timeline</span>
            <span className="text-[10px] font-bold text-gray-500 dark:text-white-dim">{project.pctTime}%</span>
          </div>
          <div className="h-1 bg-gray-100 dark:bg-dark-4 rounded overflow-hidden">
            <div className="h-full rounded bg-gray-400 dark:bg-white-dim transition-all duration-500" style={{ width: `${project.pctTime}%` }} />
          </div>
          <div className="text-[10px] text-gray-500 dark:text-white-dim mt-1">{project.timelineStart} → {project.timelineEnd}</div>
        </div>
      </div>
    </div>
  )
}

function IconChevronLeft({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}
function IconChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

/** Calendar month grid: clickable days, dot for busy days, highlight today and selected day, prev/next month. */
function CalendarWidget({
  viewYear,
  viewMonth,
  onPrevMonth,
  onNextMonth,
  busyDays,
  selectedDate,
  onSelectDate,
}: {
  viewYear: number
  viewMonth: number
  onPrevMonth: () => void
  onNextMonth: () => void
  busyDays: Set<number>
  selectedDate: string | null
  onSelectDate: (dateKey: string) => void
}) {
  const now = dayjs()
  const year = viewYear
  const month = viewMonth
  const isViewingCurrentMonth = now.year() === year && now.month() === month
  const todayDay = now.date()
  const daysInMonth = dayjs().year(year).month(month).endOf('month').date()
  const firstDay = dayjs().year(year).month(month).startOf('month').day()
  const weekLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  const leadingBlanks = firstDay
  const totalCells = leadingBlanks + daysInMonth

  const toDateKey = (day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const monthLabel = dayjs().year(year).month(month).format('MMMM YYYY')

  return (
    <div className="text-center">
      <div className="flex items-center justify-between gap-1 mb-2">
        <button
          type="button"
          onClick={onPrevMonth}
          className="p-1.5 rounded-md text-gray-500 dark:text-white-dim hover:bg-gray-100 dark:hover:bg-dark-4 hover:text-gray-900 dark:hover:text-landing-white transition-colors"
          aria-label="Previous month"
        >
          <IconChevronLeft className="w-4 h-4" />
        </button>
        <p className="text-xs font-medium text-gray-500 dark:text-white-dim min-w-[100px]">
          {monthLabel}
        </p>
        <button
          type="button"
          onClick={onNextMonth}
          className="p-1.5 rounded-md text-gray-500 dark:text-white-dim hover:bg-gray-100 dark:hover:bg-dark-4 hover:text-gray-900 dark:hover:text-landing-white transition-colors"
          aria-label="Next month"
        >
          <IconChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {weekLabels.map((label, i) => (
          <span key={`weekday-${i}`} className="text-[10px] font-medium text-gray-400 dark:text-white-faint py-0.5">
            {label}
          </span>
        ))}
        {Array.from({ length: totalCells }, (_, i) => {
          if (i < leadingBlanks) return <span key={`blank-${i}`} className="min-h-[32px]" />
          const day = i - leadingBlanks + 1
          const dateKey = toDateKey(day)
          const hasTask = busyDays.has(day)
          const isToday = isViewingCurrentMonth && day === todayDay
          const isSelected = selectedDate === dateKey
          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelectDate(dateKey)}
              className={`flex flex-col items-center justify-center transition-colors min-h-[32px] rounded-md ${
                isSelected
                  ? 'bg-accent text-white'
                  : isToday
                    ? 'bg-accent/20 dark:bg-accent/25 text-accent dark:text-accent font-semibold'
                    : 'hover:bg-gray-100 dark:hover:bg-dark-4 text-gray-700 dark:text-landing-white'
              }`}
              aria-label={isToday ? `Today, ${day}` : `${monthLabel} ${day}`}
              aria-pressed={isSelected}
            >
              <span className="text-xs tabular-nums leading-none h-4 flex items-center justify-center">{day}</span>
              <span className="h-1.5 w-full flex items-center justify-center mt-0.5 shrink-0">
                {hasTask && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-accent'}`}
                    aria-hidden
                  />
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function DashboardPage() {
  useTheme()
  const [projectSearch, _setProjectSearch] = useState('')
  const [chatConversations, setChatConversations] = useState<ConversationListItem[]>([])
  const [chatConversationsLoading, setChatConversationsLoading] = useState(true)
  const [chatSearch, setChatSearch] = useState('')
  const { user: authUser } = useAuth()
  const [selectedTaskDate, setSelectedTaskDate] = useState(todayKey)
  const [calendarView, setCalendarView] = useState(() => {
    const n = dayjs()
    return { year: n.year(), month: n.month() }
  })
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([])
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([])
  const [alerts, setAlerts] = useState<import('@/api/client').DashboardAlert[]>([])
  const [alertsLoading, setAlertsLoading] = useState(true)
  const [kpis, setKpis] = useState<import('@/api/client').DashboardKpis | null>(null)
  const [kpisLoading, setKpisLoading] = useState(true)
  const [clockedIn, setClockedIn] = useState<import('@/api/client').ClockedInEntry[]>([])
  const [clockedInLoading, setClockedInLoading] = useState(true)
  const [dashboardProjects, setDashboardProjects] = useState<import('@/api/client').DashboardProject[]>([])
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [scheduleDaysDates, setScheduleDaysDates] = useState<string[]>([])
  const [scheduleDaysMonth, setScheduleDaysMonth] = useState<string>('')

  const appLayout = useAppLayout()
  const navigate = useNavigate()

  const visibleAlerts = alerts.filter((a) => !dismissedAlerts.includes(a.id))

  // Map API schedule items to today's schedule display (time placeholder when not available)
  const scheduleForDisplay = scheduleItems.length > 0
    ? scheduleItems.slice(0, 8).map((item) => ({
        time: item.endDate ? dayjs(item.endDate).format('h:mm A') : '—',
        title: item.title,
        job: item.projectName,
        who: item.responsible ?? '',
        type: item.type === 'milestone' ? 'milestone' : 'task',
      }))
    : []

  useEffect(() => {
    let cancelled = false
    setScheduleLoading(true)
    api.getSchedule(selectedTaskDate).then((items) => {
      if (!cancelled) {
        setScheduleItems(items)
        setScheduleLoading(false)
      }
    }).catch(() => {
      if (!cancelled) {
        setScheduleItems([])
        setScheduleLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [selectedTaskDate])

  useEffect(() => {
    let cancelled = false
    setAlertsLoading(true)
    api.dashboard.getAlerts().then((data) => {
      if (!cancelled) {
        setAlerts(data)
        setAlertsLoading(false)
      }
    }).catch(() => {
      if (!cancelled) {
        setAlerts([])
        setAlertsLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    setKpisLoading(true)
    api.dashboard.getKpis().then((data) => {
      if (!cancelled) {
        setKpis(data)
        setKpisLoading(false)
      }
    }).catch(() => {
      if (!cancelled) {
        setKpis(null)
        setKpisLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    setClockedInLoading(true)
    api.dashboard.getClockedIn().then((data) => {
      if (!cancelled) {
        setClockedIn(data)
        setClockedInLoading(false)
      }
    }).catch(() => {
      if (!cancelled) {
        setClockedIn([])
        setClockedInLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    setProjectsLoading(true)
    api.dashboard.getProjects().then((data) => {
      if (!cancelled) {
        setDashboardProjects(data)
        setProjectsLoading(false)
      }
    }).catch(() => {
      if (!cancelled) {
        setDashboardProjects([])
        setProjectsLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [])

  const calendarMonthKey = `${calendarView.year}-${String(calendarView.month + 1).padStart(2, '0')}`
  useEffect(() => {
    let cancelled = false
    api.getScheduleDays(calendarMonthKey).then(({ dates }) => {
      if (!cancelled) {
        setScheduleDaysDates(dates)
        setScheduleDaysMonth(calendarMonthKey)
      }
    }).catch(() => {
      if (!cancelled) {
        setScheduleDaysDates([])
        setScheduleDaysMonth(calendarMonthKey)
      }
    })
    return () => { cancelled = true }
  }, [calendarMonthKey])

  const calendarBusyDays = calendarMonthKey === scheduleDaysMonth
    ? new Set(scheduleDaysDates.map((d) => parseInt(d.split('-')[2], 10)))
    : new Set<number>()

  useEffect(() => {
    let cancelled = false
    setChatConversationsLoading(true)
    api.conversations.list().then((data) => {
      if (!cancelled) {
        setChatConversations(data)
        setChatConversationsLoading(false)
      }
    }).catch(() => {
      if (!cancelled) {
        setChatConversations([])
        setChatConversationsLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [])

  const filteredChatConversations = chatSearch.trim()
    ? chatConversations.filter((c) => {
        const preview = c.last_message?.body ?? ''
        return preview.toLowerCase().includes(chatSearch.toLowerCase())
      })
    : chatConversations

  const filteredProjects: ProjectCardData[] = dashboardProjects
    .filter(
      (p) =>
        projectSearch === '' ||
        p.id.toLowerCase().includes(projectSearch.toLowerCase()) ||
        p.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
        (p.client || '').toLowerCase().includes(projectSearch.toLowerCase())
    )
    .map((p, i) => ({
      id: p.id,
      name: p.name,
      client: p.client || '',
      initials: p.initials || p.name.slice(0, 2).toUpperCase(),
      color: PROJECT_COLORS[i % PROJECT_COLORS.length],
      budget: p.budget_total || 0,
      spent: p.spent_total || 0,
      timelineStart: p.timeline_start ? formatDate(p.timeline_start) : '—',
      timelineEnd: p.timeline_end ? formatDate(p.timeline_end) : '—',
      pctTime: p.timeline_pct ?? 0,
      status: (p.status === 'on_hold' ? 'on-hold' : p.status) as ProjectStatusKey,
    }))

  const greeting = (() => {
    const h = dayjs().hour()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()
  const displayName = authUser?.user_metadata?.full_name ?? authUser?.email?.split('@')[0] ?? 'Kyle'
  const userName = displayName.trim().split(/\s+/)[0] || 'Kyle'

  return (
    <div className="layout">
      <main className="main">
        {/* Page heading: hamburger + date & greeting + New Project */}
        <div className="dashboard-page-header flex-wrap gap-3">
          <button type="button" className="hamburger shrink-0" onClick={() => appLayout?.openMobileNav()} aria-label="Open menu">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><path d="M2 4h12M2 8h12M2 12h12" /></svg>
          </button>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 flex-1 min-w-0">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-white-dim mb-0.5">
                {dayjs().format('dddd, MMMM D, YYYY').toUpperCase()}
              </div>
              <h1 className="dashboard-title text-2xl font-normal tracking-tight m-0">
                {greeting}, {userName}.
              </h1>
            </div>
            <button
              type="button"
              className="btn btn-primary shrink-0 py-2 px-4 text-sm font-semibold flex items-center gap-1.5"
              onClick={() => navigate('/projects?new=1')}
            >
              <IconPlus className="w-4 h-4" />
              New Project
            </button>
          </div>
        </div>

        {/* Needs Attention */}
        {!alertsLoading && visibleAlerts.length > 0 && (
          <div className="space-y-1.5 mb-5">
            {visibleAlerts.map((alert) => {
              const u = URGENCY_STYLES[alert.urgency]
              const icon = alert.type === 'invoice' ? '🧾' : alert.type === 'estimate' ? '📋' : '⚠️'
              const onAction = () => {
                if (alert.type === 'budget_overrun') navigate(`/projects/${alert.entityId}`)
                else if (alert.type === 'estimate') navigate('/estimates')
                else navigate('/revenue')
              }
              return (
                <div
                  key={alert.id}
                  className="flex items-center gap-3 rounded-xl px-4 py-2.5 border"
                  style={{ background: u.bg, borderColor: u.border }}
                >
                  <span className="text-base shrink-0" aria-hidden>{icon}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-semibold" style={{ color: u.color }}>{alert.label}</span>
                    <span className="text-xs text-gray-500 dark:text-white-dim ml-2">{alert.sub}</span>
                  </div>
                  <button type="button" onClick={onAction} className="text-[11px] font-semibold text-white px-3 py-1 rounded-md shrink-0" style={{ background: u.color }}>
                    {alert.action}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await api.dashboard.dismissAlert(alert)
                        setDismissedAlerts((d) => [...d, alert.id])
                      } catch {
                        // keep visible on error
                      }
                    }}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-white-dim text-lg leading-none p-0 shrink-0"
                    aria-label="Dismiss"
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* KPI cards: 4 columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {kpisLoading ? (
            <div className="col-span-full py-8 text-center text-sm text-gray-500 dark:text-white-dim">Loading KPIs…</div>
          ) : (
          (() => {
            const revTrend = kpis?.revenueTrend
            const revPct = revTrend && revTrend.length >= 2 && revTrend[0] > 0
              ? Math.round(((revTrend[revTrend.length - 1] - revTrend[0]) / revTrend[0]) * 100)
              : null
            const expenseRevPct = (kpis?.totalRevenue ?? 0) > 0 && (kpis?.totalExpense ?? 0) >= 0
              ? (Math.round(((kpis!.totalExpense / kpis!.totalRevenue) * 100) * 10) / 10).toFixed(1) + '% of revenue'
              : 'YTD'
            const activeJobs = kpis?.activeJobs ?? 0
            const totalProjects = Math.max(kpis?.totalProjects ?? 0, 1)
            const kpiRows = [
              { label: 'Total Revenue', val: fmt(kpis?.totalRevenue ?? 0), sub: revPct != null ? `↑${revPct}% YTD` : 'YTD', color: '#10B981', spark: (kpis?.revenueTrend?.length ? kpis.revenueTrend : []), sparkColor: '#10B981' as const },
              { label: 'Total Expense', val: fmt(kpis?.totalExpense ?? 0), sub: expenseRevPct, color: '#F59E0B', spark: (kpis?.expenseTrend?.length ? kpis.expenseTrend : []), sparkColor: '#F59E0B' as const },
              { label: 'Outstanding', val: fmt(kpis?.outstanding ?? 0), sub: `${kpis?.openInvoicesCount ?? 0} open invoices`, color: '#EF4444', spark: null, sparkColor: null },
              { label: 'Active Jobs', val: String(activeJobs), sub: `of ${kpis?.totalProjects ?? 0} projects`, color: '#3B82F6', spark: null, sparkColor: null, isActiveJobs: true },
            ]
            return kpiRows.map((k, i) => (
              <div
                key={i}
                className="rounded-2xl border border-gray-200 dark:border-border-dark bg-white dark:bg-dark-3 p-4 pt-[18px] pb-3 relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl" style={{ background: k.color }} />
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-white-dim mb-2">{k.label}</div>
                <div className="text-xl lg:text-2xl font-semibold tracking-tight text-gray-900 dark:text-landing-white mb-1.5">{k.val}</div>
                {k.spark && k.spark.length >= 2 ? (
                  <div className="flex items-end justify-between gap-2">
                    <span className="text-[11px] font-semibold" style={{ color: k.color }}>{k.sub}</span>
                    <Sparkline data={k.spark} color={k.sparkColor!} height={28} width={72} />
                  </div>
                ) : k.isActiveJobs ? (
                  <div className="flex items-end justify-between gap-2">
                    <span className="text-[11px] font-semibold" style={{ color: k.color }}>{k.sub}</span>
                    <div className="flex gap-0.5 items-end h-5" aria-hidden>
                      {Array.from({ length: 12 }, (_, j) => (
                        <div
                          key={j}
                          className="w-1.5 rounded-sm flex-1 min-w-0 h-full bg-gray-200 dark:bg-dark-4"
                          style={j < activeJobs ? { background: k.color } : undefined}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] font-semibold" style={{ color: k.color }}>{k.sub}</div>
                )}
              </div>
            ))
          })()
          )}
        </div>

        {/* Today's Schedule */}
        <div className="rounded-2xl border border-gray-200 dark:border-border-dark bg-white dark:bg-dark-3 overflow-hidden mb-6">
          <div className="px-5 py-3.5 border-b border-gray-100 dark:border-border flex items-center justify-between">
            <span className="text-[13px] font-bold text-gray-900 dark:text-landing-white">Today&apos;s Schedule</span>
            <button type="button" className="text-[11px] px-2.5 py-1 rounded-md border border-gray-200 dark:border-border-dark text-gray-500 dark:text-white-dim hover:bg-gray-50 dark:hover:bg-dark-4">
              + Add
            </button>
          </div>
          {scheduleLoading ? (
            <div className="px-5 py-4 text-sm text-gray-500 dark:text-white-dim">Loading schedule…</div>
          ) : scheduleForDisplay.length === 0 ? (
            <div className="px-5 py-4 text-sm text-gray-500 dark:text-white-dim">No schedule items for this day.</div>
          ) : (
            scheduleForDisplay.map((item, i) => {
              const t = SCHEDULE_TYPE_STYLES[item.type] || SCHEDULE_TYPE_STYLES.admin
              const label = t.label || item.type
              return (
                <div
                  key={i}
                  className="flex items-center gap-3.5 px-5 py-3 border-b border-gray-50 dark:border-border/50 last:border-0 hover:bg-gray-50/80 dark:hover:bg-dark-4/50 cursor-pointer transition-colors"
                  onClick={() => navigate('/projects')}
                  onKeyDown={(e) => e.key === 'Enter' && navigate('/projects')}
                  role="button"
                  tabIndex={0}
                >
                  <div className="text-[11px] font-semibold text-gray-500 dark:text-white-dim w-14 shrink-0">{item.time}</div>
                  <div className="w-0.5 h-8 rounded-sm shrink-0" style={{ background: t.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-gray-900 dark:text-landing-white">{item.title}</div>
                    <div className="text-[11px] text-gray-500 dark:text-white-dim">{item.job}{item.who ? ` · ${item.who}` : ''}</div>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: t.bg, color: t.color }}>{label}</span>
                </div>
              )
            })
          )}
        </div>

        {/* Projects grid */}
        <div>
          <div className="flex items-center justify-between mb-3.5">
            <span className="text-[13px] font-bold text-gray-900 dark:text-landing-white">Projects</span>
            <div className="flex gap-1.5">
              <button type="button" className="py-1.5 px-3 rounded-md text-[11px] font-medium text-gray-500 dark:text-white-dim bg-gray-100 dark:bg-dark-4 hover:bg-gray-200 dark:hover:bg-dark-3">
                Filter
              </button>
              <button type="button" className="py-1.5 px-3 rounded-md text-[11px] font-medium text-gray-500 dark:text-white-dim bg-gray-100 dark:bg-dark-4 hover:bg-gray-200 dark:hover:bg-dark-3" onClick={() => navigate('/projects')}>
                Manage
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {projectsLoading ? (
              <div className="col-span-full py-8 text-center text-sm text-gray-500 dark:text-white-dim">Loading projects…</div>
            ) : filteredProjects.length === 0 ? (
              <div className="col-span-full py-8 text-center text-sm text-gray-500 dark:text-white-dim">No projects yet.</div>
            ) : (
              filteredProjects.map((p) => (
                <ProjectHealthCard key={p.id} project={p} onClick={() => navigate(`/projects/${p.id}`)} />
              ))
            )}
          </div>
        </div>
      </main>

        {/* Right sidebar: Calendar, Clocked In, Recent Chats */}
        <div className="content-right flex flex-col gap-5">
          {/* Calendar card */}
          <div className="rounded-2xl border border-gray-200 dark:border-border-dark bg-white dark:bg-dark-3 p-4">
            <CalendarWidget
              viewYear={calendarView.year}
              viewMonth={calendarView.month}
              onPrevMonth={() =>
                setCalendarView((prev) => {
                  if (prev.month === 0) return { year: prev.year - 1, month: 11 }
                  return { year: prev.year, month: prev.month - 1 }
                })
              }
              onNextMonth={() =>
                setCalendarView((prev) => {
                  if (prev.month === 11) return { year: prev.year + 1, month: 0 }
                  return { year: prev.year, month: prev.month + 1 }
                })
              }
              busyDays={calendarBusyDays}
              selectedDate={selectedTaskDate}
              onSelectDate={setSelectedTaskDate}
            />
          </div>

          {/* Clocked In Now */}
          <div className="rounded-2xl border border-gray-200 dark:border-border-dark bg-white dark:bg-dark-3 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-border flex items-center justify-between">
              <span className="text-xs font-bold text-gray-900 dark:text-landing-white">Clocked In Now</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">• {clockedIn.length} active</span>
            </div>
            {clockedInLoading ? (
              <div className="px-4 py-3 text-sm text-gray-500 dark:text-white-dim">Loading…</div>
            ) : clockedIn.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 dark:text-white-dim">No one clocked in.</div>
            ) : (
              clockedIn.map((c, i) => {
                const h = Math.floor(c.hoursSoFar)
                const m = Math.round((c.hoursSoFar - h) * 60)
                const duration = m > 0 ? `${h}h ${m}m` : `${h}h`
                return (
                  <div key={c.employeeId + c.jobId} className="flex items-center gap-2.5 px-4 py-2.5 border-b border-gray-50 dark:border-border/50 last:border-0">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{ background: PROJECT_COLORS[i % PROJECT_COLORS.length] + '20', color: PROJECT_COLORS[i % PROJECT_COLORS.length] }}>{c.initials}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-gray-900 dark:text-landing-white">{c.employeeName}</div>
                      <div className="text-[10px] text-gray-500 dark:text-white-dim truncate">{c.jobName}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-semibold text-gray-900 dark:text-landing-white">{duration}</div>
                      <div className="text-[10px] text-gray-500 dark:text-white-dim">{c.clockInFormatted}</div>
                    </div>
                  </div>
                )
              })
            )}
            <div className="px-4 py-2.5 border-t border-gray-100 dark:border-border">
              <button type="button" onClick={() => navigate('/teams')} className="w-full py-1.5 rounded-md text-[11px] font-medium text-gray-500 dark:text-white-dim bg-gray-100 dark:bg-dark-4 hover:bg-gray-200 dark:hover:bg-dark-3">
                View Full Timeclock →
              </button>
            </div>
          </div>

          {/* Recent Chats card */}
          <div className="rounded-2xl border border-gray-200 dark:border-border-dark bg-white dark:bg-dark-3 overflow-hidden flex flex-col min-h-0">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-border flex items-center justify-between shrink-0">
              <span className="text-xs font-bold text-gray-900 dark:text-landing-white">Recent Chats</span>
              <button type="button" onClick={() => navigate('/directory')} className="text-gray-500 dark:text-white-dim hover:text-gray-700 dark:hover:text-landing-white text-lg leading-none" aria-label="New chat">+</button>
            </div>
            <div className="p-2 shrink-0">
              <div className="relative">
                <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-white-faint pointer-events-none" />
                <input type="search" placeholder="Search…" value={chatSearch} onChange={(e) => setChatSearch(e.target.value)} className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 dark:border-border-dark bg-gray-50 dark:bg-dark-4 text-sm text-gray-900 dark:text-landing-white placeholder:text-gray-400 dark:placeholder:text-white-dim focus:outline-none focus:ring-2 focus:ring-accent/30" aria-label="Search chats" />
              </div>
            </div>
            <div className="flex flex-col overflow-y-auto min-h-0">
              {chatConversationsLoading ? (
                <div className="px-4 py-3 text-sm text-gray-500 dark:text-white-dim">Loading…</div>
              ) : filteredChatConversations.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-500 dark:text-white-dim">No conversations yet.</div>
              ) : (
                filteredChatConversations.slice(0, 6).map((c, i) => {
                  const last = c.last_message
                  const isFromMe = last && authUser?.id && last.sender_id === authUser.id
                  const preview = last ? (isFromMe ? 'You: ' : '') + (last.body?.slice(0, 35) || '') + (last.body?.length > 35 ? '…' : '') : 'No messages yet'
                  const timeLabel = last ? dayjs(last.created_at).format('h:mm A') : '—'
                  const color = CHAT_COLORS[i % CHAT_COLORS.length]
                  return (
                    <div
                      key={c.id}
                      className="flex items-center gap-2.5 px-4 py-2.5 border-b border-gray-50 dark:border-border/50 last:border-0 hover:bg-gray-50 dark:hover:bg-dark-4/50 cursor-pointer transition-colors"
                      onClick={() => navigate('/directory')}
                      onKeyDown={(e) => e.key === 'Enter' && navigate('/directory')}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="relative shrink-0">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: color + '20', color }}>?</div>
                        {c.unread_count > 0 && (
                          <div className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-1 rounded-full bg-accent border-2 border-white dark:border-dark-3 flex items-center justify-center text-[8px] font-bold text-white">
                            {c.unread_count > 99 ? '99+' : c.unread_count}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center gap-2 mb-0.5">
                          <span className={`text-xs truncate ${c.unread_count ? 'font-bold' : 'font-medium'} text-gray-900 dark:text-landing-white`}>Chat</span>
                          <span className="text-[10px] text-gray-500 dark:text-white-dim shrink-0">{timeLabel}</span>
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-white-dim truncate">{preview}</div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            <div className="p-2.5 border-t border-gray-100 dark:border-border shrink-0">
              <button type="button" onClick={() => navigate('/directory')} className="w-full py-1.5 rounded-md text-[11px] font-medium text-gray-500 dark:text-white-dim bg-gray-100 dark:bg-dark-4 hover:bg-gray-200 dark:hover:bg-dark-3">
                View All Messages →
              </button>
            </div>
          </div>
        </div>
    </div>
  )
}
