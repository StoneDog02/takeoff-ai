import { useState } from 'react'

interface BulkSendModalProps {
  subCount: number
  onSend: (subject: string, body: string) => Promise<void>
  onClose: () => void
}

export function BulkSendModal({ subCount, onSend, onClose }: BulkSendModalProps) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    try {
      await onSend(subject, body)
      onClose()
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="rounded-lg border border-border dark:border-border-dark bg-surface-elevated dark:bg-dark-3 p-6 shadow-lg max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-landing-white mb-2">Bulk send to subcontractors</h2>
        <p className="text-sm text-muted dark:text-white-dim mb-4">
          Sending to {subCount} selected subcontractor{subCount !== 1 ? 's' : ''}.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-white-dim mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-md px-3 py-2 border border-border dark:border-border-dark bg-white dark:bg-dark-4 text-gray-900 dark:text-landing-white"
              placeholder="Email subject"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-white-dim mb-1">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              className="w-full rounded-md px-3 py-2 border border-border dark:border-border-dark bg-white dark:bg-dark-4 text-gray-900 dark:text-landing-white"
              placeholder="Compose your message…"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-border dark:border-border-dark text-muted dark:text-white-dim hover:bg-surface dark:hover:bg-dark-4"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending}
              className="px-4 py-2 rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
