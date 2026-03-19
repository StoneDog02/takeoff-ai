import type {
  Job,
  Estimate,
  EstimateLineItem,
  Invoice,
  CustomProduct,
  JobExpense,
  JobSpendSummary,
} from '@/types/global'
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
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

/** Estimate with line_items (from GET /estimates/:id) */
export interface EstimateWithLines extends Estimate {
  line_items: EstimateLineItem[]
  client_notes?: string | null
  client_terms?: string | null
  estimate_groups_meta?: unknown
}

export const estimatesApi = {
  // Jobs (projects as jobs)
  async getJobs(): Promise<Job[]> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/jobs`, { headers })
    return handleResponse<Job[]>(res)
  },

  // Estimates
  async getEstimates(jobId?: string): Promise<Estimate[]> {
    const headers = await getAuthHeaders()
    const url = jobId
      ? `${API_BASE}/estimates?job_id=${encodeURIComponent(jobId)}`
      : `${API_BASE}/estimates`
    const res = await fetch(url, { headers })
    return handleResponse<Estimate[]>(res)
  },

  async getEstimate(id: string): Promise<EstimateWithLines> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/estimates/${id}`, { headers })
    return handleResponse<EstimateWithLines>(res)
  },

  async createEstimate(params: { job_id?: string; title?: string }): Promise<EstimateWithLines> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/estimates`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    return handleResponse<EstimateWithLines>(res)
  },

  async updateEstimate(
    id: string,
    updates: Partial<
      Pick<
        Estimate,
        | 'job_id'
        | 'title'
        | 'status'
        | 'total_amount'
        | 'recipient_emails'
        | 'client_notes'
        | 'client_terms'
      >
    > & { estimate_groups_meta?: unknown | null }
  ): Promise<Estimate> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/estimates/${id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    return handleResponse<Estimate>(res)
  },

  async deleteEstimate(id: string): Promise<void> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/estimates/${id}`, {
      method: 'DELETE',
      headers,
    })
    return handleResponse<void>(res)
  },

  async addLineItem(
    estimateId: string,
    item: {
      custom_product_id?: string
      description: string
      quantity: number
      unit: string
      unit_price: number
      section?: string | null
    }
  ): Promise<EstimateLineItem> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/estimates/${estimateId}/line-items`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    })
    return handleResponse<EstimateLineItem>(res)
  },

  async updateLineItem(
    estimateId: string,
    lineId: string,
    updates: Partial<Pick<EstimateLineItem, 'description' | 'quantity' | 'unit' | 'unit_price' | 'section'>>
  ): Promise<EstimateLineItem> {
    const headers = await getAuthHeaders()
    const res = await fetch(
      `${API_BASE}/estimates/${estimateId}/line-items/${lineId}`,
      {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      }
    )
    return handleResponse<EstimateLineItem>(res)
  },

  async deleteLineItem(estimateId: string, lineId: string): Promise<void> {
    const headers = await getAuthHeaders()
    const res = await fetch(
      `${API_BASE}/estimates/${estimateId}/line-items/${lineId}`,
      { method: 'DELETE', headers }
    )
    return handleResponse<void>(res)
  },

  /** After saving line items on an already-accepted estimate, refresh the project budget. */
  async syncProjectBudgetFromEstimate(estimateId: string): Promise<{ ok: boolean }> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/estimates/${estimateId}/sync-project-budget`, {
      method: 'POST',
      headers,
    })
    return handleResponse<{ ok: boolean }>(res)
  },

  async convertToInvoice(
    estimateId: string,
    options?: { due_date?: string; amount?: number }
  ): Promise<{ invoice: Invoice; estimate?: Estimate }> {
    const headers = await getAuthHeaders()
    const res = await fetch(
      `${API_BASE}/estimates/${estimateId}/convert-to-invoice`,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          due_date: options?.due_date,
          amount: options?.amount,
        }),
      }
    )
    const data = await handleResponse<{ invoice: Invoice; estimate: Estimate | null }>(res)
    return { invoice: data.invoice, estimate: data.estimate ?? undefined }
  },

  /** Send estimate to client: sets client_token, status sent, project awaiting_approval; optional client/project/gc names for email. */
  async sendEstimate(
    estimateId: string,
    payload: {
      recipient_emails: string[]
      client_name?: string
      project_name?: string
      gc_name?: string
    }
  ): Promise<Estimate> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/estimates/${estimateId}/send`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return handleResponse<Estimate>(res)
  },

  // Invoices
  async getInvoices(jobId?: string): Promise<Invoice[]> {
    const headers = await getAuthHeaders()
    const url = jobId
      ? `${API_BASE}/invoices?job_id=${encodeURIComponent(jobId)}`
      : `${API_BASE}/invoices`
    const res = await fetch(url, { headers })
    return handleResponse<Invoice[]>(res)
  },

  async getInvoice(id: string): Promise<Invoice> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/invoices/${id}`, { headers })
    return handleResponse<Invoice>(res)
  },

  async updateInvoice(
    id: string,
    updates: Partial<
      Pick<
        Invoice,
        'status' | 'total_amount' | 'recipient_emails' | 'due_date' | 'paid_at'
      >
    >
  ): Promise<Invoice> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/invoices/${id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    return handleResponse<Invoice>(res)
  },

  async deleteInvoice(id: string): Promise<void> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/invoices/${id}`, { method: 'DELETE', headers })
    return handleResponse<void>(res)
  },

  async sendInvoice(
    invoiceId: string,
    recipient_emails: string[]
  ): Promise<Invoice> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/invoices/${invoiceId}/send`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient_emails }),
    })
    return handleResponse<Invoice>(res)
  },

  // Custom products
  async getCustomProducts(): Promise<CustomProduct[]> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/custom-products`, { headers })
    return handleResponse<CustomProduct[]>(res)
  },

  async createCustomProduct(params: {
    name: string
    description?: string
    unit?: string
    default_unit_price: number
    item_type?: 'service' | 'product' | 'labor' | 'sub' | 'material' | 'equipment'
    sub_cost?: number
    markup_pct?: number
    billed_price?: number
    trades?: string[]
    taxable?: boolean
  }): Promise<CustomProduct> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/custom-products`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    return handleResponse<CustomProduct>(res)
  },

  async updateCustomProduct(
    id: string,
    updates: Partial<
      Pick<CustomProduct, 'name' | 'description' | 'unit' | 'default_unit_price' | 'item_type' | 'sub_cost' | 'markup_pct' | 'billed_price' | 'trades' | 'taxable'>
    >
  ): Promise<CustomProduct> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/custom-products/${id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    return handleResponse<CustomProduct>(res)
  },

  async deleteCustomProduct(id: string): Promise<void> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/custom-products/${id}`, {
      method: 'DELETE',
      headers,
    })
    return handleResponse<void>(res)
  },

  // Job expenses (optional jobId; omit to fetch all for pipeline)
  async getJobExpenses(jobId?: string): Promise<JobExpense[]> {
    const headers = await getAuthHeaders()
    const url = jobId
      ? `${API_BASE}/job-expenses?job_id=${encodeURIComponent(jobId)}`
      : `${API_BASE}/job-expenses`
    const res = await fetch(url, { headers })
    return handleResponse<JobExpense[]>(res)
  },

  async getJobSpendSummaries(): Promise<JobSpendSummary[]> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/job-expenses/summary`, { headers })
    return handleResponse<JobSpendSummary[]>(res)
  },

  async createJobExpense(params: {
    job_id: string
    amount: number
    category: 'materials' | 'labor' | 'equipment' | 'misc' | 'subs'
    description?: string
    receipt_file_url?: string
    billable?: boolean
    vendor?: string
  }): Promise<JobExpense> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/job-expenses`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    return handleResponse<JobExpense>(res)
  },

  async deleteJobExpense(id: string): Promise<void> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/job-expenses/${id}`, {
      method: 'DELETE',
      headers,
    })
    return handleResponse<void>(res)
  },

  /** Scan receipt image via backend (e.g. Claude). Returns extracted fields or throws. */
  async scanReceipt(params: {
    image_base64: string
    media_type: string
  }): Promise<{
    vendor?: string
    date?: string
    total?: number
    description?: string
    category?: string
  }> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/receipts/scan`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    return handleResponse(res)
  },
}
