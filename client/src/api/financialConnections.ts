import { API_BASE } from './config'

export type FinancialConnectionsAccount = {
  id: string
  display_name: string | null
  institution_name: string | null
  last4: string | null
  status: string | null
  category?: string | null
}

export async function createFinancialConnectionsSession(opts: {
  accessToken?: string | null
  email?: string
}): Promise<{ client_secret: string; stripe_customer_id: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.accessToken) headers.Authorization = `Bearer ${opts.accessToken}`
  const body = opts.accessToken ? '{}' : JSON.stringify({ email: opts.email ?? '' })
  const res = await fetch(`${API_BASE}/stripe/financial-connections-session`, {
    method: 'POST',
    headers,
    body,
  })
  const data = (await res.json().catch(() => ({}))) as { error?: string; client_secret?: string }
  if (!res.ok) throw new Error(data.error || 'Could not start bank linking')
  if (!data.client_secret) throw new Error('Invalid response from server')
  return {
    client_secret: data.client_secret,
    stripe_customer_id: (data as { stripe_customer_id?: string }).stripe_customer_id || '',
  }
}

export async function syncFinancialConnections(
  accessToken: string
): Promise<{ accounts: FinancialConnectionsAccount[] }> {
  const res = await fetch(`${API_BASE}/stripe/financial-connections-sync`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })
  const data = (await res.json().catch(() => ({}))) as {
    error?: string
    accounts?: FinancialConnectionsAccount[]
  }
  if (!res.ok) throw new Error(data.error || 'Sync failed')
  return { accounts: data.accounts || [] }
}

export async function getFinancialConnectionsStatus(
  accessToken: string
): Promise<{ stripe_customer_id: string | null; accounts: FinancialConnectionsAccount[] }> {
  const res = await fetch(`${API_BASE}/stripe/financial-connections-status`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = (await res.json().catch(() => ({}))) as {
    error?: string
    stripe_customer_id?: string | null
    accounts?: FinancialConnectionsAccount[]
  }
  if (!res.ok) throw new Error(data.error || 'Failed to load bank status')
  return {
    stripe_customer_id: data.stripe_customer_id ?? null,
    accounts: data.accounts || [],
  }
}
