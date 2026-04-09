import { API_BASE } from '@/api/config'
import { getSessionAuthHeaders } from '@/api/authHeaders'

export interface AffiliateSetupValidation {
  valid: boolean
  name?: string
  email?: string
  commission_percent?: number
  error?: string
}

export async function validateAffiliateSetupToken(token: string): Promise<AffiliateSetupValidation> {
  const res = await fetch(`${API_BASE}/affiliates/portal/setup?token=${encodeURIComponent(token)}`)
  return res.json() as Promise<AffiliateSetupValidation>
}

export async function completeAffiliateSetup(token: string, password: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/affiliates/portal/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  })
  const json = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new Error(json.error || res.statusText)
  return json as { success: boolean }
}

export interface AffiliatePortalReferralRow {
  id: string
  referee_email: string | null
  signed_up_at: string | null
  status: string
  completed_at: string | null
  created_at: string | null
}

export interface AffiliatePortalSummary {
  affiliate: {
    id: string
    name: string
    email: string
    commission_percent: number
    active: boolean
  }
  referral_code: string | null
  referral_share_url: string | null
  signup_count: number
  completed_referrals: number
  commission_cents_total: number
  referrals: AffiliatePortalReferralRow[]
}

export async function getAffiliatePortalSummary(): Promise<AffiliatePortalSummary> {
  const headers = await getSessionAuthHeaders()
  const res = await fetch(`${API_BASE}/affiliates/portal/summary`, { headers })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || res.statusText)
  }
  return res.json() as Promise<AffiliatePortalSummary>
}
