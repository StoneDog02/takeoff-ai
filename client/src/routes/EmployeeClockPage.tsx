import { useState, useEffect, useRef } from 'react'
import { MapPin, Clock, AlertTriangle, ChevronRight, LogOut, Calendar } from 'lucide-react'
import { teamsApi, getProjectsList } from '@/api/teamsClient'
import { api } from '@/api/client'
import { settingsApi } from '@/api/settings'
import { useEffectiveEmployee } from '@/hooks/useEffectiveEmployee'
import { useAuth } from '@/contexts/AuthContext'
import type { JobGeofence, TimeEntry } from '@/types/global'
import type { Project, ProjectWorkType } from '@/types/global'
import { WorkTypeIcon } from '@/components/projects/WorkTypeIcon'
import { getWorkTypeStyle } from '@/components/projects/CustomWorkTypeColorPicker'
import { dayjs } from '@/lib/date'
import {
  createOutsideBoundaryTracker,
  DEFAULT_CLOCK_OUT_TOLERANCE_MINUTES,
  distanceMeters,
  geofenceRadiusMeters,
  isOutsideJobGeofence,
} from '@/lib/geofenceAutoClockOut'

function formatJobAddress(p: Project): string {
  const parts = [p.address_line_1, p.address_line_2, [p.city, p.state, p.postal_code].filter(Boolean).join(', ')].filter(Boolean)
  return parts.join(', ') || '—'
}

const pad = (n: number) => String(n).padStart(2, '0')
const formatElapsed = (seconds: number) => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}
const formatTime = (date: Date) => date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
const formatDateLong = (date: Date) => date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
const formatDateShort = (date: Date) => dayjs(date).format('ddd MMM D')

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

type ClockStep = 'jobs' | 'work_types' | 'clocked_in'

export function EmployeeClockPage() {
  const { employeeId, employeeName, isPreview } = useEffectiveEmployee()
  const { employee: authEmployee } = useAuth()
  const [now, setNow] = useState(new Date())
  const [step, setStep] = useState<ClockStep>('jobs')
  const [jobs, setJobs] = useState<Array<{ id: string; name: string; address: string }>>([])
  const [jobsLoaded, setJobsLoaded] = useState(false)
  const [geofenceByJob, setGeofenceByJob] = useState<Record<string, JobGeofence>>({})
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [selectedWorkType, setSelectedWorkType] = useState<ProjectWorkType | null>(null)
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null)
  const [recentEntries, setRecentEntries] = useState<TimeEntry[]>([])
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [confirmingClockOut, setConfirmingClockOut] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [workTypesList, setWorkTypesList] = useState<ProjectWorkType[]>([])
  const [workTypesLoading, setWorkTypesLoading] = useState(false)
  const [clockOutToleranceMin, setClockOutToleranceMin] = useState(DEFAULT_CLOCK_OUT_TOLERANCE_MINUTES)
  const watchIdRef = useRef<number | null>(null)

  const displayName = employeeName ?? authEmployee?.name ?? 'Employee'
  const hasEmployeeContext = !!(authEmployee || isPreview || employeeId)

  const selectedJob = selectedJobId != null ? (jobs.find((j) => j.id === selectedJobId) ?? null) : null
  const geofence = selectedJobId != null ? geofenceByJob[selectedJobId] ?? null : null
  const isInsideGeofence =
    location != null && geofence != null
      ? distanceMeters(geofence.center_lat, geofence.center_lng, location.lat, location.lng) <= geofenceRadiusMeters(geofence)
      : null

  const clockedIn = !!activeEntry
  const clockInTime = activeEntry ? new Date(activeEntry.clock_in) : null
  const elapsedSeconds = clockedIn && clockInTime ? Math.floor((now.getTime() - clockInTime.getTime()) / 1000) : 0

  const weekStart = dayjs().startOf('week')
  const weekEnd = dayjs().endOf('week')
  const weekEntries = recentEntries.filter(
    (e) => e.clock_out && e.hours != null && dayjs(e.clock_in).isBetween(weekStart, weekEnd, null, '[]')
  )
  const todayEntries = recentEntries.filter(
    (e) => e.clock_out && e.hours != null && dayjs(e.clock_in).isSame(dayjs(), 'day')
  )
  const weekHours = weekEntries.reduce((s, e) => s + (e.hours ?? 0), 0)
  const todayHours = todayEntries.reduce((s, e) => s + (e.hours ?? 0), 0)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true }
    )
  }, [])

  useEffect(() => {
    settingsApi
      .getSettings()
      .then((r) => {
        const t = r.geofence_defaults?.clock_out_tolerance_minutes
        if (t != null && Number.isFinite(Number(t))) setClockOutToleranceMin(Number(t))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (authEmployee == null && !isPreview) {
      setJobs([])
      setJobsLoaded(true)
      return
    }
    let cancelled = false
    setJobsLoaded(false)
    getProjectsList()
      .then((projects) => {
        if (cancelled) return
        setJobs(
          projects.map((p) => ({
            id: p.id,
            name: p.name,
            address: formatJobAddress(p),
          }))
        )
      })
      .catch(() => {
        if (!cancelled) setJobs([])
      })
      .finally(() => {
        if (!cancelled) setJobsLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [isPreview, authEmployee])

  useEffect(() => {
    jobs.forEach((job) => {
      teamsApi.geofences.getByJob(job.id).then((g) => {
        if (g) setGeofenceByJob((prev) => ({ ...prev, [job.id]: g }))
      }).catch(() => {})
    })
  }, [jobs])

  useEffect(() => {
    if (!employeeId) return
    let cancelled = false
    setLoading(true)
    const weekAgo = dayjs().subtract(7, 'day').toISOString()
    ;(async () => {
      try {
        const entries = await teamsApi.timeEntries.list({ employee_id: employeeId, from: weekAgo })
        if (cancelled) return
        const open = entries.find((e) => !e.clock_out)
        setActiveEntry(open ?? null)
        setRecentEntries(entries)
        if (open) {
          setStep('clocked_in')
          setSelectedJobId(open.job_id)
          if (open.project_work_type_id) {
            try {
              const wts = await api.projects.getWorkTypes(open.job_id)
              if (cancelled) return
              const w = wts.find((x) => x.id === open.project_work_type_id)
              setSelectedWorkType(
                w
                  ? {
                      ...w,
                      rate: typeof w.rate === 'number' ? w.rate : Number(w.rate) || 0,
                    }
                  : null
              )
            } catch {
              if (!cancelled) setSelectedWorkType(null)
            }
          } else {
            setSelectedWorkType(null)
          }
        }
      } catch {
        if (!cancelled) {
          setActiveEntry(null)
          setRecentEntries([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [employeeId])

  useEffect(() => {
    if (!selectedJobId || step !== 'work_types') return
    setWorkTypesLoading(true)
    setMessage(null)
    api.projects
      .getWorkTypes(selectedJobId)
      .then((rows) => {
        setWorkTypesList(
          rows.map((w) => ({
            ...w,
            rate: typeof w.rate === 'number' ? w.rate : Number(w.rate) || 0,
          }))
        )
      })
      .catch(() => {
        setWorkTypesList([])
        setMessage('Could not load work types for this job.')
      })
      .finally(() => setWorkTypesLoading(false))
  }, [selectedJobId, step])

  useEffect(() => {
    if (!activeEntry?.job_id || !navigator.geolocation) return
    const g = geofenceByJob[activeEntry.job_id]
    if (!g) return

    const entryRef = { current: activeEntry }
    entryRef.current = activeEntry
    const geofenceRef = { current: g }
    geofenceRef.current = g

    const tracker = createOutsideBoundaryTracker({
      toleranceMinutes: clockOutToleranceMin,
      onFirstOutside: () => {
        if (clockOutToleranceMin > 0) {
          setMessage(`Outside jobsite — auto clock-out after ${clockOutToleranceMin} min.`)
        }
      },
      onBackInside: () => setMessage(null),
      onTrigger: (lat, lng) => {
        const e = entryRef.current
        const gf = geofenceRef.current
        if (!e?.id || !gf?.id) return
        setMessage('Exited jobsite boundary — clocking out.')
        teamsApi.gpsClockOut
          .create({
            employee_id: e.employee_id,
            time_entry_id: e.id,
            job_id: e.job_id,
            lat,
            lng,
            geofence_id: gf.id,
          })
          .then(() => {
            setActiveEntry(null)
            setSelectedWorkType(null)
            setSelectedJobId(null)
            setStep('jobs')
            setMessage(null)
          })
          .catch(() => {
            setMessage('Failed to clock out.')
            tracker.reset()
          })
      },
    })

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        const gf = geofenceRef.current
        if (!gf) return
        tracker.onPosition(lat, lng, isOutsideJobGeofence(lat, lng, gf))
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000 }
    )
    return () => {
      tracker.reset()
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [activeEntry?.id, activeEntry?.job_id, geofenceByJob, clockOutToleranceMin])

  const handleSelectJob = (jobId: string) => {
    setSelectedJobId(jobId)
    setStep('work_types')
  }

  const handleClockIn = async (workType: ProjectWorkType) => {
    if (!employeeId || !selectedJobId) return
    if (geofence && isInsideGeofence === false) {
      setMessage('You must be inside the job geofence to clock in.')
      return
    }
    setLoading(true)
    setMessage(null)
    try {
      const entry = await teamsApi.timeEntries.create({
        employee_id: employeeId,
        job_id: selectedJobId,
        clock_in: dayjs().toISOString(),
        source: 'manual',
        project_work_type_id: workType.id,
      })
      setActiveEntry(entry)
      setSelectedWorkType(workType)
      setStep('clocked_in')
      setRecentEntries((prev) => [entry, ...prev])
      setMessage('Clocked in.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to clock in')
    } finally {
      setLoading(false)
    }
  }

  const handleClockOut = async () => {
    if (!activeEntry) return
    setLoading(true)
    setMessage(null)
    try {
      await teamsApi.timeEntries.clockOut(activeEntry.id)
      setActiveEntry(null)
      setSelectedWorkType(null)
      setSelectedJobId(null)
      setStep('jobs')
      setConfirmingClockOut(false)
      if (employeeId) {
        const weekAgo = dayjs().subtract(7, 'day').toISOString()
        teamsApi.timeEntries.list({ employee_id: employeeId, from: weekAgo }).then(setRecentEntries).catch(() => {})
      }
      setMessage('Clocked out.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to clock out')
    } finally {
      setLoading(false)
    }
  }

  const handleBackToJobs = () => {
    setSelectedJobId(null)
    setStep('jobs')
  }

  if (!employeeId && !isPreview) {
    return (
      <div className="w-full max-w-[480px] mx-auto px-4 sm:px-6 py-10">
        <div className="rounded-xl border border-border dark:border-border-dark bg-white dark:bg-dark-3 shadow-card p-6 font-sora">
          <p className="text-muted text-sm">
            Your employer removed you from their crew. This account can't be used until you're added back and sent a new invite.
          </p>
        </div>
      </div>
    )
  }

  if (!employeeId && isPreview) {
    return (
      <div className="w-full max-w-[480px] mx-auto px-4 sm:px-6 py-10">
        <div className="rounded-xl border border-border dark:border-border-dark bg-white dark:bg-dark-3 shadow-card p-6 font-sora">
          <p className="text-muted text-sm">Preview mode: select an employee from Admin to see their data.</p>
        </div>
      </div>
    )
  }

  const historyForList = recentEntries
    .filter((e) => e.clock_out && e.hours != null)
    .slice(0, 10)
    .map((e) => ({
      date: formatDateShort(new Date(e.clock_in)),
      job: jobs.find((j) => j.id === e.job_id)?.name ?? e.job_id,
      clockIn: formatTime(new Date(e.clock_in)),
      clockOut: formatTime(new Date(e.clock_out!)),
      hours: e.hours!,
    }))

  return (
    <div className="w-full max-w-[480px] mx-auto px-4 sm:px-6 py-10 pb-16 relative font-sora text-gray-900 dark:text-landing-white">
      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .clock-fade-up { animation: fade-up 0.4s ease forwards; }
        .clock-pulse-ring { animation: pulse-ring 1.5s ease-out infinite; }
      `}</style>

      <div className="absolute inset-0 bg-[radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)] dark:bg-[radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)] bg-[size:28px_28px] pointer-events-none" aria-hidden />

      <div className="relative z-10">
        {/* ── Clocked in (takes priority) ── */}
        {clockedIn && selectedJob && (
          <>
            <div className="clock-fade-up flex items-center gap-2 mb-4">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Clocked in</span>
            </div>
            <div className="clock-fade-up mb-2">
              <h2 className="text-xl font-extrabold text-gray-900 dark:text-landing-white">{selectedJob.name}</h2>
              {selectedWorkType ? (
                <div className="flex items-center gap-2 text-sm text-muted mt-1">
                  <WorkTypeIcon typeKey={selectedWorkType.type_key} size={14} customColor={selectedWorkType.custom_color} />{' '}
                  {selectedWorkType.name}
                </div>
              ) : (
                <div className="text-sm text-muted mt-1">Work type not recorded</div>
              )}
            </div>
            <div
              className="clock-fade-up rounded-2xl p-6 mb-6 text-center"
              style={{ backgroundColor: 'rgba(96, 165, 250, 0.12)', border: '1px solid rgba(96, 165, 250, 0.25)' }}
            >
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Time elapsed</div>
              <div className="text-4xl font-extrabold tabular-nums text-primary dark:text-blue-400">
                {formatElapsed(elapsedSeconds)}
              </div>
            </div>
            {!confirmingClockOut ? (
              <button
                type="button"
                onClick={() => setConfirmingClockOut(true)}
                className="w-full py-4 rounded-xl bg-gray-800 dark:bg-gray-700 text-white font-bold flex items-center justify-center gap-2 hover:opacity-90"
              >
                <LogOut size={18} /> Clock out
              </button>
            ) : (
              <div className="rounded-xl border border-red-500/25 bg-red-500/10 dark:bg-red-500/10 p-5">
                <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 text-center mb-4">
                  End shift after <strong className="text-gray-900 dark:text-landing-white">{formatElapsed(elapsedSeconds)}</strong>?
                </div>
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setConfirmingClockOut(false)}
                    className="flex-1 py-3 rounded-lg border border-border dark:border-border-dark bg-white/50 dark:bg-white/5 text-muted font-semibold text-sm"
                  >
                    Keep working
                  </button>
                  <button
                    type="button"
                    onClick={handleClockOut}
                    disabled={loading}
                    className="flex-1 py-3 rounded-lg bg-accent hover:bg-accent-hover text-white font-bold text-sm disabled:opacity-50"
                  >
                    Yes, clock out
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Step: Work types (Back + project + work type list) ── */}
        {!clockedIn && step === 'work_types' && selectedJob && (
          <>
            <button
              type="button"
              onClick={handleBackToJobs}
              className="clock-fade-up text-sm font-semibold text-primary hover:underline mb-4"
            >
              ← Back
            </button>
            <div className="clock-fade-up mb-6">
              <h2 className="text-xl font-extrabold text-gray-900 dark:text-landing-white mb-1">{selectedJob.name}</h2>
              <div className="flex items-center gap-1.5 text-sm text-muted">
                <MapPin size={14} /> {selectedJob.address}
              </div>
            </div>
            <div className="clock-fade-up text-[10px] font-bold uppercase tracking-widest text-muted mb-3">
              What are you working on?
            </div>
            {workTypesLoading ? (
              <p className="text-sm text-muted py-8 text-center">Loading work types…</p>
            ) : workTypesList.length === 0 ? (
              <p className="text-sm text-muted py-6 text-center leading-relaxed">
                No work types are set up for this job yet. Ask your manager to add them under the project&apos;s work types settings.
              </p>
            ) : (
              <div className="space-y-3">
                {workTypesList.map((wt) => {
                  const style = getWorkTypeStyle(wt.type_key, wt.custom_color)
                  return (
                    <button
                      key={wt.id}
                      type="button"
                      onClick={() => handleClockIn(wt)}
                      disabled={loading || (!!geofence && isInsideGeofence === false)}
                      className="w-full rounded-xl border-2 p-4 flex items-center gap-4 text-left transition-all hover:opacity-90 disabled:opacity-50"
                      style={{ backgroundColor: style.bg, borderColor: `${style.rate}40` }}
                    >
                      <div
                        className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 text-gray-600 dark:text-gray-400"
                        style={{ backgroundColor: 'rgba(255,255,255,0.7)', color: style.rate }}
                      >
                        <WorkTypeIcon typeKey={wt.type_key} size={20} className="shrink-0" customColor={wt.custom_color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-gray-900 dark:text-landing-white">{wt.name}</div>
                        <div className="text-xs text-muted mt-0.5">Tap to clock in</div>
                      </div>
                      <ChevronRight size={20} className="text-muted flex-shrink-0" />
                    </button>
                  )
                })}
              </div>
            )}
            {message && <p className="text-sm text-center text-muted mt-4">{message}</p>}
            {geofence && isInsideGeofence === false && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 dark:bg-amber-500/15 p-3 mt-4">
                <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  You&apos;re outside the job geofence. Move on site to clock in.
                </span>
              </div>
            )}
          </>
        )}

        {/* ── Step: Job list (default view when not clocked in) ── */}
        {!clockedIn && step === 'jobs' && (
          <>
            <div className="clock-fade-up text-center mb-6">
              <div className="text-xs text-muted uppercase tracking-widest mb-1">{getGreeting()}</div>
              <div className="text-2xl font-extrabold text-gray-900 dark:text-landing-white">{displayName}</div>
            </div>
            <div className="clock-fade-up text-center mb-6" style={{ animationDelay: '0.05s' }}>
              <div className="text-5xl md:text-6xl font-extrabold tabular-nums leading-none text-gray-900 dark:text-landing-white">
                {formatTime(now).split(' ')[0]}
                <span className="text-2xl font-normal text-muted ml-1.5">{formatTime(now).split(' ')[1]}</span>
              </div>
              <div className="text-sm text-muted mt-1.5">{formatDateLong(now)}</div>
            </div>
            <div className="clock-fade-up grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6" style={{ animationDelay: '0.08s' }}>
              <div className="rounded-xl border border-border dark:border-border-dark bg-white dark:bg-white/5 p-4 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">This week</div>
                <div className="text-2xl font-extrabold text-gray-900 dark:text-landing-white">{weekHours.toFixed(1)} hrs</div>
              </div>
              <div className="rounded-xl border border-border dark:border-border-dark bg-white dark:bg-white/5 p-4 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Today</div>
                <div className="text-2xl font-extrabold text-gray-900 dark:text-landing-white">{todayHours.toFixed(1)} hrs</div>
              </div>
            </div>
            <div className="clock-fade-up mb-4" style={{ animationDelay: '0.1s' }}>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Select your job</div>
              <div className="flex flex-col gap-2">
                {!jobsLoaded && hasEmployeeContext ? (
                  <p className="text-sm text-muted py-5 text-center">Loading jobs…</p>
                ) : jobsLoaded && jobs.length === 0 && hasEmployeeContext ? (
                  <div className="rounded-xl border border-border dark:border-border-dark bg-white dark:bg-white/5 p-4 shadow-sm">
                    <p className="text-sm text-muted text-center leading-relaxed">
                      You don&apos;t have any jobs to clock in to yet. Your manager needs to assign you to a job on the crew
                      (Teams → project → Crew) before jobs show up here.
                    </p>
                  </div>
                ) : (
                  jobs.map((job) => (
                    <button
                      key={job.id}
                      type="button"
                      onClick={() => handleSelectJob(job.id)}
                      className="w-full rounded-xl border border-border dark:border-border-dark bg-white dark:bg-white/5 p-4 text-left flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors shadow-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-gray-900 dark:text-landing-white truncate">{job.name}</div>
                        <div className="text-xs text-muted flex items-center gap-1 truncate mt-0.5">
                          <MapPin size={12} /> {job.address}
                        </div>
                      </div>
                      <ChevronRight size={20} className="text-muted flex-shrink-0" />
                    </button>
                  ))
                )}
              </div>
            </div>
            {locationError && <p className="text-sm text-red-500 dark:text-red-400 text-center mb-4">{locationError}</p>}
            {message && <p className="text-sm text-center text-muted mb-4">{message}</p>}

            {/* Recent shifts */}
            <div className="mt-8">
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="w-full flex items-center justify-between py-0 pb-3.5 bg-transparent border-none cursor-pointer font-sora"
              >
                <span className="text-xs font-bold uppercase tracking-widest text-muted flex items-center gap-1.5">
                  <Clock size={13} /> Recent shifts
                </span>
                <ChevronRight
                  size={14}
                  className="text-muted transition-transform duration-200"
                  style={{ transform: showHistory ? 'rotate(90deg)' : 'rotate(0)' }}
                />
              </button>
              {showHistory && (
                <div className="flex flex-col gap-2">
                  {historyForList.length === 0 ? (
                    <p className="text-sm text-muted py-4">No recent shifts.</p>
                  ) : (
                    historyForList.map((h, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-border dark:border-border-dark bg-white/30 dark:bg-white/5 p-3.5 flex items-center gap-3.5"
                      >
                        <div className="w-9 h-9 rounded-lg bg-white/10 dark:bg-white/5 flex items-center justify-center flex-shrink-0">
                          <Calendar size={14} className="text-muted" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{h.job}</div>
                          <div className="text-[11px] text-muted">
                            {h.date} · {h.clockIn} – {h.clockOut}
                          </div>
                        </div>
                        <div className="text-sm font-extrabold text-gray-900 dark:text-landing-white flex-shrink-0">{h.hours}h</div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
