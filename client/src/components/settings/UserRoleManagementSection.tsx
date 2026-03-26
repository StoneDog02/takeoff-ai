import { useState, useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import type { UserRole, InvitedMember } from '@/types/global'
import { teamsApi } from '@/api/teamsClient'
import {
  SectionHeader,
  Card,
  CardHeader,
  CardBody,
  Field,
  Input,
  Select,
  Btn,
} from './SettingsPrimitives'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'

const ROLES_DATA: { role: UserRole; label: string; color: string; perms: string[] }[] = [
  { role: 'admin', label: 'Admin', color: '#b91c1c', perms: ['Full access', 'Manage users', 'Billing', 'All settings'] },
  { role: 'project_manager', label: 'Project Manager', color: '#1d4ed8', perms: ['Projects & jobs', 'Estimates & invoices', 'Reports', 'Team view'] },
  { role: 'field_supervisor', label: 'Field Supervisor', color: '#047857', perms: ['Jobsite access', 'Clock in/out', 'View assignments', 'Limited reports'] },
  { role: 'employee', label: 'Employee', color: '#6b7280', perms: ['Clock in/out', 'View own schedule', 'View assigned jobs'] },
  { role: 'subcontractor', label: 'Subcontractor', color: '#92400e', perms: ['View only', 'Bids assigned to you', 'Documents shared with you'] },
]

export function UserRoleManagementSection() {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('employee')
  const [members, setMembers] = useState<InvitedMember[]>([])
  const [loading, setLoading] = useState(true)
  const [inviting, setInviting] = useState(false)
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

  const handleInvite = async () => {
    if (!email.trim()) return
    setInviting(true)
    setError(null)
    try {
      const created = await teamsApi.employees.create({ name: email.trim(), email: email.trim(), role })
      await teamsApi.employees.invite(created.id)
      setMembers((m) => [
        ...m,
        { id: created.id, email: email.trim(), role, status: 'pending', invitedAt: new Date().toISOString().slice(0, 10) },
      ])
      setEmail('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invite failed')
    } finally {
      setInviting(false)
    }
  }

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
        desc="Invite team members and assign roles. Subcontractors have view-only access."
      />
      <Card>
        <CardHeader title="Invite team member" />
        <CardBody>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end md:gap-3">
            <Field label="Email address">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colleague@company.com" />
            </Field>
            <Field label="Role">
              <div className="w-full md:w-auto md:min-w-[160px]">
                <Select value={role} onChange={(e) => setRole(e.target.value as UserRole)} style={{ width: '100%' }}>
                  {ROLES_DATA.map((r) => (
                    <option key={r.role} value={r.role}>{r.label}</option>
                  ))}
                </Select>
              </div>
            </Field>
            <Btn
              type="button"
              className="inline-flex w-full items-center justify-center md:w-auto"
              style={{ whiteSpace: 'nowrap' }}
              onClick={handleInvite}
              disabled={inviting}
            >
              {inviting ? 'Sending…' : 'Send invite →'}
            </Btn>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Role permissions" desc="What each role can access in the system" />
        <CardBody style={{ padding: 0 }}>
          {ROLES_DATA.map((r, i) => (
            <div
              key={r.role}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 20,
                padding: '18px 24px',
                borderBottom: i < ROLES_DATA.length - 1 ? '1px solid #f9f8f6' : 'none',
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: r.color,
                  flexShrink: 0,
                  marginTop: 5,
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#111', marginBottom: 6 }}>{r.label}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {r.perms.map((p) => (
                    <span
                      key={p}
                      style={{
                        fontSize: 11.5,
                        color: '#6b7280',
                        background: '#f9f8f6',
                        padding: '3px 9px',
                        borderRadius: 20,
                        border: '1px solid #f1f0ed',
                      }}
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </CardBody>
      </Card>

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
              <span className="min-w-0 text-[#6b7280]">{ROLES_DATA.find((r) => r.role === m.role)?.label ?? m.role}</span>
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
