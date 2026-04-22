/**
 * Public "See it in action" demo: sessionStorage-backed persona (with or without a real session).
 * Used by AuthProvider, API stubs, landing CTA, and affiliate partner portal. Keep free of React imports.
 */

import type { MeResponse } from '@/api/me'
import { DEMO_CONTRACTOR_USER_UUID, DEMO_EMPLOYEE_USER_UUID } from '@/data/demo/demoIds'
import { clearDemoBankTransactionSession } from '@/data/demo/bankTransactionFixtures'

export const PUBLIC_DEMO_STORAGE_KEY = 'takeoff-public-demo'

/** After exit, navigate here (must start with `/`). Cleared on exit. */
const PUBLIC_DEMO_EXIT_TO_KEY = 'takeoff-public-demo-exit-to'

export type PublicDemoPersona = 'pm' | 'employee'

interface StoredPublicDemo {
  persona: PublicDemoPersona
  v?: number
}

export const DEMO_PM_USER_ID = DEMO_CONTRACTOR_USER_UUID
export const DEMO_EMPLOYEE_ID = DEMO_EMPLOYEE_USER_UUID

function loadStored(): StoredPublicDemo | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(PUBLIC_DEMO_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredPublicDemo
    if (parsed.persona !== 'pm' && parsed.persona !== 'employee') return null
    return parsed
  } catch {
    return null
  }
}

function saveStored(value: StoredPublicDemo | null) {
  try {
    if (value) sessionStorage.setItem(PUBLIC_DEMO_STORAGE_KEY, JSON.stringify(value))
    else sessionStorage.removeItem(PUBLIC_DEMO_STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function isPublicDemo(): boolean {
  return loadStored() != null
}

export function getPublicDemoPersona(): PublicDemoPersona {
  return loadStored()?.persona ?? 'pm'
}

export function setPublicDemoPersona(persona: PublicDemoPersona) {
  saveStored({ persona, v: 1 })
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('takeoff-public-demo-change'))
  }
}

export function enterPublicDemo(
  persona: PublicDemoPersona = 'pm',
  options?: { exitTo?: string },
) {
  saveStored({ persona, v: 1 })
  try {
    const to = options?.exitTo
    if (typeof to === 'string' && to.startsWith('/') && !to.startsWith('//')) {
      sessionStorage.setItem(PUBLIC_DEMO_EXIT_TO_KEY, to)
    } else {
      sessionStorage.removeItem(PUBLIC_DEMO_EXIT_TO_KEY)
    }
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('takeoff-public-demo-change'))
  }
}

/** Ends the demo. Returns a pathname to navigate to (e.g. `/affiliate`) or `null` for home `/`. */
export function exitPublicDemo(): string | null {
  let exitTo: string | null = null
  try {
    const raw = sessionStorage.getItem(PUBLIC_DEMO_EXIT_TO_KEY)
    if (raw && raw.startsWith('/') && !raw.startsWith('//')) exitTo = raw
    sessionStorage.removeItem(PUBLIC_DEMO_EXIT_TO_KEY)
  } catch {
    // ignore
  }
  saveStored(null)
  clearDemoBankTransactionSession()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('takeoff-public-demo-change'))
  }
  return exitTo
}

/** Synthetic /me payload for demo (no network). */
export function buildSyntheticMeResponse(): MeResponse {
  const persona = getPublicDemoPersona()
  if (persona === 'employee') {
    const now = new Date().toISOString()
    return {
      user: {
        id: DEMO_EMPLOYEE_ID,
        email: 'demo.employee@example.com',
        display_name: 'Jamie K.',
      },
      isAdmin: false,
      /** Marketing preview: show full product without a Stripe subscription row. */
      bypass_feature_gates: true,
      type: 'employee',
      has_affiliate_portal: false,
      employee_id: DEMO_EMPLOYEE_ID,
      employee: {
        id: DEMO_EMPLOYEE_ID,
        name: 'Jamie K.',
        email: 'demo.employee@example.com',
        role: 'Site Super',
        phone: '(555) 000-1111',
        status: 'active',
        current_compensation: 32,
        created_at: now,
        updated_at: now,
      },
    }
  }
  return {
    user: {
      id: DEMO_PM_USER_ID,
      email: 'demo@example.com',
      display_name: 'Demo Contractor',
    },
    isAdmin: false,
    /** Marketing preview: show full product without a Stripe subscription row. */
    bypass_feature_gates: true,
    type: 'contractor',
    has_affiliate_portal: false,
    role_label: 'Owner',
  }
}
