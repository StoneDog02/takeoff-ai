import { API_BASE } from '@/api/config'
import { getSessionAuthHeaders } from '@/api/authHeaders'

export type BillingPlan = {
  name: string
  description: string | null
  amount_cents: number
  currency: string
  interval: 'month' | 'year'
  formatted: string
}

export type BillingSubscription = {
  id: string
  status: string
  cancel_at_period_end: boolean
  current_period_start: string | null
  current_period_end: string | null
  trial_end: string | null
  /** Active Stripe price id when known (for plan picker / upgrades). */
  stripe_price_id?: string | null
  plan: BillingPlan | null
}

export type BillingLimits = {
  max_projects: number | null
  max_team_members: number | null
}

export type BillingSummary = {
  subscription: BillingSubscription | null
  usage: {
    project_count: number
    team_member_count: number
  }
  limits: BillingLimits
  manage_billing_url: string | null
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || res.statusText || 'Request failed')
  }
  return res.json() as Promise<T>
}

export const billingApi = {
  async getSummary(): Promise<BillingSummary> {
    const headers = await getSessionAuthHeaders()
    const res = await fetch(`${API_BASE}/settings/billing`, { headers })
    return handleResponse<BillingSummary>(res)
  },
}
