import { API_BASE } from '@/api/config'
import { getSessionAuthHeaders } from '@/api/authHeaders'
import { isPublicDemo, buildSyntheticMeResponse } from '@/lib/publicDemo'

export interface MeResponse {
  user: {
    id: string
    email: string
    full_name?: string | null
    display_name?: string
  } | null
  isAdmin: boolean
  /** True when subscription feature gates should be ignored (admin or profiles.full_product_access). */
  bypass_feature_gates?: boolean
  type: 'contractor' | 'employee'
  /** True when this login is linked to a row in affiliates (partner dashboard). Independent of profiles.role. */
  has_affiliate_portal?: boolean
  role_label?: string
  employee_id?: string
  employee?: {
    id: string
    name: string
    email: string
    role: string
    phone: string
    status: string
    current_compensation: number | null
    created_at: string
    updated_at: string
  }
  /** True when owner/admin is viewing the app as a roster employee (X-Act-As-Employee-Id). */
  acting_as_employee?: boolean
}

export async function getMe(): Promise<MeResponse> {
  /** Logged-in users (e.g. affiliates) can still run the interactive demo; it overrides /me. */
  if (isPublicDemo()) {
    return buildSyntheticMeResponse()
  }
  const headers = await getSessionAuthHeaders()
  const res = await fetch(`${API_BASE}/me`, { headers })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || res.statusText)
  }
  return res.json() as Promise<MeResponse>
}
