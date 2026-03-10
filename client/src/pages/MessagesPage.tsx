import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Send, Plus } from 'lucide-react'
import { api } from '@/api/client'
import { useAuth } from '@/contexts/AuthContext'
import { dayjs } from '@/lib/date'
import type { ConversationListItem, Message } from '@/api/client'

const CHAT_COLORS = ['#15803d', '#374151', '#9a3412', '#7c3aed', '#0891b2', '#b45309']

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

export function MessagesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const conversationIdFromUrl = searchParams.get('conversation')
  const { user: authUser } = useAuth()

  const [conversations, setConversations] = useState<ConversationListItem[]>([])
  const [conversationsLoading, setConversationsLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(conversationIdFromUrl)
  const [messages, setMessages] = useState<Message[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSelectedId(conversationIdFromUrl)
  }, [conversationIdFromUrl])

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
        api.conversations.markRead(selectedId).catch(() => {})
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

  const filteredConversations = search.trim()
    ? conversations.filter((c) => (c.last_message?.body ?? '').toLowerCase().includes(search.toLowerCase()))
    : conversations

  const selectedConversation = selectedId ? conversations.find((c) => c.id === selectedId) : null

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
  }

  return (
    <div className="dashboard-app messages-page min-h-full">
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
        <div className="messages-body">
          <div className="messages-left-panel">
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
                <div className="messages-loading">Loading…</div>
              ) : filteredConversations.length === 0 ? (
                <div className="messages-empty">No conversations yet. Start a chat from Directory.</div>
              ) : (
                filteredConversations.map((c, i) => {
                  const isActive = selectedId === c.id
                  const last = c.last_message
                  const preview = last?.body?.slice(0, 50) ?? 'No messages yet'
                  const timeLabel = last ? dayjs(last.created_at).format('MMM D, h:mm A') : '—'
                  const color = CHAT_COLORS[i % CHAT_COLORS.length]
                  return (
                    <div
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => selectConversation(c.id)}
                      onKeyDown={(e) => e.key === 'Enter' && selectConversation(c.id)}
                      className={`messages-contact-row ${isActive ? 'active' : ''}`}
                    >
                      <Avatar initials="?" color={color} size={40} />
                      <div className="messages-contact-info">
                        <div className="messages-contact-top">
                          <span className="messages-contact-name">Chat</span>
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
          <div className="messages-right-wrap">
            <div className="messages-chat-panel">
              {selectedId && selectedConversation && (
                <>
                  <div className="messages-chat-header">
                    <Avatar initials="?" color={CHAT_COLORS[0]} size={42} />
                    <div className="messages-chat-header-info">
                      <div className="messages-chat-header-name">Chat</div>
                      <div className="messages-chat-header-meta">Conversation</div>
                    </div>
                  </div>
                  <div className="messages-scroll messages-thread">
                    {messagesLoading ? (
                      <div className="messages-loading">Loading messages…</div>
                    ) : messages.length === 0 ? (
                      <div className="messages-thread-empty">
                        <div className="messages-thread-empty-icon">💬</div>
                        <div>No messages yet. Say hello!</div>
                      </div>
                    ) : (
                      messages.map((msg) => {
                        const isMe = authUser?.id && msg.sender_id === authUser.id
                        return (
                          <div
                            key={msg.id}
                            className="messages-bubble-wrap"
                            style={{ justifyContent: isMe ? 'flex-end' : 'flex-start' }}
                          >
                            <div className={`messages-bubble ${isMe ? 'me' : 'them'}`}>
                              {msg.body}
                              <div className="text-[10px] opacity-80 mt-1">
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
                  <div>Select a conversation or start a new chat from Directory.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
