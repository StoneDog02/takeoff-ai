import { supabase } from '@/lib/supabaseClient'

function projectUrl(): string {
  return (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim().replace(/\/$/, '') ?? ''
}

/** In Vite dev, use same-origin `/functions/v1/...` so the dev server can proxy to Supabase (avoids CORS "Failed to fetch"). */
function functionsBaseUrl(): string {
  if (import.meta.env.DEV) return ''
  return projectUrl()
}

function anonKey(): string {
  return (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? ''
}

/**
 * Call a Supabase Edge Function using `fetch` (avoids some `functions.invoke` + SW edge cases).
 * Sends `apikey` + `Authorization: Bearer <session>` like the JS client.
 */
export async function callEdgeFunctionJson<T = unknown>(
  functionName: string,
  options: {
    method?: 'GET' | 'POST'
    json?: Record<string, unknown>
  } = {}
): Promise<{ data: T | null; errorMessage: string | null; httpStatus: number }> {
  const base = functionsBaseUrl()
  const anon = anonKey()
  if ((!base && !import.meta.env.DEV) || !anon) {
    return { data: null, errorMessage: 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY', httpStatus: 0 }
  }
  if (!supabase) {
    return { data: null, errorMessage: 'Supabase is not configured', httpStatus: 0 }
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token

  const method = options.method ?? (options.json ? 'POST' : 'GET')
  const url = `${base}/functions/v1/${functionName}`

  const headers = new Headers()
  headers.set('apikey', anon)
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let res: Response
  try {
    if (method === 'GET') {
      res = await fetch(url, { method, headers })
    } else {
      headers.set('Content-Type', 'application/json')
      res = await fetch(url, {
        method,
        headers,
        body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
      })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      data: null,
      errorMessage: `Network error calling Edge Function: ${msg}`,
      httpStatus: 0,
    }
  }

  const text = await res.text()
  let parsed: unknown = null
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    parsed = { _raw: text }
  }

  if (!res.ok) {
    const errObj = parsed as { error?: string } | null
    return {
      data: parsed as T,
      errorMessage: typeof errObj?.error === 'string' ? errObj.error : `HTTP ${res.status}`,
      httpStatus: res.status,
    }
  }

  return { data: parsed as T, errorMessage: null, httpStatus: res.status }
}
