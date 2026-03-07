import { useState, useEffect } from 'react'
import { Search, Send, Phone, Mail, Paperclip, Zap } from 'lucide-react'
import type { DirectoryContractor } from '@/data/mockDirectoryData'
import type { ThreadMessage } from '@/data/mockDirectoryData'
import { DirectoryAvatar } from './DirectoryAvatar'
import { TradePill } from './TradePill'
import { Stars } from './Stars'

interface MessagesTabViewProps {
  contractors: DirectoryContractor[]
  threads: Record<string, ThreadMessage[]>
  onThreadsChange: (next: Record<string, ThreadMessage[]>) => void
  initialContact?: DirectoryContractor | null
}

export function MessagesTabView({
  contractors,
  threads,
  onThreadsChange,
  initialContact,
}: MessagesTabViewProps) {
  const [selected, setSelected] = useState<DirectoryContractor | null>(
    initialContact ?? contractors[0] ?? null
  )
  const [search, setSearch] = useState('')
  const [input, setInput] = useState('')

  useEffect(() => {
    if (initialContact) setSelected(initialContact)
  }, [initialContact])

  const filtered = contractors.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.trade.toLowerCase().includes(search.toLowerCase())
  )

  const messages = selected ? threads[selected.id] ?? [] : []
  const totalUnread = contractors.reduce((s, c) => s + c.unread, 0)

  const sendMessage = () => {
    if (!input.trim() || !selected) return
    onThreadsChange({
      ...threads,
      [selected.id]: [
        ...(threads[selected.id] ?? []),
        {
          id: Date.now(),
          from: 'me',
          text: input.trim(),
          time: 'Just now',
        },
      ],
    })
    setInput('')
  }

  return (
    <div className="directory-messages flex flex-1 min-h-0 flex-col">
      <div className="flex flex-1 min-h-0 gap-4 py-0">
        {/* Left: contractor list */}
        <div className="directory-messages-list w-[310px] shrink-0 flex flex-col rounded-2xl border border-border dark:border-border-dark bg-surface dark:bg-dark-3 overflow-hidden">
          <div className="px-4 py-3.5 border-b border-border dark:border-border-dark font-bold text-sm text-[var(--text-primary)] flex justify-between items-center">
            Contractors
            {totalUnread > 0 && (
              <span className="bg-[var(--red)] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {totalUnread}
              </span>
            )}
          </div>
          <div className="p-2.5 border-b border-border dark:border-border-dark">
            <div className="relative">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-full rounded-lg border border-border dark:border-border-dark bg-[var(--bg-page)] dark:bg-dark-4 py-1.5 pl-7 pr-2.5 text-[13px] text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--red)]/30"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {filtered.map((c) => {
              const isActive = selected?.id === c.id
              const msgs = threads[c.id] ?? []
              const preview =
                msgs.length > 0 ? msgs[msgs.length - 1].text : c.lastMsg
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelected(c)}
                  className={`w-full text-left px-3.5 py-3 flex gap-2.5 items-start cursor-pointer transition-colors border-b border-border dark:border-border-dark last:border-0 ${
                    isActive
                      ? 'bg-[var(--red-glow-soft)] dark:bg-red-950/20 border-l-[3px] border-l-[var(--red)]'
                      : 'hover:bg-[var(--bg-hover)] dark:hover:bg-dark-4 border-l-[3px] border-l-transparent'
                  }`}
                >
                  <DirectoryAvatar initials={c.avatar} color={c.color} size={38} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <span
                        className={`text-[13.5px] truncate ${
                          c.unread > 0 ? 'font-bold' : 'font-semibold'
                        } text-[var(--text-primary)]`}
                      >
                        {c.name}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] shrink-0 ml-1">
                        {c.lastTime}
                      </span>
                    </div>
                    <div className="text-[11.5px] font-semibold text-[var(--red)] mb-0.5">
                      {c.trade}
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span
                        className={`text-xs truncate max-w-[175px] ${
                          c.unread > 0
                            ? 'text-[var(--text-secondary)] font-semibold'
                            : 'text-[var(--text-muted)]'
                        }`}
                      >
                        {preview}
                      </span>
                      {c.unread > 0 && (
                        <span className="w-4 h-4 rounded-full bg-[var(--red)] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                          {c.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Center: chat */}
        <div className="flex-1 flex flex-col min-w-0 rounded-2xl border border-border dark:border-border-dark bg-surface dark:bg-dark-3 overflow-hidden">
          {selected && (
            <div className="px-5 py-4 border-b border-border dark:border-border-dark flex items-center gap-3.5 shrink-0">
              <DirectoryAvatar
                initials={selected.avatar}
                color={selected.color}
                size={42}
                status={selected.status}
              />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-base text-[var(--text-primary)]">
                  {selected.name}
                </div>
                <div className="text-xs text-[var(--text-muted)] flex items-center gap-1.5">
                  <TradePill trade={selected.trade} />
                </div>
              </div>
              <div className="flex gap-2">
                {selected.phone && (
                  <a
                    href={`tel:${selected.phone}`}
                    className="w-8 h-8 rounded-lg border border-border dark:border-border-dark bg-[var(--bg-page)] dark:bg-dark-4 flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-hover)] no-underline"
                    aria-label="Call"
                  >
                    <Phone size={14} />
                  </a>
                )}
                <a
                  href={`mailto:${selected.email}`}
                  className="w-8 h-8 rounded-lg border border-border dark:border-border-dark bg-[var(--bg-page)] dark:bg-dark-4 flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-hover)] no-underline"
                  aria-label="Email"
                >
                  <Mail size={14} />
                </a>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-1 min-h-0">
            {messages.map((msg, i) => {
              const isMe = msg.from === 'me'
              const prevSame = i > 0 && messages[i - 1].from === msg.from
              return (
                <div key={msg.id}>
                  {!prevSame && (
                    <div className="text-center text-[11px] text-[var(--text-muted)] my-2 font-medium">
                      {msg.time}
                    </div>
                  )}
                  <div
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1`}
                  >
                    {!isMe && !prevSame && (
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 mr-2 self-end"
                        style={{ background: selected?.color }}
                      >
                        {selected?.avatar}
                      </div>
                    )}
                    {!isMe && prevSame && <div className="w-8 shrink-0" />}
                    <div
                      className={`max-w-[62%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                        isMe
                          ? 'rounded-br-md bg-[var(--red)] text-white'
                          : 'rounded-bl-md bg-[var(--bg-raised)] dark:bg-dark-4 text-[var(--text-primary)]'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="p-3 border-t border-border dark:border-border-dark shrink-0">
            <div className="flex gap-2.5 items-end bg-[var(--bg-page)] dark:bg-dark-4 border border-border dark:border-border-dark rounded-xl p-2 focus-within:ring-2 focus-within:ring-[var(--red)]/30 focus-within:border-[var(--red)]">
              <button
                type="button"
                className="p-1 border-0 bg-transparent cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                aria-label="Attach"
              >
                <Paperclip size={15} />
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                placeholder={`Message ${selected?.name?.split(' ')[0] ?? ''}…`}
                rows={1}
                className="flex-1 border-0 bg-transparent text-sm text-[var(--text-primary)] resize-none outline-none min-h-[24px] max-h-20 py-1"
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={!input.trim()}
                className={`w-8 h-8 rounded-lg border-0 flex items-center justify-center transition-colors shrink-0 ${
                  input.trim()
                    ? 'bg-[var(--red)] text-white cursor-pointer hover:bg-[var(--red-mid)]'
                    : 'bg-[var(--bg-raised)] dark:bg-dark-4 text-[var(--text-muted)] cursor-default'
                }`}
                aria-label="Send"
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* Right: profile */}
        {selected && (
          <div className="w-[230px] shrink-0 flex flex-col gap-3">
            <div className="rounded-xl border border-border dark:border-border-dark bg-surface dark:bg-dark-3 p-4 text-center">
              <div className="flex justify-center mb-2.5">
                <DirectoryAvatar
                  initials={selected.avatar}
                  color={selected.color}
                  size={56}
                />
              </div>
              <div className="font-extrabold text-[15px] text-[var(--text-primary)] mb-0.5">
                {selected.name}
              </div>
              <div className="mb-1.5 flex justify-center">
                <TradePill trade={selected.trade} />
              </div>
              <div className="flex justify-center mb-3.5">
                <Stars rating={selected.rating} />
              </div>
              <div className="flex gap-2">
                {selected.phone && (
                  <a
                    href={`tel:${selected.phone}`}
                    className="flex-1 py-1.5 px-2 border border-border dark:border-border-dark rounded-lg bg-[var(--bg-page)] dark:bg-dark-4 flex items-center justify-center gap-1 no-underline text-xs text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
                  >
                    <Phone size={12} />
                    Call
                  </a>
                )}
                <a
                  href={`mailto:${selected.email}`}
                  className="flex-1 py-1.5 px-2 border border-border dark:border-border-dark rounded-lg bg-[var(--bg-page)] dark:bg-dark-4 flex items-center justify-center gap-1 no-underline text-xs text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
                >
                  <Mail size={12} />
                  Email
                </a>
              </div>
            </div>
            {selected.notes && (
              <div className="rounded-xl border border-border dark:border-border-dark bg-surface dark:bg-dark-3 p-4">
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                  Notes
                </div>
                <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {selected.notes}
                </div>
              </div>
            )}
            {selected.jobs.length > 0 && (
              <div className="rounded-xl border border-border dark:border-border-dark bg-surface dark:bg-dark-3 p-4">
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                  Invited to bid
                </div>
                {selected.jobs.map((j) => (
                  <div
                    key={j}
                    className="flex items-center gap-2 mb-1.5 text-xs text-[var(--text-secondary)] last:mb-0"
                  >
                    <Zap size={11} className="text-[var(--red)] shrink-0" />
                    {j}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
