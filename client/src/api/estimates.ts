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
import { isPublicDemo, DEMO_PM_USER_ID } from '@/lib/publicDemo'
import {
  MOCK_JOBS,
  MOCK_ESTIMATES,
  MOCK_INVOICES,
  MOCK_CUSTOM_PRODUCTS,
  MOCK_JOB_EXPENSES,
  MOCK_JOB_SPEND_SUMMARIES,
  getMockEstimateWithLines,
  getMockInvoice,
  getMockJobExpensesByJob,
} from '@/data/mockEstimatesData'

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

/** Parsed QuickBooks-style spreadsheet (preview before import). */
export interface CustomProductsImportPreview {
  totalParsed: number
  wouldInsert: number
  skippedDuplicates: number
  previewRows: Array<{
    name: string
    description: string | null
    unit: string
    default_unit_price: number
    sub_cost: number | null
    item_type: string
    taxable: boolean
    sourceRow: number
  }>
  warnings: string[]
  parseErrors: Array<{ row: number; message: string }>
}

/** Result after POST /custom-products/import */
export interface CustomProductsImportResult {
  inserted: number
  skippedDuplicates: number
  totalParsed: number
  warnings: string[]
  parseErrors: Array<{ row: number; message: string }>
}

export const estimatesApi = {
  // Jobs (projects as jobs)
  async getJobs(): Promise<Job[]> {
    if (isPublicDemo()) return Promise.resolve(MOCK_JOBS)
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/jobs`, { headers })
    return handleResponse<Job[]>(res)
  },

  // Estimates
  async getEstimates(jobId?: string): Promise<Estimate[]> {
    if (isPublicDemo()) {
      const list = jobId ? MOCK_ESTIMATES.filter((e) => e.job_id === jobId) : MOCK_ESTIMATES
      return Promise.resolve(list)
    }
    const headers = await getAuthHeaders()
    const url = jobId
      ? `${API_BASE}/estimates?job_id=${encodeURIComponent(jobId)}`
      : `${API_BASE}/estimates`
    const res = await fetch(url, { headers })
    return handleResponse<Estimate[]>(res)
  },

  async getEstimate(id: string): Promise<EstimateWithLines> {
    if (isPublicDemo()) {
      const e = getMockEstimateWithLines(id)
      if (!e) return Promise.reject(new Error('Estimate not found'))
      return Promise.resolve(e)
    }
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/estimates/${id}`, { headers })
    return handleResponse<EstimateWithLines>(res)
  },

  async createEstimate(params: { job_id?: string; title?: string }): Promise<EstimateWithLines> {
    if (isPublicDemo()) {
      const t = new Date().toISOString()
      return Promise.resolve({
        id: `est-demo-${Date.now()}`,
        job_id: params.job_id ?? 'demo',
        title: params.title ?? 'New estimate',
        status: 'draft',
        total_amount: 0,
        invoiced_amount: 0,
        recipient_emails: [],
        created_at: t,
        updated_at: t,
        line_items: [],
      })
    }
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
    if (isPublicDemo()) {
      const existing = getMockEstimateWithLines(id)
      if (!existing) return Promise.reject(new Error('Not found'))
      return Promise.resolve({ ...existing, ...updates } as Estimate)
    }
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/estimates/${id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    return handleResponse<Estimate>(res)
  },

  async deleteEstimate(id: string): Promise<void> {
    if (isPublicDemo()) return Promise.resolve()
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
      /** When `unit` is `pct`, resolved dollar total (percentage × hard subtotal). */
      total?: number
    }
  ): Promise<EstimateLineItem> {
    if (isPublicDemo()) {
      return Promise.resolve({
        id: `li-demo-${Date.now()}`,
        estimate_id: estimateId,
        product_id: item.custom_product_id ?? null,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        total: item.total ?? item.quantity * item.unit_price,
        section: item.section ?? null,
      })
    }
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
    if (isPublicDemo()) {
      const e = getMockEstimateWithLines(estimateId)
      const li = e?.line_items.find((l) => l.id === lineId)
      if (!li) return Promise.reject(new Error('Line not found'))
      return Promise.resolve({ ...li, ...updates })
    }
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
    if (isPublicDemo()) return Promise.resolve()
    const headers = await getAuthHeaders()
    const res = await fetch(
      `${API_BASE}/estimates/${estimateId}/line-items/${lineId}`,
      { method: 'DELETE', headers }
    )
    return handleResponse<void>(res)
  },

  /** After saving line items on an already-accepted estimate, refresh the project budget. */
  async syncProjectBudgetFromEstimate(estimateId: string): Promise<{ ok: boolean }> {
    if (isPublicDemo()) return Promise.resolve({ ok: true })
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/estimates/${estimateId}/sync-project-budget`, {
      method: 'POST',
      headers,
    })
    return handleResponse<{ ok: boolean }>(res)
  },

  async convertToInvoice(
    estimateId: string,
    options?: {
      due_date?: string
      amount?: number
      /** Progress invoice: milestone schedule for client portal (see server invoicePortal). */
      schedule_snapshot?: { rows: unknown[] } | null
    }
  ): Promise<{ invoice: Invoice; estimate?: Estimate }> {
    if (isPublicDemo()) {
      const est = getMockEstimateWithLines(estimateId)
      const inv: Invoice = {
        id: `inv-demo-${Date.now()}`,
        estimate_id: estimateId,
        job_id: est?.job_id ?? 'demo',
        status: 'draft',
        total_amount: options?.amount ?? est?.total_amount ?? 0,
        recipient_emails: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      return Promise.resolve({ invoice: inv, estimate: est ?? undefined })
    }
    const headers = await getAuthHeaders()
    const res = await fetch(
      `${API_BASE}/estimates/${estimateId}/convert-to-invoice`,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          due_date: options?.due_date,
          amount: options?.amount,
          schedule_snapshot: options?.schedule_snapshot,
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
    if (isPublicDemo()) {
      const e = getMockEstimateWithLines(estimateId)
      if (!e) return Promise.reject(new Error('Not found'))
      return Promise.resolve({ ...e, status: 'sent', recipient_emails: payload.recipient_emails })
    }
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/estimates/${estimateId}/send`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return handleResponse<Estimate>(res)
  },

  /** Resend the client portal link using reminder copy (estimate must already be sent; same token). */
  async sendEstimateReminder(estimateId: string): Promise<{ ok: boolean; emailed_to: string }> {
    if (isPublicDemo()) {
      return Promise.resolve({ ok: true, emailed_to: 'client@example.com' })
    }
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/estimates/${estimateId}/remind`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    return handleResponse<{ ok: boolean; emailed_to: string }>(res)
  },

  // Invoices
  async getInvoices(jobId?: string): Promise<Invoice[]> {
    if (isPublicDemo()) {
      const list = jobId ? MOCK_INVOICES.filter((i) => i.job_id === jobId) : MOCK_INVOICES
      return Promise.resolve(list)
    }
    const headers = await getAuthHeaders()
    const url = jobId
      ? `${API_BASE}/invoices?job_id=${encodeURIComponent(jobId)}`
      : `${API_BASE}/invoices`
    const res = await fetch(url, { headers })
    return handleResponse<Invoice[]>(res)
  },

  async getInvoice(id: string): Promise<Invoice> {
    if (isPublicDemo()) {
      const inv = getMockInvoice(id)
      if (!inv) return Promise.reject(new Error('Invoice not found'))
      return Promise.resolve(inv)
    }
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/invoices/${id}`, { headers })
    return handleResponse<Invoice>(res)
  },

  async createInvoice(params: {
    job_id?: string | null
    total_amount: number
    recipient_emails?: string[]
    due_date?: string
    estimate_id?: string | null
    status?: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue'
    schedule_snapshot?: Record<string, unknown>
  }): Promise<Invoice> {
    if (isPublicDemo()) {
      const t = new Date().toISOString()
      return Promise.resolve({
        id: `inv-new-${Date.now()}`,
        job_id: params.job_id ?? null,
        estimate_id: params.estimate_id ?? null,
        status: params.status ?? 'draft',
        total_amount: params.total_amount,
        recipient_emails: params.recipient_emails ?? [],
        created_at: t,
        updated_at: t,
        due_date: params.due_date,
        schedule_snapshot: params.schedule_snapshot ?? null,
      } as Invoice)
    }
    const headers = await getAuthHeaders()
    const body = { ...params }
    if (body.job_id === '' || body.job_id === undefined) delete body.job_id
    const res = await fetch(`${API_BASE}/invoices`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
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
    if (isPublicDemo()) {
      const inv = getMockInvoice(id)
      if (!inv) return Promise.reject(new Error('Not found'))
      return Promise.resolve({ ...inv, ...updates })
    }
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/invoices/${id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    return handleResponse<Invoice>(res)
  },

  async deleteInvoice(id: string): Promise<void> {
    if (isPublicDemo()) return Promise.resolve()
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/invoices/${id}`, { method: 'DELETE', headers })
    return handleResponse<void>(res)
  },

  async sendInvoice(
    invoiceId: string,
    recipient_emails: string[]
  ): Promise<Invoice> {
    if (isPublicDemo()) {
      const inv = getMockInvoice(invoiceId)
      if (!inv) return Promise.reject(new Error('Not found'))
      return Promise.resolve({ ...inv, status: 'sent', recipient_emails })
    }
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/invoices/${invoiceId}/send`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient_emails }),
    })
    return handleResponse<Invoice>(res)
  },

  async uploadInvoiceAttachment(invoiceId: string, file: File): Promise<Invoice> {
    if (isPublicDemo()) {
      const inv = getMockInvoice(invoiceId)
      if (!inv) return Promise.reject(new Error('Not found'))
      return Promise.resolve(inv)
    }
    const allHeaders = await getAuthHeaders()
    const form = new FormData()
    form.append('file', file)
    const headers: Record<string, string> = {}
    const auth = (allHeaders as Record<string, string> | undefined)?.Authorization
    if (auth) headers.Authorization = auth
    const res = await fetch(`${API_BASE}/invoices/${invoiceId}/attachments`, {
      method: 'POST',
      body: form,
      headers,
    })
    const data = await handleResponse<{ invoice: Invoice }>(res)
    return data.invoice
  },

  // Custom products
  async getCustomProducts(): Promise<CustomProduct[]> {
    if (isPublicDemo()) return Promise.resolve(MOCK_CUSTOM_PRODUCTS)
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/custom-products`, { headers })
    return handleResponse<CustomProduct[]>(res)
  },

  async previewCustomProductsImport(file: File): Promise<CustomProductsImportPreview> {
    if (isPublicDemo()) {
      return Promise.resolve({
        totalParsed: 0,
        wouldInsert: 0,
        skippedDuplicates: 0,
        previewRows: [],
        warnings: [],
        parseErrors: [],
      })
    }
    const headers = await getAuthHeaders()
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${API_BASE}/custom-products/import/preview`, {
      method: 'POST',
      headers,
      body: form,
    })
    return handleResponse<CustomProductsImportPreview>(res)
  },

  async importCustomProducts(file: File): Promise<CustomProductsImportResult> {
    if (isPublicDemo()) {
      return Promise.resolve({
        inserted: 0,
        skippedDuplicates: 0,
        totalParsed: 0,
        warnings: [],
        parseErrors: [],
      })
    }
    const headers = await getAuthHeaders()
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${API_BASE}/custom-products/import`, {
      method: 'POST',
      headers,
      body: form,
    })
    return handleResponse<CustomProductsImportResult>(res)
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
    if (isPublicDemo()) {
      const t = new Date().toISOString()
      return Promise.resolve({
        id: `prod-demo-${Date.now()}`,
        user_id: DEMO_PM_USER_ID,
        name: params.name,
        description: params.description ?? '',
        unit: params.unit ?? 'ea',
        default_unit_price: params.default_unit_price,
        item_type: params.item_type ?? 'service',
        created_at: t,
      })
    }
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
    if (isPublicDemo()) {
      const p = MOCK_CUSTOM_PRODUCTS.find((x) => x.id === id)
      if (!p) return Promise.reject(new Error('Not found'))
      return Promise.resolve({ ...p, ...updates })
    }
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/custom-products/${id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    return handleResponse<CustomProduct>(res)
  },

  async deleteCustomProduct(id: string): Promise<void> {
    if (isPublicDemo()) return Promise.resolve()
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/custom-products/${id}`, {
      method: 'DELETE',
      headers,
    })
    return handleResponse<void>(res)
  },

  // Job expenses (optional jobId; omit to fetch all for pipeline)
  async getJobExpenses(jobId?: string): Promise<JobExpense[]> {
    if (isPublicDemo()) {
      if (jobId) return Promise.resolve(getMockJobExpensesByJob(jobId))
      return Promise.resolve(MOCK_JOB_EXPENSES)
    }
    const headers = await getAuthHeaders()
    const url = jobId
      ? `${API_BASE}/job-expenses?job_id=${encodeURIComponent(jobId)}`
      : `${API_BASE}/job-expenses`
    const res = await fetch(url, { headers })
    return handleResponse<JobExpense[]>(res)
  },

  async getJobSpendSummaries(): Promise<JobSpendSummary[]> {
    if (isPublicDemo()) return Promise.resolve(MOCK_JOB_SPEND_SUMMARIES)
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
    if (isPublicDemo()) {
      return Promise.resolve({
        id: `exp-demo-${Date.now()}`,
        job_id: params.job_id,
        amount: params.amount,
        category: params.category,
        description: params.description,
        created_at: new Date().toISOString(),
        billable: params.billable ?? true,
        vendor: params.vendor,
      })
    }
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/job-expenses`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    return handleResponse<JobExpense>(res)
  },

  async deleteJobExpense(id: string): Promise<void> {
    if (isPublicDemo()) return Promise.resolve()
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
    /** Optional project/job id for paper-trail document link */
    job_id?: string
  }): Promise<{
    vendor?: string
    date?: string
    total?: number
    description?: string
    category?: string
  }> {
    if (isPublicDemo()) {
      return Promise.resolve({ vendor: 'Demo Supply', total: 42, description: 'Demo receipt', category: 'materials' })
    }
    const headers = await getAuthHeaders()
    const { image_base64, media_type, job_id } = params
    const res = await fetch(`${API_BASE}/receipts/scan`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_base64,
        media_type,
        ...(job_id ? { job_id } : {}),
      }),
    })
    return handleResponse(res)
  },
}
