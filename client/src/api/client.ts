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

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || res.statusText)
  }
  return res.json() as Promise<T>
}

export interface TakeoffItem {
  description: string
  quantity: number
  unit: string
  notes?: string
}

export interface TakeoffCategory {
  name: string
  items: TakeoffItem[]
}

export interface MaterialList {
  categories: TakeoffCategory[]
  summary?: string
}

export interface BuildListItem {
  id: string
  name: string
  created_at: string
  status?: string
}

export interface BuildListDetail extends BuildListItem {
  plan_file_name?: string
  plan_file_url?: string
  material_list: MaterialList
}

export interface TakeoffResponse {
  id: string
  name: string
  materialList: MaterialList
  createdAt?: string
}

export const api = {
  async runTakeoff(file: File, name?: string): Promise<TakeoffResponse> {
    const form = new FormData()
    form.append('file', file)
    if (name) form.append('name', name)
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/takeoff`, {
      method: 'POST',
      body: form,
      headers,
    })
    return handleResponse<TakeoffResponse>(res)
  },

  async getBuildLists(): Promise<BuildListItem[]> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/build-lists`, { headers })
    return handleResponse<BuildListItem[]>(res)
  },

  async getBuildList(id: string): Promise<BuildListDetail> {
    const headers = await getAuthHeaders()
    const res = await fetch(`${API_BASE}/build-lists/${id}`, { headers })
    return handleResponse<BuildListDetail>(res)
  },
}
