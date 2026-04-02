/**
 * Hero section mock: current dashboard layout filled with static mock data.
 * Mirrors DashboardPage structure so the landing page preview matches the real app.
 */
import { dayjs } from '@/lib/date'
import { DEMO_KPIS, getDemoDashboardProjects } from '@/data/demo/dashboardFixtures'

const PROJECT_COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#EF4444'] as const
const fmt = (n: number) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })

function Sparkline({ data, color, height = 28, width = 72 }: { data: number[]; color: string; height?: number; width?: number }) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((v - min) / range) * height
    return `${x},${y}`
  })
  const area = `0,${height} ${pts.join(' ')} ${width},${height}`
  const id = `hero-spark-${color.replace('#', '')}`
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

function IconChevronLeft({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}
function IconChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}
function IconPlus({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}
function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}

const MOCK_KPIS = DEMO_KPIS
const HERO_REVENUE_SPARKLINE = DEMO_KPIS.revenueTrend ?? [
  40, 55, 70, 50, 85, 90, 75, 88, 82, 95, 90, 100,
]

const MOCK_SCHEDULE = [
  { time: '7:30 AM', title: 'Crew Kickoff — Riverside Commercial', job: 'Riverside Commercial · Floor 4 Framing', type: 'On-site' as const, color: '#10B981', bg: '#ECFDF5' },
  { time: '10:00 AM', title: 'Client Walkthrough', job: 'Harbor View · Unit 12', type: 'Meeting' as const, color: '#3B82F6', bg: '#EFF6FF' },
  { time: '1:00 PM', title: 'Material Delivery', job: 'Summit Construction', type: 'Pending' as const, color: '#EAB308', bg: '#FEF9C3' },
  { time: '3:30 PM', title: 'Inspect Framing', job: 'Riverside Commercial', type: 'Task' as const, color: '#0EA5E9', bg: '#E0F2FE' },
]

const heroDashProject = getDemoDashboardProjects()[0]
const MOCK_PROJECT = {
  id: heroDashProject.id,
  name: heroDashProject.name,
  client: heroDashProject.client ?? 'Summit Construction',
  initials: heroDashProject.initials ?? 'RC',
  color: PROJECT_COLORS[2],
  budget: heroDashProject.budget_total ?? 165000,
  spent: heroDashProject.spent_total ?? 128400,
  timelineStart: heroDashProject.timeline_start ?? '02/01/2026',
  timelineEnd: heroDashProject.timeline_end ?? '04/15/2026',
  pctTime: heroDashProject.timeline_pct ?? 65,
  status: 'active' as const,
  statusLabel: 'Active',
  statusColor: '#10B981',
  statusBg: '#ECFDF5',
}

const MOCK_CLOCKED_IN = [
  { initials: 'MT', name: 'Marcus T.', job: 'Lead Framer', duration: '3h 22m' },
  { initials: 'JK', name: 'Jamie K.', job: 'Site Super', duration: '2h 45m' },
  { initials: 'SC', name: 'Sarah C.', job: 'Estimator', duration: '1h 15m' },
  { initials: 'DL', name: 'Drew L.', job: 'Carpenter', duration: '4h 00m' },
]

const MOCK_CHATS = [
  { initials: 'SC', name: 'Sarah Chen', time: '9:14am' },
]

export function HeroDashboardMock() {
  const now = dayjs()
  const greeting = now.hour() < 12 ? 'Good morning' : now.hour() < 17 ? 'Good afternoon' : 'Good evening'
  const daysInMonth = now.endOf('month').date()
  const firstDay = now.startOf('month').day()
  const todayDay = now.date()
  const monthLabel = now.format('MMMM YYYY')
  const weekLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  const leadingBlanks = firstDay
  const totalCells = leadingBlanks + daysInMonth
  const busyDays = new Set([3, 7, 11, 15, 18, 22, 25])
  const budgetPct = Math.round((MOCK_PROJECT.spent / MOCK_PROJECT.budget) * 100)
  const budgetColor = budgetPct > 95 ? '#EF4444' : budgetPct > 80 ? '#F59E0B' : '#10B981'

  return (
    <div className="w-full mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-0 items-start">
        <main className="main px-5 py-4 lg:px-6 lg:py-5 min-w-0">
          {/* Page header */}
          <div className="dashboard-page-header flex flex-wrap items-center gap-3 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 flex-1 min-w-0">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-white-dim mb-0.5">
                  {now.format('dddd, MMMM D, YYYY').toUpperCase()}
                </div>
                <h1 className="dashboard-title text-xl lg:text-2xl font-normal tracking-tight m-0 text-gray-900 dark:text-landing-white">
                  {greeting}, there.
                </h1>
              </div>
              <button
                type="button"
                className="btn btn-primary shrink-0 py-2 px-4 text-sm font-semibold flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white border-0 cursor-default"
                aria-hidden
              >
                <IconPlus className="w-4 h-4" />
                New Project
              </button>
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 lg:gap-3 mb-4 lg:mb-6">
            <div className="rounded-2xl border border-gray-200 dark:border-border-dark bg-white dark:bg-dark-3 p-3 lg:p-4 pt-[14px] lg:pt-[18px] pb-2.5 lg:pb-3 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl bg-emerald-500" />
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-white-dim mb-1.5">Total Revenue</div>
              <div className="text-lg lg:text-2xl font-semibold tracking-tight text-gray-900 dark:text-landing-white mb-1">{fmt(MOCK_KPIS.totalRevenue)}</div>
              <div className="flex items-end justify-between gap-1.5">
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">↑12.4% YTD</span>
                <Sparkline data={HERO_REVENUE_SPARKLINE} color="#10B981" height={24} width={56} />
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 dark:border-border-dark bg-white dark:bg-dark-3 p-3 lg:p-4 pt-[14px] lg:pt-[18px] pb-2.5 lg:pb-3 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl bg-amber-500" />
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-white-dim mb-1.5">Total Expense</div>
              <div className="text-lg lg:text-2xl font-semibold tracking-tight text-gray-900 dark:text-landing-white mb-1">{fmt(MOCK_KPIS.totalExpense)}</div>
              <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">69.6% of revenue</div>
            </div>
            <div className="rounded-2xl border border-gray-200 dark:border-border-dark bg-white dark:bg-dark-3 p-3 lg:p-4 pt-[14px] lg:pt-[18px] pb-2.5 lg:pb-3 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl bg-red-500" />
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-white-dim mb-1.5">Outstanding</div>
              <div className="text-lg lg:text-2xl font-semibold tracking-tight text-gray-900 dark:text-landing-white mb-1">{fmt(MOCK_KPIS.outstanding)}</div>
              <div className="text-[11px] font-semibold text-red-600 dark:text-red-400">{MOCK_KPIS.openInvoicesCount} open invoices</div>
            </div>
            <div className="rounded-2xl border border-gray-200 dark:border-border-dark bg-white dark:bg-dark-3 p-3 lg:p-4 pt-[14px] lg:pt-[18px] pb-2.5 lg:pb-3 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl bg-blue-500" />
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-white-dim mb-1.5">Active Jobs</div>
              <div className="text-lg lg:text-2xl font-semibold tracking-tight text-gray-900 dark:text-landing-white mb-1">{MOCK_KPIS.activeJobs}</div>
              <div className="flex items-end justify-between gap-1.5">
                <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">of {MOCK_KPIS.totalProjects} projects</span>
                <div className="flex gap-0.5 items-end h-5" aria-hidden>
                  {Array.from({ length: 12 }, (_, j) => (
                    <div
                      key={j}
                      className="w-1 rounded-sm flex-1 min-w-0 h-full bg-gray-200 dark:bg-dark-4"
                      style={j < MOCK_KPIS.activeJobs ? { background: '#3B82F6' } : undefined}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Today's Schedule */}
          <div className="rounded-2xl border border-gray-200 dark:border-border-dark bg-white dark:bg-dark-3 overflow-hidden mb-4 lg:mb-6">
            <div className="px-4 lg:px-5 py-3 border-b border-gray-100 dark:border-border flex items-center justify-between">
              <span className="text-xs lg:text-[13px] font-bold text-gray-900 dark:text-landing-white">Today&apos;s Schedule</span>
              <span className="text-[11px] px-2.5 py-1 rounded-md border border-gray-200 dark:border-border-dark text-gray-500 dark:text-white-dim">+ Add</span>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-border/50">
              {MOCK_SCHEDULE.map((item, i) => (
                <div key={i} className="flex items-center gap-2.5 lg:gap-3.5 px-4 lg:px-5 py-2.5 lg:py-3">
                  <div className="text-[10px] lg:text-[11px] font-semibold text-gray-500 dark:text-white-dim w-12 lg:w-14 shrink-0">{item.time}</div>
                  <div className="w-0.5 h-6 lg:h-8 rounded-sm shrink-0" style={{ background: item.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] lg:text-[13px] font-medium text-gray-900 dark:text-landing-white truncate">{item.title}</div>
                    <div className="text-[10px] lg:text-[11px] text-gray-500 dark:text-white-dim truncate">{item.job}</div>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: item.bg, color: item.color }}>{item.type}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Projects */}
          <div>
            <div className="flex items-center justify-between mb-2.5 lg:mb-3.5">
              <span className="text-xs lg:text-[13px] font-bold text-gray-900 dark:text-landing-white">Projects</span>
              <div className="flex gap-1.5">
                <span className="py-1.5 px-3 rounded-md text-[11px] font-medium text-gray-500 dark:text-white-dim bg-gray-100 dark:bg-dark-4">Filter</span>
                <span className="py-1.5 px-3 rounded-md text-[11px] font-medium text-gray-500 dark:text-white-dim bg-gray-100 dark:bg-dark-4">Manage</span>
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-border-dark bg-white dark:bg-dark-3 p-3 lg:p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0" style={{ background: MOCK_PROJECT.color + '20', color: MOCK_PROJECT.color }}>{MOCK_PROJECT.initials}</div>
                  <div className="min-w-0">
                    <div className="text-[12px] lg:text-[13px] font-semibold text-gray-900 dark:text-landing-white truncate">{MOCK_PROJECT.name}</div>
                    <div className="text-[10px] lg:text-[11px] text-gray-500 dark:text-white-dim">{MOCK_PROJECT.client || '—'}</div>
                  </div>
                </div>
                <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0" style={{ background: MOCK_PROJECT.statusBg, color: MOCK_PROJECT.statusColor }}>{MOCK_PROJECT.statusLabel}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 lg:gap-3">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-white-dim">Budget</span>
                    <span className="text-[10px] font-bold" style={{ color: budgetColor }}>{budgetPct}%</span>
                  </div>
                  <div className="h-1 bg-gray-100 dark:bg-dark-4 rounded overflow-hidden">
                    <div className="h-full rounded" style={{ width: `${budgetPct}%`, background: budgetColor }} />
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-white-dim mt-0.5">{fmt(MOCK_PROJECT.spent)} of {fmt(MOCK_PROJECT.budget)}</div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-white-dim">Timeline</span>
                    <span className="text-[10px] font-bold text-gray-500 dark:text-white-dim">{MOCK_PROJECT.pctTime}%</span>
                  </div>
                  <div className="h-1 bg-gray-100 dark:bg-dark-4 rounded overflow-hidden">
                    <div className="h-full rounded bg-gray-400 dark:bg-white-dim" style={{ width: `${MOCK_PROJECT.pctTime}%` }} />
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-white-dim mt-0.5">{MOCK_PROJECT.timelineStart} → {MOCK_PROJECT.timelineEnd}</div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Right sidebar */}
        <div className="content-right flex flex-col gap-4 lg:gap-5 pt-4 lg:pt-6 px-4 lg:px-5 pb-6 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-border min-w-0">
          {/* Calendar */}
          <div className="rounded-2xl border border-gray-200 dark:border-border-dark bg-white dark:bg-dark-3 p-3 lg:p-4">
            <div className="flex items-center justify-between gap-1 mb-2">
              <button type="button" className="p-1.5 rounded-md text-gray-400 dark:text-white-dim" aria-hidden><IconChevronLeft className="w-4 h-4" /></button>
              <p className="text-xs font-medium text-gray-500 dark:text-white-dim min-w-[90px]">{monthLabel}</p>
              <button type="button" className="p-1.5 rounded-md text-gray-400 dark:text-white-dim" aria-hidden><IconChevronRight className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {weekLabels.map((l, i) => (
                <span key={i} className="text-[10px] font-medium text-gray-400 dark:text-white-faint py-0.5 text-center">{l}</span>
              ))}
              {Array.from({ length: totalCells }, (_, i) => {
                if (i < leadingBlanks) return <span key={`b-${i}`} className="min-h-[28px]" />
                const day = i - leadingBlanks + 1
                const isToday = day === todayDay
                const hasTask = busyDays.has(day)
                return (
                  <div
                    key={day}
                    className={`flex flex-col items-center justify-center min-h-[28px] rounded-md text-xs ${isToday ? 'bg-red-600/20 dark:bg-red-500/25 text-red-600 dark:text-red-400 font-semibold' : 'text-gray-700 dark:text-landing-white'}`}
                  >
                    {day}
                    {hasTask && <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isToday ? 'bg-red-500' : 'bg-red-500/60'}`} />}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Clocked In Now */}
          <div className="rounded-2xl border border-gray-200 dark:border-border-dark bg-white dark:bg-dark-3 overflow-hidden">
            <div className="px-3 lg:px-4 py-2.5 lg:py-3 border-b border-gray-100 dark:border-border flex items-center justify-between">
              <span className="text-xs font-bold text-gray-900 dark:text-landing-white">Clocked In Now</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">• {MOCK_CLOCKED_IN.length} active</span>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-border/50">
              {MOCK_CLOCKED_IN.map((c, i) => (
                <div key={i} className="flex items-center gap-2 px-3 lg:px-4 py-2 lg:py-2.5">
                  <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{ background: PROJECT_COLORS[i % 4] + '20', color: PROJECT_COLORS[i % 4] }}>{c.initials}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] lg:text-xs font-semibold text-gray-900 dark:text-landing-white truncate">{c.name}</div>
                    <div className="text-[10px] text-gray-500 dark:text-white-dim truncate">{c.job}</div>
                  </div>
                  <div className="text-[11px] lg:text-xs font-semibold text-gray-900 dark:text-landing-white shrink-0">{c.duration}</div>
                </div>
              ))}
            </div>
            <div className="px-3 lg:px-4 py-2 border-t border-gray-100 dark:border-border">
              <span className="block w-full py-1.5 rounded-md text-[11px] font-medium text-gray-500 dark:text-white-dim bg-gray-100 dark:bg-dark-4 text-center">View Full Timeclock →</span>
            </div>
          </div>

          {/* Recent Chats */}
          <div className="rounded-2xl border border-gray-200 dark:border-border-dark bg-white dark:bg-dark-3 overflow-hidden">
            <div className="px-3 lg:px-4 py-2.5 lg:py-3 border-b border-gray-100 dark:border-border flex items-center justify-between">
              <span className="text-xs font-bold text-gray-900 dark:text-landing-white">Recent Chats</span>
              <span className="text-gray-500 dark:text-white-dim text-lg leading-none">+</span>
            </div>
            <div className="p-2">
              <div className="relative">
                <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-white-faint pointer-events-none" />
                <input type="text" placeholder="Search…" readOnly className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 dark:border-border-dark bg-gray-50 dark:bg-dark-4 text-sm text-gray-900 dark:text-landing-white placeholder:text-gray-400" aria-hidden />
              </div>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-border/50">
              {MOCK_CHATS.map((c, i) => (
                <div key={i} className="flex items-center gap-2.5 px-3 lg:px-4 py-2 lg:py-2.5">
                  <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 bg-red-500/20 text-red-500">{c.initials}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] lg:text-xs font-medium text-gray-900 dark:text-landing-white truncate">{c.name}</div>
                    <div className="text-[10px] text-gray-500 dark:text-white-dim">{c.time}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-2 border-t border-gray-100 dark:border-border">
              <span className="block w-full py-1.5 rounded-md text-[11px] font-medium text-gray-500 dark:text-white-dim bg-gray-100 dark:bg-dark-4 text-center">View All Messages →</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
