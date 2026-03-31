import type {
  CompanyProfile,
  NotificationPreferences,
  GeofenceDefaults,
  TaxCompliance,
  Integration,
  ExportScope,
  ExportFormat,
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

export interface SettingsResponse {
  company: CompanyProfile | null
  branding: {
    logoUrl?: string | null
    primaryColor: string
    secondaryColor: string
    invoiceTemplateStyle: string
  } | null
  notification_preferences: { prefs: NotificationPreferences['newBids'] extends Record<string, boolean> ? Record<string, Record<string, boolean>> : Record<string, unknown> } | null
  geofence_defaults: { default_radius_meters: number; clock_out_tolerance_minutes: number } | null
  tax_compliance: {
    default_tax_rates: TaxCompliance['defaultTaxRates']
    contractor_license_number: string | null
    insurance_expiry_date: string | null
  } | null
  integrations: Array<{ id: string; integration_id: string; connected: boolean; config: Record<string, unknown> }>
}

export const settingsApi = {
  async getSettings(): Promise<SettingsResponse> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/settings`, { headers })
    return handleResponse<SettingsResponse>(res)
  },

  async updateCompany(data: Partial<CompanyProfile> & { address?: Partial<CompanyProfile['address']> }): Promise<CompanyProfile> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/settings/company`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return handleResponse<CompanyProfile>(res)
  },

  async updateBranding(data: {
    logoUrl?: string | null
    primaryColor?: string
    secondaryColor?: string
    invoiceTemplateStyle?: string
  }): Promise<{
    logoUrl: string | null
    primaryColor: string
    secondaryColor: string
    invoiceTemplateStyle: string
  }> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/settings/branding`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return handleResponse(res)
  },

  async updateNotificationPreferences(prefs: NotificationPreferences): Promise<{ prefs: Record<string, unknown> }> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/settings/notification-preferences`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefs }),
    })
    return handleResponse(res)
  },

  async updateGeofenceDefaults(data: { default_radius_meters?: number; clock_out_tolerance_minutes?: number }): Promise<GeofenceDefaults> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/settings/geofence-defaults`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return handleResponse(res)
  },

  async updateTaxCompliance(data: Partial<{ default_tax_rates: TaxCompliance['defaultTaxRates']; contractor_license_number: string | null; insurance_expiry_date: string | null }>): Promise<{ default_tax_rates: TaxCompliance['defaultTaxRates']; contractor_license_number: string | null; insurance_expiry_date: string | null }> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/settings/tax-compliance`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return handleResponse(res)
  },

  async getIntegrations(): Promise<Array<{ id: string; integration_id: string; connected: boolean; config: Record<string, unknown> }>> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/settings/integrations`, { headers })
    return handleResponse(res)
  },

  async updateIntegration(integrationId: string, data: { connected: boolean; config?: Record<string, unknown> }): Promise<Integration & { id: string }> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/settings/integrations/${encodeURIComponent(integrationId)}`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return handleResponse(res)
  },

  async uploadLogo(file: File, type: 'company' | 'branding'): Promise<{ url: string | null; path: string }> {
    const headers = await getAuthHeaders()
    const form = new FormData()
    form.append('file', file)
    form.append('type', type)
    const res = await fetch(`${API_BASE}/settings/upload-logo`, {
      method: 'POST',
      headers: headers as Record<string, string>,
      body: form,
    })
    return handleResponse(res)
  },

  async exportData(scope: ExportScope, format: ExportFormat): Promise<Blob> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/settings/export`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope, format }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error((data as { error?: string }).error || res.statusText)
    }
    return res.blob()
  },

  async wipeData(): Promise<void> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/settings/wipe-data`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true }),
    })
    await handleResponse(res)
  },

  async deleteAccount(): Promise<void> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/settings/delete-account`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true }),
    })
    await handleResponse(res)
  },
}
