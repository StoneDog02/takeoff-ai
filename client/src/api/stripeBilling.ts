import { API_BASE } from '@/api/config'
import { getSessionAuthHeaders } from '@/api/authHeaders'

async function handleJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = data as { error?: string; code?: string }
    const e = new Error(err.error || res.statusText || 'Request failed') as Error & { code?: string }
    if (err.code) e.code = err.code
    throw e
  }
  return data as T
}

export type StripePaymentMethodSummary = {
  id: string
  brand: string
  last4: string
  exp_month: number | null
  exp_year: number | null
} | null

export type SubscriptionInvoiceRow = {
  id: string
  number: string | null
  amount_paid: number
  currency: string
  status: string | null
  created: number
  hosted_invoice_url: string | null
  invoice_pdf: string | null
}

export const stripeBillingApi = {
  async createBillingSetupIntent(): Promise<{ client_secret: string }> {
    const headers = await getSessionAuthHeaders()
    const res = await fetch(`${API_BASE}/stripe/billing-setup-intent`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    return handleJson(res)
  },

  async setDefaultPaymentMethod(payment_method_id: string): Promise<{ ok: boolean }> {
    const headers = await getSessionAuthHeaders()
    const res = await fetch(`${API_BASE}/stripe/set-default-payment-method`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_method_id }),
    })
    return handleJson(res)
  },

  async getPaymentMethod(): Promise<{ payment_method: StripePaymentMethodSummary }> {
    const headers = await getSessionAuthHeaders()
    const res = await fetch(`${API_BASE}/stripe/payment-method`, { headers })
    return handleJson(res)
  },

  async getSubscriptionInvoices(): Promise<{ invoices: SubscriptionInvoiceRow[] }> {
    const headers = await getSessionAuthHeaders()
    const res = await fetch(`${API_BASE}/stripe/subscription-invoices`, { headers })
    return handleJson(res)
  },

  async subscribePlan(price_id: string): Promise<{ subscription_id: string; updated: boolean }> {
    const headers = await getSessionAuthHeaders()
    const res = await fetch(`${API_BASE}/stripe/subscribe-plan`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ price_id }),
    })
    return handleJson(res)
  },
}
