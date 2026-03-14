import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import type { DirectoryContractor } from '@/data/mockDirectoryData'
import type { ThreadMessage } from '@/data/mockDirectoryData'
import { api } from '@/api/client'
import type { Contractor } from '@/types/global'
import { DirectoryTabView } from '@/components/directory/DirectoryTabView'
import { MessagesTabView } from '@/components/directory/MessagesTabView'
import { EmployeesTabView } from '@/components/directory/EmployeesTabView'
import { TeamChatView } from '@/components/directory/TeamChatView'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'

type DirectorySubTab = 'directory' | 'messages'
type DirectoryContentTab = 'contractors' | 'employees' | 'team'

const SUB_TABS: { id: DirectorySubTab; label: string }[] = [
  { id: 'directory', label: 'Directory' },
  { id: 'messages', label: 'Messages' },
]

const DIRECTORY_CONTENT_TABS: { id: DirectoryContentTab; label: string }[] = [
  { id: 'contractors', label: 'Contractors' },
  { id: 'employees', label: 'Employees' },
  { id: 'team', label: 'Team' },
]

function contractorsToDirectory(c: Contractor): DirectoryContractor {
  const initials = c.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const tradeColors: Record<string, string> = {
    Electrical: '#1d4ed8',
    Plumbing: '#0891b2',
    HVAC: '#047857',
    Drywall: '#7c3aed',
    Flooring: '#b45309',
    Other: '#9ca3af',
  }
  return {
    id: c.id,
    name: c.name,
    trade: c.trade || 'Other',
    email: c.email,
    phone: c.phone ?? '',
    notes: '',
    rating: 4,
    jobs: [],
    avatar: initials,
    color: tradeColors[c.trade] ?? '#6b7280',
    status: 'offline',
    lastMsg: '',
    lastTime: '',
    unread: 0,
  }
}

export function DirectoryPage() {
  const location = useLocation()
  const [subTab, setSubTab] = useState<DirectorySubTab>(
    location.pathname === '/messages' ? 'messages' : 'directory'
  )
  const [contentTab, setContentTab] = useState<DirectoryContentTab>('contractors')
  const [contractors, setContractors] = useState<DirectoryContractor[]>([])
  const [threads, setThreads] = useState<Record<string, ThreadMessage[]>>({})
  const [messagingContact, setMessagingContact] =
    useState<DirectoryContractor | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.contractors
      .list()
      .then((list: Contractor[]) => {
        setContractors(list.map(contractorsToDirectory))
        setThreads({})
      })
      .catch(() => setContractors([]))
      .finally(() => setLoading(false))
  }, [])

  // When navigating to Messages with a specific contact (e.g. from "Message" button)
  useEffect(() => {
    if (messagingContact) {
      setSubTab('messages')
      setMessagingContact(null)
    }
  }, [messagingContact])

  const handleAdd = async (c: Omit<DirectoryContractor, 'id'> & { id: string }) => {
    try {
      const created = await api.contractors.create({
        name: c.name,
        trade: c.trade,
        email: c.email,
        phone: c.phone || undefined,
      })
      setContractors((prev) => [...prev, contractorsToDirectory(created)])
    } catch {
      // leave state unchanged; caller could show error
    }
  }

  const handleRemove = async (id: string) => {
    if (!window.confirm('Remove this contractor from your directory?')) return
    try {
      await api.contractors.delete(id)
      setContractors((prev) => prev.filter((x) => x.id !== id))
      setThreads((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    } catch {
      // leave state unchanged; could show error
    }
  }

  const handleMessage = (c: DirectoryContractor) => {
    setMessagingContact(c)
    setSubTab('messages')
  }

  // Clear pending contact after opening Messages so next "Message" click can pass a fresh one
  useEffect(() => {
    if (subTab === 'messages') setMessagingContact(null)
  }, [subTab])

  return (
    <div className="dashboard-app teams-page directory-page flex flex-col flex-1 min-h-0">
      <div className="teams-page-inner flex flex-col flex-1 min-h-0">
        <div className="dashboard-page-header teams-page-header flex-shrink-0">
          <h1 className="dashboard-title">Directory</h1>
        </div>

        {/* Main tabs + contacts sub-tabs in one block so no gap between them */}
        <div className="directory-tabs-wrap">
          <div className="teams-tab-bar">
            {SUB_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`teams-tab-btn directory-sub-tab ${subTab === t.id ? 'active' : ''}`}
                onClick={() => setSubTab(t.id)}
                aria-current={subTab === t.id ? 'true' : undefined}
              >
                <span className="directory-sub-tab-icon" aria-hidden>
                  {t.id === 'directory' && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                  )}
                  {t.id === 'messages' && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                  )}
                </span>
                {t.label}
              </button>
            ))}
          </div>
          {/* When Messages is selected: Contractors | Employees | Team (directly below main tabs) */}
          {subTab === 'messages' && (
            <div className="teams-tab-bar directory-contacts-tab-bar border-t border-border dark:border-border-dark/50">
              {DIRECTORY_CONTENT_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`teams-tab-btn directory-sub-tab ${contentTab === t.id ? 'active' : ''}`}
                  onClick={() => setContentTab(t.id)}
                  aria-current={contentTab === t.id ? 'true' : undefined}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="teams-page-content flex-1 min-h-0 flex flex-col">
          {loading && subTab === 'directory' ? (
            <div className="py-8">
              <LoadingSkeleton variant="inline" lines={6} className="max-w-md mx-auto" />
            </div>
          ) : subTab === 'directory' ? (
            <DirectoryTabView
              contractors={contractors}
              onAdd={handleAdd}
              onRemove={handleRemove}
              onMessage={handleMessage}
            />
          ) : (
            contentTab === 'contractors' ? (
              <MessagesTabView
                contractors={contractors}
                threads={threads}
                onThreadsChange={setThreads}
                initialContact={messagingContact || undefined}
              />
            ) : contentTab === 'employees' ? (
              <EmployeesTabView />
            ) : (
              <TeamChatView />
            )
          )}
        </div>
      </div>
    </div>
  )
}
