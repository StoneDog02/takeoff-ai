import { useCallback, useEffect, useState } from 'react'
import { teamsApi } from '@/api/teamsClient'
import { assignmentAllowsDailyLogAccess, rosterAllowsDailyLogAccess } from '@/lib/dailyLogFieldRoles'
import { useEffectiveEmployee } from '@/hooks/useEffectiveEmployee'
import { useAuth } from '@/contexts/AuthContext'

function computeEligible(
  assignments: { role_on_job?: string }[],
  rosterRole: string | undefined | null,
  dailyLogAccess: boolean | undefined | null
): boolean {
  if (rosterAllowsDailyLogAccess(rosterRole, dailyLogAccess)) return true
  return assignments.some((a) =>
    assignmentAllowsDailyLogAccess(rosterRole, a.role_on_job, dailyLogAccess)
  )
}

/** True when field lead on roster (employees.role) or on at least one active job assignment (role_on_job). */
export function useEmployeeDailyLogEligibility(): { eligible: boolean; loading: boolean } {
  const { employeeId } = useEffectiveEmployee()
  const { employee: authEmployee } = useAuth()
  const rosterRole = authEmployee?.role
  const dailyLogAccess = authEmployee?.daily_log_access
  const [eligible, setEligible] = useState(false)
  const [loading, setLoading] = useState(true)

  const refetchSilent = useCallback(async () => {
    if (!employeeId) return
    try {
      const list = await teamsApi.jobAssignments.list({ employee_id: employeeId, active_only: true })
      setEligible(computeEligible(list, rosterRole, dailyLogAccess))
    } catch {
      setEligible(false)
    }
  }, [employeeId, rosterRole, dailyLogAccess])

  useEffect(() => {
    if (!employeeId) {
      setEligible(false)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    teamsApi.jobAssignments
      .list({ employee_id: employeeId, active_only: true })
      .then((list) => {
        if (!cancelled) setEligible(computeEligible(list, rosterRole, dailyLogAccess))
      })
      .catch(() => {
        if (!cancelled) setEligible(false)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [employeeId, rosterRole, dailyLogAccess])

  useEffect(() => {
    if (!employeeId) return
    const onVis = () => {
      if (document.visibilityState === 'visible') void refetchSilent()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [employeeId, refetchSilent])

  return { eligible, loading }
}
