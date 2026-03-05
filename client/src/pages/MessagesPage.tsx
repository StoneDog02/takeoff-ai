import { useState, useEffect } from 'react'
import { Search, Send, Phone, Mail, MapPin, Circle, MoreHorizontal, Paperclip, Smile, Plus, X } from 'lucide-react'
import { teamsApi } from '@/api/teams'
import { getAggregatedSubcontractors } from '@/api/directory'
import { getInitials } from '@/components/teams/TeamsAvatar'

// ── Types ─────────────────────────────────────────────────────────────────────
type DirectoryTab = 'Employees' | 'Subcontractors' | 'Companies'
type ContactStatus = 'online' | 'away' | 'offline'

export interface Contact {
  id: string
  name: string
  role: string
  avatar: string
  color: string
  phone: string
  email: string
  job: string
  status: ContactStatus
  lastMsg: string
  lastTime: string
  unread: number
}

interface ThreadMessage {
  id: number
  from: 'me' | 'them'
  text: string
  time: string
}

// ── Mock: Companies (initial seed; new ones added via Add company) ─────────────
const INITIAL_COMPANIES: Contact[] = [
  { id: 'c1', name: 'Hansen Lumber', role: 'Materials Supplier', avatar: 'HL', color: '#15803d', phone: '801-555-0620', email: 'orders@hansenlumber.com', job: 'Vendor', status: 'online', lastMsg: 'Your order is ready for pickup.', lastTime: '1h ago', unread: 1 },
  { id: 'c2', name: 'City Permits Office', role: 'Municipality', avatar: 'CP', color: '#374151', phone: '801-555-0801', email: 'permits@saltlake.gov', job: 'Permit #4821', status: 'offline', lastMsg: 'Permit approved. PDF attached.', lastTime: '3d ago', unread: 0 },
  { id: 'c3', name: 'Ames Equipment', role: 'Equipment Rental', avatar: 'AE', color: '#9a3412', phone: '801-555-0944', email: 'rent@amesequip.com', job: 'Vendor', status: 'away', lastMsg: 'Excavator available Friday.', lastTime: '5d ago', unread: 0 },
]

const COMPANY_COLORS = ['#15803d', '#374151', '#9a3412', '#7c3aed', '#0891b2', '#b45309']

const THREAD_MESSAGES: Record<string, ThreadMessage[]> = {
  default: [
    { id: 1, from: 'them', text: 'Hey, quick question about the cabinet delivery.', time: 'Mon 9:02 AM' },
    { id: 2, from: 'me', text: 'Sure, what\'s up?', time: 'Mon 9:04 AM' },
    { id: 3, from: 'them', text: 'They said it\'ll be Wednesday now instead of Tuesday. Does that work?', time: 'Mon 9:05 AM' },
    { id: 4, from: 'me', text: 'Yeah Wednesday works fine.', time: 'Mon 9:08 AM' },
  ],
}

const STATUS_COLOR: Record<ContactStatus, string> = {
  online: '#22c55e',
  away: '#f59e0b',
  offline: 'var(--text-muted)',
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({
  initials,
  color,
  size = 40,
  status,
}: {
  initials: string
  color: string
  size?: number
  status?: ContactStatus
}) {
  return (
    <div className="messages-avatar-wrap">
      <div
        className="messages-avatar"
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: color,
          color: '#fff',
          fontSize: size * 0.32,
        }}
      >
        {initials}
      </div>
      {status && (
        <div
          className="messages-avatar-status"
          style={{
            background: STATUS_COLOR[status],
            borderColor: 'var(--bg-page)',
          }}
        />
      )}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
type NewMessageModalMode = 'choose' | 'add_company'

export function MessagesPage() {
  const [tab, setTab] = useState<DirectoryTab>('Employees')
  const [employees, setEmployees] = useState<Contact[]>([])
  const [subcontractors, setSubcontractors] = useState<Contact[]>([])
  const [companies, setCompanies] = useState<Contact[]>(INITIAL_COMPANIES)
  const [loadingEmployees, setLoadingEmployees] = useState(true)
  const [loadingSubs, setLoadingSubs] = useState(true)
  const [selected, setSelected] = useState<Contact | null>(null)
  const [search, setSearch] = useState('')
  const [input, setInput] = useState('')
  const [threads, setThreads] = useState<Record<string, ThreadMessage[]>>(THREAD_MESSAGES)
  const [newMessageOpen, setNewMessageOpen] = useState(false)
  const [newMessageMode, setNewMessageMode] = useState<NewMessageModalMode>('choose')
  const [newMessageSearch, setNewMessageSearch] = useState('')
  const [addCompanyForm, setAddCompanyForm] = useState({ name: '', role: '', email: '', phone: '', job: 'Vendor' })
  const [addCompanySaving, setAddCompanySaving] = useState(false)

  const lists: Record<DirectoryTab, Contact[]> = {
    Employees: employees,
    Subcontractors: subcontractors,
    Companies: companies,
  }
  const currentList = lists[tab]

  useEffect(() => {
    setLoadingEmployees(true)
    teamsApi.employees
      .list()
      .then((list) => {
        const mapped: Contact[] = list.map((e, i) => ({
          id: e.id,
          name: e.name,
          role: e.role || 'Team member',
          avatar: getInitials(e.name),
          color: ['#c0392b', '#1d4ed8', '#047857', '#6b7280'][i % 4] as string,
          phone: e.phone || '',
          email: e.email,
          job: 'Unassigned',
          status: 'offline' as ContactStatus,
          lastMsg: 'No messages yet.',
          lastTime: '—',
          unread: 0,
        }))
        setEmployees(mapped)
        if (mapped.length > 0 && !selected) setSelected(mapped[0])
      })
      .catch(() => setEmployees([]))
      .finally(() => setLoadingEmployees(false))
  }, [])

  useEffect(() => {
    setLoadingSubs(true)
    getAggregatedSubcontractors()
      .then((list) => {
        const mapped: Contact[] = list.map((s, i) => ({
          id: s.id,
          name: s.name,
          role: s.trade || 'Subcontractor',
          avatar: s.name.slice(0, 2).toUpperCase(),
          color: ['#7c3aed', '#0891b2', '#b45309'][i % 3] as string,
          phone: s.phone || '',
          email: s.email || '',
          job: s.project_names?.length ? s.project_names.join(', ') : '—',
          status: 'offline' as ContactStatus,
          lastMsg: 'No messages yet.',
          lastTime: '—',
          unread: 0,
        }))
        setSubcontractors(mapped)
      })
      .catch(() => setSubcontractors([]))
      .finally(() => setLoadingSubs(false))
  }, [])

  const filtered = currentList.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.role.toLowerCase().includes(search.toLowerCase())
  )

  const totalUnread = (list: Contact[]) => list.reduce((s, p) => s + p.unread, 0)
  const messages = selected
    ? (threads[selected.id]?.length ? threads[selected.id] : threads.default || [])
    : []

  const sendMessage = () => {
    if (!input.trim() || !selected) return
    setThreads((t) => ({
      ...t,
      [selected.id]: [
        ...(t[selected.id] || []),
        { id: Date.now(), from: 'me', text: input.trim(), time: 'Just now' },
      ],
    }))
    setInput('')
  }

  const handleTabChange = (t: DirectoryTab) => {
    setTab(t)
    const list = lists[t]
    if (list.length > 0) setSelected(list[0])
    else setSelected(null)
  }

  const allContactsForPicker: { contact: Contact; source: DirectoryTab }[] = [
    ...employees.map((contact) => ({ contact, source: 'Employees' as DirectoryTab })),
    ...subcontractors.map((contact) => ({ contact, source: 'Subcontractors' as DirectoryTab })),
    ...companies.map((contact) => ({ contact, source: 'Companies' as DirectoryTab })),
  ]
  const pickerFiltered = allContactsForPicker.filter(
    ({ contact }) =>
      contact.name.toLowerCase().includes(newMessageSearch.toLowerCase()) ||
      contact.role.toLowerCase().includes(newMessageSearch.toLowerCase()) ||
      contact.email.toLowerCase().includes(newMessageSearch.toLowerCase())
  )

  const handleOpenNewMessage = () => {
    setNewMessageSearch('')
    setNewMessageMode('choose')
    setNewMessageOpen(true)
  }

  const handleOpenAddCompany = () => {
    setAddCompanyForm({ name: '', role: '', email: '', phone: '', job: 'Vendor' })
    setNewMessageMode('add_company')
    setNewMessageOpen(true)
  }

  const handlePickContact = (contact: Contact) => {
    setSelected(contact)
    setTab(
      employees.some((e) => e.id === contact.id)
        ? 'Employees'
        : subcontractors.some((s) => s.id === contact.id)
          ? 'Subcontractors'
          : 'Companies'
    )
    setNewMessageOpen(false)
  }

  const handleAddCompanySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!addCompanyForm.name.trim() || !addCompanyForm.email.trim()) return
    setAddCompanySaving(true)
    const initials = addCompanyForm.name
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
    const color = COMPANY_COLORS[companies.length % COMPANY_COLORS.length]
    const newContact: Contact = {
      id: `c-${Date.now()}`,
      name: addCompanyForm.name.trim(),
      role: addCompanyForm.role.trim() || 'Vendor',
      avatar: initials || '??',
      color,
      phone: addCompanyForm.phone.trim(),
      email: addCompanyForm.email.trim(),
      job: addCompanyForm.job.trim() || 'Vendor',
      status: 'offline',
      lastMsg: 'No messages yet.',
      lastTime: '—',
      unread: 0,
    }
    setCompanies((prev) => [...prev, newContact])
    setSelected(newContact)
    setTab('Companies')
    setNewMessageOpen(false)
    setAddCompanySaving(false)
  }

  return (
    <div className="dashboard-app messages-page min-h-full">
      <style>{`
        .messages-page * { box-sizing: border-box; }
        .messages-page ::placeholder { color: var(--text-muted); }
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
          {/* Left panel */}
          <div className="messages-left-panel">
            <div className="messages-tabs">
              {(['Employees', 'Subcontractors', 'Companies'] as const).map((t) => {
                const unread = totalUnread(lists[t])
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleTabChange(t)}
                    className={`messages-tab ${tab === t ? 'active' : ''}`}
                  >
                    {t}
                    {unread > 0 && <span className="messages-tab-badge">{unread}</span>}
                  </button>
                )
              })}
            </div>

            <div className="messages-new-row">
              <button type="button" className="messages-new-msg-btn" onClick={handleOpenNewMessage}>
                <Plus size={14} />
                New message
              </button>
              {tab === 'Companies' && (
                <button type="button" className="messages-add-company-btn" onClick={handleOpenAddCompany}>
                  <Plus size={14} />
                  Add company
                </button>
              )}
            </div>

            <div className="messages-search-wrap">
              <Search size={14} className="messages-search-icon" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${tab.toLowerCase()}…`}
                className="messages-search-input"
              />
            </div>

            <div className="messages-scroll messages-contact-list">
              {tab === 'Employees' && loadingEmployees ? (
                <div className="messages-loading">Loading…</div>
              ) : tab === 'Subcontractors' && loadingSubs ? (
                <div className="messages-loading">Loading…</div>
              ) : filtered.length === 0 ? (
                <div className="messages-empty">No {tab.toLowerCase()} to show.</div>
              ) : (
                filtered.map((person, _i) => {
                  const isActive = selected?.id === person.id
                  const msgs = threads[person.id] || []
                  const preview = msgs.length > 0 ? msgs[msgs.length - 1].text : person.lastMsg
                  return (
                    <div
                      key={person.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelected(person)}
                      onKeyDown={(e) => e.key === 'Enter' && setSelected(person)}
                      className={`messages-contact-row ${isActive ? 'active' : ''}`}
                    >
                      <Avatar initials={person.avatar} color={person.color} size={40} status={person.status} />
                      <div className="messages-contact-info">
                        <div className="messages-contact-top">
                          <span className="messages-contact-name">{person.name}</span>
                          <span className="messages-contact-time">{person.lastTime}</span>
                        </div>
                        <div className="messages-contact-role">{person.role}</div>
                        <div className="messages-contact-preview-wrap">
                          <span className="messages-contact-preview">{preview}</span>
                          {person.unread > 0 && (
                            <span className="messages-contact-unread">{person.unread}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Right: Chat + Profile */}
          <div className="messages-right-wrap">
            {/* Chat panel */}
            <div className="messages-chat-panel">
              {selected && (
                <>
                  <div className="messages-chat-header">
                    <Avatar initials={selected.avatar} color={selected.color} size={42} status={selected.status} />
                    <div className="messages-chat-header-info">
                      <div className="messages-chat-header-name">{selected.name}</div>
                      <div className="messages-chat-header-meta">
                        <Circle size={7} fill={STATUS_COLOR[selected.status]} color={STATUS_COLOR[selected.status]} />
                        {selected.status.charAt(0).toUpperCase() + selected.status.slice(1)} · {selected.role}
                      </div>
                    </div>
                    <div className="messages-chat-header-actions">
                      <a href={`tel:${selected.phone}`} className="messages-icon-btn" aria-label="Call">
                        <Phone size={15} />
                      </a>
                      <a href={`mailto:${selected.email}`} className="messages-icon-btn" aria-label="Email">
                        <Mail size={15} />
                      </a>
                      <button type="button" className="messages-icon-btn" aria-label="More">
                        <MoreHorizontal size={15} />
                      </button>
                    </div>
                  </div>

                  <div className="messages-scroll messages-thread">
                    {messages.length === 0 ? (
                      <div className="messages-thread-empty">
                        <div className="messages-thread-empty-icon">💬</div>
                        <div>No messages yet. Say hello!</div>
                      </div>
                    ) : (
                      messages.map((msg, i) => {
                        const isMe = msg.from === 'me'
                        const prevSame = i > 0 && messages[i - 1].from === msg.from
                        const showTime = i === 0 || messages[i - 1].time !== msg.time
                        return (
                          <div key={msg.id}>
                            {showTime && !prevSame && (
                              <div className="messages-time-divider">{msg.time}</div>
                            )}
                            <div
                              className="messages-bubble-wrap"
                              style={{ justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: prevSame ? 2 : 6 }}
                            >
                              {!isMe && !prevSame && (
                                <div
                                  className="messages-bubble-avatar"
                                  style={{ background: selected.color }}
                                >
                                  {selected.avatar}
                                </div>
                              )}
                              {!isMe && prevSame && <div className="messages-bubble-spacer" />}
                              <div
                                className={`messages-bubble ${isMe ? 'me' : 'them'}`}
                              >
                                {msg.text}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>

                  <div className="messages-input-wrap">
                    <div className="messages-input-inner">
                      <button type="button" className="messages-input-icon" aria-label="Attach">
                        <Paperclip size={16} />
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
                        placeholder={`Message ${selected.name.split(' ')[0] || ''}…`}
                        rows={1}
                        className="messages-textarea"
                      />
                      <button type="button" className="messages-input-icon" aria-label="Emoji">
                        <Smile size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={sendMessage}
                        className="messages-send-btn"
                        style={{
                          background: input.trim() ? 'var(--red)' : 'var(--bg-raised)',
                          cursor: input.trim() ? 'pointer' : 'default',
                        }}
                        aria-label="Send"
                      >
                        <Send size={14} color={input.trim() ? '#fff' : 'var(--text-muted)'} />
                      </button>
                    </div>
                    <div className="messages-input-hint">Enter to send · Shift+Enter for new line</div>
                  </div>
                </>
              )}
              {!selected && (
                <div className="messages-no-selection">
                  <div className="messages-thread-empty-icon">💬</div>
                  <div>Select a contact to start messaging.</div>
                </div>
              )}
            </div>

            {/* Profile panel */}
            {selected && (
              <div className="messages-profile-panel">
                <div className="messages-profile-card">
                  <div className="messages-profile-avatar-wrap">
                    <Avatar initials={selected.avatar} color={selected.color} size={60} status={selected.status} />
                  </div>
                  <div className="messages-profile-name">{selected.name}</div>
                  <div className="messages-profile-role">{selected.role}</div>
                  <div className="messages-profile-actions">
                    <a href={`tel:${selected.phone}`} className="messages-profile-btn">
                      <Phone size={13} />
                      <span>Call</span>
                    </a>
                    <a href={`mailto:${selected.email}`} className="messages-profile-btn">
                      <Mail size={13} />
                      <span>Email</span>
                    </a>
                  </div>
                </div>
                <div className="messages-details-card">
                  <div className="messages-details-title">Contact details</div>
                  <div className="messages-detail-row">
                    <div className="messages-detail-icon">
                      <Phone size={13} />
                    </div>
                    <span className="messages-detail-label">{selected.phone || '—'}</span>
                  </div>
                  <div className="messages-detail-row">
                    <div className="messages-detail-icon">
                      <Mail size={13} />
                    </div>
                    <span className="messages-detail-label">{selected.email}</span>
                  </div>
                  <div className="messages-detail-row">
                    <div className="messages-detail-icon">
                      <MapPin size={13} />
                    </div>
                    <span className="messages-detail-label">{selected.job}</span>
                  </div>
                </div>
                <div className="messages-job-card">
                  <div className="messages-details-title">Current job</div>
                  <div className="messages-job-inner">
                    <div className="messages-job-name">{selected.job}</div>
                    <div className="messages-job-meta">Active assignment</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* New message / Add company modal */}
        {newMessageOpen && (
          <div
            className="messages-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="messages-modal-title"
            onClick={() => setNewMessageOpen(false)}
          >
            <div className="messages-modal" onClick={(e) => e.stopPropagation()}>
              <div className="messages-modal-header">
                <h2 id="messages-modal-title" className="messages-modal-title">
                  {newMessageMode === 'choose' ? 'New message' : 'Add company'}
                </h2>
                <button
                  type="button"
                  className="messages-modal-close"
                  onClick={() => setNewMessageOpen(false)}
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              {newMessageMode === 'choose' ? (
                <>
                  <div className="messages-modal-search-wrap">
                    <Search size={14} className="messages-modal-search-icon" />
                    <input
                      type="search"
                      value={newMessageSearch}
                      onChange={(e) => setNewMessageSearch(e.target.value)}
                      placeholder="Search contacts…"
                      className="messages-modal-search-input"
                    />
                  </div>
                  <div className="messages-modal-list">
                    {pickerFiltered.length === 0 ? (
                      <div className="messages-modal-empty">No contacts match.</div>
                    ) : (
                      pickerFiltered.map(({ contact, source }) => (
                        <button
                          key={contact.id}
                          type="button"
                          className="messages-modal-contact-btn"
                          onClick={() => handlePickContact(contact)}
                        >
                          <Avatar initials={contact.avatar} color={contact.color} size={36} status={contact.status} />
                          <div className="messages-modal-contact-info">
                            <span className="messages-modal-contact-name">{contact.name}</span>
                            <span className="messages-modal-contact-meta">
                              {contact.role} · {source}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                  <div className="messages-modal-footer">
                    <button
                      type="button"
                      className="messages-modal-add-link"
                      onClick={() => {
                        setAddCompanyForm({ name: '', role: '', email: '', phone: '', job: 'Vendor' })
                        setNewMessageMode('add_company')
                      }}
                    >
                      + Add new company
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="messages-modal-back"
                    onClick={() => setNewMessageMode('choose')}
                  >
                    ← Back to contacts
                  </button>
                  <form onSubmit={handleAddCompanySubmit} className="messages-add-company-form">
                  <label className="messages-form-label">
                    Name <span className="messages-form-required">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={addCompanyForm.name}
                    onChange={(e) => setAddCompanyForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Company name"
                    className="messages-form-input"
                  />
                  <label className="messages-form-label">Role / type</label>
                  <input
                    type="text"
                    value={addCompanyForm.role}
                    onChange={(e) => setAddCompanyForm((f) => ({ ...f, role: e.target.value }))}
                    placeholder="e.g. Materials Supplier"
                    className="messages-form-input"
                  />
                  <label className="messages-form-label">
                    Email <span className="messages-form-required">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={addCompanyForm.email}
                    onChange={(e) => setAddCompanyForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="contact@company.com"
                    className="messages-form-input"
                  />
                  <label className="messages-form-label">Phone</label>
                  <input
                    type="tel"
                    value={addCompanyForm.phone}
                    onChange={(e) => setAddCompanyForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="Optional"
                    className="messages-form-input"
                  />
                  <label className="messages-form-label">Job / project</label>
                  <input
                    type="text"
                    value={addCompanyForm.job}
                    onChange={(e) => setAddCompanyForm((f) => ({ ...f, job: e.target.value }))}
                    placeholder="e.g. Vendor, Permit #123"
                    className="messages-form-input"
                  />
                  <div className="messages-form-actions">
                    <button type="button" className="messages-form-cancel" onClick={() => setNewMessageOpen(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="messages-form-submit" disabled={addCompanySaving}>
                      {addCompanySaving ? 'Adding…' : 'Add company'}
                    </button>
                  </div>
                </form>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
