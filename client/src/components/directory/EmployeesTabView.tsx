import { useState, useEffect, useRef } from 'react'
import { Search, Mail, MessageSquare, Send, ChevronLeft } from 'lucide-react'
import { teamsApi } from '@/api/teams'
import { api } from '@/api/client'
import type { Employee } from '@/types/global'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'
import { dayjs } from '@/lib/date'
import type { Message } from '@/api/client'
import { useAuth } from '@/contexts/AuthContext'

function Avatar({ initials, color }: { initials: string; color: string }) {
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 text-sm"
      style={{ width: 40, height: 40, background: color }}
    >
      {initials}
    </div>
  )
}

const COLORS = ['#15803d', '#374151', '#9a3412', '#7c3aed', '#0891b2', '#b45309']

export function EmployeesTabView() {
  const { user: authUser } = useAuth()
  const [isMobile, setIsMobile] = useState(false)
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [employeeWeAreMessaging, setEmployeeWeAreMessaging] = useState<Employee | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const sync = () => setIsMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    teamsApi.employees
      .list()
      .then((list) => {
        if (!cancelled) setEmployees(list)
      })
      .catch(() => {
        if (!cancelled) setEmployees([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([])
      setEmployeeWeAreMessaging(null)
      return
    }
    let cancelled = false
    setMessagesLoading(true)
    api.conversations
      .getMessages(selectedConversationId)
      .then(({ messages: list }) => {
        if (!cancelled) {
          setMessages(list)
          setMessagesLoading(false)
          api.conversations.markRead(selectedConversationId).catch(() => {})
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMessages([])
          setMessagesLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [selectedConversationId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const filtered = search.trim()
    ? employees.filter(
        (e) =>
          e.name.toLowerCase().includes(search.toLowerCase()) ||
          (e.email && e.email.toLowerCase().includes(search.toLowerCase())) ||
          (e.role && e.role.toLowerCase().includes(search.toLowerCase()))
      )
    : employees

  const withPortalAccess = employees.filter((e) => e.auth_user_id)

  const showList = !isMobile || !mobileThreadOpen
  const showChat = !isMobile || mobileThreadOpen

  const openConversation = async (emp: Employee) => {
    if (!emp.auth_user_id) return
    try {
      const conv = await api.conversations.findOrCreate(emp.auth_user_id)
      setSelectedConversationId(conv.id)
      setEmployeeWeAreMessaging(emp)
      if (window.matchMedia('(max-width: 767px)').matches) {
        setMobileThreadOpen(true)
      }
    } catch {
      // could toast error
    }
  }

  const backToEmployeeList = () => {
    setMobileThreadOpen(false)
    setSelectedConversationId(null)
    setEmployeeWeAreMessaging(null)
    setMessages([])
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || !selectedConversationId || sending) return
    setSending(true)
    try {
      const msg = await api.conversations.sendMessage(selectedConversationId, text)
      setMessages((prev) => [...prev, msg])
      setInput('')
    } finally {
      setSending(false)
    }
  }

  const getInitials = (name: string) =>
    name
      .split(/\s+/)
      .map((s) => s[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()

  return (
    <div className="directory-tab-content w-full flex flex-col flex-1 min-h-0">
      <div className="flex flex-col gap-0 text-left mb-4">
        <h2 className="dashboard-title text-[20px] font-extrabold tracking-tight m-0">
          Employees
        </h2>
        <p className="text-[13.5px] text-[var(--text-muted)] mt-1 mb-0">
          Your roster. Message employees who have accepted their invite.
        </p>
      </div>

      <div className="flex flex-1 min-h-0 gap-4 rounded-2xl border border-border dark:border-border-dark bg-surface dark:bg-dark-3 overflow-hidden">
        {/* Left: employee list */}
        <div
          className={`w-full shrink-0 flex flex-col border-r border-border dark:border-border-dark md:w-[300px] ${
            showList ? 'flex' : 'hidden md:flex'
          }`}
        >
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
            {loading ? (
              <div className="p-4">
                <LoadingSkeleton variant="inline" lines={5} />
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-sm text-[var(--text-muted)]">
                No employees match.
              </div>
            ) : (
              filtered.map((emp, i) => {
                const hasAccess = !!emp.auth_user_id
                const isActive = employeeWeAreMessaging?.id === emp.id
                const color = COLORS[i % COLORS.length]
                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => hasAccess && openConversation(emp)}
                    disabled={!hasAccess}
                    className={`w-full text-left px-3.5 py-3 flex gap-2.5 items-center border-b border-border dark:border-border-dark last:border-0 transition-colors ${
                      isActive
                        ? 'bg-[var(--red-glow-soft)] dark:bg-red-950/20'
                        : hasAccess
                          ? 'hover:bg-[var(--bg-hover)] dark:hover:bg-dark-4'
                          : 'opacity-70 cursor-default'
                    }`}
                  >
                    <Avatar
                      initials={getInitials(emp.name)}
                      color={color}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[13.5px] text-[var(--text-primary)] truncate">
                        {emp.name}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] truncate">
                        {emp.role}
                        {!hasAccess && ' · No portal access'}
                      </div>
                    </div>
                    {hasAccess && (
                      <MessageSquare size={14} className="text-[var(--red)] shrink-0" />
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Right: chat or empty state */}
        <div
          className={`flex-1 flex flex-col min-w-0 ${showChat ? 'flex' : 'hidden md:flex'}`}
        >
          {selectedConversationId && employeeWeAreMessaging ? (
            <>
              <div className="px-4 py-3 border-b border-border dark:border-border-dark flex items-center gap-3 shrink-0">
                {isMobile && mobileThreadOpen && (
                  <button
                    type="button"
                    onClick={backToEmployeeList}
                    className="mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border dark:border-border-dark bg-[var(--bg-page)] dark:bg-dark-4 text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                    aria-label="Back to employees"
                  >
                    <ChevronLeft size={20} />
                  </button>
                )}
                <Avatar
                  initials={getInitials(employeeWeAreMessaging.name)}
                  color={COLORS[employees.indexOf(employeeWeAreMessaging) % COLORS.length]}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[var(--text-primary)]">
                    {employeeWeAreMessaging.name}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {employeeWeAreMessaging.role}
                  </div>
                </div>
                {employeeWeAreMessaging.email && (
                  <a
                    href={`mailto:${employeeWeAreMessaging.email}`}
                    className="p-2 rounded-lg border border-border dark:border-border-dark text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
                    aria-label="Email"
                  >
                    <Mail size={14} />
                  </a>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 min-h-0">
                {messagesLoading ? (
                  <LoadingSkeleton variant="inline" lines={4} />
                ) : messages.length === 0 ? (
                  <div className="text-center text-sm text-[var(--text-muted)] py-8">
                    No messages yet. Say hello!
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = authUser?.id && msg.sender_id === authUser.id
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${
                            isMe
                              ? 'bg-[var(--red)] text-white rounded-br-md'
                              : 'bg-[var(--bg-raised)] dark:bg-dark-4 text-[var(--text-primary)] rounded-bl-md'
                          }`}
                        >
                          {msg.body}
                          <div className="text-[10px] opacity-80 mt-0.5">
                            {dayjs(msg.created_at).format('h:mm A')}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
              <form
                className="p-3 border-t border-border dark:border-border-dark shrink-0"
                onSubmit={(e) => {
                  e.preventDefault()
                  sendMessage()
                }}
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type a message…"
                    className="flex-1 rounded-lg border border-border dark:border-border-dark bg-white dark:bg-dark-4 px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                    disabled={sending}
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || sending}
                    className="p-2 rounded-lg bg-[var(--red)] text-white hover:opacity-90 disabled:opacity-50"
                    aria-label="Send"
                  >
                    <Send size={14} />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div className="text-[var(--text-muted)] text-sm max-w-[280px]">
                {withPortalAccess.length === 0
                  ? 'No employees have accepted their invite yet. Once they do, you can message them here.'
                  : 'Select an employee from the list to start a conversation.'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
