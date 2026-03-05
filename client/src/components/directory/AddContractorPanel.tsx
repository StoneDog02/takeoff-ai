import { useState } from 'react'
import { X, Star } from 'lucide-react'
import { TRADES, TRADE_COLORS } from '@/data/mockDirectoryData'
import type { DirectoryContractor } from '@/data/mockDirectoryData'

interface AddContractorPanelProps {
  onClose: () => void
  onAdd: (c: Omit<DirectoryContractor, 'id'> & { id: string }) => void
}

const inputClass =
  'w-full rounded-lg px-3 py-2.5 text-sm border border-border dark:border-border-dark bg-surface dark:bg-dark-4 text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--red)]/30 focus:border-[var(--red)] transition-colors'
const labelClass = 'text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5 block'

export function AddContractorPanel({ onClose, onAdd }: AddContractorPanelProps) {
  const [form, setForm] = useState({
    name: '',
    trade: 'Electrical',
    email: '',
    phone: '',
    notes: '',
    rating: 4,
  })

  const set = (k: keyof typeof form, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }))

  const submit = () => {
    if (!form.name.trim() || !form.email.trim()) return
    const initials = form.name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
    onAdd({
      ...form,
      id: `dir-${Date.now()}`,
      avatar: initials,
      color: TRADE_COLORS[form.trade] ?? '#6b7280',
      status: 'offline',
      jobs: [],
      lastMsg: 'Added to contacts.',
      lastTime: 'Just now',
      unread: 0,
    })
    onClose()
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="directory-add-panel fixed top-0 right-0 bottom-0 z-50 w-full max-w-[420px] flex flex-col bg-surface dark:bg-dark-3 border-l border-border dark:border-border-dark shadow-lg"
        role="dialog"
        aria-labelledby="add-contractor-title"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-border dark:border-border-dark flex-shrink-0">
          <div>
            <h2 id="add-contractor-title" className="text-lg font-extrabold text-[var(--text-primary)] tracking-tight">
              Add contractor
            </h2>
            <p className="text-[13px] text-[var(--text-muted)] mt-1">
              They'll appear in your directory and Messages.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-border dark:border-border-dark bg-[var(--bg-page)] flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition-colors"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          <div>
            <label className={labelClass}>Company / Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Apex Plumbing"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Trade *</label>
            <select
              value={form.trade}
              onChange={(e) => set('trade', e.target.value)}
              className={inputClass}
            >
              {TRADES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="contact@company.com"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="801-555-0000"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Rating</label>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => set('rating', i)}
                  className="p-0.5 border-0 bg-transparent cursor-pointer"
                  aria-label={`Rate ${i} stars`}
                >
                  <Star
                    size={22}
                    fill={i <= form.rating ? '#f59e0b' : 'none'}
                    color={i <= form.rating ? '#f59e0b' : 'var(--text-muted)'}
                  />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelClass}>Notes / Specialty</label>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={3}
              placeholder="Specialties, preferences, availability notes…"
              className={`${inputClass} resize-y`}
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border dark:border-border-dark flex gap-2.5 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-border dark:border-border-dark bg-[var(--bg-page)] text-sm font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!form.name.trim() || !form.email.trim()}
            className="flex-[2] py-2.5 rounded-lg border-0 text-sm font-bold text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed bg-[var(--red)] hover:enabled:bg-[var(--red-mid)] disabled:bg-[var(--bg-raised)] disabled:text-[var(--text-muted)]"
          >
            Add contractor
          </button>
        </div>
      </div>
    </>
  )
}
