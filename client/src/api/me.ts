import { supabase } from '@/lib/supabaseClient'

const API_BASE = '/api'

async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: HeadersInit = {}
  if (!supabase) return headers
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${session.access_token}`
  }
  return headers
}

export interface MeResponse {
  user: { id: string; email: string } | null
  isAdmin: boolean
  type: 'contractor' | 'employee'
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
}

export async function getMe(): Promise<MeResponse> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/me`, { headers })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || res.statusText)
  }
  return res.json() as Promise<MeResponse>
}
