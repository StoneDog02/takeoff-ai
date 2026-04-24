import { supabase } from '@/lib/supabaseClient'
import { API_BASE } from '@/api/config'

async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: HeadersInit = {}
  if (!supabase) return headers
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${session.access_token}`
  }
  return headers
}

/** Main marketing contractor signups (PM / field supervisor / subcontractor). Excludes employee portal logins and partner-portal-only profiles (`affiliate` role). */
export interface AdminStats {
  totalUsers: number
  newUsersLast7Days: number
  newUsersLast30Days: number
  /** Rows in `subscriptions` with Stripe-synced status `trialing`. */
  subscriptionsTrialing: number
  /** Paying or retained plans: `active`, `past_due`, or `paused`. */
  subscriptionsPaid: number
}

export async function getAdminStats(): Promise<AdminStats> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/stats`, { headers })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || res.statusText)
  }
  return res.json() as Promise<AdminStats>
}

export interface AdminUser {
  id: string
  email: string
  created_at: string | null
  last_sign_in_at: string | null
  /** Roster rows in `employees` for this contractor (`user_id` = auth id). */
  active_employee_count: number
}

export interface AdminUsersResponse {
  users: AdminUser[]
  page: number
  perPage: number
  total: number
}

export async function getAdminUsers(page = 1, perPage = 20): Promise<AdminUsersResponse> {
  const headers = await getAuthHeaders()
  const res = await fetch(
    `${API_BASE}/admin/users?page=${encodeURIComponent(page)}&per_page=${encodeURIComponent(perPage)}`,
    { headers }
  )
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || res.statusText)
  }
  return res.json() as Promise<AdminUsersResponse>
}

export interface AdminAffiliate {
  id: string
  name: string
  email: string
  phone: string | null
  commission_rate: number
  /** false = invite-only; no commission accrual */
  tracks_commission?: boolean
  active: boolean
  created_at: string
  updated_at: string
  referral_code: string | null
  /** Referred customers who created an account with this partner’s code */
  signup_count: number
  completed_referrals: number
  commission_cents_total: number
  /** Partner completed portal password setup (affiliates.auth_user_id is set). */
  portal_signed_up: boolean
}

export async function getAdminAffiliates(): Promise<{ affiliates: AdminAffiliate[] }> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/affiliates`, { headers })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || res.statusText)
  }
  return res.json() as Promise<{ affiliates: AdminAffiliate[] }>
}

export type AdminMyInviteResponse =
  | { has_invite: false }
  | {
      has_invite: true
      affiliate: {
        id: string
        name: string
        email: string
        active: boolean
        tracks_commission: boolean
      }
      /** Eligible subscription invoice share, when commission is tracked; null if invite-only */
      commission_percent: number | null
      referral_code: string | null
      referral_share_url: string | null
      signup_count: number
      completed_referrals: number
    }

export async function getAdminMyInvite(): Promise<AdminMyInviteResponse> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/affiliates/my-invite`, { headers })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || res.statusText)
  }
  return res.json() as Promise<AdminMyInviteResponse>
}

export async function provisionAdminMyInvite(body?: { name?: string }): Promise<{ affiliate: AdminAffiliate }> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/affiliates/my-invite/provision`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || res.statusText)
  }
  return res.json() as Promise<{ affiliate: AdminAffiliate }>
}

export async function postAdminMyInviteSendInvite(
  email: string
): Promise<{ success: boolean; message?: string }> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/affiliates/my-invite/send-invite`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  })
  const json = (await res.json().catch(() => ({}))) as { error?: string; success?: boolean; message?: string; code?: string }
  if (!res.ok) {
    throw new Error(json.error || res.statusText)
  }
  return { success: Boolean(json.success), message: json.message }
}

export async function createAdminAffiliate(body: {
  name: string
  email: string
  phone?: string
  commission_rate: number
}): Promise<{ affiliate: AdminAffiliate; welcome_email_sent?: boolean }> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/affiliates`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || res.statusText)
  }
  return res.json() as Promise<{ affiliate: AdminAffiliate; welcome_email_sent?: boolean }>
}

export async function patchAdminAffiliate(
  id: string,
  body: Partial<{
    name: string
    email: string
    phone: string | null
    commission_rate: number
    active: boolean
    tracks_commission: boolean
  }>
): Promise<{ affiliate: AdminAffiliate }> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/affiliates/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || res.statusText)
  }
  return res.json() as Promise<{ affiliate: AdminAffiliate }>
}

export async function deleteAdminAffiliate(id: string): Promise<{ success: boolean }> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/admin/affiliates/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers,
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || res.statusText)
  }
  return res.json() as Promise<{ success: boolean }>
}
