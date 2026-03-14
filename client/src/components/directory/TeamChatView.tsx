import { useState, useEffect, useRef, useMemo } from 'react'
import { Send, Users } from 'lucide-react'
import { teamsApi } from '@/api/teams'
import { api } from '@/api/client'
import type { Employee } from '@/types/global'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'
import { dayjs } from '@/lib/date'
import type { Message, ConversationListItem } from '@/api/client'
import { useAuth } from '@/contexts/AuthContext'

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const setA = new Set(a)
  for (const id of b) if (!setA.has(id)) return false
  return true
}

export function TeamChatView() {
  const { user: authUser } = useAuth()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [conversationLoading, setConversationLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const rosterAuthIds = useMemo(
    () =>
      employees
        .map((e) => e.auth_user_id)
        .filter((id): id is string => !!id)
        .sort(),
    [employees]
  )

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
    if (loading || rosterAuthIds.length === 0) {
      setConversationId(null)
      return
    }
    let cancelled = false
    setConversationLoading(true)
    setError(null)
    api.conversations
      .list()
      .then((list: ConversationListItem[]) => {
        if (cancelled) return
        const teamConvo = list.find(
          (c) =>
            c.other_participant_ids.length === rosterAuthIds.length &&
            sameSet(c.other_participant_ids, rosterAuthIds)
        )
        if (teamConvo) {
          setConversationId(teamConvo.id)
        } else {
          return api.conversations.create(rosterAuthIds)
        }
      })
      .then((created) => {
        if (cancelled) return
        if (created && created.id) setConversationId(created.id)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load team chat')
        }
      })
      .finally(() => {
        if (!cancelled) setConversationLoading(false)
      })
    return () => { cancelled = true }
  }, [loading, rosterAuthIds])

  useEffect(() => {
    if (!conversationId) {
      setMessages([])
      return
    }
    let cancelled = false
    setMessagesLoading(true)
    api.conversations
      .getMessages(conversationId)
      .then(({ messages: list }) => {
        if (!cancelled) {
          setMessages(list)
          setMessagesLoading(false)
          api.conversations.markRead(conversationId).catch(() => {})
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMessages([])
          setMessagesLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [conversationId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || !conversationId || sending) return
    setSending(true)
    try {
      const msg = await api.conversations.sendMessage(conversationId, text)
      setMessages((prev) => [...prev, msg])
      setInput('')
    } finally {
      setSending(false)
    }
  }

  const withAccess = employees.filter((e) => e.auth_user_id).length

  if (loading) {
    return (
      <div className="directory-tab-content w-full flex flex-col flex-1 min-h-0">
        <div className="flex flex-col gap-0 text-left mb-4">
          <h2 className="dashboard-title text-[20px] font-extrabold tracking-tight m-0">
            Team chat
          </h2>
          <p className="text-[13.5px] text-[var(--text-muted)] mt-1 mb-0">
            One group conversation with you and your whole roster.
          </p>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <LoadingSkeleton variant="inline" lines={4} />
        </div>
      </div>
    )
  }

  if (rosterAuthIds.length === 0) {
    return (
      <div className="directory-tab-content w-full flex flex-col flex-1 min-h-0">
        <div className="flex flex-col gap-0 text-left mb-4">
          <h2 className="dashboard-title text-[20px] font-extrabold tracking-tight m-0">
            Team chat
          </h2>
          <p className="text-[13.5px] text-[var(--text-muted)] mt-1 mb-0">
            One group conversation with you and your whole roster.
          </p>
        </div>
        <div className="flex-1 flex items-center justify-center rounded-2xl border border-border dark:border-border-dark bg-surface dark:bg-dark-3">
          <div className="text-center text-[var(--text-muted)] text-sm max-w-[320px] p-6">
            <Users className="mx-auto mb-3 opacity-60" size={32} />
            <p>
              No employees have accepted their invite yet. Once at least one person has
              joined the portal, you can use this team chat to message everyone in one place.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="directory-tab-content w-full flex flex-col flex-1 min-h-0">
      <div className="flex flex-col gap-0 text-left mb-4">
        <h2 className="dashboard-title text-[20px] font-extrabold tracking-tight m-0">
          Team chat
        </h2>
        <p className="text-[13.5px] text-[var(--text-muted)] mt-1 mb-0">
          One group conversation with you and your whole roster ({withAccess} with portal access).
        </p>
      </div>

      <div className="flex-1 flex flex-col min-h-0 rounded-2xl border border-border dark:border-border-dark bg-surface dark:bg-dark-3 overflow-hidden">
        {error && (
          <div className="px-4 py-2 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}
        {conversationLoading ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <LoadingSkeleton variant="inline" lines={3} />
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 min-h-0">
              {messagesLoading ? (
                <LoadingSkeleton variant="inline" lines={4} />
              ) : messages.length === 0 ? (
                <div className="text-center text-sm text-[var(--text-muted)] py-8">
                  No messages yet. Start the conversation!
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
                  placeholder="Message the whole team…"
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
        )}
      </div>
    </div>
  )
}
