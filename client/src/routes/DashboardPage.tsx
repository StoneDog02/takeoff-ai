import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppLayout } from '@/contexts/AppLayoutContext'
import { useTheme } from '@/contexts/ThemeContext'
import { dayjs, formatDate } from '@/lib/date'
import { api } from '@/api/client'
import type { ScheduleItem } from '@/types/global'

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
function IconChip({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="32" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
      <path d="M15 3v18" />
      <path d="M3 9h18" />
      <path d="M3 15h18" />
    </svg>
  )
}
function IconArrowLeft({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  )
}
function IconBarChart({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="12" x2="12" y1="20" y2="10" />
      <line x1="18" x2="18" y1="20" y2="4" />
      <line x1="6" x2="6" y1="20" y2="16" />
    </svg>
  )
}
function IconArrowUp({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m5 12 7-7 7 7" />
      <path d="M12 19V5" />
    </svg>
  )
}
function IconSend({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  )
}
// --- Mock data ---
type PeriodKey = 'month' | 'quarter' | 'ytd'
type ProfitRevenueSnapshot = { revenue: number; profit: number; marginPercent: number; periodTrend: number }

const profitRevenueByPeriod: Record<PeriodKey, ProfitRevenueSnapshot> = {
  month: { revenue: 184200, profit: 42150, marginPercent: 22.9, periodTrend: 8.2 },
  quarter: { revenue: 512400, profit: 118200, marginPercent: 23.1, periodTrend: 5.4 },
  ytd: { revenue: 1842000, profit: 398400, marginPercent: 21.6, periodTrend: 12.1 },
}

/** Expense by period: mock (replace with API). Derived from revenue - profit for consistency. */
const expenseByPeriod: Record<'month' | 'ytd', { value: number; trend: number }> = {
  month: { value: profitRevenueByPeriod.month.revenue - profitRevenueByPeriod.month.profit, trend: 5 },
  ytd: { value: profitRevenueByPeriod.ytd.revenue - profitRevenueByPeriod.ytd.profit, trend: 6 },
}

type ProjectStatus = 'Active' | 'On Hold' | 'Completed' | 'Planning'
const projects: { id: string; name: string; client: string; budget: number; timeline: string; status: ProjectStatus }[] = [
  { id: 'PRJ-001', name: 'Kitchen Remodel', client: 'Savannah Nguyen', budget: 48_200, timeline: 'Jun - Aug 2025', status: 'Active' },
  { id: 'PRJ-002', name: 'Office Build-Out', client: 'Jordan Lee', budget: 125_000, timeline: 'Jul - Oct 2025', status: 'Planning' },
  { id: 'PRJ-003', name: 'Bathroom Renovation', client: 'Alexis Kim', budget: 22_400, timeline: 'May - Jun 2025', status: 'Completed' },
  { id: 'PRJ-004', name: 'Exterior Siding', client: 'Morgan Reed', budget: 67_500, timeline: 'Aug - Nov 2025', status: 'On Hold' },
]

function toDateKey(d: dayjs.Dayjs) {
  return d.format('YYYY-MM-DD')
}
const now = dayjs()
const todayKey = toDateKey(now)

// Chat: contacts + initial messages per conversation
type ChatMsg = { id: string; role: 'user' | 'assistant'; text: string; time: string }
type ChatContact = { id: string; name: string; initials: string; timeLabel: string; unread: number }
const CHAT_CONTACTS: ChatContact[] = [
  { id: 'support', name: 'Support', initials: 'S', timeLabel: '4:30 PM', unread: 2 },
  { id: 'pm', name: 'Sarah (PM)', initials: 'SP', timeLabel: '4:30 PM', unread: 1 },
  { id: 'estimator', name: 'Mike (Estimator)', initials: 'ME', timeLabel: 'Yesterday', unread: 0 },
]
const CHAT_CONVERSATIONS_INITIAL: Record<string, ChatMsg[]> = {
  support: [
    { id: 's1', role: 'assistant', text: 'Hi, how can I help with your project today?', time: '10:32 AM' },
    { id: 's2', role: 'user', text: 'Can you pull the latest cost breakdown for the kitchen remodel?', time: '10:33 AM' },
    { id: 's3', role: 'assistant', text: "Sure. I've pulled the kitchen remodel summary: materials $12,400, labor $8,200. Want a PDF export?", time: '10:34 AM' },
  ],
  pm: [
    { id: 'p1', role: 'assistant', text: 'Schedule looks good for the next two weeks. Want to lock in subs for Phase 2?', time: '9:15 AM' },
    { id: 'p2', role: 'user', text: 'Yes — can you send the updated Gantt?', time: '9:22 AM' },
  ],
  estimator: [
    { id: 'e1', role: 'assistant', text: 'Revised estimate is ready. Total $48,200; I can break it down by trade if you need.', time: 'Yesterday' },
  ],
}
function formatCurrency(n: number, decimals = 2) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n)
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
        {weekLabels.map((label) => (
          <span key={label} className="text-[10px] font-medium text-gray-400 dark:text-white-faint py-0.5">
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
  const [revenuePeriod, setRevenuePeriod] = useState<'ytd' | 'month'>('ytd')
  const [expensePeriod, setExpensePeriod] = useState<'ytd' | 'month'>('month')
  const [projectSearch, setProjectSearch] = useState('')
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [conversationsByContactId, setConversationsByContactId] = useState<Record<string, ChatMsg[]>>(CHAT_CONVERSATIONS_INITIAL)
  const [chatInput, setChatInput] = useState('')
  const [chatSearch, setChatSearch] = useState('')
  const [selectedTaskDate, setSelectedTaskDate] = useState(todayKey)
  const [calendarView, setCalendarView] = useState(() => {
    const n = dayjs()
    return { year: n.year(), month: n.month() }
  })
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([])
  const [scheduleLoading, setScheduleLoading] = useState(false)

  const appLayout = useAppLayout()
  const navigate = useNavigate()

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

  const revenueData = revenuePeriod === 'ytd' ? profitRevenueByPeriod.ytd : profitRevenueByPeriod.month
  const expenseData = expenseByPeriod[expensePeriod]

  const calendarBusyDays = new Set<number>()

  const isSelectedToday = selectedTaskDate === todayKey
  const selectedDateLabel = isSelectedToday
    ? "Today's Schedule"
    : `${formatDate(selectedTaskDate)} Schedule`

  const toggleScheduleItemCompleted = async (item: ScheduleItem) => {
    const next = !item.completed
    try {
      if (item.type === 'task') {
        await api.projects.updateTask(item.projectId, item.id, { completed: next })
      } else {
        await api.projects.updateMilestone(item.projectId, item.id, { completed: next })
      }
      setScheduleItems((prev) =>
        prev.map((i) => (i.id === item.id && i.type === item.type ? { ...i, completed: next } : i))
      )
    } catch {
      // keep UI state on error
    }
  }

  const toggleRow = (id: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllRows = () => {
    if (selectedRows.size === projects.length) setSelectedRows(new Set())
    else setSelectedRows(new Set(projects.map((p) => p.id)))
  }

  const filteredProjects = projects.filter(
    (p) =>
      projectSearch === '' ||
      p.id.toLowerCase().includes(projectSearch.toLowerCase()) ||
      p.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
      p.client.toLowerCase().includes(projectSearch.toLowerCase())
  )

  return (
    <div className="layout">
      <main className="main">
        <div className="dashboard-page-header">
          <button type="button" className="hamburger" onClick={() => appLayout?.openMobileNav()} aria-label="Open menu">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><path d="M2 4h12M2 8h12M2 12h12" /></svg>
            </button>
            <h1 className="dashboard-title">Dashboard</h1>
            <div className="dashboard-main-search">
              <div className="search-wrap">
                <IconSearch className="w-[13px] h-[13px] shrink-0" />
                <input
                  type="search"
                  placeholder="Search projects…"
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  aria-label="Search projects"
                />
              </div>
            </div>
          </div>
          <div className="metrics">
            <div className="metric-card">
              <div className="metric-label">Total Revenue</div>
              <div className="metric-value">{formatCurrency(revenueData.revenue)}</div>
              <div className="metric-footer">
                <span className="badge-up">
                  <IconArrowUp style={{ width: 9, height: 9 }} />
                  +{revenueData.periodTrend}%
                </span>
                <div className="metric-tabs">
                  <button type="button" className={`metric-tab ${revenuePeriod === 'ytd' ? 'active' : ''}`} onClick={() => setRevenuePeriod('ytd')}>YTD</button>
                  <button type="button" className={`metric-tab ${revenuePeriod === 'month' ? 'active' : ''}`} onClick={() => setRevenuePeriod('month')}>Monthly</button>
                </div>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Total Expense</div>
              <div className="metric-value">{formatCurrency(expenseData.value)}</div>
              <div className="metric-footer">
                <span className="badge-up">
                  <IconArrowUp style={{ width: 9, height: 9 }} />
                  +{expenseData.trend}%
                </span>
                <div className="metric-tabs">
                  <button type="button" className={`metric-tab ${expensePeriod === 'ytd' ? 'active' : ''}`} onClick={() => setExpensePeriod('ytd')}>YTD</button>
                  <button type="button" className={`metric-tab ${expensePeriod === 'month' ? 'active' : ''}`} onClick={() => setExpensePeriod('month')}>Monthly</button>
                </div>
              </div>
            </div>
          </div>

          <div className="section-header">
            <span className="section-title">{selectedDateLabel}</span>
            <button type="button" className="add-pill" aria-label="Add task"><IconPlus style={{ width: 11, height: 11 }} /></button>
          </div>
          <div className="tasks-card">
            {scheduleLoading ? (
              <div className="task-item">
                <div className="task-check" />
                <div className="task-info">
                  <div className="task-name">Loading schedule…</div>
                  <div className="task-project">Fetching tasks and milestones</div>
                </div>
              </div>
            ) : scheduleItems.length > 0 ? (
              scheduleItems.map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className={`task-item ${item.completed ? 'done' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/projects/${item.projectId}?tab=schedule`)}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/projects/${item.projectId}?tab=schedule`)}
                >
                  <div
                    className={`task-check ${item.completed ? 'checked' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); toggleScheduleItemCompleted(item) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); toggleScheduleItemCompleted(item) } }}
                    aria-label={item.completed ? 'Mark incomplete' : 'Mark complete'}
                  >
                    <svg viewBox="0 0 10 8" aria-hidden><polyline points="1,4 4,7 9,1" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
                  </div>
                  <div className="task-info">
                    <div className="task-name">{item.title}</div>
                    <div className="task-project">
                      {item.projectName}
                      {item.responsible ? ` · ${item.responsible}` : ''}
                    </div>
                  </div>
                  <span className="task-tag">{item.type === 'milestone' ? 'Milestone' : 'Task'}</span>
                </div>
              ))
            ) : (
              <div className="task-item">
                <div className="task-check" />
                <div className="task-info">
                  <div className="task-name">No tasks for this date</div>
                  <div className="task-project">Select another day or add a task from a project Schedule tab</div>
                </div>
              </div>
            )}
          </div>

          <div className="section-header" style={{ marginTop: 24 }}>
            <span className="section-title">Projects</span>
          </div>
          <div className="projects-card">
            <div className="projects-top">
              <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginLeft: 'auto' }}>
                <button type="button" className="btn btn-ghost" style={{ padding: '6px 11px', gap: 5 }} aria-label="Filter">
                  <IconBarChart style={{ width: 12, height: 12 }} />
                  Filter
                </button>
                <button type="button" className="btn btn-ghost" style={{ padding: '6px 11px', gap: 5 }} aria-label="Manage projects">
                  <IconChip className="w-3 h-3 shrink-0" />
                  Manage Projects
                </button>
                <button type="button" className="add-pill" style={{ width: 34, height: 34 }} aria-label="Add project">
                  <IconPlus style={{ width: 11, height: 11 }} />
                </button>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th className="chk">
                      <input type="checkbox" checked={selectedRows.size === projects.length && projects.length > 0} onChange={toggleAllRows} aria-label="Select all projects" />
                    </th>
                    <th>Project</th>
                    <th>Client</th>
                    <th>Budget</th>
                    <th>Timeline</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((row) => (
                    <tr key={row.id}>
                      <td className="chk">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(row.id)}
                          onChange={() => toggleRow(row.id)}
                          aria-label={`Select ${row.name}`}
                        />
                      </td>
                      <td>
                        <div className="proj-name">{row.name}</div>
                        <div className="proj-id">{row.id}</div>
                      </td>
                      <td>
                        <div className="client-cell">
                          <div className={`c-av av-${['sn', 'jl', 'ak', 'mr'][filteredProjects.indexOf(row) % 4]}`}>
                            {row.client.split(' ').map((n) => n[0]).join('')}
                          </div>
                          <span className="client-name">{row.client}</span>
                        </div>
                      </td>
                      <td><span className="budget-val">{formatCurrency(row.budget)}</span></td>
                      <td><span className="timeline-val">{row.timeline}</span></td>
                      <td>
                        <span className={`status-pill s-${row.status === 'Active' ? 'active' : row.status === 'Planning' ? 'planning' : row.status === 'Completed' ? 'completed' : 'hold'}`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>

        {/* Calendar + Chats: right side of page content (same level as main, no separate panel) */}
        <div className="content-right">
          <div className="rounded-xl bg-white dark:bg-dark-3 border border-gray-200 dark:border-border-dark shadow-card p-4 mb-6">
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

          <div className="divider" />

          <div className="chats-header">
            <span className="sidebar-label" style={{ marginBottom: 0 }}>Recent Chats</span>
            <button type="button" className="add-pill" aria-label="New chat"><IconPlus className="w-[11px] h-[11px]" /></button>
          </div>
          <div className="s-search" style={{ marginBottom: 10 }}>
            <IconSearch className="w-[13px] h-[13px]" />
            <input type="search" placeholder="Search…" value={chatSearch} onChange={(e) => setChatSearch(e.target.value)} aria-label="Search chats" />
          </div>

          {selectedContactId == null ? (
            <div className="flex flex-col gap-0">
              {CHAT_CONTACTS.filter((c) => !chatSearch || c.name.toLowerCase().includes(chatSearch.toLowerCase())).map((c) => {
                const msgs = conversationsByContactId[c.id] ?? []
                const last = msgs[msgs.length - 1]
                const preview = last ? (last.role === 'user' ? 'You: ' : '') + last.text : 'No messages yet'
                const avClass = c.id === 'support' ? 'ca-s' : c.id === 'pm' ? 'ca-sp' : 'ca-me'
                return (
                  <div key={c.id} className="chat-item" onClick={() => setSelectedContactId(c.id)} onKeyDown={(e) => e.key === 'Enter' && setSelectedContactId(c.id)} role="button" tabIndex={0}>
                    <div className={`ch-av ${avClass}`}>{c.initials}</div>
                    {c.unread > 0 && <div className="unread-badge">{c.unread > 99 ? '99+' : c.unread}</div>}
                    <div className="chat-body">
                      <div className="chat-row">
                        <span className="chat-name">{c.name}</span>
                        <span className="chat-time">{c.timeLabel}</span>
                      </div>
                      <div className="chat-pre">{preview.length > 40 ? preview.slice(0, 40) + '…' : preview}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col min-h-0">
              <div className="py-2 shrink-0 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedContactId(null)}
                  className="p-2 rounded-lg text-gray-500 dark:text-white-dim hover:bg-gray-100 dark:hover:bg-dark-4 hover:text-gray-900 dark:hover:text-landing-white transition-colors"
                  aria-label="Back to chats"
                >
                  <IconArrowLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-semibold text-gray-900 dark:text-landing-white truncate">
                  {CHAT_CONTACTS.find((c) => c.id === selectedContactId)?.name ?? 'Chat'}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0 py-3 space-y-2">
                {(conversationsByContactId[selectedContactId] ?? []).map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                        msg.role === 'user'
                          ? 'bg-accent text-white'
                          : 'bg-white dark:bg-dark-3 text-gray-900 dark:text-landing-white border border-gray-200 dark:border-border-dark shadow-sm'
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                      <p className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-white/80' : 'text-gray-500 dark:text-white-faint'}`}>
                        {msg.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <form
                className="pt-3 shrink-0"
                onSubmit={(e) => {
                  e.preventDefault()
                  const text = chatInput.trim()
                  if (!text || !selectedContactId) return
                  const time = dayjs().format('h:mm A')
                  const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: 'user', text, time }
                  const assistantMsg: ChatMsg = { id: `a-${Date.now()}`, role: 'assistant', text: "Got it — I'll follow up on that.", time }
                  setConversationsByContactId((prev) => ({
                    ...prev,
                    [selectedContactId]: [...(prev[selectedContactId] ?? []), userMsg, assistantMsg],
                  }))
                  setChatInput('')
                }}
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 min-w-0 rounded-lg border border-gray-200 dark:border-border-dark bg-white dark:bg-dark-4 text-gray-900 dark:text-landing-white placeholder:text-gray-400 dark:placeholder:text-white-dim text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                    aria-label="Chat message"
                  />
                  <button
                    type="submit"
                    className="p-2 rounded-lg bg-accent text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-accent/50 shrink-0"
                    aria-label="Send message"
                  >
                    <IconSend />
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
    </div>
  )
}
