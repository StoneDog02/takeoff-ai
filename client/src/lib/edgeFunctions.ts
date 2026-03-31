import { supabase } from '@/lib/supabaseClient'

function projectUrl(): string {
  return (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim().replace(/\/$/, '') ?? ''
}

/**
 * Base URL for Edge Function fetch calls.
 * - Dev: same-origin `/functions/v1/...` (Vite proxy → Supabase).
 * - Prod (Netlify): same-origin when `VITE_EDGE_FUNCTIONS_RELATIVE` is true — `dist/_redirects` proxies to Supabase (avoids CORS / SW "Failed to fetch").
 * - Otherwise: direct `https://<project>.supabase.co` (requires browser → Supabase CORS to succeed).
 */
function functionsBaseUrl(): string {
  if (import.meta.env.DEV) return ''
  if (import.meta.env.VITE_EDGE_FUNCTIONS_RELATIVE === 'true') return ''
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
  // Same-origin `/functions/v1` (dev proxy or Netlify _redirects) uses empty `base`; only direct
  // cross-origin calls need `VITE_SUPABASE_URL` for the request URL.
  const sameOriginFunctions =
    import.meta.env.DEV || import.meta.env.VITE_EDGE_FUNCTIONS_RELATIVE === 'true'
  if (!anon || (!sameOriginFunctions && !projectUrl())) {
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
