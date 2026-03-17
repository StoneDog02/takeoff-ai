/**
 * reCAPTCHA v3 — load script and get a token for silent verification.
 * Set VITE_RECAPTCHA_SITE_KEY in .env to enable.
 * Skipped on localhost so you can test signup locally without verification.
 */

const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined
const SCRIPT_URL = 'https://www.google.com/recaptcha/api.js'

function isLocalhost(): boolean {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  return h === 'localhost' || h === '127.0.0.1'
}

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void
      execute: (siteKey: string, options: { action: string }) => Promise<string>
    }
  }
}

let scriptLoaded: Promise<void> | null = null

function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.grecaptcha?.execute) return Promise.resolve()
  if (scriptLoaded) return scriptLoaded
  scriptLoaded = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src^="${SCRIPT_URL}"]`)
    if (existing) {
      window.grecaptcha?.ready?.(() => resolve())
      return
    }
    const script = document.createElement('script')
    script.src = `${SCRIPT_URL}?render=${encodeURIComponent(SITE_KEY || '')}`
    script.async = true
    script.onload = () => {
      window.grecaptcha?.ready?.(() => resolve()) ?? resolve()
    }
    script.onerror = () => reject(new Error('reCAPTCHA script failed to load'))
    document.head.appendChild(script)
  })
  return scriptLoaded
}

/**
 * Get a reCAPTCHA v3 token for the given action.
 * Returns null on localhost or when VITE_RECAPTCHA_SITE_KEY is not set (caller skips verification).
 */
export async function getRecaptchaToken(action: string): Promise<string | null> {
  if (isLocalhost()) return null
  if (!SITE_KEY || !SITE_KEY.startsWith('6L')) return null
  await loadScript()
  if (!window.grecaptcha?.execute) return null
  return window.grecaptcha.execute(SITE_KEY, { action })
}

/** True only when site key is set and we're not on localhost (so verification runs in production). */
export const isRecaptchaConfigured =
  !isLocalhost() && Boolean(SITE_KEY && SITE_KEY.startsWith('6L'))
