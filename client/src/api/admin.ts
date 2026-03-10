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

export interface AdminStats {
  totalUsers: number
  newUsersLast7Days: number
  newUsersLast30Days: number
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
}

export interface AdminUsersResponse {
  users: AdminUser[]
  page: number
  perPage: number
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
