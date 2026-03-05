import { useMemo } from 'react'
import type { Phase, Milestone, ProjectTask } from '@/types/global'
import { dayjs, formatDate, formatShortDate, parseToTimestamp, todayISO } from '@/lib/date'

interface PhaseTimelineProps {
  phases: Phase[]
  milestones: Milestone[]
  tasks?: ProjectTask[]
  projectId?: string
  isDemo?: boolean
  onImportClick?: () => void
}

type PhaseStatus = 'done' | 'active' | 'upcoming'

function getPhaseStatus(phase: Phase): PhaseStatus {
  const today = todayISO()
  if (today > phase.end_date) return 'done'
  if (today >= phase.start_date && today <= phase.end_date) return 'active'
  return 'upcoming'
}

function getPhaseProgress(phase: Phase): number {
  const status = getPhaseStatus(phase)
  if (status !== 'active') return status === 'done' ? 100 : 0
  const start = parseToTimestamp(phase.start_date)
  const end = parseToTimestamp(phase.end_date)
  const now = dayjs().valueOf()
  if (end <= start) return 100
  return Math.round(((now - start) / (end - start)) * 100)
}

function daysBetween(a: string, b: string): number {
  const t1 = parseToTimestamp(a)
  const t2 = parseToTimestamp(b)
  return Math.round(Math.abs(t2 - t1) / 86400000)
}

function getTaskStatus(task: ProjectTask): 'done' | 'active' | 'upcoming' {
  const today = todayISO()
  if (today > task.end_date) return 'done'
  if (today >= task.start_date && today <= task.end_date) return 'active'
  return 'upcoming'
}

export function PhaseTimeline({ phases, milestones, tasks = [], projectId, isDemo, onImportClick }: PhaseTimelineProps) {
  const taskList = tasks || []
  const hasTasks = taskList.length > 0

  const { rangeStart, rangeEnd, totalDays, pct, months } = useMemo(() => {
    const allDates = [
      ...phases.flatMap((p) => [parseToTimestamp(p.start_date), parseToTimestamp(p.end_date)]),
      ...milestones.map((m) => parseToTimestamp(m.due_date)),
      ...taskList.flatMap((t) => [parseToTimestamp(t.start_date), parseToTimestamp(t.end_date)]),
    ]
    const minTs = Math.min(...allDates)
    const maxTs = Math.max(...allDates)
    const rangeStart = dayjs(minTs)
    const rangeEnd = dayjs(maxTs)
    const totalDays = Math.max(1, daysBetween(rangeStart.format('YYYY-MM-DD'), rangeEnd.format('YYYY-MM-DD')))
    const pct = (dateStr: string | number) => {
      const ts = typeof dateStr === 'string' ? parseToTimestamp(dateStr) : dateStr
      return ((ts - minTs) / (maxTs - minTs)) * 100
    }
    const months: { start: dayjs.Dayjs; label: string; widthPct: number; isCurrent: boolean }[] = []
    let cur = rangeStart.startOf('month')
    const today = dayjs()
    while (cur.isBefore(rangeEnd) || cur.isSame(rangeEnd, 'month')) {
      const mEnd = cur.endOf('month')
      const mStartClamped = cur.isBefore(rangeStart) ? rangeStart : cur
      const mEndClamped = mEnd.isAfter(rangeEnd) ? rangeEnd : mEnd
      const monthDays = mEndClamped.diff(mStartClamped, 'day') + 1
      const widthPct = (monthDays / totalDays) * 100
      months.push({
        start: cur,
        label: cur.format('MMM YY'),
        widthPct,
        isCurrent: cur.year() === today.year() && cur.month() === today.month(),
      })
      cur = cur.add(1, 'month').startOf('month')
    }
    return { rangeStart, rangeEnd, totalDays, pct, months, minTs, maxTs }
  }, [phases, milestones, taskList])

  const todayPct = useMemo(() => {
    const minTs = rangeStart.valueOf()
    const maxTs = rangeEnd.valueOf()
    const now = dayjs().valueOf()
    if (now < minTs) return 0
    if (now > maxTs) return 100
    return ((now - minTs) / (maxTs - minTs)) * 100
  }, [rangeStart, rangeEnd])

  const ganttRows: ({ type: 'phase'; phase: Phase } | { type: 'task'; task: ProjectTask })[] = hasTasks
    ? phases.flatMap((p) => [
        { type: 'phase' as const, phase: p },
        ...taskList
          .filter((t) => t.phase_id === p.id)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((t) => ({ type: 'task' as const, task: t })),
      ])
    : phases.map((p) => ({ type: 'phase' as const, phase: p }))

  if (phases.length === 0 && milestones.length === 0 && taskList.length === 0) {
    return (
      <div className="rounded-xl border border-border dark:border-border-dark bg-white dark:bg-dark-3 p-6 shadow-card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-landing-white mb-2">Schedule</h2>
        <p className="text-sm text-muted dark:text-white-dim">No phases or milestones yet.</p>
        {projectId && !isDemo && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary text-sm" onClick={onImportClick}>
              Import schedule
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border dark:border-border-dark bg-white dark:bg-dark-3 p-6 shadow-card overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-landing-white">Schedule</h2>
          <p className="text-xs font-medium text-muted dark:text-white-faint mt-0.5">
            {formatDate(rangeStart.toISOString())} – {formatDate(rangeEnd.toISOString())}
            <span className="mx-1.5">·</span>
            {totalDays} days total
          </p>
        </div>
        {projectId && !isDemo && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-ghost text-sm" onClick={onImportClick}>
              Import schedule
            </button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-4" aria-hidden>
          <div className="flex items-center gap-1.5">
            <div className="w-[18px] h-1 rounded-sm bg-sky-300 dark:bg-sky-600" />
            <span className="text-[11.5px] font-medium text-muted dark:text-white-faint">Complete</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-[18px] h-1 rounded-sm bg-primary dark:bg-primary shadow-sm" />
            <span className="text-[11.5px] font-medium text-muted dark:text-white-faint">In Progress</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-[18px] h-1 rounded-sm bg-gray-300 dark:bg-gray-500" />
            <span className="text-[11.5px] font-medium text-muted dark:text-white-faint">Upcoming</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rotate-45 rounded-sm bg-green-600 dark:bg-green-500" />
            <span className="text-[11.5px] font-medium text-muted dark:text-white-faint">Milestone</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-0.5 h-3 rounded-full bg-accent dark:bg-accent" />
            <span className="text-[11.5px] font-medium text-muted dark:text-white-faint">Today</span>
          </div>
        </div>
      </div>

      {/* Gantt body */}
      <div className="flex gap-0 min-w-0">
        {/* Labels column */}
        <div className="w-[180px] shrink-0 pt-7">
          {ganttRows.map((row) =>
            row.type === 'phase' ? (
              <div
                key={`phase-${row.phase.id}`}
                className="h-[52px] flex items-center text-xs font-medium text-gray-600 dark:text-white-dim"
              >
                {row.phase.name}
              </div>
            ) : (
              <div
                key={`task-${row.task.id}`}
                className="h-[52px] flex items-center pl-3 text-xs text-muted dark:text-white-faint border-l-2 border-transparent"
              >
                {row.task.title}
                {row.task.responsible ? (
                  <span className="ml-1.5 text-[10px] text-muted dark:text-white-faint truncate" title={row.task.responsible}>
                    · {row.task.responsible}
                  </span>
                ) : null}
              </div>
            )
          )}
          <div className="h-9 flex items-start pt-3 text-[10.5px] font-semibold uppercase tracking-wider text-muted dark:text-white-faint">
            Milestones
          </div>
        </div>

        {/* Chart area */}
        <div className="flex-1 min-w-0 relative">
          {/* Month header */}
          <div className="flex h-7 border-b border-border dark:border-border-dark">
            {months.map((m) => (
              <div
                key={m.start.valueOf()}
                className={`border-r border-border dark:border-border-dark px-2 flex items-center text-[10.5px] font-semibold uppercase tracking-wide shrink-0 last:border-r-0 ${
                  m.isCurrent ? 'text-primary dark:text-primary' : 'text-muted dark:text-white-faint'
                }`}
                style={{ width: `${m.widthPct}%` }}
              >
                {m.label}
              </div>
            ))}
          </div>

          {/* Grid + Today line + Rows */}
          <div className="relative">
            {/* Subtle grid columns */}
            <div className="absolute inset-0 flex pointer-events-none top-0">
              {months.map((m) => (
                <div
                  key={`grid-${m.start.valueOf()}`}
                  className="border-r border-border/60 dark:border-border-dark/60 shrink-0 last:border-r-0"
                  style={{ width: `${m.widthPct}%` }}
                />
              ))}
            </div>

            {/* Today line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-accent dark:bg-accent z-10 pointer-events-none"
              style={{ left: `${todayPct}%` }}
            >
              <span className="absolute top-[-22px] left-1/2 -translate-x-1/2 text-[9.5px] font-bold uppercase tracking-wide text-accent dark:text-accent bg-white dark:bg-dark-3 px-1.5 py-0.5 rounded border border-accent/20 whitespace-nowrap">
                Today
              </span>
            </div>

            {/* Phase and task rows */}
            {ganttRows.map((row) => {
              if (row.type === 'phase') {
                const phase = row.phase
                const status = getPhaseStatus(phase)
                const progress = getPhaseProgress(phase)
                const leftPct = pct(phase.start_date)
                const endPct = pct(phase.end_date)
                const widthPct = Math.max(endPct - leftPct, 1)
                const days = daysBetween(phase.start_date, phase.end_date)
                return (
                  <div
                    key={phase.id}
                    className="h-[52px] flex items-center relative border-b border-border/50 dark:border-border-dark/50 last:border-b-0"
                  >
                    <div
                      className={`absolute h-5 rounded-md flex items-center overflow-visible z-[2] group/bar ${
                        status === 'done'
                          ? 'bg-sky-300 dark:bg-sky-600'
                          : status === 'active'
                            ? 'bg-primary dark:bg-primary shadow-md'
                            : 'bg-gray-300 dark:bg-gray-500'
                      }`}
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    >
                      {status === 'active' && (
                        <div
                          className="absolute inset-y-0 left-0 rounded-l-md bg-white/25 rounded-r-none"
                          style={{ width: `${progress}%` }}
                        />
                      )}
                      <span className="absolute left-0 -top-4 text-[10px] font-semibold text-muted dark:text-white-faint whitespace-nowrap">
                        {formatShortDate(phase.start_date)}
                      </span>
                      <span className="absolute right-0 -top-4 text-[10px] font-semibold text-muted dark:text-white-faint whitespace-nowrap">
                        {formatShortDate(phase.end_date)}
                      </span>
                      {status === 'active' && (
                        <span className="absolute right-2 text-[9.5px] font-bold uppercase tracking-wide text-white/90">
                          {progress}%
                        </span>
                      )}
                      <span
                        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full ml-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-dark-3 text-[10px] font-semibold px-1.5 py-0.5 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none z-20 whitespace-nowrap"
                        title={`${days} days`}
                      >
                        {days} days
                      </span>
                    </div>
                  </div>
                )
              }
              const task = row.task
              const tStatus = getTaskStatus(task)
              const leftPct = pct(task.start_date)
              const endPct = pct(task.end_date)
              const widthPct = Math.max(endPct - leftPct, 1)
              const taskDays = daysBetween(task.start_date, task.end_date)
              const isOdd = (ganttRows.findIndex((r) => r.type === 'task' && r.task.id === task.id) ?? 0) % 2 === 0
              return (
                <div
                  key={task.id}
                  className="h-[52px] flex items-center relative border-b border-border/50 dark:border-border-dark/50 last:border-b-0"
                >
                  <div
                    className={`absolute h-4 rounded flex items-center overflow-visible z-[2] group/bar ${
                      tStatus === 'done'
                        ? 'bg-sky-300/80 dark:bg-sky-600/80'
                        : tStatus === 'active'
                          ? isOdd
                            ? 'bg-blue-500 dark:bg-blue-500'
                            : 'bg-blue-400 dark:bg-blue-600'
                          : 'bg-gray-300/80 dark:bg-gray-500/80'
                    }`}
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  >
                    <span className="absolute left-0 -top-3.5 text-[9px] font-medium text-muted dark:text-white-faint whitespace-nowrap">
                      {formatShortDate(task.start_date)}
                    </span>
                    <span
                      className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full ml-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-dark-3 text-[9px] font-medium px-1 py-0.5 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none z-20 whitespace-nowrap"
                      title={task.responsible ? `${taskDays} days · ${task.responsible}` : `${taskDays} days`}
                    >
                      {taskDays}d{task.responsible ? ` · ${task.responsible}` : ''}
                    </span>
                  </div>
                </div>
              )
            })}

            {/* Milestone row */}
            <div className="h-9 relative mt-1 pt-1 border-t border-border dark:border-border-dark">
              {milestones.map((m) => {
                const leftPct = pct(m.due_date)
                const color = m.completed ? 'green' : 'red'

                return (
                  <div
                    key={m.id}
                    className="absolute top-0 flex flex-col items-center -translate-x-1/2 cursor-default group"
                    style={{ left: `${leftPct}%` }}
                  >
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-dark-3 text-[10.5px] font-medium px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30 whitespace-nowrap">
                      {m.title} · {formatShortDate(m.due_date)}
                    </span>
                    <div
                      className={`w-px h-2.5 ${
                        color === 'green'
                          ? 'bg-green-600 dark:bg-green-500'
                          : 'bg-accent dark:bg-accent'
                      }`}
                    />
                    <div
                      className={`w-2 h-2 rotate-45 rounded-sm ${
                        color === 'green'
                          ? 'bg-green-600 dark:bg-green-500'
                          : 'bg-accent dark:bg-accent'
                      }`}
                    />
                    <span
                      className={`text-[9.5px] font-medium mt-0.5 text-center max-w-[90px] truncate ${
                        color === 'green'
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-accent dark:text-accent'
                      }`}
                    >
                      {m.title}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
