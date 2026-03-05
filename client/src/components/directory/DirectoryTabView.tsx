import { useState, useRef, useEffect } from 'react'
import { Search, Mail, Phone, MessageSquare, ChevronDown, Zap } from 'lucide-react'
import type { DirectoryContractor } from '@/data/mockDirectoryData'
import { DirectoryAvatar } from './DirectoryAvatar'
import { TradePill } from './TradePill'
import { Stars } from './Stars'
import { AddContractorPanel } from './AddContractorPanel'

interface DirectoryTabViewProps {
  contractors: DirectoryContractor[]
  onAdd: (c: Omit<DirectoryContractor, 'id'> & { id: string }) => void
  onRemove: (id: string) => void
  onMessage: (c: DirectoryContractor) => void
}

export function DirectoryTabView({
  contractors,
  onAdd,
  onRemove,
  onMessage,
}: DirectoryTabViewProps) {
  const [search, setSearch] = useState('')
  const [filterTrade, setFilterTrade] = useState('All')
  const [showAdd, setShowAdd] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (openDropdown === null) return
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [openDropdown])

  const trades = ['All', ...new Set(contractors.map((c) => c.trade))]
  const filtered = contractors.filter(
    (c) =>
      (filterTrade === 'All' || c.trade === filterTrade) &&
      (c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.trade.toLowerCase().includes(search.toLowerCase()))
  )

  const totalUnread = contractors.reduce((s, c) => s + c.unread, 0)
  const onlineCount = contractors.filter((c) => c.status === 'online').length
  const avgRating =
    contractors.length > 0
      ? (
          contractors.reduce((s, c) => s + c.rating, 0) / contractors.length
        ).toFixed(1)
      : '—'

  return (
    <div className="directory-tab-content w-full">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div className="flex flex-col gap-0 text-left">
          <h2 className="dashboard-title text-[20px] font-extrabold tracking-tight m-0">
            Contractors
          </h2>
          <p className="text-[13.5px] text-[var(--text-muted)] mt-1 mb-0">
            Manage your contractor contact list. Add and remove contractors.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1.5 bg-[var(--red)] text-white border-0 rounded-lg py-2.5 px-4 text-sm font-bold cursor-pointer hover:bg-[var(--red-mid)] transition-colors"
        >
          <span className="w-4 h-4 flex items-center justify-center">+</span>
          Add contractor
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center mb-4">
        <div className="relative flex-1 min-w-0 max-w-[320px]">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contractors…"
            className="w-full rounded-lg border border-border dark:border-border-dark bg-surface dark:bg-dark-4 py-2 pl-9 pr-3 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--red)]/30"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {trades.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilterTrade(t)}
              className={`py-1.5 px-3.5 rounded-full text-xs font-semibold border transition-colors ${
                filterTrade === t
                  ? 'bg-[var(--text-primary)] text-[var(--bg-page)] border-transparent'
                  : 'bg-surface dark:bg-dark-4 border-border dark:border-border-dark text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total contractors', value: contractors.length },
          { label: 'Online now', value: onlineCount },
          { label: 'Unread messages', value: totalUnread },
          { label: 'Avg rating', value: `${avgRating} ★` },
        ].map((m) => (
          <div
            key={m.label}
            className="rounded-xl border border-border dark:border-border-dark bg-surface dark:bg-dark-3 p-3.5"
          >
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
              {m.label}
            </div>
            <div className="text-xl font-extrabold text-[var(--text-primary)] tracking-tight">
              {m.value}
            </div>
          </div>
        ))}
      </div>

      {/* Cards grid: items-start so cards keep their own height */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-start">
        {filtered.map((c) => {
          const isDropdownOpen = openDropdown === c.id
          return (
            <div
              key={c.id}
              className="rounded-xl border border-border dark:border-border-dark bg-surface dark:bg-dark-3 overflow-visible transition-shadow hover:shadow-card"
            >
              <div className="p-4">
                <div className="flex gap-3.5 items-start mb-3">
                  <DirectoryAvatar
                    initials={c.avatar}
                    color={c.color}
                    size={46}
                    status={c.status}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[15px] text-[var(--text-primary)] mb-1">
                      {c.name}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <TradePill trade={c.trade} />
                      <Stars rating={c.rating} />
                    </div>
                  </div>
                  {c.unread > 0 && (
                    <span className="flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-[var(--red)] text-white text-[10px] font-bold px-1">
                      {c.unread}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1 mb-3">
                  {c.email && (
                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                      <Mail size={12} />
                      {c.email}
                    </div>
                  )}
                  {c.phone && (
                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                      <Phone size={12} />
                      {c.phone}
                    </div>
                  )}
                </div>

                <div className="rounded-lg p-2.5 mb-3 bg-[var(--bg-page)] dark:bg-dark-4 border border-border dark:border-border-dark">
                  <div className="text-[11px] text-[var(--text-muted)] font-semibold uppercase tracking-wide mb-0.5">
                    Last message · {c.lastTime}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] truncate">
                    {c.lastMsg}
                  </div>
                </div>

                <div className="flex gap-2 items-center">
                  <button
                    type="button"
                    onClick={() => onMessage(c)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[var(--red)] text-white border-0 text-[13px] font-bold cursor-pointer hover:bg-[var(--red-mid)]"
                  >
                    <MessageSquare size={13} />
                    Message
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(c.id)}
                    className="py-2 px-3 rounded-lg bg-transparent border border-red-200 dark:border-red-900/50 text-[var(--red)] text-xs font-semibold cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/20"
                  >
                    Remove
                  </button>
                  <div
                    ref={isDropdownOpen ? dropdownRef : undefined}
                    className="relative shrink-0"
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setOpenDropdown(isDropdownOpen ? null : c.id)
                      }}
                      className="py-2 px-2 rounded-lg bg-[var(--bg-raised)] dark:bg-dark-4 border border-border dark:border-border-dark text-[var(--text-muted)] cursor-pointer inline-flex items-center justify-center hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]"
                      aria-haspopup="true"
                      aria-expanded={isDropdownOpen}
                      aria-label="More options"
                    >
                      <ChevronDown
                        size={14}
                        className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {isDropdownOpen && (
                      <div
                        className="absolute right-0 top-full z-50 mt-1 min-w-[220px] rounded-xl border border-border dark:border-border-dark bg-surface dark:bg-dark-3 shadow-lg py-3 px-4 flex flex-col gap-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {c.notes && (
                          <div>
                            <div className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                              Notes
                            </div>
                            <div className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
                              {c.notes}
                            </div>
                          </div>
                        )}
                        {c.jobs.length > 0 && (
                          <div>
                            <div className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                              Invited to bid
                            </div>
                            <div className="flex flex-col gap-1">
                              {c.jobs.map((j) => (
                                <div
                                  key={j}
                                  className="flex items-center gap-2 text-xs text-[var(--text-secondary)]"
                                >
                                  <Zap size={11} className="text-[var(--red)] shrink-0" />
                                  {j}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {!c.notes && c.jobs.length === 0 && (
                          <div className="text-xs text-[var(--text-muted)]">
                            No notes or jobs.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {showAdd && (
        <AddContractorPanel
          onClose={() => setShowAdd(false)}
          onAdd={(c) => {
            onAdd(c)
            setShowAdd(false)
          }}
        />
      )}
    </div>
  )
}
