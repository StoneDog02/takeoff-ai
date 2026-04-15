import { FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'

function anonKey(): string {
  return (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? ''
}

/**
 * Call a Supabase Edge Function via the JS client (`functions.invoke`).
 * Requests go to `VITE_SUPABASE_URL/functions/v1/...` (not same-origin `/functions/v1`), so production
 * does not depend on Netlify `_redirects` or a custom `/functions/v1` proxy forwarding auth correctly.
 */
export async function callEdgeFunctionJson<T = unknown>(
  functionName: string,
  options: {
    method?: 'GET' | 'POST'
    json?: Record<string, unknown>
    /**
     * Use when the session was just created (e.g. signUp) and `getSession()` may not
     * have the access token persisted yet — without this, Edge calls return 401.
     */
    accessToken?: string | null
  } = {}
): Promise<{ data: T | null; errorMessage: string | null; httpStatus: number }> {
  const anon = anonKey()
  if (!anon) {
    return { data: null, errorMessage: 'Missing VITE_SUPABASE_ANON_KEY', httpStatus: 0 }
  }
  if (!supabase) {
    return { data: null, errorMessage: 'Supabase is not configured', httpStatus: 0 }
  }

  let token: string | undefined
  if (options.accessToken !== undefined) {
    token = options.accessToken ?? undefined
  } else {
    // Session is often not hydrated on the first tick after email confirmation / refresh — retry
    // so we never POST without Authorization (Supabase gateway returns 401).
    for (let i = 0; i < 30; i++) {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      token = session?.access_token
      if (token) break
      await new Promise((r) => setTimeout(r, 100))
    }
  }

  const method = options.method ?? (options.json ? 'POST' : 'GET')

  if (!token && method !== 'GET' && options.json !== undefined) {
    return {
      data: null,
      errorMessage: 'Not authenticated yet — try again in a moment.',
      httpStatus: 401,
    }
  }

  const invokeHeaders: Record<string, string> = {}
  if (token) invokeHeaders.Authorization = `Bearer ${token}`

  let invokeResult: Awaited<ReturnType<(typeof supabase)['functions']['invoke']>>
  try {
    invokeResult = await supabase.functions.invoke<T>(functionName, {
      method,
      body: method === 'GET' ? undefined : options.json,
      headers: Object.keys(invokeHeaders).length ? invokeHeaders : undefined,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      data: null,
      errorMessage: `Network error calling Edge Function: ${msg}`,
      httpStatus: 0,
    }
  }

  const { data, error, response } = invokeResult

  if (error) {
    if (error instanceof FunctionsHttpError && response) {
      const status = response.status
      const text = await response.text()
      let parsed: unknown = null
      try {
        parsed = text ? JSON.parse(text) : null
      } catch {
        parsed = { _raw: text }
      }
      const errObj = parsed as { error?: string } | null
      return {
        data: parsed as T,
        errorMessage: typeof errObj?.error === 'string' ? errObj.error : `HTTP ${status}`,
        httpStatus: status,
      }
    }
    if (error instanceof FunctionsRelayError) {
      return {
        data: null,
        errorMessage: error.message || 'Edge Function relay error',
        httpStatus: 0,
      }
    }
    const msg = error instanceof Error ? error.message : String(error)
    return {
      data: null,
      errorMessage: msg || 'Edge Function request failed',
      httpStatus: 0,
    }
  }

  const httpStatus = response?.status ?? 200
  return { data: data as T, errorMessage: null, httpStatus }
}
