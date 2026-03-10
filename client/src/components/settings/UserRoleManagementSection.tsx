import { useState, useEffect } from 'react'
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

  if (loading) return <div style={{ padding: 24, color: '#6b7280' }}>Loading…</div>

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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'flex-end' }}>
            <Field label="Email address">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colleague@company.com" />
            </Field>
            <Field label="Role">
              <Select value={role} onChange={(e) => setRole(e.target.value as UserRole)} style={{ width: 'auto', minWidth: 160 }}>
                {ROLES_DATA.map((r) => (
                  <option key={r.role} value={r.role}>{r.label}</option>
                ))}
              </Select>
            </Field>
            <Btn type="button" style={{ whiteSpace: 'nowrap' }} onClick={handleInvite} disabled={inviting}>{inviting ? 'Sending…' : 'Send invite →'}</Btn>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px 80px', gap: 12, padding: '14px 24px', borderBottom: '1px solid #f1f0ed', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#c4bfb8' }}>
            <span>Email</span><span>Role</span><span>Status</span><span></span>
          </div>
          {members.map((m) => (
            <div
              key={m.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 100px 80px',
                gap: 12,
                alignItems: 'center',
                padding: '14px 24px',
                borderBottom: '1px solid #f9f8f6',
                fontSize: 14,
              }}
            >
              <span style={{ color: '#111' }}>{m.email}</span>
              <span style={{ color: '#6b7280' }}>{ROLES_DATA.find((r) => r.role === m.role)?.label ?? m.role}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: m.status === 'accepted' ? '#15803d' : '#9ca3af' }}>{m.status}</span>
              <Btn variant="ghost" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => removeMember(m.id)}>Remove</Btn>
            </div>
          ))}
        </CardBody>
      </Card>
    </>
  )
}
