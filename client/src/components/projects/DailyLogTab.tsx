import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/api/client'
import { teamsApi } from '@/api/teamsClient'
import { ConfirmDeleteDailyLogModal } from '@/components/projects/ConfirmDeleteDailyLogModal'
import { JobWalkGallery } from '@/components/projects/JobWalkGallery'
import { dayjs, formatDate } from '@/lib/date'
import { localDb, type LocalDailyLog } from '@/lib/localDb'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import type { DailyLogRow, Employee, JobAssignment, JobWalkMedia, Phase } from '@/types/global'

/** Caption tag for legacy rows or extra context (optional when `log_date` is set on media). */
function dailyLogMediaCaptionPrefix(logDate: string): string {
  return `[DailyLog:${logDate}]`
}

type WeatherCondition = 'Sunny' | 'Cloudy' | 'Rain' | 'Snow' | 'Wind'
type IssueSeverity = 'info' | 'warning' | 'critical'

interface MaterialLine {
  id: string
  description: string
  quantity: string
}

interface LogIssue {
  id: string
  severity: IssueSeverity
  description: string
  /** Public/signed URL from `job_walk_media` after upload. */
  photoUrl?: string
  /** IndexedDB `media_queue` row id when the issue photo is only queued offline. */
  localMediaQueueId?: string
}

interface VisitorLine {
  id: string
  name: string
  notes?: string
}

export interface DailyLogEntry {
  id: string
  date: string
  weather: WeatherCondition
  temperature?: string
  crewEmployeeIds: string[]
  adHocCrewNames: string[]
  workSummary: string
  phaseId: string | null
  materials: MaterialLine[]
  issues: LogIssue[]
  visitors: VisitorLine[]
  lockedAt?: string | null
  createdAt: string
}

export interface DailyLogTabProps {
  projectId: string
  projectName: string
  phases: Phase[]
  /** Field PM / Site Supervisor: load crew & phases from API (same logs sync to GC project). */
  employeePortal?: boolean
}

const WEATHER_OPTIONS: WeatherCondition[] = ['Sunny', 'Cloudy', 'Rain', 'Snow', 'Wind']
const SEVERITY_OPTIONS: { value: IssueSeverity; label: string }[] = [
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' },
]

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function dbWeatherToUi(w: string | null): WeatherCondition {
  const map: Record<string, WeatherCondition> = {
    sunny: 'Sunny',
    cloudy: 'Cloudy',
    rain: 'Rain',
    snow: 'Snow',
    wind: 'Wind',
  }
  return w ? map[w.toLowerCase()] ?? 'Sunny' : 'Sunny'
}

function severityUi(s: string | undefined): IssueSeverity {
  const x = (s || 'info').toLowerCase()
  if (x === 'warning' || x === 'critical' || x === 'info') return x
  return 'info'
}

function mapRowToEntry(row: DailyLogRow): DailyLogEntry {
  const crew_present = (Array.isArray(row.crew_present) ? row.crew_present : []) as {
    name?: string
    role?: string
    hours?: number
    employee_id?: string
  }[]
  const crewEmployeeIds: string[] = []
  const adHocCrewNames: string[] = []
  for (const p of crew_present) {
    if (!p || typeof p !== 'object') continue
    if (p.employee_id) crewEmployeeIds.push(String(p.employee_id))
    else if (p.name?.trim()) adHocCrewNames.push(p.name.trim())
  }

  const materialsRaw = Array.isArray(row.materials) ? row.materials : []
  const materials: MaterialLine[] = materialsRaw.map(
    (m: { description?: string; quantity?: string | number }, i: number) => ({
      id: `mat-${row.id}-${i}`,
      description: m.description ?? '',
      quantity: m.quantity != null ? String(m.quantity) : '',
    })
  )

  const issuesRaw = Array.isArray(row.issues) ? row.issues : []
  const issues: LogIssue[] = issuesRaw.map(
    (
      iss: { severity?: string; description?: string; photo_url?: string; local_media_queue_id?: string },
      i: number
    ) => ({
      id: `iss-${row.id}-${i}`,
      severity: severityUi(iss.severity),
      description: iss.description ?? '',
      photoUrl: iss.photo_url ?? undefined,
      localMediaQueueId: iss.local_media_queue_id,
    })
  )

  const vl = row.visitor_log
  const visitorsRaw = Array.isArray(vl) ? vl : []
  const visitors: VisitorLine[] = visitorsRaw.map(
    (v: { name?: string; notes?: string }, i: number) => ({
      id: `vis-${row.id}-${i}`,
      name: v.name ?? '',
      notes: v.notes ?? '',
    })
  )

  return {
    id: row.id,
    date: row.log_date,
    weather: dbWeatherToUi(row.weather),
    temperature: row.temperature ?? '',
    crewEmployeeIds,
    adHocCrewNames,
    workSummary: row.work_summary ?? '',
    phaseId: row.phase_id,
    materials,
    issues,
    visitors,
    lockedAt: row.locked_at,
    createdAt: row.created_at,
  }
}

function buildPatchPayload(
  entry: DailyLogEntry,
  assignments: JobAssignment[],
  employees: Employee[]
): Record<string, unknown> {
  const empName = new Map(employees.map((e) => [e.id, e.name]))
  const crew_present: { name: string; role?: string; hours?: number; employee_id?: string }[] = []
  for (const eid of entry.crewEmployeeIds) {
    const name = empName.get(eid) ?? 'Unknown'
    const ja = assignments.find((a) => a.employee_id === eid && !a.ended_at)
    crew_present.push({
      name,
      role: ja?.role_on_job || undefined,
      employee_id: eid,
    })
  }
  for (const n of entry.adHocCrewNames) {
    if (n.trim()) crew_present.push({ name: n.trim() })
  }

  const materials = entry.materials.map((m) => ({
    description: m.description,
    quantity: m.quantity,
    unit: '',
  }))

  const issues = entry.issues.map((i) => ({
    severity: i.severity,
    description: i.description,
    photo_url:
      i.photoUrl && !i.photoUrl.startsWith('blob:') ? i.photoUrl : undefined,
  }))

  const visitor_log = entry.visitors.map((v) => ({ name: v.name, notes: v.notes || '' }))

  return {
    log_date: entry.date,
    weather: entry.weather.toLowerCase(),
    temperature: entry.temperature?.trim() || null,
    crew_count: crew_present.length,
    crew_present,
    work_summary: entry.workSummary.trim() || null,
    phase_id: entry.phaseId,
    materials,
    issues,
    visitor_log,
  }
}

function issuesForLocalDb(entry: DailyLogEntry) {
  return entry.issues.map((i) => ({
    severity: i.severity,
    description: i.description,
    photo_url: i.photoUrl && !i.photoUrl.startsWith('blob:') ? i.photoUrl : undefined,
    local_media_queue_id: i.localMediaQueueId,
  }))
}

function localDailyLogFromEntry(
  projectId: string,
  entry: DailyLogEntry,
  assignments: JobAssignment[],
  employees: Employee[]
): LocalDailyLog {
  const payload = buildPatchPayload(entry, assignments, employees)
  return {
    id: entry.id,
    project_id: projectId,
    log_date: entry.date,
    weather: (payload.weather as string) || 'sunny',
    temperature: (payload.temperature as string) || undefined,
    crew_count: (payload.crew_count as number) ?? 0,
    crew_present: (payload.crew_present as LocalDailyLog['crew_present']) ?? [],
    work_summary: (payload.work_summary as string) ?? undefined,
    phase_id: entry.phaseId ?? undefined,
    materials: (payload.materials as LocalDailyLog['materials']) ?? [],
    issues: issuesForLocalDb(entry),
    visitor_log: (payload.visitor_log as LocalDailyLog['visitor_log']) ?? [],
    sync_status: 'pending',
    created_at: Date.now(),
  }
}

function localToEntry(l: LocalDailyLog): DailyLogEntry {
  const row: DailyLogRow = {
    id: l.id,
    project_id: l.project_id,
    log_date: l.log_date,
    weather: l.weather ?? 'sunny',
    temperature: l.temperature ?? null,
    crew_count: l.crew_count ?? 0,
    crew_present: l.crew_present ?? [],
    work_summary: l.work_summary ?? null,
    phase_id: (l.phase_id as string | null) ?? null,
    materials: l.materials ?? [],
    issues: l.issues ?? [],
    visitor_log: l.visitor_log ?? [],
    notes: null,
    created_by: null,
    locked_at: null,
    created_at: new Date(l.created_at).toISOString(),
    updated_at: new Date(l.created_at).toISOString(),
  }
  return mapRowToEntry(row)
}

function newEmptyDailyLogEntry(id: string, logDate: string): DailyLogEntry {
  return {
    id,
    date: logDate,
    weather: 'Sunny',
    temperature: '',
    crewEmployeeIds: [],
    adHocCrewNames: [],
    workSummary: '',
    phaseId: null,
    materials: [],
    issues: [],
    visitors: [],
    lockedAt: undefined,
    createdAt: new Date().toISOString(),
  }
}

function isEntryLocked(entry: DailyLogEntry): boolean {
  if (entry.lockedAt) return true
  return dayjs().diff(dayjs(entry.createdAt), 'hour') >= 24
}

function weatherIcon(w: WeatherCondition): string {
  switch (w) {
    case 'Sunny':
      return '☀️'
    case 'Cloudy':
      return '☁️'
    case 'Rain':
      return '🌧️'
    case 'Snow':
      return '❄️'
    case 'Wind':
      return '💨'
    default:
      return '—'
  }
}

function oneLineSummary(text: string): string {
  const t = text.trim()
  if (!t) return '—'
  const line = t.split(/\n/)[0] ?? ''
  return line.length > 120 ? `${line.slice(0, 117)}…` : line
}

function mediaForLogDate(media: JobWalkMedia[], logDate: string): JobWalkMedia[] {
  const tag = dailyLogMediaCaptionPrefix(logDate)
  return media.filter((m) => {
    if (m.log_date) return m.log_date === logDate
    return (m.caption ?? '').includes(tag)
  })
}

function photoCountForLog(media: JobWalkMedia[], logDate: string): number {
  return mediaForLogDate(media, logDate).filter((m) => m.type === 'photo').length
}

export function DailyLogTab({ projectId, projectName, phases, employeePortal }: DailyLogTabProps) {
  const { isOnline } = useOfflineSync()
  const [entries, setEntries] = useState<DailyLogEntry[]>([])
  const [logsLoading, setLogsLoading] = useState(true)
  const [logsError, setLogsError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<JobAssignment[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [media, setMedia] = useState<JobWalkMedia[]>([])
  const [pickDateOpen, setPickDateOpen] = useState(false)
  const [pickDateValue, setPickDateValue] = useState(() => dayjs().format('YYYY-MM-DD'))
  /** Confirm before creating today’s log (instant create was too easy to trigger by mistake). */
  const [newLogConfirmOpen, setNewLogConfirmOpen] = useState(false)
  const [loadingCrew, setLoadingCrew] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [portalFieldPhases, setPortalFieldPhases] = useState<Phase[] | null>(null)
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'warning' | 'error' } | null>(
    null
  )
  const [mediaQueueTick, setMediaQueueTick] = useState(0)
  const [queuedGalleryMedia, setQueuedGalleryMedia] = useState<JobWalkMedia[]>([])
  const [queuedPhotoCountsByDate, setQueuedPhotoCountsByDate] = useState<Record<string, number>>({})
  const [issuePreviewUrls, setIssuePreviewUrls] = useState<Record<string, string>>({})
  const queuedGalleryUrlsRef = useRef<string[]>([])

  const showToast = useCallback((message: string, variant: 'success' | 'warning' | 'error' = 'success') => {
    setToast({ message, variant })
    window.setTimeout(() => setToast(null), 4200)
  }, [])

  const saveOffline = useCallback(
    async (entry: DailyLogEntry) => {
      const row = localDailyLogFromEntry(projectId, entry, assignments, employees)
      await localDb.daily_logs.put({
        ...row,
        id: entry.id || crypto.randomUUID(),
        sync_status: 'pending',
        created_at: row.created_at,
      })
    },
    [projectId, assignments, employees]
  )

  useEffect(() => {
    let cancelled = false
    setLogsLoading(true)
    setLogsError(null)
    const load = async () => {
      try {
        if (!isOnline) {
          const localRows = await localDb.daily_logs.where('project_id').equals(projectId).toArray()
          if (cancelled) return
          setEntries(
            localRows
              .map(localToEntry)
              .sort((a, b) => b.date.localeCompare(a.date))
          )
          return
        }
        const rows = await api.projects.getDailyLogs(projectId)
        const localRows = await localDb.daily_logs
          .where('project_id')
          .equals(projectId)
          .filter((l) => l.sync_status === 'pending' || l.sync_status === 'error')
          .toArray()
        if (cancelled) return
        const apiEntries = rows.map(mapRowToEntry)
        const apiIds = new Set(rows.map((r) => r.id))
        const extra = localRows.filter((l) => !apiIds.has(l.id)).map(localToEntry)
        const merged = [...apiEntries, ...extra].sort((a, b) => b.date.localeCompare(a.date))
        setEntries(merged)
      } catch {
        if (!cancelled) setLogsError('Could not load daily logs.')
      } finally {
        if (!cancelled) setLogsLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [projectId, isOnline])

  useEffect(() => {
    setSelectedId(null)
    setExpandedId(null)
    setNewLogConfirmOpen(false)
    setPickDateOpen(false)
  }, [projectId])

  useEffect(() => {
    let cancelled = false
    setLoadingCrew(true)
    if (!isOnline) {
      setPortalFieldPhases(null)
      void (async () => {
        try {
          const cached = await localDb.projects.get(projectId)
          if (cancelled) return
          setAssignments([])
          setEmployees([])
          if (employeePortal) {
            const ph = Array.isArray(cached?.phases) ? (cached!.phases as Phase[]) : null
            setPortalFieldPhases(ph && ph.length > 0 ? ph : null)
          }
          setMedia([])
        } finally {
          if (!cancelled) setLoadingCrew(false)
        }
      })()
      return () => {
        cancelled = true
      }
    }
    if (employeePortal) {
      setPortalFieldPhases(null)
      Promise.all([
        api.projects.getDailyLogFieldData(projectId).catch(() => null),
        api.projects.getMedia(projectId).catch(() => []),
      ])
        .then(([field, m]) => {
          if (cancelled) return
          if (field) {
            setAssignments(field.assignments ?? [])
            setEmployees(field.employees ?? [])
            setPortalFieldPhases(field.phases ?? [])
          } else {
            setAssignments([])
            setEmployees([])
            setPortalFieldPhases([])
          }
          setMedia(m ?? [])
        })
        .finally(() => {
          if (!cancelled) setLoadingCrew(false)
        })
      return () => {
        cancelled = true
      }
    }
    Promise.all([
      teamsApi.jobAssignments.list({ job_id: projectId, active_only: true }).catch(() => []),
      teamsApi.employees.list().catch(() => []),
      api.projects.getMedia(projectId).catch(() => []),
    ])
      .then(([a, e, m]) => {
        if (cancelled) return
        setAssignments(a ?? [])
        setEmployees(e ?? [])
        setMedia(m ?? [])
      })
      .finally(() => {
        if (!cancelled) setLoadingCrew(false)
      })
    return () => {
      cancelled = true
    }
  }, [projectId, employeePortal, isOnline])

  const refreshMedia = useCallback(() => {
    if (!isOnline) {
      setMedia([])
      setMediaQueueTick((t) => t + 1)
      return
    }
    api.projects.getMedia(projectId).then(setMedia).catch(() => {})
  }, [projectId, isOnline])

  useEffect(() => {
    void (async () => {
      const rows = await localDb.media_queue
        .where('project_id')
        .equals(projectId)
        .filter((m) => m.sync_status === 'pending')
        .toArray()
      const map: Record<string, number> = {}
      for (const m of rows) {
        if (!m.log_date || (m.caption ?? '').includes('[Issue:')) continue
        map[m.log_date] = (map[m.log_date] ?? 0) + 1
      }
      setQueuedPhotoCountsByDate(map)
    })()
  }, [projectId, mediaQueueTick])

  const employeeNameById = useMemo(() => {
    const m = new Map<string, string>()
    employees.forEach((e) => m.set(e.id, e.name))
    return m
  }, [employees])

  const assignedRows = useMemo(() => {
    const active = assignments.filter((a) => !a.ended_at)
    return active.map((a) => ({
      assignmentId: a.id,
      employeeId: a.employee_id,
      name: employeeNameById.get(a.employee_id) ?? 'Unknown',
    }))
  }, [assignments, employeeNameById])

  const phasesForUi = employeePortal && portalFieldPhases ? portalFieldPhases : phases

  const sortedPhases = useMemo(() => {
    return [...phasesForUi].sort((a, b) => {
      const oa = a.order ?? 0
      const ob = b.order ?? 0
      if (oa !== ob) return oa - ob
      return a.start_date.localeCompare(b.start_date)
    })
  }, [phasesForUi])

  const entriesSorted = useMemo(() => {
    return [...entries].sort((a, b) => b.date.localeCompare(a.date))
  }, [entries])

  const weekGroups = useMemo(() => {
    const map = new Map<string, DailyLogEntry[]>()
    for (const e of entriesSorted) {
      const wk = dayjs(e.date).startOf('week').format('YYYY-MM-DD')
      if (!map.has(wk)) map.set(wk, [])
      map.get(wk)!.push(e)
    }
    const keys = [...map.keys()].sort((a, b) => b.localeCompare(a))
    return keys.map((weekStart) => ({
      weekStart,
      label: `Week of ${formatDate(weekStart)}`,
      items: map.get(weekStart)!,
    }))
  }, [entriesSorted])

  const selected = selectedId ? entries.find((e) => e.id === selectedId) : undefined

  useEffect(() => {
    let alive = true
    queuedGalleryUrlsRef.current.forEach((u) => URL.revokeObjectURL(u))
    queuedGalleryUrlsRef.current = []
    const logDate = selected?.date
    if (!logDate) {
      setQueuedGalleryMedia([])
      return () => {
        alive = false
      }
    }
    void (async () => {
      const rows = await localDb.media_queue
        .where('project_id')
        .equals(projectId)
        .filter((m) => m.sync_status === 'pending')
        .toArray()
      if (!alive) return
      const urls: string[] = []
      const vm: JobWalkMedia[] = []
      for (const m of rows) {
        if (m.log_date !== logDate) continue
        if ((m.caption ?? '').includes('[Issue:')) continue
        const url = URL.createObjectURL(m.file_data)
        urls.push(url)
        const isVid = /\.(mp4|mov|webm)$/i.test(m.file_name)
        vm.push({
          id: `queued-${m.id}`,
          project_id: projectId,
          url,
          type: isVid ? 'video' : 'photo',
          uploaded_at: new Date(m.created_at).toISOString(),
          uploader_name: 'Queued',
          caption: m.caption,
          log_date: logDate,
          queued: true,
        })
      }
      queuedGalleryUrlsRef.current = urls
      setQueuedGalleryMedia(vm)
    })()
    return () => {
      alive = false
      queuedGalleryUrlsRef.current.forEach((u) => URL.revokeObjectURL(u))
      queuedGalleryUrlsRef.current = []
    }
  }, [projectId, selected?.date, mediaQueueTick])

  useEffect(() => {
    let alive = true
    const created: string[] = []
    void (async () => {
      const next: Record<string, string> = {}
      for (const e of entries) {
        for (const iss of e.issues) {
          if (!iss.localMediaQueueId) continue
          const row = await localDb.media_queue.get(iss.localMediaQueueId)
          if (!row?.file_data || !alive) continue
          const u = URL.createObjectURL(row.file_data)
          created.push(u)
          next[iss.id] = u
        }
      }
      if (!alive) {
        created.forEach(URL.revokeObjectURL)
        return
      }
      setIssuePreviewUrls((prev) => {
        Object.values(prev).forEach(URL.revokeObjectURL)
        return next
      })
    })()
    return () => {
      alive = false
      setIssuePreviewUrls((prev) => {
        Object.values(prev).forEach(URL.revokeObjectURL)
        return {}
      })
    }
  }, [entries, mediaQueueTick])

  const combinedLogGalleryMedia = useMemo(() => {
    if (!selected) return []
    return [...mediaForLogDate(media, selected.date), ...queuedGalleryMedia]
  }, [media, selected, queuedGalleryMedia])

  useEffect(() => {
    if (!selectedId && entriesSorted.length > 0) {
      setSelectedId(entriesSorted[0]!.id)
    }
  }, [selectedId, entriesSorted])

  useEffect(() => {
    if (selectedId && !entries.some((e) => e.id === selectedId)) {
      setSelectedId(entriesSorted[0]?.id ?? null)
    }
  }, [selectedId, entries, entriesSorted])

  useEffect(() => {
    setDeleteError(null)
    setDeleteModalOpen(false)
  }, [selectedId])

  const updateEntry = useCallback((id: string, patch: Partial<DailyLogEntry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)))
  }, [])

  const mergeServerRow = useCallback((row: DailyLogRow) => {
    setEntries((prev) => {
      const next = mapRowToEntry(row)
      const idx = prev.findIndex((e) => e.id === row.id)
      if (idx === -1) return [next, ...prev].sort((a, b) => b.date.localeCompare(a.date))
      const copy = [...prev]
      copy[idx] = next
      return copy.sort((a, b) => b.date.localeCompare(a.date))
    })
  }, [])

  const handleNewDailyLog = () => {
    const today = dayjs().format('YYYY-MM-DD')
    if (entries.some((e) => e.date === today)) {
      setNewLogConfirmOpen(false)
      setPickDateValue(today)
      setPickDateOpen(true)
      return
    }
    setPickDateOpen(false)
    setNewLogConfirmOpen(true)
  }

  const confirmCreateTodayLog = async () => {
    const today = dayjs().format('YYYY-MM-DD')
    setNewLogConfirmOpen(false)
    const createLocal = async () => {
      const id = crypto.randomUUID()
      const entry = newEmptyDailyLogEntry(id, today)
      setEntries((prev) => [...prev, entry].sort((a, b) => b.date.localeCompare(a.date)))
      setSelectedId(id)
      await saveOffline(entry)
      setMediaQueueTick((t) => t + 1)
      showToast('Saved locally — will sync when online', 'warning')
    }
    if (!isOnline) {
      await createLocal()
      return
    }
    try {
      const row = await api.projects.createDailyLog(projectId, { log_date: today })
      mergeServerRow(row)
      setSelectedId(row.id)
      await localDb.daily_logs.delete(row.id).catch(() => {})
    } catch {
      await createLocal()
    }
  }

  const confirmPickDate = async () => {
    const d = pickDateValue.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      setPickDateOpen(false)
      return
    }
    const existing = entries.find((e) => e.date === d)
    if (existing) {
      setSelectedId(existing.id)
      setPickDateOpen(false)
      return
    }
    const createLocal = async () => {
      const id = crypto.randomUUID()
      const entry = newEmptyDailyLogEntry(id, d)
      setEntries((prev) => [...prev, entry].sort((a, b) => b.date.localeCompare(a.date)))
      setSelectedId(id)
      await saveOffline(entry)
      setMediaQueueTick((t) => t + 1)
      showToast('Saved locally — will sync when online', 'warning')
      setPickDateOpen(false)
    }
    if (!isOnline) {
      await createLocal()
      return
    }
    try {
      const row = await api.projects.createDailyLog(projectId, { log_date: d })
      mergeServerRow(row)
      setSelectedId(row.id)
      await localDb.daily_logs.delete(row.id).catch(() => {})
      setPickDateOpen(false)
    } catch {
      await createLocal()
    }
  }

  const handleSaveLog = async () => {
    if (!selected || isEntryLocked(selected)) return
    setSaving(true)
    setSaveError(null)
    try {
      if (isOnline) {
        try {
          const payload = buildPatchPayload(selected, assignments, employees)
          const updated = await api.projects.patchDailyLog(projectId, selected.id, payload)
          mergeServerRow(updated)
          await localDb.daily_logs.delete(selected.id).catch(() => {})
          showToast('Daily log saved', 'success')
        } catch {
          await saveOffline(selected)
          showToast('Saved locally — will sync when online', 'warning')
        }
      } else {
        await saveOffline(selected)
        showToast('Saved locally — will sync when online', 'warning')
      }
    } finally {
      setSaving(false)
    }
  }

  const openDeleteModal = () => {
    if (!selected || isEntryLocked(selected)) return
    setDeleteError(null)
    setDeleteModalOpen(true)
  }

  const confirmDeleteLog = async () => {
    if (!selected || isEntryLocked(selected)) return
    setDeleteError(null)
    setDeleting(true)
    const removedId = selected.id
    const logDate = selected.date
    try {
      if (isOnline) {
        try {
          await api.projects.deleteDailyLog(projectId, removedId)
        } catch {
          /* log may exist only in IndexedDB */
        }
      }
      await localDb.daily_logs.delete(removedId).catch(() => {})
      const queueRows = await localDb.media_queue
        .where('project_id')
        .equals(projectId)
        .filter((m) => m.log_date === logDate && m.sync_status === 'pending')
        .toArray()
      for (const m of queueRows) {
        await localDb.media_queue.delete(m.id)
      }
      setEntries((prev) => prev.filter((e) => e.id !== removedId))
      setSelectedId(null)
      setExpandedId(null)
      setDeleteModalOpen(false)
      setMediaQueueTick((t) => t + 1)
      refreshMedia()
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Could not delete log.')
    } finally {
      setDeleting(false)
    }
  }

  const locked = selected ? isEntryLocked(selected) : false
  const isTodaySelected = selected ? selected.date === dayjs().format('YYYY-MM-DD') : false
  const detailTitle = isTodaySelected ? "Today's log" : 'Selected log'

  const toggleCrewMember = (employeeId: string) => {
    if (!selected || locked) return
    const set = new Set(selected.crewEmployeeIds)
    if (set.has(employeeId)) set.delete(employeeId)
    else set.add(employeeId)
    updateEntry(selected.id, { crewEmployeeIds: [...set] })
  }

  const headcount = selected
    ? selected.crewEmployeeIds.length + selected.adHocCrewNames.filter((n) => n.trim()).length
    : 0

  return (
    <div className="daily-log-tab w-full min-w-0">
      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className={`daily-log-toast daily-log-toast--${toast.variant}`}
        >
          {toast.message}
        </div>
      ) : null}
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] m-0">Daily log</h2>
          <p className="text-sm text-[var(--text-muted)] m-0">{projectName}</p>
        </div>
      </div>

      {logsError ? (
        <p className="text-sm text-red-600 mb-4" role="alert">
          {logsError}
        </p>
      ) : null}

      <div className="project-daily-log-layout">
        <div className="project-daily-log-list min-h-0">
          <div className="project-daily-log-list-header">
            <span className="text-sm font-semibold text-[var(--text-primary)]">Log list</span>
            <button
              type="button"
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
              onClick={handleNewDailyLog}
              disabled={logsLoading}
            >
              + New daily log
            </button>
          </div>

          {newLogConfirmOpen && (
            <div
              className="border-b border-[var(--border)] bg-[var(--bg-base)] p-4"
              role="dialog"
              aria-label="Create daily log"
            >
              <p className="mt-0 mb-3 text-sm text-[var(--text-primary)]">
                Create a daily log for {formatDate(dayjs())}?
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium"
                  onClick={() => setNewLogConfirmOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white"
                  onClick={() => void confirmCreateTodayLog()}
                >
                  Create log
                </button>
              </div>
            </div>
          )}

          {pickDateOpen && (
            <div
              className="border-b border-[var(--border)] bg-[var(--bg-base)] p-4"
              role="dialog"
              aria-label="Choose log date"
            >
              <p className="mt-0 mb-2 text-sm text-[var(--text-primary)]">
                Today already has a log. Pick a date for a new entry.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1.5 text-sm"
                  value={pickDateValue}
                  onChange={(e) => setPickDateValue(e.target.value)}
                />
                <button
                  type="button"
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium"
                  onClick={() => setPickDateOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white"
                  onClick={() => void confirmPickDate()}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {logsLoading ? (
              <p className="p-4 text-sm text-[var(--text-muted)]">Loading logs…</p>
            ) : weekGroups.length === 0 ? (
              <p className="p-4 text-sm text-[var(--text-muted)]">No logs yet. Create one to get started.</p>
            ) : (
              weekGroups.map((group) => (
                <div key={group.weekStart}>
                  <div className="px-[18px] pb-2 pt-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] first:pt-2">
                    {group.label}
                  </div>
                  <ul className="m-0 list-none p-0">
                    {group.items.map((entry) => {
                      const isSel = selectedId === entry.id
                      const expanded = expandedId === entry.id
                      const issues = entry.issues.filter((i) => i.description.trim())
                      const crewN =
                        entry.crewEmployeeIds.length +
                        entry.adHocCrewNames.filter((n) => n.trim()).length
                      const photos =
                        photoCountForLog(media, entry.date) +
                        (queuedPhotoCountsByDate[entry.date] ?? 0)
                      const wkLabel = dayjs(entry.date).format('ddd')
                      return (
                        <li key={entry.id} className="m-0 p-0">
                          <div className={`project-daily-log-entry-row ${isSel ? 'active' : ''}`}>
                            <div className="flex items-stretch">
                              <button
                                type="button"
                                onClick={() => setSelectedId(entry.id)}
                                className="min-w-0 flex-1 cursor-pointer border-none bg-transparent p-0 text-left font-inherit"
                              >
                                <div className="project-daily-log-entry-date">
                                  {formatDate(entry.date)} · {wkLabel}
                                </div>
                                <div className="project-daily-log-entry-summary">{oneLineSummary(entry.workSummary)}</div>
                                <div className="project-daily-log-entry-badges">
                                  <span
                                    className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-base)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]"
                                    title="Weather"
                                  >
                                    <span aria-hidden>{weatherIcon(entry.weather)}</span>
                                    {entry.weather}
                                  </span>
                                  {crewN > 0 ? (
                                    <span className="rounded-full bg-[var(--bg-base)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-primary)]">
                                      {crewN} crew
                                    </span>
                                  ) : null}
                                  {photos > 0 ? (
                                    <span className="rounded-full bg-[var(--bg-base)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-primary)]">
                                      {photos} photos
                                    </span>
                                  ) : null}
                                  {issues.length > 0 ? (
                                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-200">
                                      {issues.length} issues
                                    </span>
                                  ) : null}
                                </div>
                              </button>
                              <button
                                type="button"
                                className="shrink-0 border-l border-[var(--border)] px-2 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                                title={expanded ? 'Collapse preview' : 'Expand preview'}
                                aria-expanded={expanded}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedId(entry.id)
                                  setExpandedId((id) => (id === entry.id ? null : entry.id))
                                }}
                              >
                                <span className="text-lg leading-none">{expanded ? '▾' : '▸'}</span>
                              </button>
                            </div>
                          </div>
                          {expanded ? (
                            <div className="border-b border-[var(--border)] bg-[var(--bg-base)] px-[18px] py-2 text-xs text-[var(--text-secondary)]">
                              {entry.workSummary.trim() || 'No work summary yet.'}
                              {issues.length > 0 ? (
                                <ul className="mt-2 list-disc pl-4">
                                  {issues.slice(0, 4).map((i) => (
                                    <li key={i.id}>
                                      <span className="font-semibold">{i.severity}:</span> {i.description}
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Detail */}
        <div className="project-daily-log-detail min-w-0">
          {!selected ? (
            <p className="text-sm text-[var(--text-muted)]">Select a log entry or create a new one.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--border)] pb-4">
                <div>
                  <h3 className="text-base font-semibold text-[var(--text-primary)] m-0">{detailTitle}</h3>
                  <p className="text-xs text-[var(--text-muted)] m-0 mt-0.5">
                    {locked
                      ? 'This log is locked (older than 24 hours or explicitly locked).'
                      : 'Save to sync to the server. Editable until 24 hours after the log was first created.'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {!locked ? (
                    <button
                      type="button"
                      disabled={deleting || saving}
                      onClick={openDeleteModal}
                      className="rounded-lg border border-[var(--border)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--red)] hover:bg-[var(--red-glow-soft)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {deleting ? 'Deleting…' : 'Delete log'}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={locked || saving || deleting}
                    onClick={() => void handleSaveLog()}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {saving ? 'Saving…' : 'Save log'}
                  </button>
                </div>
              </div>
              {saveError ? (
                <p className="text-sm text-red-600" role="alert">
                  {saveError}
                </p>
              ) : null}

              {/* Date & weather */}
              <section className="project-daily-log-section">
                <h4 className="project-daily-log-section-title">Date &amp; weather</h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-medium text-[var(--text-muted)]">
                    Date
                    <input
                      type="date"
                      disabled={locked}
                      className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--bg-base)] px-2 py-2 text-sm disabled:opacity-60"
                      value={selected.date}
                      onChange={(e) => updateEntry(selected.id, { date: e.target.value })}
                    />
                  </label>
                  <label className="block text-xs font-medium text-[var(--text-muted)]">
                    Temperature (optional)
                    <input
                      type="text"
                      disabled={locked}
                      placeholder="e.g. 72°F"
                      className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--bg-base)] px-2 py-2 text-sm disabled:opacity-60"
                      value={selected.temperature ?? ''}
                      onChange={(e) => updateEntry(selected.id, { temperature: e.target.value })}
                    />
                  </label>
                </div>
                <div>
                  <span className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Conditions</span>
                  <div className="project-daily-log-weather-pills">
                    {WEATHER_OPTIONS.map((w) => (
                      <button
                        key={w}
                        type="button"
                        disabled={locked}
                        onClick={() => updateEntry(selected.id, { weather: w })}
                        className={`project-daily-log-weather-pill inline-flex items-center gap-1 ${
                          selected.weather === w ? 'active' : ''
                        } disabled:opacity-50`}
                      >
                        <span aria-hidden>{weatherIcon(w)}</span>
                        {w}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {/* Crew */}
              <section className="project-daily-log-section">
                <h4 className="project-daily-log-section-title">
                  Crew on site ({headcount} on site)
                </h4>
                {loadingCrew ? (
                  <p className="text-sm text-[var(--text-muted)]">Loading crew…</p>
                ) : assignedRows.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">
                    No job assignments yet. Assign crew in the Crew tab, or add names below.
                  </p>
                ) : (
                  <ul className="m-0 mb-3 list-none p-0">
                    {assignedRows.map((row) => (
                      <li key={row.assignmentId} className="project-daily-log-crew-row">
                        <input
                          type="checkbox"
                          disabled={locked}
                          checked={selected.crewEmployeeIds.includes(row.employeeId)}
                          onChange={() => toggleCrewMember(row.employeeId)}
                          id={`crew-${row.employeeId}`}
                        />
                        <label htmlFor={`crew-${row.employeeId}`} className="text-sm text-[var(--text-primary)]">
                          {row.name}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="space-y-2">
                  <span className="text-xs font-medium text-[var(--text-muted)]">Ad-hoc names</span>
                  {selected.adHocCrewNames.map((name, idx) => (
                    <div key={`adhoc-${idx}`} className="flex gap-2">
                      <input
                        type="text"
                        disabled={locked}
                        className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--bg-base)] px-2 py-1.5 text-sm"
                        placeholder="Name"
                        value={name}
                        onChange={(e) => {
                          const next = [...selected.adHocCrewNames]
                          next[idx] = e.target.value
                          updateEntry(selected.id, { adHocCrewNames: next })
                        }}
                      />
                      {!locked ? (
                        <button
                          type="button"
                          className="shrink-0 text-xs text-red-600"
                          onClick={() =>
                            updateEntry(selected.id, {
                              adHocCrewNames: selected.adHocCrewNames.filter((_, i) => i !== idx),
                            })
                          }
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {!locked ? (
                    <button
                      type="button"
                      className="text-sm font-medium text-primary"
                      onClick={() =>
                        updateEntry(selected.id, { adHocCrewNames: [...selected.adHocCrewNames, ''] })
                      }
                    >
                      + Add name
                    </button>
                  ) : null}
                </div>
              </section>

              {/* Work */}
              <section className="project-daily-log-section">
                <h4 className="project-daily-log-section-title">Work completed</h4>
                <textarea
                  disabled={locked}
                  className="min-h-[100px] w-full rounded-md border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm disabled:opacity-60"
                  placeholder="Describe work performed today…"
                  value={selected.workSummary}
                  onChange={(e) => updateEntry(selected.id, { workSummary: e.target.value })}
                />
                <label className="mt-3 block text-xs font-medium text-[var(--text-muted)]">
                  Which phase does today&apos;s work relate to?
                  <select
                    disabled={locked}
                    className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--bg-base)] px-2 py-2 text-sm disabled:opacity-60"
                    value={selected.phaseId ?? ''}
                    onChange={(e) => updateEntry(selected.id, { phaseId: e.target.value || null })}
                  >
                    <option value="">— Select phase —</option>
                    {sortedPhases.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              </section>

              {/* Materials */}
              <section className="project-daily-log-section">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="project-daily-log-section-title m-0 min-w-0 flex-1">Materials &amp; deliveries</h4>
                  {!locked ? (
                    <button
                      type="button"
                      className="shrink-0 text-sm font-medium text-primary"
                      onClick={() =>
                        updateEntry(selected.id, {
                          materials: [
                            ...selected.materials,
                            { id: newId('mat'), description: '', quantity: '' },
                          ],
                        })
                      }
                    >
                      + Add line
                    </button>
                  ) : null}
                </div>
                {selected.materials.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">No materials recorded.</p>
                ) : (
                  <ul className="space-y-2">
                    {selected.materials.map((m) => (
                      <li key={m.id} className="flex flex-wrap gap-2">
                        <input
                          type="text"
                          disabled={locked}
                          className="min-w-[120px] flex-1 rounded-md border border-[var(--border)] bg-[var(--bg-base)] px-2 py-1.5 text-sm"
                          placeholder="Description"
                          value={m.description}
                          onChange={(e) => {
                            const materials = selected.materials.map((x) =>
                              x.id === m.id ? { ...x, description: e.target.value } : x
                            )
                            updateEntry(selected.id, { materials })
                          }}
                        />
                        <input
                          type="text"
                          disabled={locked}
                          className="w-24 rounded-md border border-[var(--border)] bg-[var(--bg-base)] px-2 py-1.5 text-sm"
                          placeholder="Qty"
                          value={m.quantity}
                          onChange={(e) => {
                            const materials = selected.materials.map((x) =>
                              x.id === m.id ? { ...x, quantity: e.target.value } : x
                            )
                            updateEntry(selected.id, { materials })
                          }}
                        />
                        {!locked ? (
                          <button
                            type="button"
                            className="text-xs text-red-600"
                            onClick={() =>
                              updateEntry(selected.id, {
                                materials: selected.materials.filter((x) => x.id !== m.id),
                              })
                            }
                          >
                            Remove
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Issues */}
              <section className="project-daily-log-section">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="project-daily-log-section-title m-0 min-w-0 flex-1">Issues &amp; flags</h4>
                  {!locked ? (
                    <button
                      type="button"
                      className="shrink-0 text-sm font-medium text-primary"
                      onClick={() =>
                        updateEntry(selected.id, {
                          issues: [
                            ...selected.issues,
                            { id: newId('iss'), severity: 'info', description: '' },
                          ],
                        })
                      }
                    >
                      + Add issue
                    </button>
                  ) : null}
                </div>
                {selected.issues.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">No issues flagged.</p>
                ) : (
                  <ul className="m-0 flex list-none flex-col gap-3 p-0">
                    {selected.issues.map((issue) => (
                      <li
                        key={issue.id}
                        className={`project-daily-log-issue-row project-daily-log-issue-row--${
                          issue.severity === 'critical' ? 'critical' : issue.severity === 'warning' ? 'warning' : 'info'
                        }`}
                      >
                        <div className="mb-2 flex flex-wrap gap-2">
                          <select
                            disabled={locked}
                            className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1.5 text-sm"
                            value={issue.severity}
                            onChange={(e) => {
                              const sev = e.target.value as IssueSeverity
                              const issues = selected.issues.map((i) =>
                                i.id === issue.id ? { ...i, severity: sev } : i
                              )
                              updateEntry(selected.id, { issues })
                            }}
                          >
                            {SEVERITY_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                          {!locked ? (
                            <button
                              type="button"
                              className="text-xs text-red-600"
                              onClick={() => {
                                const iss = selected.issues.find((i) => i.id === issue.id)
                                if (iss?.localMediaQueueId) {
                                  void localDb.media_queue.delete(iss.localMediaQueueId).then(() => {
                                    setMediaQueueTick((t) => t + 1)
                                  })
                                }
                                updateEntry(selected.id, {
                                  issues: selected.issues.filter((i) => i.id !== issue.id),
                                })
                              }}
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>
                        <textarea
                          disabled={locked}
                          className="mb-2 min-h-[64px] w-full rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1.5 text-sm"
                          placeholder="Describe the issue, delay, or safety observation…"
                          value={issue.description}
                          onChange={(e) => {
                            const issues = selected.issues.map((i) =>
                              i.id === issue.id ? { ...i, description: e.target.value } : i
                            )
                            updateEntry(selected.id, { issues })
                          }}
                        />
                        <div className="text-xs text-[var(--text-muted)]">
                          Optional photo
                          <input
                            type="file"
                            accept="image/*"
                            disabled={locked}
                            className="mt-1 block w-full text-sm"
                            onChange={async (e) => {
                              const file = e.target.files?.[0]
                              e.target.value = ''
                              if (!file || !file.type.startsWith('image/') || locked) return
                              const caption = `${dailyLogMediaCaptionPrefix(selected.date)}[Issue:${issue.id}]`
                              const queueOffline = async () => {
                                const qid = crypto.randomUUID()
                                await localDb.media_queue.put({
                                  id: qid,
                                  project_id: projectId,
                                  log_date: selected.date,
                                  file_data: file,
                                  file_name: file.name,
                                  caption,
                                  sync_status: 'pending',
                                  created_at: Date.now(),
                                })
                                const issuesNext = selected.issues.map((i) =>
                                  i.id === issue.id
                                    ? { ...i, photoUrl: undefined, localMediaQueueId: qid }
                                    : i
                                )
                                updateEntry(selected.id, { issues: issuesNext })
                                setMediaQueueTick((t) => t + 1)
                                await saveOffline({ ...selected, issues: issuesNext })
                                showToast('Photo queued locally — will sync when online', 'warning')
                              }
                              if (!isOnline) {
                                await queueOffline()
                                return
                              }
                              try {
                                const created = await api.projects.uploadMedia(projectId, file, undefined, caption, {
                                  log_date: selected.date,
                                })
                                const issuesNext = selected.issues.map((i) =>
                                  i.id === issue.id
                                    ? { ...i, photoUrl: created.url, localMediaQueueId: undefined }
                                    : i
                                )
                                updateEntry(selected.id, { issues: issuesNext })
                                refreshMedia()
                                const payloadIssues = issuesNext.map((i) => ({
                                  severity: i.severity,
                                  description: i.description,
                                  photo_url: i.photoUrl,
                                }))
                                await api.projects.patchDailyLog(projectId, selected.id, { issues: payloadIssues })
                              } catch {
                                await queueOffline()
                              }
                            }}
                          />
                          {issue.photoUrl || issuePreviewUrls[issue.id] ? (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <img
                                src={issue.photoUrl || issuePreviewUrls[issue.id]}
                                alt=""
                                className="max-h-24 max-w-[200px] rounded-md border border-[var(--border)] object-contain"
                              />
                              {issue.localMediaQueueId ? (
                                <span className="daily-log-pending-indicator">Queued</span>
                              ) : (
                                <span className="text-[var(--text-secondary)]">Photo attached</span>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Photos — Job Walk Media */}
              <section className="project-daily-log-section">
                <h4 className="project-daily-log-section-title">Photos</h4>
                <p className="mb-2 text-xs text-[var(--text-muted)]">
                  Uploads set the log date on each file to this entry ({selected.date}).
                </p>
                <JobWalkGallery
                  projectId={projectId}
                  projectName={projectName}
                  media={combinedLogGalleryMedia}
                  onUpload={async (file, uploaderName, caption) => {
                    const tag = dailyLogMediaCaptionPrefix(selected.date)
                    const merged = [tag, caption?.trim()].filter(Boolean).join(' — ')
                    const putQueue = async () => {
                      await localDb.media_queue.put({
                        id: crypto.randomUUID(),
                        project_id: projectId,
                        log_date: selected.date,
                        file_data: file,
                        file_name: file.name,
                        caption: merged || tag,
                        sync_status: 'pending',
                        created_at: Date.now(),
                      })
                      setMediaQueueTick((t) => t + 1)
                      showToast('Saved locally — will sync when online', 'warning')
                    }
                    if (!isOnline) {
                      await putQueue()
                      return
                    }
                    try {
                      await api.projects.uploadMedia(projectId, file, uploaderName, merged || tag, {
                        log_date: selected.date,
                      })
                    } catch {
                      await putQueue()
                    }
                  }}
                  onDelete={
                    locked
                      ? undefined
                      : async (mediaId) => {
                          if (mediaId.startsWith('queued-')) {
                            await localDb.media_queue.delete(mediaId.slice('queued-'.length))
                            setMediaQueueTick((t) => t + 1)
                            return
                          }
                          await api.projects.deleteMedia(projectId, mediaId)
                        }
                  }
                  onRefresh={refreshMedia}
                />
              </section>

              {/* Visitors */}
              <section className="project-daily-log-section">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="project-daily-log-section-title m-0 min-w-0 flex-1">Visitor log</h4>
                  {!locked ? (
                    <button
                      type="button"
                      className="shrink-0 text-sm font-medium text-primary"
                      onClick={() =>
                        updateEntry(selected.id, {
                          visitors: [...selected.visitors, { id: newId('vis'), name: '', notes: '' }],
                        })
                      }
                    >
                      + Add visitor
                    </button>
                  ) : null}
                </div>
                {selected.visitors.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">No visitors recorded.</p>
                ) : (
                  <ul className="space-y-2">
                    {selected.visitors.map((v) => (
                      <li
                        key={v.id}
                        className="flex flex-col gap-1 rounded-md border border-[var(--border)] bg-[var(--bg-base)] p-2 sm:flex-row sm:items-center"
                      >
                        <input
                          type="text"
                          disabled={locked}
                          className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1.5 text-sm"
                          placeholder="Name / role"
                          value={v.name}
                          onChange={(e) => {
                            const visitors = selected.visitors.map((x) =>
                              x.id === v.id ? { ...x, name: e.target.value } : x
                            )
                            updateEntry(selected.id, { visitors })
                          }}
                        />
                        <input
                          type="text"
                          disabled={locked}
                          className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1.5 text-sm"
                          placeholder="Notes (optional)"
                          value={v.notes ?? ''}
                          onChange={(e) => {
                            const visitors = selected.visitors.map((x) =>
                              x.id === v.id ? { ...x, notes: e.target.value } : x
                            )
                            updateEntry(selected.id, { visitors })
                          }}
                        />
                        {!locked ? (
                          <button
                            type="button"
                            className="text-xs text-red-600"
                            onClick={() =>
                              updateEntry(selected.id, {
                                visitors: selected.visitors.filter((x) => x.id !== v.id),
                              })
                            }
                          >
                            Remove
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      <ConfirmDeleteDailyLogModal
        open={deleteModalOpen && !!selected}
        logDateLabel={selected ? formatDate(selected.date) : '—'}
        onClose={() => {
          if (deleting) return
          setDeleteModalOpen(false)
          setDeleteError(null)
        }}
        onConfirm={() => void confirmDeleteLog()}
        isDeleting={deleting}
        error={deleteError}
      />
    </div>
  )
}
