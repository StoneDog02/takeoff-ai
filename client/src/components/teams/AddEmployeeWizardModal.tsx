import { useState, useEffect } from 'react'
import { teamsApi, getProjectsList } from '@/api/teamsClient'
import type { Employee, Project } from '@/types/global'
import { EMPLOYEE_TRADE_ROLE_OPTIONS } from '@/components/teams/employeeTradeRoleOptions'

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const TRADES = EMPLOYEE_TRADE_ROLE_OPTIONS
const EMP_TYPES = ['Full-time (W-2)', 'Part-time (W-2)', '1099 Contractor', 'Subcontractor']
const PAY_SCHEDULES = ['Weekly', 'Bi-weekly', 'Semi-monthly', 'Monthly']
const APP_ROLES = [
  { value: 'field', label: 'Field Crew', desc: 'Clock in/out, view assigned job only' },
  { value: 'pm', label: 'Project Manager', desc: 'View all projects, manage schedules' },
  { value: 'admin', label: 'Admin', desc: 'Full access to all data and settings' },
] as const
const CERTS = ['OSHA 10', 'OSHA 30', 'First Aid / CPR', 'Forklift Certified', 'Driver\'s License', 'CDL', 'Lead Safe Certified', 'Asbestos Awareness', 'Scaffold Safety', 'Electrical License', 'Plumbing License', 'Welding Cert']

const STEPS = [
  { id: 1, label: 'Basic Info', icon: '👤' },
  { id: 2, label: 'Contact', icon: '📞' },
  { id: 3, label: 'Compensation', icon: '💵' },
  { id: 4, label: 'Access', icon: '🔑' },
  { id: 5, label: 'Review', icon: '✓' },
] as const

type StepId = (typeof STEPS)[number]['id']

// ─── WIZARD FIELD (reusable) ──────────────────────────────────────────────────
function WizardField({
  label,
  required,
  children,
  hint,
  error,
  half,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
  hint?: string
  error?: string
  half?: boolean
}) {
  return (
    <div
      className="teams-form-row"
      style={{ gridColumn: half ? undefined : '1 / -1', marginBottom: 16 }}
    >
      <label className="teams-label" style={{ color: error ? 'var(--red)' : undefined }}>
        {label}
        {required && <span style={{ color: 'var(--red)', marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {hint && !error && <div className="teams-muted" style={{ marginTop: 4, fontSize: 11 }}>{hint}</div>}
      {error && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>⚠ {error}</div>}
    </div>
  )
}

// ─── STEP BAR ──────────────────────────────────────────────────────────────────
function StepBar({ current }: { current: number }) {
  return (
    <div
      className="flex items-center justify-center gap-1 border-b border-[var(--border)] flex-shrink-0"
      style={{ padding: '20px 32px 24px', flexWrap: 'wrap' }}
    >
      {STEPS.map((step, i) => {
        const done = step.id < current
        const active = step.id === current
        const upcoming = step.id > current
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className="flex items-center justify-center rounded-full border-2 transition-all"
                style={{
                  width: 34,
                  height: 34,
                  background: done ? 'var(--red)' : active ? 'var(--bg-surface)' : 'var(--color-surface)',
                  borderColor: done ? 'var(--red)' : active ? 'var(--red)' : 'var(--border)',
                  fontSize: 14,
                }}
              >
                {done ? (
                  <span className="font-bold text-white text-[13px]">✓</span>
                ) : (
                  <span style={{ opacity: upcoming ? 0.4 : 1 }}>{step.icon}</span>
                )}
              </div>
              <span
                className="text-[10px] font-medium whitespace-nowrap"
                style={{
                  fontWeight: active ? 700 : 500,
                  color: active ? 'var(--red)' : done ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="h-0.5 flex-shrink-0 mx-1.5 mb-4 transition-colors"
                style={{ width: 60, background: done ? 'var(--red)' : 'var(--border)' }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── REVIEW SECTION ─────────────────────────────────────────────────────────────
function ReviewSection({
  title,
  onEdit,
  stepId,
  children,
}: {
  title: string
  onEdit: (step: StepId) => void
  stepId: StepId
  children: React.ReactNode
}) {
  return (
    <div
      className="rounded-xl mb-3.5"
      style={{ background: 'var(--color-surface)', padding: '16px 18px' }}
    >
      <div className="flex justify-between items-center mb-3">
        <span className="teams-label">{title}</span>
        <button
          type="button"
          onClick={() => onEdit(stepId)}
          className="teams-btn teams-btn-ghost text-[11px] font-semibold p-0 border-0"
          style={{ color: 'var(--red)' }}
        >
          Edit →
        </button>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">{children}</div>
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="teams-muted text-[10px] mb-0.5">{label}</div>
      <div className="text-[13px] font-medium" style={{ color: value ? 'var(--text-primary)' : 'var(--text-muted)' }}>
        {value || '—'}
      </div>
    </div>
  )
}

// ─── MODAL ────────────────────────────────────────────────────────────────────
export interface AddEmployeeWizardForm {
  firstName: string
  lastName: string
  role: string
  trade: string
  empType: string
  startDate: string
  status: 'active' | 'inactive'
  email: string
  phone: string
  altPhone: string
  address: string
  city: string
  state: string
  zip: string
  emergencyName: string
  emergencyRelation: string
  emergencyPhone: string
  payType: 'hourly' | 'salary'
  payRate: string
  salaryAnnual: string
  paySchedule: string
  overtimeEligible: boolean
  allowanceNotes: string
  inviteToPortal: boolean
  appRole: string
  assignJob: string
  certs: string[]
  employeeId: string
}

const initialForm: AddEmployeeWizardForm = {
  firstName: '',
  lastName: '',
  role: '',
  trade: '',
  empType: 'Full-time (W-2)',
  startDate: '',
  status: 'active',
  email: '',
  phone: '',
  altPhone: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  emergencyName: '',
  emergencyRelation: '',
  emergencyPhone: '',
  payType: 'hourly',
  payRate: '',
  salaryAnnual: '',
  paySchedule: 'Bi-weekly',
  overtimeEligible: true,
  allowanceNotes: '',
  inviteToPortal: true,
  appRole: 'field',
  assignJob: '',
  certs: [],
  employeeId: 'EMP-' + String(Math.floor(Math.random() * 900) + 100),
}

interface AddEmployeeWizardModalProps {
  onClose: () => void
  onSuccess: (employee: Employee, inviteSent: boolean) => void
}

export function AddEmployeeWizardModal({ onClose, onSuccess }: AddEmployeeWizardModalProps) {
  const [step, setStep] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)
  const [createdEmployee, setCreatedEmployee] = useState<Employee | null>(null)
  const [inviteSent, setInviteSent] = useState(false)
  const [form, setForm] = useState<AddEmployeeWizardForm>(initialForm)
  const [jobs, setJobs] = useState<Project[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    getProjectsList().then(setJobs).catch(() => setJobs([]))
  }, [])

  const set = (key: keyof AddEmployeeWizardForm, val: string | boolean) =>
    setForm((f) => ({ ...f, [key]: val }))
  const toggleCert = (cert: string) =>
    setForm((f) => ({
      ...f,
      certs: f.certs.includes(cert) ? f.certs.filter((c) => c !== cert) : [...f.certs, cert],
    }))

  const validate = (s: number): Record<string, string> => {
    const e: Record<string, string> = {}
    if (s === 1) {
      if (!form.firstName.trim()) e.firstName = 'Required'
      if (!form.lastName.trim()) e.lastName = 'Required'
      if (!form.role.trim()) e.role = 'Required'
      if (!form.startDate) e.startDate = 'Required'
    }
    if (s === 2) {
      if (!form.email.trim()) e.email = 'Required'
      else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email'
      if (!form.phone.trim()) e.phone = 'Required'
      if (form.emergencyName && !form.emergencyPhone) e.emergencyPhone = 'Phone required if name is set'
    }
    if (s === 3) {
      if (form.payType === 'hourly' && !form.payRate) e.payRate = 'Required'
      if (form.payType === 'salary' && !form.salaryAnnual) e.salaryAnnual = 'Required'
    }
    return e
  }

  const next = () => {
    const e = validate(step)
    if (Object.keys(e).length) {
      setErrors(e)
      return
    }
    setErrors({})
    setStep((s) => s + 1)
  }

  const back = () => {
    setErrors({})
    setStep((s) => s - 1)
  }

  const goTo = (s: StepId) => {
    setErrors({})
    setStep(s)
  }

  const handleAddEmployee = async () => {
    const e = validate(5)
    if (Object.keys(e).length) {
      setErrors(e)
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const name = [form.firstName.trim(), form.lastName.trim()].filter(Boolean).join(' ') || form.role || 'Employee'
      const status = form.status === 'active' ? 'on_site' : 'off'
      const current_compensation =
        form.payType === 'hourly'
          ? (form.payRate ? Number(form.payRate) : null)
          : form.salaryAnnual
            ? Math.round((Number(form.salaryAnnual) / 2080) * 100) / 100
            : null

      const created = await teamsApi.employees.create({
        name,
        role: form.role.trim() || form.trade || '',
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        status,
        current_compensation: current_compensation ?? undefined,
      })
      setCreatedEmployee(created)

      let sent = false
      if (form.inviteToPortal && form.email) {
        try {
          const inviteRes = await teamsApi.employees.invite(created.id)
          sent = inviteRes.invite_email_sent === true
        } catch {
          // invite failed; employee still created
        }
      }
      setInviteSent(sent)

      if (form.assignJob && form.assignJob.trim()) {
        try {
          await teamsApi.jobAssignments.create({
            employee_id: created.id,
            job_id: form.assignJob.trim(),
          })
        } catch {
          // assignment failed; employee still created
        }
      }

      setSaved(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to add employee')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddAnother = () => {
    setForm({ ...initialForm, employeeId: 'EMP-' + String(Math.floor(Math.random() * 900) + 100) })
    setStep(1)
    setErrors({})
    setSaved(false)
    setCreatedEmployee(null)
    setInviteSent(false)
    setSubmitError(null)
  }

  const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }

  // ─── SUCCESS VIEW ───────────────────────────────────────────────────────────
  if (saved && createdEmployee) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-employee-wizard-title"
      >
        <div
          className="dashboard-app rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-lg max-w-md w-full p-8 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl mx-auto mb-5"
            style={{ background: 'var(--red-glow)', color: 'var(--red)' }}
          >
            ✓
          </div>
          <h2 id="add-employee-wizard-title" className="teams-section-heading text-xl mb-2">
            Employee Added
          </h2>
          <p className="teams-muted text-sm mb-2">
            {form.firstName} {form.lastName} has been added as {form.role || form.trade || 'team member'}.
          </p>
          {inviteSent && (
            <p className="text-sm mb-6" style={{ color: 'var(--green)' }}>
              Portal invitation sent to {form.email}
            </p>
          )}
          <div className="flex gap-2 justify-center flex-wrap">
            <button type="button" className="teams-btn teams-btn-ghost" onClick={handleAddAnother}>
              Add Another
            </button>
            <button type="button" className="teams-btn teams-btn-primary" onClick={() => onSuccess(createdEmployee, inviteSent)}>
              View {form.firstName}'s Profile
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── WIZARD VIEW ─────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-employee-wizard-title"
    >
      <div
        className="dashboard-app rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-xl w-full max-w-[720px] my-8 overflow-hidden flex flex-col"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-2 border-b border-[var(--border)] flex-shrink-0">
          <h1 id="add-employee-wizard-title" className="teams-section-heading text-lg m-0">
            Add New Employee
          </h1>
          <button
            type="button"
            onClick={onClose}
            className="teams-btn teams-btn-ghost p-2 rounded-full"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <StepBar current={step} />

        <div className="flex-1 min-h-0 overflow-y-auto" style={{ padding: '32px 40px' }}>
          {submitError && (
            <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: 'var(--red-glow-soft)', color: 'var(--red)' }}>
              {submitError}
            </div>
          )}

          {/* STEP 1: Basic Info */}
          {step === 1 && (
            <div>
              <div className="mb-6">
                <div className="teams-section-heading text-base mb-1">Basic Information</div>
                <div className="teams-muted text-[13px]">Who are you adding to your team?</div>
              </div>

              <div
                className="flex items-center gap-4 mb-7 p-4 rounded-xl border border-[var(--border)] border-dashed"
                style={{ background: 'var(--color-surface)' }}
              >
                <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 teams-muted" style={{ background: 'var(--border)' }}>
                  👤
                </div>
                <div>
                  <div className="text-[13px] font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Profile Photo</div>
                  <div className="teams-muted text-[11px] mb-2">Optional. JPG or PNG, max 5MB.</div>
                  <button type="button" className="teams-btn teams-btn-ghost text-[11px] py-1.5 px-3.5">
                    Upload Photo
                  </button>
                </div>
              </div>

              <div style={{ ...grid2, marginBottom: 16 }}>
                <WizardField label="First Name" required error={errors.firstName} half>
                  <input
                    type="text"
                    className="teams-input"
                    value={form.firstName}
                    onChange={(e) => set('firstName', e.target.value)}
                    placeholder="Marcus"
                  />
                </WizardField>
                <WizardField label="Last Name" required error={errors.lastName} half>
                  <input
                    type="text"
                    className="teams-input"
                    value={form.lastName}
                    onChange={(e) => set('lastName', e.target.value)}
                    placeholder="Rivera"
                  />
                </WizardField>
              </div>

              <div style={{ ...grid2, marginBottom: 16 }}>
                <WizardField label="Job Title / Role" required error={errors.role} hint="e.g. Lead Carpenter" half>
                  <input
                    type="text"
                    className="teams-input"
                    value={form.role}
                    onChange={(e) => set('role', e.target.value)}
                    placeholder="Lead Carpenter"
                  />
                </WizardField>
                <WizardField label="Trade / Specialty" half>
                  <select
                    className="teams-input teams-select"
                    value={form.trade}
                    onChange={(e) => set('trade', e.target.value)}
                  >
                    <option value="">Select trade…</option>
                    {TRADES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </WizardField>
              </div>

              <div style={{ ...grid2, marginBottom: 16 }}>
                <WizardField label="Employment Type" half>
                  <select
                    className="teams-input teams-select"
                    value={form.empType}
                    onChange={(e) => set('empType', e.target.value)}
                  >
                    {EMP_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </WizardField>
                <WizardField label="Start Date" required error={errors.startDate} half>
                  <input
                    type="date"
                    className="teams-input"
                    value={form.startDate}
                    onChange={(e) => set('startDate', e.target.value)}
                  />
                </WizardField>
              </div>

              <WizardField label="Status">
                <div className="flex gap-2">
                  {(['active', 'inactive'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => set('status', s)}
                      className="teams-btn flex-1"
                      style={{
                        borderWidth: 2,
                        borderColor: form.status === s ? (s === 'active' ? 'var(--green)' : 'var(--red)') : 'var(--border)',
                        background: form.status === s ? (s === 'active' ? 'var(--green-glow)' : 'var(--red-glow-soft)') : 'var(--bg-surface)',
                        color: form.status === s ? (s === 'active' ? 'var(--green)' : 'var(--red)') : 'var(--text-muted)',
                        fontWeight: form.status === s ? 600 : 400,
                        textTransform: 'capitalize',
                      }}
                    >
                      {s === 'active' ? '✓ Active' : '⊘ Inactive'}
                    </button>
                  ))}
                </div>
              </WizardField>

              <div className="mt-5 py-2.5 px-3.5 rounded-lg flex justify-between items-center" style={{ background: 'var(--color-surface)' }}>
                <span className="teams-muted text-[11px]">Auto-assigned Employee ID</span>
                <span className="text-xs font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{form.employeeId}</span>
              </div>
            </div>
          )}

          {/* STEP 2: Contact */}
          {step === 2 && (
            <div>
              <div className="mb-6">
                <div className="teams-section-heading text-base mb-1">Contact Information</div>
                <div className="teams-muted text-[13px]">How do you reach them? Also used for portal invites.</div>
              </div>

              <div className="teams-label mb-3.5 pb-2 border-b border-[var(--border)]">Primary Contact</div>
              <div style={{ ...grid2, marginBottom: 16 }}>
                <WizardField label="Email Address" required error={errors.email} hint="Used for portal access" half>
                  <input
                    type="email"
                    className="teams-input"
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    placeholder="m.rivera@email.com"
                  />
                </WizardField>
                <WizardField label="Mobile Phone" required error={errors.phone} half>
                  <input
                    type="tel"
                    className="teams-input"
                    value={form.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    placeholder="801-555-0192"
                  />
                </WizardField>
              </div>
              <div style={{ marginBottom: 24 }}>
                <WizardField label="Alternate Phone" hint="Optional">
                  <input
                    type="tel"
                    className="teams-input"
                    value={form.altPhone}
                    onChange={(e) => set('altPhone', e.target.value)}
                    placeholder="801-555-0000"
                    style={{ maxWidth: '50%' }}
                  />
                </WizardField>
              </div>

              <div className="teams-label mb-3.5 pb-2 border-b border-[var(--border)]">Home Address <span className="font-normal normal-case text-[10px]">— optional</span></div>
              <div style={{ marginBottom: 16 }}>
                <WizardField label="Street Address">
                  <input
                    type="text"
                    className="teams-input"
                    value={form.address}
                    onChange={(e) => set('address', e.target.value)}
                    placeholder="123 Main Street"
                  />
                </WizardField>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16, marginBottom: 28 }}>
                <WizardField label="City" half>
                  <input
                    type="text"
                    className="teams-input"
                    value={form.city}
                    onChange={(e) => set('city', e.target.value)}
                    placeholder="Salt Lake City"
                  />
                </WizardField>
                <WizardField label="State" half>
                  <input
                    type="text"
                    className="teams-input"
                    value={form.state}
                    onChange={(e) => set('state', e.target.value)}
                    placeholder="UT"
                  />
                </WizardField>
                <WizardField label="Zip" half>
                  <input
                    type="text"
                    className="teams-input"
                    value={form.zip}
                    onChange={(e) => set('zip', e.target.value)}
                    placeholder="84101"
                  />
                </WizardField>
              </div>

              <div className="teams-label mb-3.5 pb-2 border-b border-[var(--border)]">Emergency Contact</div>
              <div style={{ ...grid2, marginBottom: 16 }}>
                <WizardField label="Full Name" half>
                  <input
                    type="text"
                    className="teams-input"
                    value={form.emergencyName}
                    onChange={(e) => set('emergencyName', e.target.value)}
                    placeholder="Jane Rivera"
                  />
                </WizardField>
                <WizardField label="Relationship" half>
                  <input
                    type="text"
                    className="teams-input"
                    value={form.emergencyRelation}
                    onChange={(e) => set('emergencyRelation', e.target.value)}
                    placeholder="Spouse, Parent, etc."
                  />
                </WizardField>
              </div>
              <WizardField label="Emergency Phone" error={errors.emergencyPhone}>
                <input
                  type="tel"
                  className="teams-input"
                  value={form.emergencyPhone}
                  onChange={(e) => set('emergencyPhone', e.target.value)}
                  placeholder="801-555-9999"
                  style={{ maxWidth: '50%' }}
                />
              </WizardField>
            </div>
          )}

          {/* STEP 3: Compensation */}
          {step === 3 && (
            <div>
              <div className="mb-6">
                <div className="teams-section-heading text-base mb-1">Compensation</div>
                <div className="teams-muted text-[13px]">Starting pay rate and schedule. You can update this anytime from their profile.</div>
              </div>

              <WizardField label="Pay Type">
                <div className="flex gap-2 mb-5">
                  {(['hourly', 'salary'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => set('payType', v)}
                      className="teams-btn flex-1"
                      style={{
                        borderWidth: 2,
                        borderColor: form.payType === v ? 'var(--red)' : 'var(--border)',
                        background: form.payType === v ? 'var(--red-glow-soft)' : 'var(--bg-surface)',
                        color: form.payType === v ? 'var(--red)' : 'var(--text-muted)',
                        fontWeight: form.payType === v ? 700 : 400,
                      }}
                    >
                      {v === 'hourly' ? 'Hourly' : 'Salary'}
                    </button>
                  ))}
                </div>
              </WizardField>

              {form.payType === 'hourly' ? (
                <div style={{ ...grid2, marginBottom: 16 }}>
                  <WizardField label="Base Rate (per hour)" required error={errors.payRate} hint="Starting rate" half>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 teams-muted text-sm font-semibold">$</span>
                      <input
                        type="number"
                        step="0.01"
                        className="teams-input w-full"
                        value={form.payRate}
                        onChange={(e) => set('payRate', e.target.value)}
                        placeholder="32.00"
                        style={{ paddingLeft: 26 }}
                      />
                    </div>
                  </WizardField>
                  <WizardField label="Overtime Eligible" hint="FLSA non-exempt" half>
                    <div className="flex gap-2">
                      {([true, false] as const).map((v) => (
                        <button
                          key={String(v)}
                          type="button"
                          onClick={() => set('overtimeEligible', v)}
                          className="teams-btn flex-1 text-[11px] py-2.5"
                          style={{
                            borderWidth: 2,
                            borderColor: form.overtimeEligible === v ? 'var(--red)' : 'var(--border)',
                            background: form.overtimeEligible === v ? 'var(--red-glow-soft)' : 'var(--bg-surface)',
                            color: form.overtimeEligible === v ? 'var(--red)' : 'var(--text-muted)',
                            fontWeight: form.overtimeEligible === v ? 700 : 400,
                          }}
                        >
                          {v ? 'Yes — OT after 40h' : 'No — Exempt'}
                        </button>
                      ))}
                    </div>
                  </WizardField>
                </div>
              ) : (
                <div style={{ ...grid2, marginBottom: 16 }}>
                  <WizardField label="Annual Salary" required error={errors.salaryAnnual} half>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 teams-muted text-sm font-semibold">$</span>
                      <input
                        type="number"
                        className="teams-input w-full"
                        value={form.salaryAnnual}
                        onChange={(e) => set('salaryAnnual', e.target.value)}
                        placeholder="85000"
                        style={{ paddingLeft: 26 }}
                      />
                    </div>
                  </WizardField>
                  {form.salaryAnnual && (
                    <div className="flex items-center">
                      <div className="rounded-lg py-2.5 px-3.5 w-full" style={{ background: 'var(--color-surface)' }}>
                        <div className="teams-muted text-[10px] mb-1">Effective hourly (est.)</div>
                        <div className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                          ${(Number(form.salaryAnnual) / 2080).toFixed(2)}/hr
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <WizardField label="Pay Schedule" hint="How often is this employee paid?">
                <div className="flex gap-2 flex-wrap">
                  {PAY_SCHEDULES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => set('paySchedule', s)}
                      className="teams-btn flex-1 min-w-0 text-[11px] py-2"
                      style={{
                        borderWidth: 2,
                        borderColor: form.paySchedule === s ? 'var(--red)' : 'var(--border)',
                        background: form.paySchedule === s ? 'var(--red-glow-soft)' : 'var(--bg-surface)',
                        color: form.paySchedule === s ? 'var(--red)' : 'var(--text-muted)',
                        fontWeight: form.paySchedule === s ? 700 : 400,
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </WizardField>

              <div className="mt-5">
                <WizardField label="Compensation Notes" hint="Mileage, per diem, tool allowance — optional">
                  <textarea
                    className="teams-input w-full resize-y"
                    value={form.allowanceNotes}
                    onChange={(e) => set('allowanceNotes', e.target.value)}
                    placeholder="e.g. $40/day mileage"
                    rows={2}
                  />
                </WizardField>
              </div>

              {(form.payRate || form.salaryAnnual) && (
                <div
                  className="mt-5 py-3.5 px-4 rounded-xl flex justify-between items-center"
                  style={{ background: 'var(--text-primary)', color: 'var(--bg-surface)' }}
                >
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-1">Starting Compensation</div>
                    <div className="text-xl font-semibold">
                      {form.payType === 'hourly' ? `$${form.payRate}/hr` : `$${Number(form.salaryAnnual || 0).toLocaleString()}/yr`}
                    </div>
                  </div>
                  <div className="text-right text-[11px] opacity-80">
                    <div>{form.paySchedule} pay</div>
                    {form.payType === 'hourly' && <div>{form.overtimeEligible ? 'OT eligible' : 'Exempt'}</div>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Access */}
          {step === 4 && (
            <div>
              <div className="mb-6">
                <div className="teams-section-heading text-base mb-1">Access & Assignment</div>
                <div className="teams-muted text-[13px]">Portal access, certifications, and initial job assignment.</div>
              </div>

              <div className="mb-6">
                <div className="teams-label mb-3.5 pb-2 border-b border-[var(--border)]">Portal Access</div>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => set('inviteToPortal', !form.inviteToPortal)}
                  onKeyDown={(e) => e.key === 'Enter' && set('inviteToPortal', !form.inviteToPortal)}
                  className="flex items-center gap-3.5 p-3.5 rounded-xl cursor-pointer transition-all border-2"
                  style={{
                    background: form.inviteToPortal ? 'var(--red-glow-soft)' : 'var(--color-surface)',
                    borderColor: form.inviteToPortal ? 'var(--red)' : 'var(--border)',
                  }}
                >
                  <div
                    className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0"
                    style={{
                      borderColor: form.inviteToPortal ? 'var(--red)' : 'var(--border)',
                      background: form.inviteToPortal ? 'var(--red)' : 'var(--bg-surface)',
                    }}
                  >
                    {form.inviteToPortal && <span className="text-white text-xs font-bold">✓</span>}
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>Send portal invitation</div>
                    <div className="teams-muted text-[11px]">Email invite to {form.email || 'their email'} so they can clock in, view schedule, and more.</div>
                  </div>
                </div>

                {form.inviteToPortal && (
                  <div style={{ marginTop: 14 }}>
                  <WizardField label="App Permission Level">
                    <div className="flex flex-col gap-2">
                      {APP_ROLES.map((r) => (
                        <div
                          key={r.value}
                          role="button"
                          tabIndex={0}
                          onClick={() => set('appRole', r.value)}
                          onKeyDown={(e) => e.key === 'Enter' && set('appRole', r.value)}
                          className="flex items-center gap-3 p-3 rounded-lg cursor-pointer border-2 transition-all"
                          style={{
                            borderColor: form.appRole === r.value ? 'var(--red)' : 'var(--border)',
                            background: form.appRole === r.value ? 'var(--red-glow-soft)' : 'var(--bg-surface)',
                          }}
                        >
                          <div
                            className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                            style={{
                              borderColor: form.appRole === r.value ? 'var(--red)' : 'var(--border)',
                              background: form.appRole === r.value ? 'var(--red)' : 'var(--bg-surface)',
                            }}
                          >
                            {form.appRole === r.value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <div>
                            <div className="text-[13px] font-semibold" style={{ color: form.appRole === r.value ? 'var(--red)' : 'var(--text-primary)' }}>{r.label}</div>
                            <div className="teams-muted text-[11px]">{r.desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </WizardField>
                </div>
                )}
              </div>

              <div className="mb-6">
                <div className="teams-label mb-3.5 pb-2 border-b border-[var(--border)]">Initial Job Assignment <span className="font-normal normal-case text-[10px]">— optional</span></div>
                <WizardField label="Assign to Job" hint="You can assign or reassign later">
                  <select
                    className="teams-input teams-select"
                    value={form.assignJob}
                    onChange={(e) => set('assignJob', e.target.value)}
                  >
                    <option value="">No assignment yet</option>
                    {jobs.map((j) => (
                      <option key={j.id} value={j.id}>{j.name}</option>
                    ))}
                  </select>
                </WizardField>
              </div>

              <div>
                <div className="teams-label mb-3.5 pb-2 border-b border-[var(--border)]">Certifications & Licenses <span className="font-normal normal-case text-[10px]">— select all that apply</span></div>
                <div className="flex flex-wrap gap-2">
                  {CERTS.map((cert) => {
                    const active = form.certs.includes(cert)
                    return (
                      <button
                        key={cert}
                        type="button"
                        onClick={() => toggleCert(cert)}
                        className="teams-btn py-1.5 px-3.5 text-[11px] rounded-full"
                        style={{
                          borderWidth: 2,
                          borderColor: active ? 'var(--red)' : 'var(--border)',
                          background: active ? 'var(--red-glow-soft)' : 'var(--bg-surface)',
                          color: active ? 'var(--red)' : 'var(--text-muted)',
                          fontWeight: active ? 600 : 400,
                        }}
                      >
                        {active && '✓ '}{cert}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Review */}
          {step === 5 && (
            <div>
              <div className="mb-6">
                <div className="teams-section-heading text-base mb-1">Review & Confirm</div>
                <div className="teams-muted text-[13px]">Double-check everything before adding this employee.</div>
              </div>

              <div
                className="flex items-center gap-4 p-4 rounded-xl mb-5"
                style={{ background: 'var(--color-surface)' }}
              >
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center text-base font-bold flex-shrink-0"
                  style={{ background: 'var(--red-glow)', color: 'var(--red)' }}
                >
                  {(form.firstName[0] || '') + (form.lastName[0] || '')}
                </div>
                <div className="min-w-0">
                  <div className="teams-section-heading text-base">{form.firstName} {form.lastName}</div>
                  <div className="teams-muted text-xs">{form.role} · {form.empType} · {form.employeeId}</div>
                </div>
                <span
                  className="ml-auto text-[10px] font-semibold py-1 px-2.5 rounded-full"
                  style={{ background: 'var(--green-glow)', color: 'var(--green)' }}
                >
                  {form.status === 'active' ? 'Active' : 'Inactive'}
                </span>
              </div>

              <ReviewSection title="Basic Info" onEdit={goTo} stepId={1}>
                <ReviewRow label="Start Date" value={form.startDate} />
                <ReviewRow label="Trade" value={form.trade || undefined} />
                <ReviewRow label="Emp. Type" value={form.empType} />
                <ReviewRow label="Employee ID" value={form.employeeId} />
              </ReviewSection>

              <ReviewSection title="Contact" onEdit={goTo} stepId={2}>
                <ReviewRow label="Email" value={form.email} />
                <ReviewRow label="Phone" value={form.phone} />
                <ReviewRow label="Address" value={[form.address, form.city, form.state].filter(Boolean).join(', ') || undefined} />
                <ReviewRow label="Emergency" value={form.emergencyName ? `${form.emergencyName} (${form.emergencyRelation})` : undefined} />
              </ReviewSection>

              <ReviewSection title="Compensation" onEdit={goTo} stepId={3}>
                <ReviewRow label="Pay Type" value={form.payType === 'hourly' ? 'Hourly' : 'Salary'} />
                <ReviewRow label="Rate" value={form.payType === 'hourly' ? (form.payRate ? `$${form.payRate}/hr` : undefined) : (form.salaryAnnual ? `$${Number(form.salaryAnnual).toLocaleString()}/yr` : undefined)} />
                <ReviewRow label="Schedule" value={form.paySchedule} />
                <ReviewRow label="Overtime" value={form.payType === 'hourly' ? (form.overtimeEligible ? 'Eligible' : 'Exempt') : 'N/A'} />
              </ReviewSection>

              <ReviewSection title="Access & Assignment" onEdit={goTo} stepId={4}>
                <ReviewRow label="Portal Invite" value={form.inviteToPortal ? `Yes → ${form.email}` : 'Not invited'} />
                <ReviewRow label="App Role" value={APP_ROLES.find((r) => r.value === form.appRole)?.label} />
                <ReviewRow label="Job Assignment" value={form.assignJob ? jobs.find((j) => j.id === form.assignJob)?.name : 'None'} />
                <ReviewRow label="Certifications" value={form.certs.length ? form.certs.join(', ') : 'None selected'} />
              </ReviewSection>
            </div>
          )}
        </div>

        {/* Footer buttons — always visible, outside scroll */}
        <div
          className="flex justify-between items-center flex-shrink-0 border-t border-[var(--border)]"
          style={{ padding: '20px 40px 32px' }}
        >
            <button
              type="button"
              onClick={back}
              disabled={step === 1}
              className="teams-btn teams-btn-ghost"
              style={{ opacity: step === 1 ? 0.5 : 1, pointerEvents: step === 1 ? 'none' : 'auto' }}
            >
              ← Back
            </button>
            <div className="flex items-center gap-2">
              {step < 5 && (
                <button
                  type="button"
                  onClick={() => setStep(5)}
                  className="teams-btn teams-btn-ghost text-xs py-2 px-3"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Skip to Review
                </button>
              )}
              {step < 5 ? (
                <button type="button" onClick={next} className="teams-btn teams-btn-primary">
                  Continue →
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAddEmployee}
                    disabled={submitting}
                    className="teams-btn teams-btn-primary"
                  >
                    {submitting ? 'Adding…' : form.inviteToPortal ? 'Add Employee & Send Invite' : 'Add Employee'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
  )
}
