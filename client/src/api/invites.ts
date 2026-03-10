import { API_BASE } from '@/api/config'

export interface ValidateInviteResponse {
  valid: boolean
  email?: string
  expires_at?: string
}

export async function validateInviteToken(token: string): Promise<ValidateInviteResponse> {
  const res = await fetch(`${API_BASE}/invites/validate/${encodeURIComponent(token)}`)
  return res.json() as Promise<ValidateInviteResponse>
}

export async function acceptInvite(token: string, password: string): Promise<void> {
  const res = await fetch(`${API_BASE}/invites/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || res.statusText)
  }
}
