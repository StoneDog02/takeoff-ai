import { useState, useEffect, useRef } from 'react'
import { Shield, Lock, LogOut, Camera, Eye, EyeOff, Check } from 'lucide-react'
import { getMe } from '@/api/me'
import { teamsApi } from '@/api/teamsClient'
import { useEffectiveEmployee } from '@/hooks/useEffectiveEmployee'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'

const NOTIF_PREFS = [
  { id: 'shift_start', label: 'Shift reminders', desc: 'Reminder 15 min before scheduled start', defaultOn: true },
  { id: 'job_updates', label: 'Job updates', desc: 'When a PM posts updates to your job', defaultOn: true },
  { id: 'schedule', label: 'Schedule changes', desc: 'When your assignment or hours change', defaultOn: true },
  { id: 'payroll', label: 'Pay stubs available', desc: 'When a new pay stub is ready to view', defaultOn: false },
  { id: 'messages', label: 'New messages', desc: 'Direct messages from supervisors', defaultOn: true },
]

function Toggle({
  checked,
  onChange,
}: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`w-[42px] h-6 rounded-xl flex-shrink-0 relative transition-colors border ${
        checked ? 'bg-accent border-accent' : 'bg-black/10 dark:bg-white/10 border-border dark:border-border-dark'
      }`}
    >
      <span
        className="absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-left duration-200"
        style={{ left: checked ? 21 : 3 }}
      />
    </button>
  )
}

function Section({
  title,
  desc,
  children,
  delay = '0s',
}: { title: string; desc?: string; children: React.ReactNode; delay?: string }) {
  return (
    <div
      className="profile-fade-up rounded-[18px] border border-border dark:border-border-dark bg-white/60 dark:bg-white/5 overflow-hidden mb-3.5"
      style={{ animationDelay: delay }}
    >
      <div className="px-5 sm:px-6 py-4 border-b border-border dark:border-border-dark">
        <div className="text-[15px] font-extrabold tracking-tight text-gray-900 dark:text-landing-white">{title}</div>
        {desc && <div className="text-xs text-muted mt-1">{desc}</div>}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1.5">{children}</div>
  )
}

export function EmployeeProfilePage() {
  const { employeeId, employeeName, isPreview } = useEffectiveEmployee()
  const { employee: authEmployee } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)

  const [profile, setProfile] = useState<{ name: string; email: string; role: string; phone: string; created_at?: string } | null>(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notifs, setNotifs] = useState<Record<string, boolean>>(NOTIF_PREFS.reduce((a, n) => ({ ...a, [n.id]: n.defaultOn }), {}))
  const [showPass, setShowPass] = useState(false)
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' })
  const [passSaved, setPassSaved] = useState(false)
  const [passError, setPassError] = useState<string | null>(null)
  const [passSaving, setPassSaving] = useState(false)
  const [compactView, setCompactView] = useState(false)
  const [avatar, setAvatar] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const displayName = employeeName ?? authEmployee?.name ?? profile?.name ?? 'Employee'
  const displayRole = profile?.role ?? authEmployee?.role ?? ''
  const initials = (profile?.name ?? displayName).split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase() || 'EM'
  const avatarColor = '#047857'

  useEffect(() => {
    if (isPreview && employeeId) {
      teamsApi.employees.get(employeeId).then((emp) => {
        setProfile({
          name: emp.name,
          email: emp.email,
          role: emp.role,
          phone: emp.phone ?? '',
          created_at: emp.created_at,
        })
        setForm({ name: emp.name, email: emp.email, phone: emp.phone ?? '' })
      }).catch(() => setProfile(null))
      return
    }
    if (!isPreview) {
      getMe().then((me) => {
        if (me.type === 'employee' && me.employee) {
          const e = me.employee
          setProfile({
            name: e.name,
            email: e.email,
            role: e.role,
            phone: e.phone ?? '',
            created_at: e.updated_at,
          })
          setForm({ name: e.name, email: e.email, phone: e.phone ?? '' })
        }
      }).catch(() => {})
    }
  }, [employeeId, isPreview])

  const handleSave = async () => {
    if (!employeeId) return
    setSaving(true)
    setMessage(null)
    try {
      await teamsApi.employees.update(employeeId, { phone: form.phone })
      setProfile((p) => (p ? { ...p, phone: form.phone } : null))
      setSaved(true)
      setTimeout(() => setSaved(false), 2200)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handlePassSave = async () => {
    if (!passwords.next || passwords.next !== passwords.confirm) {
      setPassError('New passwords do not match.')
      return
    }
    if (passwords.next.length < 6) {
      setPassError('Password must be at least 6 characters.')
      return
    }
    setPassSaving(true)
    setPassError(null)
    try {
      const { error } = await supabase?.auth.updateUser({ password: passwords.next })
      if (error) throw error
      setPassSaved(true)
      setPasswords({ current: '', next: '', confirm: '' })
      setTimeout(() => setPassSaved(false), 2200)
    } catch (err) {
      setPassError(err instanceof Error ? err.message : 'Failed to update password')
    } finally {
      setPassSaving(false)
    }
  }

  const handleSignOut = async () => {
    await supabase?.auth.signOut()
    navigate('/sign-in', { replace: true })
  }

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '—'

  if (isPreview && !employeeId) {
    return (
      <div className="w-full max-w-[580px] mx-auto px-4 sm:px-6 py-10">
        <div className="rounded-xl border border-border dark:border-border-dark bg-white dark:bg-dark-3 shadow-card p-6 font-sora">
          <p className="text-muted text-sm">Preview mode: select an employee from Admin to see their profile.</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="w-full max-w-[580px] mx-auto px-4 sm:px-6 py-10">
        <div className="rounded-xl border border-border dark:border-border-dark bg-white dark:bg-dark-3 shadow-card p-6 font-sora">
          <p className="text-muted text-sm">Loading…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-[580px] mx-auto px-4 sm:px-6 py-10 pb-16 relative font-sora text-gray-900 dark:text-landing-white">
      <style>{`
        @keyframes fade-up-profile {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .profile-fade-up { animation: fade-up-profile 0.35s ease forwards; }
      `}</style>

      <div
        className="absolute inset-0 bg-[radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)] dark:bg-[radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)] bg-[size:28px_28px] pointer-events-none"
        aria-hidden
      />

      <div className="relative z-10">
        {/* Avatar hero */}
        <div className="profile-fade-up flex items-center gap-5 mb-8">
          <button
            type="button"
            className="relative cursor-pointer rounded-full focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 dark:focus:ring-offset-dark-3"
            onClick={() => fileRef.current?.click()}
          >
            <div
              className="w-[72px] h-[72px] rounded-full flex items-center justify-center text-2xl font-bold overflow-hidden border-[3px]"
              style={{
                background: avatar ? 'transparent' : `linear-gradient(135deg, ${avatarColor}, ${avatarColor}88)`,
                borderColor: `${avatarColor}44`,
              }}
            >
              {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : initials}
            </div>
            <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-accent border-2 border-white dark:border-dark-3 flex items-center justify-center">
              <Camera size={11} className="text-white" />
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) {
                  const r = new FileReader()
                  r.onload = (ev) => setAvatar(ev.target?.result as string)
                  r.readAsDataURL(f)
                }
              }}
            />
          </button>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight mb-1 text-gray-900 dark:text-landing-white">
              {profile.name}
            </h1>
            <div className="text-sm text-muted mb-2">{displayRole}</div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border dark:border-border-dark bg-black/5 dark:bg-white/5 px-3 py-1 text-xs text-muted">
              <Shield size={11} className="text-muted flex-shrink-0" />
              <span>Employer · Since {memberSince}</span>
            </div>
          </div>
        </div>

        {/* Contact info */}
        <Section title="Contact Info" desc="Your name, email, and phone as your employer sees them." delay="0.05s">
          <div className="flex flex-col gap-3.5 mb-4">
            <div>
              <Label>Full name</Label>
              <input
                value={form.name}
                readOnly
                className="w-full rounded-lg border border-border dark:border-border-dark bg-black/5 dark:bg-white/5 px-3.5 py-2.5 text-sm text-gray-900 dark:text-landing-white outline-none font-sora cursor-not-allowed"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <Label>Email address</Label>
                <input
                  type="email"
                  value={form.email}
                  readOnly
                  className="w-full rounded-lg border border-border dark:border-border-dark bg-black/5 dark:bg-white/5 px-3.5 py-2.5 text-sm text-gray-900 dark:text-landing-white outline-none font-sora cursor-not-allowed"
                />
              </div>
              <div>
                <Label>Phone number</Label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full rounded-lg border border-border dark:border-border-dark bg-white dark:bg-dark-4 px-3.5 py-2.5 text-sm text-gray-900 dark:text-landing-white outline-none font-sora focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </div>
            </div>
          </div>
          {message && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{message}</p>}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className={`inline-flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-bold transition-all ${
                saved
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  : 'bg-accent text-white border border-transparent hover:opacity-90 disabled:opacity-50'
              }`}
            >
              {saved ? <><Check size={14} /> Saved!</> : saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </Section>

        {/* Employment details (read-only) */}
        <Section title="Employment Details" desc="Set by your employer. Contact your PM to make changes." delay="0.08s">
          <div className="flex flex-col">
            {[
              { label: 'Employer', value: 'Your company' },
              { label: 'Role', value: profile.role },
              { label: 'Member since', value: memberSince },
            ].map(({ label, value }, i, arr) => (
              <div
                key={label}
                className={`flex justify-between items-center py-3 ${i < arr.length - 1 ? 'border-b border-border dark:border-border-dark' : ''}`}
              >
                <span className="text-sm text-muted">{label}</span>
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{value}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-border dark:border-border-dark bg-black/5 dark:bg-white/5 p-2.5">
            <Lock size={12} className="text-muted flex-shrink-0" />
            <span className="text-xs text-muted">These fields are managed by your employer and cannot be edited here.</span>
          </div>
        </Section>

        {/* Password */}
        <Section title="Password & Security" desc="Change your login password." delay="0.11s">
          <div className="flex flex-col gap-3 mb-4">
            {[
              { key: 'current' as const, label: 'Current password' },
              { key: 'next' as const, label: 'New password' },
              { key: 'confirm' as const, label: 'Confirm new password' },
            ].map(({ key, label }) => (
              <div key={key}>
                <Label>{label}</Label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={passwords[key]}
                    onChange={(e) => setPasswords((p) => ({ ...p, [key]: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-border dark:border-border-dark bg-white dark:bg-dark-4 px-3.5 py-2.5 pr-10 text-sm text-gray-900 dark:text-landing-white outline-none font-sora focus:border-accent focus:ring-2 focus:ring-accent/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            ))}
            {passwords.next.length > 0 && (
              <div>
                <div className="flex gap-1 mb-1">
                  {[1, 2, 3, 4].map((i) => {
                    const strength = Math.min(Math.floor(passwords.next.length / 3), 4)
                    const colors = ['#ef4444', '#f59e0b', '#60a5fa', '#22c55e']
                    return (
                      <div
                        key={i}
                        className="flex-1 h-0.5 rounded-sm transition-colors"
                        style={{
                          background: i <= strength ? colors[strength - 1] : 'rgba(0,0,0,0.08)',
                        }}
                      />
                    )
                  })}
                </div>
                <span className="text-[11px] text-muted">
                  {['', 'Weak', 'Fair', 'Good', 'Strong'][Math.min(Math.floor(passwords.next.length / 3), 4)]} password
                </span>
              </div>
            )}
          </div>
          {passError && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{passError}</p>}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handlePassSave}
              disabled={passSaving}
              className={`inline-flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-bold transition-all ${
                passSaved
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  : 'bg-accent text-white border border-transparent hover:opacity-90 disabled:opacity-50'
              }`}
            >
              {passSaved ? <><Check size={14} /> Saved!</> : passSaving ? 'Saving…' : 'Update password'}
            </button>
          </div>
        </Section>

        {/* Notifications */}
        <Section title="Notifications" desc="Choose what you want to be alerted about." delay="0.14s">
          <div className="flex flex-col">
            {NOTIF_PREFS.map((pref, i) => (
              <div
                key={pref.id}
                className={`flex items-center justify-between py-3.5 gap-4 ${
                  i < NOTIF_PREFS.length - 1 ? 'border-b border-border dark:border-border-dark' : ''
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 dark:text-landing-white mb-0.5">{pref.label}</div>
                  <div className="text-xs text-muted">{pref.desc}</div>
                </div>
                <Toggle checked={notifs[pref.id]} onChange={(v) => setNotifs((n) => ({ ...n, [pref.id]: v }))} />
              </div>
            ))}
          </div>
        </Section>

        {/* App preferences */}
        <Section title="App Preferences" desc="Personalize how the app looks and behaves." delay="0.17s">
          {[
            {
              label: 'Compact view',
              desc: 'Denser layout for job & hours lists',
              checked: compactView,
              onChange: setCompactView,
            },
          ].map((item, i, arr) => (
            <div
              key={item.label}
              className={`flex items-center justify-between py-3.5 ${i < arr.length - 1 ? 'border-b border-border dark:border-border-dark' : ''} gap-4`}
            >
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-landing-white mb-0.5">{item.label}</div>
                <div className="text-xs text-muted">{item.desc}</div>
              </div>
              <Toggle checked={item.checked} onChange={item.onChange} />
            </div>
          ))}
        </Section>

        {/* Sign out */}
        <div className="profile-fade-up" style={{ animationDelay: '0.2s' }}>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400 font-bold text-sm hover:bg-red-500/20 transition-colors"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
