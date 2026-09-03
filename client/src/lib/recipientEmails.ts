/** Parse and normalize recipient email lists for estimate/invoice sends. */

/**
 * Split comma / semicolon / whitespace separated addresses, trim, drop empties,
 * and dedupe case-insensitively (keeps first casing).
 */
export function parseRecipientEmails(input: string | string[] | null | undefined): string[] {
  const raw = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(/[,;\s]+/)
      : []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of raw) {
    const email = String(item || '').trim()
    if (!email) continue
    const key = email.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(email)
  }
  return out
}

/** Primary address for project.client_email (single field). */
export function primaryRecipientEmail(input: string | string[] | null | undefined): string {
  return parseRecipientEmails(input)[0] || ''
}

/** Display helper for success copy / lists. */
export function formatRecipientEmailsLabel(emails: string[]): string {
  if (emails.length === 0) return 'the client'
  if (emails.length === 1) return emails[0]
  if (emails.length === 2) return `${emails[0]} and ${emails[1]}`
  return `${emails.length} recipients (${emails.join(', ')})`
}
