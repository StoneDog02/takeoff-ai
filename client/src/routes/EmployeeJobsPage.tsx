import { useState, useEffect, useMemo } from 'react'
import { MapPin, Calendar, ChevronRight, Briefcase, Clock, CheckCircle, Circle, AlertCircle } from 'lucide-react'
import { teamsApi, getProjectsList } from '@/api/teamsClient'
import { useEffectiveEmployee } from '@/hooks/useEffectiveEmployee'
import { useAuth } from '@/contexts/AuthContext'
import type { JobAssignment } from '@/types/global'
import type { Project } from '@/types/global'
import { dayjs } from '@/lib/date'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'

const formatDateShort = (iso: string | null | undefined) =>
  iso ? dayjs(iso).format('MMM D, YYYY') : '—'

function formatProjectAddress(p: Project): string {
  const parts = [
    p.address_line_1,
    p.address_line_2,
    [p.city, p.state, p.postal_code].filter(Boolean).join(', '),
  ].filter(Boolean)
  return parts.join(', ') || '—'
}

/** Stable hex color per job */
const JOB_COLOR_PALETTE = ['#047857', '#b91c1c', '#1d4ed8', '#b45309', '#6d28d9', '#6b7280']
function jobColor(jobId: string): string {
  let h = 0
  for (let i = 0; i < jobId.length; i++) h = ((h << 5) - h) + jobId.charCodeAt(i) | 0
  return JOB_COLOR_PALETTE[Math.abs(h) % JOB_COLOR_PALETTE.length]
}

const CREW_AVATAR_COLORS = ['#b91c1c', '#1d4ed8', '#047857', '#7c3aed', '#b45309']

type JobStatus = 'active' | 'completed' | 'paused'

interface JobCardData {
  id: string
  assignmentId: string
  name: string
  address: string
  role: string
  assignedDate: string
  status: JobStatus
  phase: string
  supervisor: string
  crew: string[]
  hoursLogged: number
  startDate: string
  estEnd: string
  color: string
}

const STATUS_CFG: Record<JobStatus, { label: string; Icon: typeof Circle; className: string }> = {
  active: {
    label: 'Active',
    Icon: Circle,
    className: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/15 border-emerald-500/25',
  },
  completed: {
    label: 'Completed',
    Icon: CheckCircle,
    className: 'text-primary bg-primary/10 dark:bg-primary/20 border-primary/25',
  },
  paused: {
    label: 'Paused',
    Icon: AlertCircle,
    className: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/25',
  },
}

function CrewStack({ crew, currentUserName: _currentUserName }: { crew: string[]; currentUserName: string | null }) {
  const shown = crew.slice(0, 3)
  const extra = crew.length - 3
  return (
    <div className="flex items-center">
      {shown.map((name, i) => (
        <div
          key={name}
          title={name}
          className="flex items-center justify-center rounded-full text-white text-[9px] font-bold flex-shrink-0 border-2 border-white dark:border-dark-3"
          style={{
            width: 24,
            height: 24,
            background: CREW_AVATAR_COLORS[i % CREW_AVATAR_COLORS.length],
            marginLeft: i > 0 ? -6 : 0,
            zIndex: shown.length - i,
          }}
        >
          {name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2)}
        </div>
      ))}
      {extra > 0 && (
        <div
          className="flex items-center justify-center rounded-full text-[9px] font-bold flex-shrink-0 border-2 border-white dark:border-dark-3 bg-black/10 dark:bg-white/10 text-muted"
          style={{ width: 24, height: 24, marginLeft: -6 }}
        >
          +{extra}
        </div>
      )}
    </div>
  )
}

function JobCard({
  job,
  currentUserName,
}: { job: JobCardData; currentUserName: string | null }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = STATUS_CFG[job.status]
  const { Icon } = cfg

  return (
    <div
      className="rounded-[18px] border border-border dark:border-border-dark bg-white/60 dark:bg-white/5 overflow-hidden transition-[border-color,box-shadow] duration-200 hover:border-border-dark dark:hover:border-white/15 hover:shadow-lg dark:hover:shadow-black/25"
    >
      <div
        className="h-[3px]"
        style={{
          background: `linear-gradient(90deg, ${job.color}, ${job.color}66)`,
        }}
      />
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <div className="text-[17px] font-extrabold tracking-tight text-gray-900 dark:text-landing-white leading-snug mb-1">
              {job.name}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <MapPin size={11} /> {job.address}
            </div>
          </div>
          <div
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 flex-shrink-0 ${cfg.className}`}
          >
            <Icon
              size={10}
              fill={job.status === 'active' ? 'currentColor' : 'none'}
              strokeWidth={2.5}
              className="flex-shrink-0"
            />
            <span className="text-[11px] font-bold tracking-wide">{cfg.label}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {job.role && (
            <span
              className="text-[11px] font-bold px-2.5 py-1 rounded-full border"
              style={{
                background: `${job.color}20`,
                color: job.color,
                borderColor: `${job.color}30`,
              }}
            >
              {job.role}
            </span>
          )}
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-black/5 dark:bg-white/5 text-muted border border-border dark:border-border-dark">
            Phase: {job.phase}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-4">
          {[
            { Icon: Calendar, label: 'Assigned', value: job.assignedDate },
            { Icon: Clock, label: 'Hrs logged', value: `${job.hoursLogged} hrs` },
            { Icon: Calendar, label: 'Est. end', value: job.estEnd },
          ].map(({ Icon: Ico, label, value }) => (
            <div
              key={label}
              className="rounded-lg border border-border dark:border-border-dark bg-white/50 dark:bg-white/5 p-2.5"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Ico size={10} className="text-muted flex-shrink-0" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted">{label}</span>
              </div>
              <div className="text-xs font-bold text-gray-800 dark:text-gray-200">{value}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <CrewStack crew={job.crew} currentUserName={currentUserName} />
            <span className="text-xs text-muted">
              {job.crew.length} crew member{job.crew.length !== 1 ? 's' : ''}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 rounded-lg border border-border dark:border-border-dark bg-black/5 dark:bg-white/5 px-3 py-1.5 text-xs font-semibold text-muted hover:bg-black/10 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-landing-white transition-colors"
          >
            {expanded ? 'Less' : 'Details'}
            <ChevronRight
              size={12}
              className="transition-transform duration-200"
              style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0)' }}
            />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border dark:border-border-dark bg-black/5 dark:bg-black/20 px-5 sm:px-6 py-4">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3">Full crew</div>
          <div className="flex flex-col gap-2">
            {job.crew.map((name, i) => {
              const isMe = currentUserName != null && name === currentUserName
              const displayLabel = isMe ? 'Me' : name
              return (
                <div key={name} className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                    style={{ background: CREW_AVATAR_COLORS[i % CREW_AVATAR_COLORS.length] }}
                  >
                    {isMe ? 'Me' : name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-landing-white">{displayLabel}</div>
                    {name === job.supervisor && (
                      <div className="text-[11px] text-muted">Supervisor</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export function EmployeeJobsPage() {
  const { employeeId, employeeName } = useEffectiveEmployee()
  const { employee: authEmployee } = useAuth()
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')
  const [assignments, setAssignments] = useState<JobAssignment[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [hoursByJob, setHoursByJob] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  const displayName = employeeName ?? authEmployee?.name ?? 'Employee'
  const displayRole = authEmployee?.role ?? ''

  useEffect(() => {
    if (!employeeId) {
      setAssignments([])
      setProjects([])
      setHoursByJob({})
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([
      teamsApi.jobAssignments.list({ employee_id: employeeId }),
      getProjectsList(),
      teamsApi.timeEntries.list({ employee_id: employeeId, from: dayjs().subtract(1, 'year').toISOString() }),
    ])
      .then(([assigns, projs, entries]) => {
        setAssignments(assigns)
        setProjects(projs)
        const byJob: Record<string, number> = {}
        entries.forEach((e) => {
          if (e.clock_out != null && e.hours != null) {
            byJob[e.job_id] = (byJob[e.job_id] ?? 0) + e.hours
          }
        })
        setHoursByJob(byJob)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [employeeId])

  const projectMap = useMemo(() => {
    const m: Record<string, Project> = {}
    projects.forEach((p) => { m[p.id] = p })
    return m
  }, [projects])

  const jobs: JobCardData[] = useMemo(() => {
    return assignments.map((a) => {
      const p = projectMap[a.job_id]
      const status: JobStatus = a.ended_at ? 'completed' : 'active'
      const crew = [displayName]
      return {
        id: a.job_id,
        assignmentId: a.id,
        name: p?.name ?? a.job_id,
        address: p ? formatProjectAddress(p) : '—',
        role: a.role_on_job ?? '—',
        assignedDate: formatDateShort(a.assigned_at),
        status,
        phase: p?.status ?? '—',
        supervisor: p?.assigned_to_name ?? '—',
        crew,
        hoursLogged: hoursByJob[a.job_id] ?? 0,
        startDate: formatDateShort(p?.expected_start_date),
        estEnd: formatDateShort(p?.expected_end_date),
        color: jobColor(a.job_id),
      }
    })
  }, [assignments, projectMap, hoursByJob, displayName])

  const filtered = filter === 'all' ? jobs : jobs.filter((j) => j.status === filter)
  const activeCount = jobs.filter((j) => j.status === 'active').length
  const completedCount = jobs.filter((j) => j.status === 'completed').length

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
        @keyframes fade-up-jobs {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .jobs-fade-up { animation: fade-up-jobs 0.35s ease forwards; }
      `}</style>

      <div
        className="absolute inset-0 bg-[radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)] dark:bg-[radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)] bg-[size:28px_28px] pointer-events-none"
        aria-hidden
      />

      <div className="relative z-10">
        <div className="jobs-fade-up flex flex-wrap items-center justify-between gap-4 mb-7">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight mb-1">My Jobs</h1>
            <div className="text-sm text-muted">
              {displayName}{displayRole ? ` · ${displayRole}` : ''}
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-landing-white">
              {loading ? '…' : jobs.length}
            </div>
            <div className="text-[11px] text-muted font-semibold uppercase tracking-wide">assignments</div>
          </div>
        </div>

        <div className="jobs-fade-up flex flex-wrap gap-2.5 mb-6" style={{ animationDelay: '0.05s' }}>
          {[
            { id: 'all' as const, label: `All ${jobs.length}`, activeClass: 'text-muted border-muted/30 bg-muted/10' },
            { id: 'active' as const, label: `Active ${activeCount}`, activeClass: 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/15' },
            { id: 'completed' as const, label: `Completed ${completedCount}`, activeClass: 'text-primary border-primary/30 bg-primary/10 dark:bg-primary/20' },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-4 py-2 rounded-full border-2 text-sm font-bold transition-all ${
                filter === f.id
                  ? f.activeClass
                  : 'border-border dark:border-border-dark bg-white/50 dark:bg-white/5 text-muted hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="jobs-fade-up py-12">
            <LoadingSkeleton variant="inline" lines={5} className="max-w-sm mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="jobs-fade-up flex flex-col items-center justify-center py-16 text-muted" style={{ animationDelay: '0.08s' }}>
            <Briefcase size={32} className="mb-3 opacity-40" />
            <div className="text-sm">No {filter} jobs</div>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            {filtered.map((job, i) => (
              <div
                key={job.assignmentId}
                className="jobs-fade-up"
                style={{ animationDelay: `${0.08 + i * 0.06}s` }}
              >
                <JobCard job={job} currentUserName={displayName} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
