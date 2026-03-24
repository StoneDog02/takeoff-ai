import { supabase } from '@/lib/supabaseClient'

/** Must match PreviewContext sessionStorage key */
const PREVIEW_STORAGE_KEY = 'takeoff-admin-preview'

/**
 * When an admin (or contractor) previews the employee app from Admin, we send the roster
 * employee id so the API applies that worker's assignments and employee-scoped behavior.
 * Only on `/employee/*` so the rest of the app still uses the normal session.
 */
export function appendActAsEmployeeHeader(headers: Record<string, string>): void {
  if (typeof window === 'undefined') return
  if (!window.location.pathname.startsWith('/employee')) return
  try {
    const raw = sessionStorage.getItem(PREVIEW_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as { role?: string; employee?: { id?: string } | null }
    if (parsed.role === 'employee' && parsed.employee?.id) {
      headers['X-Act-As-Employee-Id'] = parsed.employee.id
    }
  } catch {
    // ignore invalid JSON
  }
}

export async function getSessionAuthHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = {}
  if (!supabase) return headers
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }
  appendActAsEmployeeHeader(headers)
  return headers
}
