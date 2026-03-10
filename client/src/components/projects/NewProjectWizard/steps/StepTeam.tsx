import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { teamsApi } from '@/api/teamsClient'
import type { Employee, Contractor } from '@/types/global'
import { AddBtn } from '../primitives'
import { uid, PHASE_COLORS, ROLE_OPTS, SUBCONTRACTOR_TRADE_OPTS } from '../constants'
import type { WizardProjectState, WizardTeamMember, WizardTeamMemberRoster, WizardTeamMemberExternal } from '../types'

type OnChange = (key: keyof WizardProjectState, value: unknown) => void

function isRoster(m: WizardTeamMember): m is WizardTeamMemberRoster {
  return m.type === 'roster'
}
function isExternal(m: WizardTeamMember): m is WizardTeamMemberExternal {
  return m.type === 'external'
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: 'var(--text-primary, #0f172a)',
  marginBottom: 8,
  marginTop: 16,
}
const sectionTitleFirst: React.CSSProperties = { ...sectionTitleStyle, marginTop: 0 }

export function StepTeam({ data, onChange }: { data: WizardProjectState; onChange: OnChange }) {
  const team = data.team || []
  const [employees, setEmployees] = useState<Employee[]>([])
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [rosterLoading, setRosterLoading] = useState(true)
  const [directoryLoading, setDirectoryLoading] = useState(true)

  useEffect(() => {
    teamsApi.employees
      .list()
      .then(setEmployees)
      .catch(() => setEmployees([]))
      .finally(() => setRosterLoading(false))
  }, [])

  useEffect(() => {
    api.contractors
      .list()
      .then(setContractors)
      .catch(() => setContractors([]))
      .finally(() => setDirectoryLoading(false))
  }, [])

  const rosterMembers = team.filter(isRoster)
  const externalMembers = team.filter(isExternal)
  const assignedEmployeeIds = new Set(rosterMembers.map((m) => m.employee_id))
  const availableEmployees = employees.filter((e) => !assignedEmployeeIds.has(e.id))
  const employeeMap = new Map(employees.map((e) => [e.id, e]))

  const addedSubKeys = new Set(
    externalMembers.map((m) => ((m.email || '').trim() || `${m.name}|${m.role}`).toLowerCase())
  )
  const availableContractors = contractors.filter((c) => {
    const key = ((c.email || '').trim() || `${c.name}|${c.trade}`).toLowerCase()
    return !addedSubKeys.has(key)
  })

  function addFromRoster(employeeId: string) {
    const emp = employeeMap.get(employeeId)
    if (!emp) return
    const color = PHASE_COLORS[team.length % PHASE_COLORS.length]
    const newMember: WizardTeamMemberRoster = {
      type: 'roster',
      id: uid(),
      employee_id: emp.id,
      role_on_job: '',
      color,
    }
    onChange('team', [...team, newMember])
  }

  function addFromDirectory(contractor: Contractor) {
    const color = PHASE_COLORS[team.length % PHASE_COLORS.length]
    const newMember: WizardTeamMemberExternal = {
      type: 'external',
      id: uid(),
      name: contractor.name || '',
      role: contractor.trade || '',
      email: contractor.email || '',
      color,
    }
    onChange('team', [...team, newMember])
  }

  function addExternal() {
    const color = PHASE_COLORS[team.length % PHASE_COLORS.length]
    const newMember: WizardTeamMemberExternal = {
      type: 'external',
      id: uid(),
      name: '',
      role: '',
      email: '',
      color,
    }
    onChange('team', [...team, newMember])
  }

  function updateRosterMember(id: string, field: 'role_on_job', val: string) {
    onChange(
      'team',
      team.map((m) =>
        m.id === id && isRoster(m) ? { ...m, [field]: val } : m
      )
    )
  }

  function updateExternalMember(
    id: string,
    field: keyof WizardTeamMemberExternal,
    val: string
  ) {
    onChange(
      'team',
      team.map((m) =>
        m.id === id && isExternal(m) ? { ...m, [field]: val } : m
      )
    )
  }

  function removeMember(id: string) {
    onChange('team', team.filter((m) => m.id !== id))
  }

  const displayName = (m: WizardTeamMember): string => {
    if (isRoster(m)) return employeeMap.get(m.employee_id)?.name ?? m.employee_id
    return m.name || '—'
  }

  const initials = (m: WizardTeamMember): string => {
    const name = displayName(m)
    if (!name || name === '—') return '?'
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    padding: '12px 14px',
    background: '#f8fafc',
    borderRadius: 11,
    border: '1.5px solid #e2e8f0',
  }
  const avatarStyle = (color: string): React.CSSProperties => ({
    width: 36,
    height: 36,
    borderRadius: 10,
    background: color,
    color: '#fff',
    fontSize: 12,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  })
  const removeBtnStyle: React.CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: 7,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: '#cbd5e1',
  }
  const selectStyle: React.CSSProperties = {
    border: '1.5px solid #e2e8f0',
    borderRadius: 7,
    padding: '6px 10px',
    fontSize: 13,
    minWidth: 180,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* --- Employees --- */}
      <h3 style={sectionTitleFirst}>Employees</h3>
      <p style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
        Add people from your Roster (Teams). They can be assigned to this project and clock in.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <select
          value=""
          onChange={(e) => {
            const v = e.target.value
            if (v) addFromRoster(v)
            e.target.value = ''
          }}
          disabled={rosterLoading || availableEmployees.length === 0}
          style={selectStyle}
        >
          <option value="">
            {rosterLoading
              ? 'Loading roster…'
              : availableEmployees.length === 0
                ? 'No roster employees (or all added)'
                : 'Add from Roster…'}
          </option>
          {availableEmployees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} {e.role ? `(${e.role})` : ''}
            </option>
          ))}
        </select>
      </div>
      {rosterMembers.length === 0 ? (
        <div style={{ ...rowStyle, opacity: 0.8 }}>
          <span style={{ fontSize: 13, color: '#64748b' }}>No employees added yet. Use the dropdown above.</span>
        </div>
      ) : (
        rosterMembers.map((m) => (
          <div key={m.id} style={rowStyle}>
            <div style={avatarStyle(m.color)}>{initials(m)}</div>
            <div style={{ flex: 1, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{displayName(m)}</span>
              <select
                value={m.role_on_job ?? ''}
                onChange={(e) => updateRosterMember(m.id, 'role_on_job', e.target.value)}
                style={{ flex: '1 1 140px', ...selectStyle }}
              >
                <option value="">Select role</option>
                {ROLE_OPTS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>From Roster</span>
            </div>
            <button type="button" onClick={() => removeMember(m.id)} style={removeBtnStyle} aria-label="Remove">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))
      )}

      {/* --- Subcontractors --- */}
      <h3 style={sectionTitleStyle}>Subcontractors</h3>
      <p style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
        Add from your Directory (contractors/companies you’ve saved) or enter details manually.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <select
          value=""
          onChange={(e) => {
            const id = e.target.value
            if (id) {
              const c = contractors.find((x) => x.id === id)
              if (c) addFromDirectory(c)
              e.target.value = ''
            }
          }}
          disabled={directoryLoading || availableContractors.length === 0}
          style={selectStyle}
        >
          <option value="">
            {directoryLoading
              ? 'Loading directory…'
              : availableContractors.length === 0
                ? 'No directory contractors (or all added)'
                : 'Add from Directory…'}
          </option>
          {availableContractors.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.trade ? `(${c.trade})` : ''}
            </option>
          ))}
        </select>
        <span style={{ fontSize: 13, color: '#94a3b8' }}>or</span>
        <AddBtn label="Add external (name / trade / email)" onClick={addExternal} />
      </div>
      {externalMembers.length === 0 ? (
        <div style={{ ...rowStyle, opacity: 0.8 }}>
          <span style={{ fontSize: 13, color: '#64748b' }}>No subcontractors added yet. Use the dropdown or button above.</span>
        </div>
      ) : (
        externalMembers.map((m) => (
          <div key={m.id} style={rowStyle}>
            <div style={avatarStyle(m.color)}>{initials(m)}</div>
            <div style={{ flex: 1, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                value={m.name}
                onChange={(e) => updateExternalMember(m.id, 'name', e.target.value)}
                placeholder="Name"
                style={{ flex: '1 1 120px', ...selectStyle }}
              />
              <select
                value={m.role}
                onChange={(e) => updateExternalMember(m.id, 'role', e.target.value)}
                style={{ flex: '1 1 120px', ...selectStyle }}
              >
                <option value="">Trade</option>
                {SUBCONTRACTOR_TRADE_OPTS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <input
                value={m.email}
                onChange={(e) => updateExternalMember(m.id, 'email', e.target.value)}
                placeholder="Email"
                style={{ flex: '1 1 140px', ...selectStyle }}
              />
            </div>
            <button type="button" onClick={() => removeMember(m.id)} style={removeBtnStyle} aria-label="Remove">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))
      )}
    </div>
  )
}
