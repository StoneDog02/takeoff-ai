import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/api/client'
import { localDb, type LocalDailyLog } from '@/lib/localDb'

function buildDailyLogPatch(log: LocalDailyLog): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  if (log.weather !== undefined) patch.weather = log.weather
  if (log.temperature !== undefined) patch.temperature = log.temperature
  if (log.crew_count !== undefined) patch.crew_count = log.crew_count
  if (log.crew_present !== undefined) patch.crew_present = log.crew_present
  if (log.work_summary !== undefined) patch.work_summary = log.work_summary
  if (log.phase_id !== undefined) patch.phase_id = log.phase_id
  if (log.materials !== undefined) patch.materials = log.materials
  if (log.issues !== undefined) {
    patch.issues = Array.isArray(log.issues)
      ? log.issues.map((iss: Record<string, unknown>) => {
          const { local_media_queue_id: _q, ...rest } = iss
          return rest
        })
      : log.issues
  }
  if (log.visitor_log !== undefined) patch.visitor_log = log.visitor_log
  if (log.notes !== undefined) patch.notes = log.notes
  return patch
}

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [syncPending, setSyncPending] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const syncingBusy = useRef(false)
  const syncPendingDataRef = useRef<() => Promise<void>>(async () => {})

  const syncPendingData = useCallback(async () => {
    if (syncingBusy.current) return
    syncingBusy.current = true
    setSyncing(true)
    try {
      const pendingLogs = await localDb.daily_logs
        .where('sync_status')
        .equals('pending')
        .toArray()

      for (const log of pendingLogs) {
        try {
          const created = await api.projects.createDailyLog(log.project_id, {
            log_date: log.log_date,
          })
          const patch = buildDailyLogPatch(log)
          if (Object.keys(patch).length > 0) {
            await api.projects.patchDailyLog(log.project_id, created.id, patch)
          }
          await localDb.daily_logs.delete(log.id)
        } catch {
          await localDb.daily_logs.update(log.id, { sync_status: 'error' })
        }
      }

      const pendingMedia = await localDb.media_queue
        .where('sync_status')
        .equals('pending')
        .toArray()

      for (const item of pendingMedia) {
        try {
          const file = new File([item.file_data], item.file_name)
          await api.projects.uploadMedia(
            item.project_id,
            file,
            undefined,
            item.caption,
            item.log_date ? { log_date: item.log_date } : undefined
          )
          await localDb.media_queue.update(item.id, { sync_status: 'synced' })
        } catch {
          await localDb.media_queue.update(item.id, { sync_status: 'error' })
        }
      }
    } finally {
      syncingBusy.current = false
      setSyncing(false)
    }
  }, [])

  syncPendingDataRef.current = syncPendingData

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      void syncPendingDataRef.current()
    }
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    const countPending = async () => {
      const logs = await localDb.daily_logs
        .where('sync_status')
        .equals('pending')
        .count()
      const media = await localDb.media_queue
        .where('sync_status')
        .equals('pending')
        .count()
      setSyncPending(logs + media)
    }
    void countPending()
    const interval = setInterval(() => void countPending(), 5000)
    return () => clearInterval(interval)
  }, [])

  const cacheProjectsForOffline = useCallback(async () => {
    if (!isOnline) return
    try {
      const projects = await api.dashboard.getProjects()
      const active = projects.filter((p) =>
        ['active', 'estimating', 'backlog'].includes(p.status ?? '')
      )
      for (const p of active) {
        await localDb.projects.put({
          id: p.id,
          name: p.name,
          status: p.status,
          address_line_1: p.address_line_1 ?? undefined,
          city: p.city ?? undefined,
          client: p.client ?? undefined,
          phases: p.phases,
          synced_at: Date.now(),
        })
      }
    } catch (err) {
      console.error('Failed to cache projects', err)
    }
  }, [isOnline])

  return {
    isOnline,
    syncPending,
    syncing,
    syncPendingData,
    cacheProjectsForOffline,
  }
}
