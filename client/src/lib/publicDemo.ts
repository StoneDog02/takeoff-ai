/**
 * Public "See it in action" demo: no Supabase session, sessionStorage-backed persona.
 * Used by AuthProvider, API stubs, and landing CTA. Keep free of React imports.
 */

import type { MeResponse } from '@/api/me'
import { DEMO_CONTRACTOR_USER_UUID, DEMO_EMPLOYEE_USER_UUID } from '@/data/demo/demoIds'
import { clearDemoBankTransactionSession } from '@/data/demo/bankTransactionFixtures'

export const PUBLIC_DEMO_STORAGE_KEY = 'takeoff-public-demo'

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

export function enterPublicDemo(persona: PublicDemoPersona = 'pm') {
  saveStored({ persona, v: 1 })
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('takeoff-public-demo-change'))
  }
}

export function exitPublicDemo() {
  saveStored(null)
  clearDemoBankTransactionSession()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('takeoff-public-demo-change'))
  }
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
      bypass_feature_gates: false,
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
    bypass_feature_gates: false,
    type: 'contractor',
    has_affiliate_portal: false,
    role_label: 'Owner',
  }
}
