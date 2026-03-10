/**
 * Payroll contact (who receives the report).
 * The Payroll page now uses teamsApi.payroll.getContact / setContact (DB). This module remains for optional localStorage fallback or other consumers.
 */
export interface PayrollContact {
  name: string
  email: string
  phone?: string
}

const STORAGE_KEY = 'takeoff_payroll_contact'

export function getPayrollContact(): PayrollContact | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PayrollContact
    if (!parsed.email) return null
    return { name: parsed.name ?? '', email: parsed.email, phone: parsed.phone }
  } catch {
    return null
  }
}

export function setPayrollContact(contact: PayrollContact): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(contact))
}
