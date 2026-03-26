import { useState, useEffect, useRef, useSyncExternalStore } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Send, Plus, ChevronLeft } from 'lucide-react'
import { api } from '@/api/client'
import { useAuth } from '@/contexts/AuthContext'
import { useEffectiveEmployee } from '@/hooks/useEffectiveEmployee'
import { teamsApi } from '@/api/teams'
import { dayjs } from '@/lib/date'
import type { ConversationListItem, Message } from '@/api/client'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'

const CHAT_COLORS = ['#15803d', '#374151', '#9a3412', '#7c3aed', '#0891b2', '#b45309']

/** Matches Directory GC messaging / Tailwind `md` breakpoint (single-column thread on small viewports). */
const EMPLOYEE_MESSAGES_MOBILE_MQ = '(max-width: 767px)'

function subscribeEmployeeMessagesMobile(onChange: () => void) {
  const mq = window.matchMedia(EMPLOYEE_MESSAGES_MOBILE_MQ)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

function getEmployeeMessagesMobileSnapshot() {
  return window.matchMedia(EMPLOYEE_MESSAGES_MOBILE_MQ).matches
}

function getEmployeeMessagesMobileServerSnapshot() {
  return false
}

function isEmployeeMessagesMobileViewport() {
  return typeof window !== 'undefined' && window.matchMedia(EMPLOYEE_MESSAGES_MOBILE_MQ).matches
}

function Avatar({ initials, color, size = 40 }: { initials: string; color: string; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: color,
        fontSize: size * 0.32,
      }}
    >
      {initials}
    </div>
  )
}

export function MessagesPage({ employeePortal = false }: { employeePortal?: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const conversationIdFromUrl = searchParams.get('conversation')
  const { user: authUser } = useAuth()
  const { employeeId: previewEmployeeId, isPreview } = useEffectiveEmployee()
  const [previewEmployeeAuthId, setPreviewEmployeeAuthId] = useState<string | null>(null)

  const effectiveMeId =
    employeePortal && isPreview && previewEmployeeAuthId ? previewEmployeeAuthId : authUser?.id ?? null

  const [conversations, setConversations] = useState<ConversationListItem[]>([])
  const [conversationsLoading, setConversationsLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(conversationIdFromUrl)
  const [messages, setMessages] = useState<Message[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')
  const [messagesTab, setMessagesTab] = useState<'contacts' | 'jobs'>('contacts')
  const [jobConversationsLoading, setJobConversationsLoading] = useState(false)
  /** Employee portal mobile: list-first; tap contact opens full-width thread (matches Directory GC messaging). */
  const isMobile = useSyncExternalStore(
    subscribeEmployeeMessagesMobile,
    getEmployeeMessagesMobileSnapshot,
    getEmployeeMessagesMobileServerSnapshot
  )
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { employeeId: effectiveEmployeeId } = useEffectiveEmployee()
  const { employee: authEmployee } = useAuth()
  const employeeIdForJobs = effectiveEmployeeId ?? authEmployee?.id ?? null

  useEffect(() => {
    setSelectedId(conversationIdFromUrl)
  }, [conversationIdFromUrl])

  /** Deep link or refresh with ?conversation= — open thread on employee mobile. */
  useEffect(() => {
    if (!employeePortal || !conversationIdFromUrl) return
    if (!getEmployeeMessagesMobileSnapshot()) return
    setMobileThreadOpen(true)
  }, [employeePortal, conversationIdFromUrl])

  const prevMessagesTabRef = useRef(messagesTab)
  /** Switching Contacts / Jobs returns to the list view on mobile (not on initial mount). */
  useEffect(() => {
    if (!employeePortal) return
    if (prevMessagesTabRef.current === messagesTab) return
    prevMessagesTabRef.current = messagesTab
    setMobileThreadOpen(false)
  }, [employeePortal, messagesTab])

  useEffect(() => {
    if (!employeePortal || !isPreview || !previewEmployeeId) {
      setPreviewEmployeeAuthId(null)
      return
    }
    let cancelled = false
    teamsApi.employees
      .get(previewEmployeeId)
      .then((emp) => {
        if (!cancelled && emp.auth_user_id) setPreviewEmployeeAuthId(emp.auth_user_id)
        else if (!cancelled) setPreviewEmployeeAuthId(null)
      })
      .catch(() => {
        if (!cancelled) setPreviewEmployeeAuthId(null)
      })
    return () => { cancelled = true }
  }, [employeePortal, isPreview, previewEmployeeId])

  useEffect(() => {
    let cancelled = false
    setConversationsLoading(true)
    api.conversations.list().then((data) => {
      if (!cancelled) {
        setConversations(data)
        setConversationsLoading(false)
      }
    }).catch(() => {
      if (!cancelled) {
        setConversations([])
        setConversationsLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!employeePortal || messagesTab !== 'jobs' || !employeeIdForJobs) return
    let cancelled = false
    setJobConversationsLoading(true)
    Promise.all([
      teamsApi.jobAssignments.list({ employee_id: employeeIdForJobs, active_only: true }),
      api.conversations.list(),
    ])
      .then(([assignments, existingList]) => {
        if (cancelled) return
        const jobIds = [...new Set(assignments.map((a) => a.job_id))]
        const existingJobIds = new Set((existingList || []).filter((c) => c.job_id).map((c) => c.job_id))
        const toCreate = jobIds.filter((id) => !existingJobIds.has(id))
        if (toCreate.length === 0) {
          setJobConversationsLoading(false)
          return
        }
        return Promise.all(toCreate.map((jobId) => api.conversations.getOrCreateForJob(jobId)))
          .then(() => {
            if (cancelled) return
            return api.conversations.list()
          })
          .then((data) => {
            if (!cancelled && data) setConversations(data)
          })
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setJobConversationsLoading(false)
      })
    return () => { cancelled = true }
  }, [employeePortal, messagesTab, employeeIdForJobs])

  useEffect(() => {
    if (!selectedId) {
      setMessages([])
      return
    }
    let cancelled = false
    setMessagesLoading(true)
    api.conversations.getMessages(selectedId).then(({ messages: list }) => {
      if (!cancelled) {
        setMessages(list)
        setMessagesLoading(false)
        api.conversations.markRead(selectedId).then(() => {
          if (!cancelled) {
            setConversations((prev) =>
              prev.map((c) =>
                c.id === selectedId ? { ...c, unread_count: 0 } : c
              )
            )
          }
        }).catch(() => {})
      }
    }).catch(() => {
      if (!cancelled) {
        setMessages([])
        setMessagesLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [selectedId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const contactsList = employeePortal ? conversations.filter((c) => !c.job_id) : conversations
  const jobsList = employeePortal ? conversations.filter((c) => c.job_id) : []
  const baseList = employeePortal && messagesTab === 'jobs' ? jobsList : contactsList
  const filteredConversations = search.trim()
    ? baseList.filter((c) => {
        const text = `${c.job_name ?? ''} ${c.last_message?.body ?? ''}`.toLowerCase()
        return text.includes(search.toLowerCase())
      })
    : baseList

  const selectedConversation = selectedId ? conversations.find((c) => c.id === selectedId) : null

  const showList = !employeePortal || !isMobile || !mobileThreadOpen
  const showChat = !employeePortal || !isMobile || mobileThreadOpen

  const backToConversationList = () => {
    setMobileThreadOpen(false)
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || !selectedId || sending) return
    setSending(true)
    try {
      const msg = await api.conversations.sendMessage(selectedId, text)
      setMessages((prev) => [...prev, msg])
      setInput('')
      setConversations((prev) => {
        const next = prev.map((c) =>
          c.id === selectedId
            ? {
                ...c,
                updated_at: msg.created_at,
                last_message: { id: msg.id, sender_id: msg.sender_id, body: msg.body, created_at: msg.created_at },
              }
            : c
        )
        next.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        return next
      })
    } finally {
      setSending(false)
    }
  }

  const selectConversation = (id: string) => {
    setSelectedId(id)
    setSearchParams({ conversation: id })
    // Sync viewport read — state `isMobile` can lag first paint; opening thread must not depend on it.
    if (employeePortal && isEmployeeMessagesMobileViewport()) setMobileThreadOpen(true)
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c))
    )
    api.conversations.markRead(id).catch(() => {})
  }

  const employeeMobileLayoutClass =
    employeePortal && isMobile
      ? mobileThreadOpen
        ? 'messages-page--employee-mobile-thread'
        : 'messages-page--employee-mobile-list'
      : ''

  return (
    <div className={`dashboard-app messages-page min-h-full ${employeeMobileLayoutClass}`.trim()}>
      <style>{`
        .messages-page * { box-sizing: border-box; }
        .messages-page .messages-scroll::-webkit-scrollbar { width: 4px; }
        .messages-page .messages-scroll::-webkit-scrollbar-track { background: transparent; }
        .messages-page .messages-scroll::-webkit-scrollbar-thumb { background: var(--border-mid); border-radius: 4px; }
        .messages-page textarea:focus { outline: none; }
      `}</style>
      <div className="w-full max-w-[1600px] mx-auto px-6 sm:px-8 lg:px-10 py-6 flex flex-col min-h-0 flex-1">
        <div className="messages-page-header">
          <h1 className="dashboard-title">Messages</h1>
        </div>
        {employeePortal && (
          <div className="flex gap-1 border-b border-border dark:border-border-dark mb-4">
            <button
              type="button"
              onClick={() => setMessagesTab('contacts')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                messagesTab === 'contacts'
                  ? 'border-[var(--red)] text-[var(--red)] bg-transparent'
                  : 'border-transparent text-muted hover:text-[var(--text-secondary)]'
              }`}
            >
              Contacts
            </button>
            <button
              type="button"
              onClick={() => setMessagesTab('jobs')}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                messagesTab === 'jobs'
                  ? 'border-[var(--red)] text-[var(--red)] bg-transparent'
                  : 'border-transparent text-muted hover:text-[var(--text-secondary)]'
              }`}
            >
              Jobs
            </button>
          </div>
        )}
        <div className="messages-body">
          <div
            className={`messages-left-panel ${
              employeePortal && isMobile && !showList ? 'max-md:!hidden' : ''
            }`}
          >
            {!employeePortal && (
              <div className="messages-new-row">
                <button
                  type="button"
                  className="messages-new-msg-btn"
                  onClick={() => window.location.href = '/directory'}
                >
                  <Plus size={14} />
                  New message
                </button>
              </div>
            )}
            <div className="messages-search-wrap">
              <Search size={14} className="messages-search-icon" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations…"
                className="messages-search-input"
              />
            </div>
            <div className="messages-scroll messages-contact-list">
              {conversationsLoading ? (
                <div className="messages-contact-list px-3 py-4">
                  <LoadingSkeleton variant="inline" lines={4} />
                </div>
              ) : (messagesTab === 'jobs' && jobConversationsLoading) ? (
                <div className="messages-contact-list px-3 py-4">
                  <LoadingSkeleton variant="inline" lines={3} />
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="messages-empty">
                  {employeePortal && messagesTab === 'jobs'
                    ? 'No job assignments yet. When you’re added to a job, its group chat will show up here.'
                    : employeePortal
                      ? 'No messages yet. When a contractor or project manager messages you, the conversation will appear here and you can reply.'
                      : 'No conversations yet. Start a chat from Directory.'}
                </div>
              ) : (
                filteredConversations.map((c, i) => {
                  const isActive = selectedId === c.id
                  const last = c.last_message
                  const preview = last?.body?.slice(0, 50) ?? 'No messages yet'
                  const timeLabel = last ? dayjs(last.created_at).format('MMM D, h:mm A') : '—'
                  const color = CHAT_COLORS[i % CHAT_COLORS.length]
                  const isJob = !!c.job_id
                  const participants = c.other_participants ?? []
                  const displayName = isJob
                    ? (c.job_name ?? 'Job')
                    : participants.length === 0
                      ? 'Chat'
                      : participants.length === 1
                        ? participants[0].name
                        : 'Team'
                  const initials = isJob
                    ? (c.job_name ?? 'J').split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase() || 'J'
                    : participants.length === 0
                      ? '?'
                      : participants.length === 1
                        ? participants[0].name
                            .split(/\s+/)
                            .map((s) => s[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase() || '?'
                        : 'T'
                  return (
                    <div
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => selectConversation(c.id)}
                      onKeyDown={(e) => e.key === 'Enter' && selectConversation(c.id)}
                      className={`messages-contact-row ${isActive ? 'active' : ''}`}
                    >
                      <Avatar initials={initials} color={color} size={40} />
                      <div className="messages-contact-info">
                        <div className="messages-contact-top">
                          <span className="messages-contact-name">{displayName}</span>
                          <span className="messages-contact-time">{timeLabel}</span>
                        </div>
                        <div className="messages-contact-preview-wrap">
                          <span className="messages-contact-preview">{preview}{preview.length >= 50 ? '…' : ''}</span>
                          {c.unread_count > 0 && (
                            <span className="messages-contact-unread">{c.unread_count}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
          <div
            className={`messages-right-wrap ${
              employeePortal && isMobile && !showChat ? 'max-md:!hidden' : ''
            }`}
          >
            <div className="messages-chat-panel">
              {selectedId && selectedConversation && (
                <>
                  <div className="messages-chat-header">
                    {employeePortal && isMobile && mobileThreadOpen && (
                      <button
                        type="button"
                        onClick={backToConversationList}
                        className="messages-icon-btn shrink-0 mr-0"
                        aria-label="Back to conversations"
                      >
                        <ChevronLeft size={20} />
                      </button>
                    )}
                    <Avatar
                      initials={
                        selectedConversation.job_id
                          ? (selectedConversation.job_name ?? 'J').split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase() || 'J'
                          : (selectedConversation.other_participants?.length === 1
                            ? selectedConversation.other_participants[0].name
                                .split(/\s+/)
                                .map((s) => s[0])
                                .slice(0, 2)
                                .join('')
                                .toUpperCase()
                            : selectedConversation.other_participants?.length
                              ? 'T'
                              : '?') || '?'
                      }
                      color={CHAT_COLORS[0]}
                      size={42}
                    />
                    <div className="messages-chat-header-info">
                      <div className="messages-chat-header-name">
                        {selectedConversation.job_id
                          ? (selectedConversation.job_name ?? 'Job')
                          : selectedConversation.other_participants?.length === 1
                            ? selectedConversation.other_participants[0].name
                            : selectedConversation.other_participants?.length
                              ? 'Team'
                              : 'Chat'}
                      </div>
                      <div className="messages-chat-header-meta">
                        {selectedConversation.job_id
                          ? 'Job group chat'
                          : selectedConversation.other_participants?.length === 1
                            ? 'Conversation'
                            : selectedConversation.other_participants?.length
                              ? `${selectedConversation.other_participants.length} participants`
                              : 'Conversation'}
                      </div>
                    </div>
                  </div>
                  <div className="messages-scroll messages-thread">
                    {messagesLoading ? (
                      <div className="messages-thread px-4 py-6">
                        <LoadingSkeleton variant="inline" lines={5} />
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="messages-thread-empty">
                        <div className="messages-thread-empty-icon">💬</div>
                        <div>No messages yet. Say hello!</div>
                      </div>
                    ) : (
                      messages.map((msg) => {
                        const isMe =
                          (effectiveMeId != null && msg.sender_id === effectiveMeId) ||
                          (employeePortal && isPreview && authUser != null && msg.sender_id === authUser.id)
                        const isGroup = (selectedConversation?.other_participants?.length ?? 0) > 1
                        const senderName =
                          !isMe &&
                          isGroup &&
                          selectedConversation?.other_participants?.find((p) => p.id === msg.sender_id)?.name
                        return (
                          <div
                            key={msg.id}
                            className="messages-bubble-wrap"
                            style={{ justifyContent: isMe ? 'flex-end' : 'flex-start' }}
                          >
                            <div className={isMe ? '' : 'flex flex-col items-start'}>
                              {senderName && (
                                <span className="text-[11px] font-medium text-[var(--text-muted)] mb-0.5">
                                  {senderName}
                                </span>
                              )}
                              <div className={`messages-bubble ${isMe ? 'me' : 'them'}`}>
                                {msg.body}
                                <div className="text-[10px] opacity-80 mt-1">
                                  {dayjs(msg.created_at).format('h:mm A')}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                  <form
                    className="messages-input-wrap"
                    onSubmit={(e) => {
                      e.preventDefault()
                      sendMessage()
                    }}
                  >
                    <div className="messages-input-inner">
                      <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type a message…"
                        className="messages-textarea flex-1 min-w-0 rounded-lg border border-gray-200 dark:border-border-dark bg-white dark:bg-dark-4 text-gray-900 dark:text-landing-white placeholder:text-gray-400 px-3 py-2 text-sm"
                        disabled={sending}
                      />
                      <button
                        type="submit"
                        disabled={!input.trim() || sending}
                        className="messages-send-btn p-2 rounded-lg bg-accent text-white hover:opacity-90 disabled:opacity-50"
                        aria-label="Send"
                      >
                        <Send size={14} />
                      </button>
                    </div>
                  </form>
                </>
              )}
              {!selectedId && (
                <div className="messages-no-selection">
                  <div className="messages-thread-empty-icon">💬</div>
                  <div>
                    {employeePortal
                      ? 'Select a conversation to view and reply. Contractors and PMs can message you from their side.'
                      : 'Select a conversation or start a new chat from Directory.'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
