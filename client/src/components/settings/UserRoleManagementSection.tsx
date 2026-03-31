import { useState, useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import type { UserRole, InvitedMember } from '@/types/global'
import { teamsApi } from '@/api/teamsClient'
import {
  SectionHeader,
  Card,
  CardHeader,
  CardBody,
  Btn,
} from './SettingsPrimitives'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  project_manager: 'Project Manager',
  field_supervisor: 'Field Supervisor',
  employee: 'Employee',
  subcontractor: 'Subcontractor',
}

export function UserRoleManagementSection() {
  const [members, setMembers] = useState<InvitedMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([teamsApi.employees.list(), teamsApi.employees.listInvites()])
      .then(([employees, invites]) => {
        if (cancelled) return
        const inviteByEmpId = new Map(invites.map((i) => [i.employee_id, i]))
        const list: InvitedMember[] = employees.map((emp) => {
          const inv = inviteByEmpId.get(emp.id)
          const status = emp.auth_user_id ? ('accepted' as const) : (inv?.status === 'pending' || inv?.status === 'expired' ? inv.status : 'pending')
          return {
            id: emp.id,
            email: emp.email || inv?.email || '',
            role: (emp.role as UserRole) || 'employee',
            status,
            invitedAt: inv?.invitedAt ?? '',
          }
        })
        setMembers(list)
      })
      .catch((e) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const removeMember = async (id: string) => {
    setError(null)
    try {
      await teamsApi.employees.delete(id)
      setMembers((m) => m.filter((x) => x.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Remove failed')
    }
  }

  if (loading) return <div style={{ padding: 24 }}><LoadingSkeleton variant="inline" lines={5} /></div>

  return (
    <>
      {error && <div style={{ marginBottom: 16, padding: 12, background: '#fef2f2', color: '#b91c1c', borderRadius: 8 }}>{error}</div>}
      <SectionHeader
        title="User & Role Management"
        desc="Team members and their roles in your organization."
      />
      <Card style={{ marginBottom: 0 }}>
        <CardHeader title="Team members" />
        <CardBody style={{ padding: 0 }}>
          <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto_44px] gap-2 border-b border-[#f1f0ed] px-3 py-3 text-[10.5px] font-bold uppercase tracking-wide text-[#c4bfb8] sm:gap-3 sm:px-6 md:grid-cols-[1fr_1fr_100px_44px]">
            <span className="min-w-0">Email</span>
            <span className="min-w-0">Role</span>
            <span>Status</span>
            <span className="sr-only">Remove</span>
          </div>
          {members.map((m) => (
            <div
              key={m.id}
              className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto_44px] items-center gap-2 border-b border-[#f9f8f6] px-3 py-3 text-sm sm:gap-3 sm:px-6 md:grid-cols-[1fr_1fr_100px_44px] md:text-[14px]"
            >
              <span className="min-w-0 break-all text-[#111]">{m.email}</span>
              <span className="min-w-0 text-[#6b7280]">{ROLE_LABELS[m.role] ?? m.role}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: m.status === 'accepted' ? '#15803d' : '#9ca3af' }}>{m.status}</span>
              <Btn
                variant="ghost"
                type="button"
                aria-label={`Remove ${m.email}`}
                onClick={() => removeMember(m.id)}
                className="inline-flex !shrink-0 items-center justify-center !p-2 !min-w-0"
                style={{ fontSize: 12 }}
              >
                <Trash2 size={16} strokeWidth={2} className="text-[var(--red,#b91c1c)]" aria-hidden />
              </Btn>
            </div>
          ))}
        </CardBody>
      </Card>
    </>
  )
}
