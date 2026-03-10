import { useState, useEffect, useCallback, useMemo } from 'react'
import { dayjs, formatShortDate, formatDate } from '@/lib/date'

const PHASE_COLORS = ['#2B5BA8', '#1A7B7D', '#2D7D4F', '#6B4CA8', '#B86E1A', '#C23B2A', '#5B8A3C', '#A0522D']
const MS_COLORS = ['#2D7D4F', '#2B5BA8', '#B86E1A', '#C23B2A', '#6B4CA8']

export type TaskStatus = 'not-started' | 'in-progress' | 'complete' | 'on-hold'

export interface BuilderTask {
  id: number
  name: string
  resp: string
  sw: number
  dur: number
  status: TaskStatus
}

export interface BuilderPhase {
  id: number
  name: string
  tasks: BuilderTask[]
}

export interface BuilderMilestone {
  id: number
  name: string
  wk: number
  desc: string
}

function nextId(): number {
  return Math.max(1, Math.floor(Math.random() * 1e9) + (Date.now() % 1e6))
}

export function weekToDate(startDate: string, wk: number): string {
  return dayjs(startDate).add((wk - 1) * 7, 'day').format('YYYY-MM-DD')
}

export function dateToWeek(startDate: string, dateStr: string): number {
  const start = dayjs(startDate)
  const d = dayjs(dateStr)
  const days = d.diff(start, 'day')
  return Math.max(1, Math.floor(days / 7) + 1)
}

/** Convert API phases/tasks/milestones + project to builder state. */
export function apiToBuilder(
  project: { name?: string; expected_start_date?: string; assigned_to_name?: string },
  phases: { id: string; name: string }[],
  tasks: { id: string; phase_id?: string; title: string; responsible?: string; start_date: string; end_date: string; duration_weeks?: number; completed?: boolean }[],
  milestones: { id: string; title: string; due_date: string }[],
  startDateFallback: string
): { projectName: string; startDate: string; gcOwner: string; phases: BuilderPhase[]; milestones: BuilderMilestone[] } {
  const startDate = project.expected_start_date || startDateFallback
  const phasesWithTasks = phases.map((p) => {
    const phaseTasks = tasks.filter((t) => t.phase_id === p.id)
    return {
      id: nextId(),
      name: p.name,
      tasks: phaseTasks.map((t) => ({
        id: nextId(),
        name: t.title,
        resp: t.responsible || '',
        sw: dateToWeek(startDate, t.start_date),
        dur: t.duration_weeks ?? Math.max(1, Math.ceil(dayjs(t.end_date).diff(dayjs(t.start_date), 'day') / 7)),
        status: (t.completed ? 'complete' : 'in-progress') as TaskStatus,
      })),
    }
  })
  return {
    projectName: project.name || '',
    startDate,
    gcOwner: project.assigned_to_name || '',
    phases: phasesWithTasks,
    milestones: milestones.map((m) => ({
      id: nextId(),
      name: m.title,
      wk: dateToWeek(startDate, m.due_date),
      desc: '',
    })),
  }
}

function getTaskStartDate(startDate: string, sw: number): string {
  return weekToDate(startDate, sw)
}

function getTaskEndDate(startDate: string, sw: number, dur: number): string {
  return dayjs(weekToDate(startDate, sw)).add(dur * 7 - 1, 'day').format('YYYY-MM-DD')
}

function durationLabel(startDate: string, sw: number, dur: number): string {
  const a = dayjs(getTaskStartDate(startDate, sw))
  const b = dayjs(getTaskEndDate(startDate, sw, dur))
  const days = Math.round(b.diff(a, 'day')) + 1
  if (days < 8) return `${days}d`
  const wks = Math.round(days / 7)
  return `${wks}wk${wks !== 1 ? 's' : ''}`
}

function statusListClass(s: TaskStatus): string {
  const map: Record<TaskStatus, string> = {
    'not-started': 's-ns',
    'in-progress': 's-ip',
    'complete': 's-co',
    'on-hold': 's-oh',
  }
  return map[s] ?? 's-ns'
}

function statusLabel(s: TaskStatus): string {
  const map: Record<TaskStatus, string> = {
    'not-started': 'Not started',
    'in-progress': 'In progress',
    'complete': 'Complete',
    'on-hold': 'On hold',
  }
  return map[s] ?? 'Not started'
}

function statusDotColor(s: TaskStatus): string {
  const map: Record<TaskStatus, string> = {
    'not-started': '#C5C2BB',
    'in-progress': '#2B5BA8',
    'complete': '#2D7D4F',
    'on-hold': '#B86E1A',
  }
  return map[s] ?? '#C5C2BB'
}

function minDayjs(dates: dayjs.Dayjs[]): dayjs.Dayjs {
  if (!dates.length) return dayjs()
  const ts = Math.min(...dates.map((d) => d.valueOf()))
  return dayjs(ts)
}

function maxDayjs(dates: dayjs.Dayjs[]): dayjs.Dayjs {
  if (!dates.length) return dayjs()
  const ts = Math.max(...dates.map((d) => d.valueOf()))
  return dayjs(ts)
}

function phaseRangeForDisplay(startDate: string, phase: BuilderPhase): { start: dayjs.Dayjs; end: dayjs.Dayjs } | null {
  const withName = phase.tasks.filter((t) => t.name.trim())
  if (!withName.length) return null
  const starts = withName.map((t) => dayjs(getTaskStartDate(startDate, t.sw)))
  const ends = withName.map((t) => dayjs(getTaskEndDate(startDate, t.sw, t.dur)))
  return {
    start: minDayjs(starts),
    end: maxDayjs(ends),
  }
}

/** Mock schedule data for previewing/demo only. Not used by the project Schedule tab — that tab is driven by real data via apiToBuilder(project, phases, tasks, milestones) from ProjectsPage. */
export function getMockScheduleData(): { phases: BuilderPhase[]; milestones: BuilderMilestone[] } {
  return {
    phases: [
      {
        id: 1001,
        name: 'Demo',
        tasks: [
          { id: 10001, name: 'Strip fixtures & vanity', resp: 'Crew A', sw: 1, dur: 1, status: 'complete' },
          { id: 10002, name: 'Demo tub surround & flooring', resp: 'Crew A', sw: 1, dur: 2, status: 'complete' },
          { id: 10003, name: 'Haul debris', resp: 'Crew A', sw: 3, dur: 1, status: 'in-progress' },
        ],
      },
      {
        id: 1002,
        name: 'Rough plumbing',
        tasks: [
          { id: 10004, name: 'Rough-in supply lines', resp: 'Plumber', sw: 3, dur: 2, status: 'not-started' },
          { id: 10005, name: 'Rough-in drain lines', resp: 'Plumber', sw: 4, dur: 2, status: 'not-started' },
          { id: 10006, name: 'Pressure test', resp: 'Plumber', sw: 6, dur: 1, status: 'not-started' },
        ],
      },
      {
        id: 1003,
        name: 'Tile & finish',
        tasks: [
          { id: 10007, name: 'Waterproofing', resp: 'Tile crew', sw: 7, dur: 1, status: 'not-started' },
          { id: 10008, name: 'Floor tile', resp: 'Tile crew', sw: 8, dur: 2, status: 'not-started' },
          { id: 10009, name: 'Wall tile', resp: 'Tile crew', sw: 9, dur: 3, status: 'not-started' },
          { id: 10010, name: 'Grout & seal', resp: 'Tile crew', sw: 12, dur: 1, status: 'not-started' },
        ],
      },
    ],
    milestones: [
      { id: 2001, name: 'Demo complete', wk: 3, desc: '' },
      { id: 2002, name: 'Rough plumbing complete', wk: 6, desc: '' },
      { id: 2003, name: 'Rough plumbing inspection', wk: 6, desc: '' },
      { id: 2004, name: 'Tile complete', wk: 12, desc: '' },
    ],
  }
}

export interface ScheduleBuilderProps {
  projectName: string
  startDate: string
  gcOwner: string
  phases: BuilderPhase[]
  milestones: BuilderMilestone[]
  onPhasesChange: (phases: BuilderPhase[]) => void
  onMilestonesChange: (milestones: BuilderMilestone[]) => void
  onMetaChange?: (data: { projectName: string; startDate: string; gcOwner: string }) => void
  onClearAll?: () => void
  onExportCSV?: () => void
  onSave?: (meta?: { projectName: string; startDate: string; gcOwner: string }) => void
  onImportClick?: () => void
  isDemo?: boolean
  saving?: boolean
}

export function ScheduleBuilder({
  projectName,
  startDate,
  gcOwner,
  phases,
  milestones,
  onPhasesChange,
  onMilestonesChange,
  onMetaChange,
  onSave,
  onImportClick,
  isDemo,
  saving = false,
}: ScheduleBuilderProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [meta, setMeta] = useState({ projectName, startDate, gcOwner })

  useEffect(() => {
    setMeta({ projectName, startDate, gcOwner })
  }, [projectName, startDate, gcOwner])

  const startD = meta.startDate || dayjs().format('YYYY-MM-DD')

  const allTasks = useMemo(
    () => phases.flatMap((p) => p.tasks.filter((t) => t.name.trim())),
    [phases]
  )
  const namedMilestones = useMemo(() => milestones.filter((m) => m.name.trim()), [milestones])
  /* Show "No schedule yet" when there are no tasks; list view when at least one task exists */
  const hasContent = allTasks.length > 0

  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  const openDrawer = useCallback(() => {
    if (!meta.startDate) setMeta((m) => ({ ...m, startDate: dayjs().format('YYYY-MM-DD') }))
    setDrawerOpen(true)
  }, [meta.startDate])

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false)
  }, [])

  const addPhase = useCallback(() => {
    onPhasesChange([...phases, { id: nextId(), name: '', tasks: [] }])
  }, [phases, onPhasesChange])

  const removePhase = useCallback(
    (pid: number) => {
      onPhasesChange(phases.filter((p) => p.id !== pid))
    },
    [phases, onPhasesChange]
  )

  const updatePhase = useCallback(
    (pid: number, field: 'name', value: string) => {
      onPhasesChange(phases.map((p) => (p.id === pid ? { ...p, [field]: value } : p)))
    },
    [phases, onPhasesChange]
  )

  const addTask = useCallback(
    (pid: number) => {
      const phase = phases.find((p) => p.id === pid)
      if (!phase) return
      onPhasesChange(
        phases.map((p) =>
          p.id === pid
            ? {
                ...p,
                tasks: [
                  ...p.tasks,
                  {
                    id: nextId(),
                    name: '',
                    resp: '',
                    sw: dateToWeek(startD, startD),
                    dur: 1,
                    status: 'not-started' as TaskStatus,
                  },
                ],
              }
            : p
        )
      )
    },
    [phases, onPhasesChange, startD]
  )

  const removeTask = useCallback(
    (pid: number, tid: number) => {
      onPhasesChange(phases.map((p) => (p.id === pid ? { ...p, tasks: p.tasks.filter((t) => t.id !== tid) } : p)))
    },
    [phases, onPhasesChange]
  )

  const updateTask = useCallback(
    (pid: number, tid: number, field: keyof BuilderTask, value: string | number) => {
      onPhasesChange(
        phases.map((p) => {
          if (p.id !== pid) return p
          const tasks = p.tasks.map((t) => {
            if (t.id !== tid) return t
            if (field === 'sw' || field === 'dur')
              return { ...t, [field]: Math.max(1, typeof value === 'number' ? value : parseInt(String(value), 10) || 1) }
            return { ...t, [field]: value }
          })
          return { ...p, tasks }
        })
      )
    },
    [phases, onPhasesChange]
  )

  const setTaskStartDate = useCallback(
    (pid: number, tid: number, dateStr: string) => {
      const newSw = dateToWeek(startD, dateStr)
      updateTask(pid, tid, 'sw', newSw)
    },
    [startD, updateTask]
  )

  const setTaskEndDate = useCallback(
    (pid: number, tid: number, dateStr: string) => {
      const phase = phases.find((p) => p.id === pid)
      const task = phase?.tasks.find((t) => t.id === tid)
      if (!task) return
      const taskStart = dayjs(getTaskStartDate(startD, task.sw))
      const days = dayjs(dateStr).diff(taskStart, 'day') + 1
      const newDur = Math.max(1, Math.ceil(days / 7))
      updateTask(pid, tid, 'dur', newDur)
    },
    [phases, startD, updateTask]
  )

  const addMilestone = useCallback(() => {
    onMilestonesChange([...milestones, { id: nextId(), name: '', wk: 1, desc: '' }])
  }, [milestones, onMilestonesChange])

  const removeMilestone = useCallback(
    (mid: number) => {
      onMilestonesChange(milestones.filter((m) => m.id !== mid))
    },
    [milestones, onMilestonesChange]
  )

  const updateMilestone = useCallback(
    (mid: number, field: keyof BuilderMilestone, value: string | number) => {
      onMilestonesChange(
        milestones.map((m) =>
          m.id === mid ? { ...m, [field]: field === 'wk' ? Math.max(1, typeof value === 'number' ? value : parseInt(String(value), 10) || 1) : value } : m
        )
      )
    },
    [milestones, onMilestonesChange]
  )

  const setMilestoneDate = useCallback(
    (mid: number, dateStr: string) => {
      const newWk = dateToWeek(startD, dateStr)
      updateMilestone(mid, 'wk', newWk)
    },
    [startD, updateMilestone]
  )

  const handleSaveSchedule = useCallback(() => {
    onMetaChange?.(meta)
    onSave?.(meta)
    closeDrawer()
  }, [meta, onMetaChange, onSave, closeDrawer])

  const progressDone = allTasks.filter((t) => t.status === 'complete').length
  const progressPct = allTasks.length ? Math.round((progressDone / allTasks.length) * 100) : 0

  const dateRangeSubtitle = useMemo(() => {
    const allStarts = allTasks.map((t) => dayjs(getTaskStartDate(startD, t.sw)))
    const allEnds = allTasks.map((t) => dayjs(getTaskEndDate(startD, t.sw, t.dur)))
    const msDates = namedMilestones.map((m) => dayjs(weekToDate(startD, m.wk)))
    const allDates = [...allStarts, ...allEnds, ...msDates]
    if (!allDates.length) return '—'
    const earliest = minDayjs(allDates)
    const latest = maxDayjs(allDates)
    return `${formatShortDate(earliest.toISOString())} – ${formatDate(latest.toISOString())}`
  }, [allTasks, namedMilestones, startD])

  const phasesWithContent = useMemo(
    () => phases.filter((p) => p.name.trim() || p.tasks.some((t) => t.name.trim())),
    [phases]
  )

  return (
    <div className="sched-card">
      {!hasContent ? (
        <div className="sched-empty">
          <div className="sched-empty-icon">
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <rect x={3} y={4} width={18} height={18} rx={2} />
              <line x1={16} y1={2} x2={16} y2={6} />
              <line x1={8} y1={2} x2={8} y2={6} />
              <line x1={3} y1={10} x2={21} y2={10} />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-landing-white">No schedule yet</h3>
          <p className="text-sm text-muted dark:text-white-faint max-w-[300px] leading-relaxed">
            Build out your project schedule by adding phases, tasks, and key milestones.
          </p>
          <button type="button" className="btn btn-primary mt-1 flex items-center gap-1.5" onClick={openDrawer}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <line x1={12} y1={5} x2={12} y2={19} />
              <line x1={5} y1={12} x2={19} y2={12} />
            </svg>
            Build Schedule
          </button>
        </div>
      ) : (
        <div>
          <div className="sched-header">
            <div className="sched-header-left">
              <div className="sched-header-title">{meta.projectName || 'Project Schedule'}</div>
              <div className="sched-header-sub">{dateRangeSubtitle}</div>
            </div>
            <div className="sched-header-right">
              <button type="button" className="btn btn-ghost py-1.5 px-3 text-xs flex items-center gap-1.5" onClick={openDrawer}>
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <line x1={12} y1={5} x2={12} y2={19} />
                  <line x1={5} y1={12} x2={19} y2={12} />
                </svg>
                Add Task
              </button>
              <button type="button" className="btn btn-ghost py-1.5 px-3 text-xs flex items-center gap-1.5" onClick={openDrawer}>
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit Schedule
              </button>
            </div>
          </div>

          <div className="sched-progress-strip">
            <div className="sched-prog-label">
              {progressDone} of {allTasks.length} task{allTasks.length !== 1 ? 's' : ''} done
            </div>
            <div className="sched-prog-bar-wrap">
              <div className="sched-prog-bar" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="sched-prog-pct">{progressPct}%</div>
          </div>

          <div className="sched-col-headers">
            <div className="sched-col-hdr" />
            <div className="sched-col-hdr">Task</div>
            <div className="sched-col-hdr">Responsible</div>
            <div className="sched-col-hdr">Dates</div>
            <div className="sched-col-hdr">Status</div>
            <div className="sched-col-hdr" />
          </div>

          {phasesWithContent.map((p, pi) => {
            const color = PHASE_COLORS[pi % PHASE_COLORS.length]
            const r = phaseRangeForDisplay(startD, p)
            const ts = p.tasks.filter((t) => t.name.trim())
            const pDone = ts.filter((t) => t.status === 'complete').length
            const pPct = ts.length ? Math.round((pDone / ts.length) * 100) : 0
            const badgeCls = pPct === 100 ? 'done' : pPct > 0 ? 'active' : ''

            return (
              <div key={p.id} className="sched-phase">
                <div className="sched-phase-hd" onClick={openDrawer} onKeyDown={(e) => e.key === 'Enter' && openDrawer()} role="button" tabIndex={0}>
                  <div className="sched-phase-color" style={{ background: color }} />
                  <div className="sched-phase-name">{p.name || <span className="text-muted dark:text-white-faint font-normal">Unnamed phase</span>}</div>
                  {r && (
                    <div className="sched-phase-dates">
                      {formatShortDate(r.start.toISOString())} – {formatShortDate(r.end.toISOString())}
                    </div>
                  )}
                  <div className={`sched-phase-badge ${badgeCls}`}>{ts.length ? `${pPct}%` : '—'}</div>
                </div>
                {ts.length > 0 &&
                  ts.map((t) => {
                    const sd = dayjs(getTaskStartDate(startD, t.sw))
                    const ed = dayjs(getTaskEndDate(startD, t.sw, t.dur))
                    const dateStr =
                      ed.isSame(sd, 'day') ? formatShortDate(sd.toISOString()) : `${formatShortDate(sd.toISOString())} – ${formatShortDate(ed.toISOString())}`
                    const durLbl = durationLabel(startD, t.sw, t.dur)
                    return (
                      <div key={t.id} className="sched-task-row">
                        <div className="sched-task-dot" style={{ background: statusDotColor(t.status) }} />
                        <div className="sched-task-name">{t.name}</div>
                        <div className="sched-task-who">{t.resp || '—'}</div>
                        <div className="sched-task-dates">
                          {dateStr}
                          {durLbl ? ` · ${durLbl}` : ''}
                        </div>
                        <div>
                          <span className={`sched-task-status ${statusListClass(t.status)}`}>{statusLabel(t.status)}</span>
                        </div>
                        <button type="button" className="sched-task-edit" onClick={openDrawer} title="Edit" aria-label="Edit">
                          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                      </div>
                    )
                  })}
                {ts.length === 0 && (
                  <div className="py-2.5 px-5 pl-8 text-sm text-muted dark:text-white-faint">
                    No tasks —{' '}
                    <button type="button" className="text-primary hover:underline" onClick={openDrawer}>
                      add tasks
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {namedMilestones.length > 0 && (
            <>
              <div className="sched-ms-section-hd">
                <div className="sched-ms-label">Milestones</div>
              </div>
              {namedMilestones.map((m, mi) => (
                <div key={m.id} className="sched-ms-row">
                  <div className="sched-ms-diamond" style={{ background: MS_COLORS[mi % MS_COLORS.length] }} />
                  <div className="sched-ms-name">{m.name}</div>
                  <div className="sched-ms-date">{formatDate(weekToDate(startD, m.wk))}</div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Drawer overlay */}
      <div
        className={`drawer-overlay ${drawerOpen ? 'open' : ''}`}
        onClick={closeDrawer}
        onKeyDown={(e) => e.key === 'Escape' && closeDrawer()}
        role="presentation"
        aria-hidden={!drawerOpen}
      />

      {/* Drawer */}
      <div className={`drawer ${drawerOpen ? 'open' : ''}`} role="dialog" aria-modal={drawerOpen} aria-labelledby="drawer-title">
        <div className="drawer-handle-bar">
          <div className="drawer-handle" />
        </div>
        <div className="drawer-top">
          <div>
            <div id="drawer-title" className="drawer-title">
              Build Schedule
            </div>
            <div className="drawer-title-sub">{meta.projectName || 'Job name goes here'}</div>
          </div>
          <div className="drawer-top-right">
            {onSave && (
              <button type="button" className="btn btn-primary flex items-center gap-1.5" onClick={handleSaveSchedule} disabled={saving}>
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {saving ? 'Saving…' : 'Save Schedule'}
              </button>
            )}
            {onImportClick && (
              <button type="button" className="btn btn-ghost py-1.5 px-3 text-xs" onClick={onImportClick}>
                Import schedule
              </button>
            )}
            <button type="button" className="drawer-close" onClick={closeDrawer} aria-label="Close">
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <line x1={18} y1={6} x2={6} y2={18} />
                <line x1={6} y1={6} x2={18} y2={18} />
              </svg>
            </button>
          </div>
        </div>
        <div className="drawer-body">
          <div style={{ marginBottom: 16 }}>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-muted dark:text-white-faint mb-1.5">
              Project Start Date
            </label>
            <input
              type="date"
              className="w-[190px] px-3 py-2 rounded-lg border border-border dark:border-border-dark bg-white dark:bg-dark-3 text-gray-900 dark:text-landing-white text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              value={meta.startDate}
              onChange={(e) => {
                const v = e.target.value
                setMeta((m) => ({ ...m, startDate: v }))
                onMetaChange?.({ ...meta, startDate: v })
              }}
            />
          </div>

          <div className="d-section">
            <div className="d-section-label">Phases &amp; Tasks</div>
            {phases.map((p, pi) => {
              const color = PHASE_COLORS[pi % PHASE_COLORS.length]
              const r = phaseRangeForDisplay(startD, p)
              const rangeLabel = r ? `${formatShortDate(r.start.toISOString())} – ${formatShortDate(r.end.toISOString())}` : 'Set task dates'
              return (
                <div key={p.id} className="d-phase" data-dpid={p.id}>
                  <div className="d-phase-top">
                    <div className="d-phase-swatch" style={{ background: color }} />
                    <input
                      type="text"
                      className="d-phase-name-in"
                      placeholder="Phase name…"
                      value={p.name}
                      onChange={(e) => updatePhase(p.id, 'name', e.target.value)}
                    />
                    <span className={`d-phase-range ${r ? 'live' : ''}`}>{rangeLabel}</span>
                    {!isDemo && (
                      <button type="button" className="d-del" onClick={() => removePhase(p.id)} aria-label="Remove phase">
                        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <line x1={18} y1={6} x2={6} y2={18} />
                          <line x1={6} y1={6} x2={18} y2={18} />
                        </svg>
                      </button>
                    )}
                  </div>
                  {p.tasks.length > 0 && (
                    <div className="d-task-col-hdrs">
                      <div className="d-col-h">Task</div>
                      <div className="d-col-h">Responsible</div>
                      <div className="d-col-h">Start</div>
                      <div className="d-col-h">End</div>
                      <div className="d-col-h" />
                    </div>
                  )}
                  {p.tasks.map((t) => (
                    <div key={t.id} className="d-task-row">
                      <input
                        type="text"
                        className="d-ti"
                        placeholder="Task name…"
                        value={t.name}
                        onChange={(e) => updateTask(p.id, t.id, 'name', e.target.value)}
                      />
                      <input
                        type="text"
                        className="d-ti pl-1.5"
                        placeholder="Who…"
                        value={t.resp}
                        onChange={(e) => updateTask(p.id, t.id, 'resp', e.target.value)}
                      />
                      <input
                        type="date"
                        className="d-date-in"
                        value={getTaskStartDate(startD, t.sw)}
                        onChange={(e) => setTaskStartDate(p.id, t.id, e.target.value)}
                      />
                      <input
                        type="date"
                        className="d-date-in"
                        value={getTaskEndDate(startD, t.sw, t.dur)}
                        onChange={(e) => setTaskEndDate(p.id, t.id, e.target.value)}
                      />
                      {!isDemo && (
                        <button type="button" className="d-del" onClick={() => removeTask(p.id, t.id)} aria-label="Remove task">
                          <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <line x1={18} y1={6} x2={6} y2={18} />
                            <line x1={6} y1={6} x2={18} y2={18} />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                  {!isDemo && (
                    <button type="button" className="d-add-task" onClick={() => addTask(p.id)}>
                      <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <line x1={12} y1={5} x2={12} y2={19} />
                        <line x1={5} y1={12} x2={19} y2={12} />
                      </svg>
                      Add task
                    </button>
                  )}
                </div>
              )
            })}
            {!isDemo && (
              <button type="button" className="d-add-btn" onClick={addPhase}>
                <div className="d-add-icon">
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <line x1={12} y1={5} x2={12} y2={19} />
                    <line x1={5} y1={12} x2={19} y2={12} />
                  </svg>
                </div>
                Add Phase
              </button>
            )}
          </div>

          <div className="d-section">
            <div className="d-section-label">Milestones</div>
            {milestones.map((m, mi) => (
              <div key={m.id} className="d-ms-row">
                <div className="d-ms-dot" style={{ background: MS_COLORS[mi % MS_COLORS.length] }} />
                <input
                  type="text"
                  className="d-ms-in"
                  placeholder="Milestone name…"
                  value={m.name}
                  onChange={(e) => updateMilestone(m.id, 'name', e.target.value)}
                />
                <input
                  type="date"
                  className="d-date-in text-[11.5px]"
                  value={weekToDate(startD, m.wk)}
                  onChange={(e) => setMilestoneDate(m.id, e.target.value)}
                />
                {!isDemo && (
                  <button type="button" className="d-del" onClick={() => removeMilestone(m.id)} aria-label="Remove milestone">
                    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <line x1={18} y1={6} x2={6} y2={18} />
                      <line x1={6} y1={6} x2={18} y2={18} />
                    </svg>
                  </button>
                )}
              </div>
            ))}
            {!isDemo && (
              <button type="button" className="d-add-btn" onClick={addMilestone}>
                <div className="d-add-icon">
                  <svg width={10} height={10} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L22 12L12 22L2 12L12 2z" />
                  </svg>
                </div>
                Add Milestone
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
