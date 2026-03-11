import { supabase } from '@/lib/supabaseClient'
import { API_BASE } from '@/api/config'

async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: HeadersInit = {}
  if (!supabase) return headers
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (session?.access_token) {
    (headers as Record<string, string>)['Authorization'] =
      `Bearer ${session.access_token}`
  }
  return headers
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || res.statusText)
  }
  return res.json() as Promise<T>
}

export interface QuickBooksCompanyInfo {
  CompanyInfo?: {
    CompanyName?: string
    LegalName?: string
    CompanyAddr?: { Line1?: string; City?: string; CountrySubDivisionCode?: string; PostalCode?: string }
  }
}

export interface QuickBooksQueryResponse<T = unknown> {
  QueryResponse?: { [key: string]: T[] }
  time?: string
}

export const quickbooksApi = {
  async getCompany(): Promise<QuickBooksCompanyInfo> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/quickbooks/company`, { headers })
    return handleResponse<QuickBooksCompanyInfo>(res)
  },

  async getInvoices(): Promise<QuickBooksQueryResponse> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/quickbooks/invoices`, { headers })
    return handleResponse<QuickBooksQueryResponse>(res)
  },

  async getPurchases(): Promise<QuickBooksQueryResponse> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/quickbooks/purchases`, { headers })
    return handleResponse<QuickBooksQueryResponse>(res)
  },

  async getExpenses(): Promise<QuickBooksQueryResponse> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/quickbooks/expenses`, { headers })
    return handleResponse<QuickBooksQueryResponse>(res)
  },

  async getPayrollStatus(): Promise<{ enabled: boolean; message?: string }> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/quickbooks/payroll/status`, { headers })
    return handleResponse<{ enabled: boolean; message?: string }>(res)
  },

  async createCharge(body: { amount: string; currency: string; token: string; [key: string]: unknown }): Promise<unknown> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/quickbooks/payments/charges`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return handleResponse(res)
  },
}
