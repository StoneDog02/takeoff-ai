import { API_BASE } from '@/api/config'
import { getSessionAuthHeaders } from '@/api/authHeaders'

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function showTabError(tab: Window, message: string) {
  try {
    tab.document.open()
    tab.document.write(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Error</title></head><body style="font-family:system-ui,sans-serif;padding:2rem;max-width:28rem;line-height:1.5"><p>${escapeHtml(message)}</p></body></html>`
    )
    tab.document.close()
  } catch {
    try {
      tab.close()
    } catch {
      /* noop */
    }
  }
}

/**
 * Owner session: resolve a signed storage URL and open it.
 * Opens a tab synchronously on click (so the popup is not blocked), then navigates it after fetch.
 */
export async function openOwnerInvoiceAttachment(invoiceId: string, attachmentId: string): Promise<void> {
  const tab = typeof window !== 'undefined' ? window.open('about:blank', '_blank') : null
  if (!tab) {
    console.warn('[invoice attachment] Could not open a new tab (popup blocked?)')
    return
  }

  try {
    const headers = await getSessionAuthHeaders()
    const url = `${API_BASE}/invoices/${encodeURIComponent(invoiceId)}/attachments/${encodeURIComponent(attachmentId)}/view?format=json`
    const res = await fetch(url, { headers })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      let detail = ''
      try {
        const j = JSON.parse(errText) as { error?: string }
        if (j?.error) detail = j.error
      } catch {
        /* ignore */
      }
      showTabError(tab, detail || `Could not open this file (${res.status}). Try signing in again.`)
      return
    }
    const data = (await res.json()) as { url?: string }
    if (typeof data.url !== 'string' || !data.url) {
      showTabError(tab, 'No file URL was returned.')
      return
    }
    tab.location.href = data.url
    try {
      tab.opener = null
    } catch {
      /* noop */
    }
  } catch {
    showTabError(tab, 'Network error while loading the file.')
  }
}
