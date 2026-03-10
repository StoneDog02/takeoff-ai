export const WIZARD_RED = 'var(--red, #c0392b)'

export const STEPS = [
  { id: 'client', icon: '👤', label: 'Client Info', desc: 'Who is this project for?' },
  { id: 'phases', icon: '📋', label: 'Phases', desc: 'Break down the work into stages' },
  { id: 'budget', icon: '💰', label: 'Budget', desc: 'Set your target budget by category' },
  { id: 'team', icon: '👷', label: 'Team & Crew', desc: "Who's working this job?" },
  { id: 'worktypes', icon: '🔧', label: 'Work Types', desc: 'Rates for crew to clock in under' },
  { id: 'milestones', icon: '🏁', label: 'Milestones', desc: 'Key dates to hit' },
] as const

export const PHASE_COLORS = [
  '#c0392b',
  '#6366f1',
  '#0ea5e9',
  '#16a34a',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
]

export const BUDGET_CATS = [
  'Labor',
  'Materials',
  'Subcontractors',
  'Equipment',
  'Permits',
  'Other',
]

/** Work type categories for grouping in dropdowns (order = display order). */
export const WORK_TYPE_CATEGORIES = [
  { id: 'labor', label: 'Labor', keys: ['labor'] as const },
  { id: 'demolition', label: 'Demolition', keys: ['demolition'] as const },
  { id: 'structure', label: 'Structure', keys: ['framing', 'concrete'] as const },
  { id: 'finish', label: 'Finish & Trades', keys: ['tile', 'plumbing', 'cabinets'] as const },
  { id: 'equipment', label: 'Equipment', keys: ['equipment'] as const },
  { id: 'custom', label: 'Custom', keys: ['custom'] as const },
] as const

/** Type keys in category order (not alphabetical). */
export const WORK_TYPE_KEYS: readonly ('labor' | 'demolition' | 'framing' | 'concrete' | 'tile' | 'plumbing' | 'cabinets' | 'equipment' | 'custom')[] = WORK_TYPE_CATEGORIES.flatMap((c) => [...c.keys])

/** Palette of colors for custom work types. Exclude these from picker when already in use. */
export const CUSTOM_WORK_TYPE_PALETTE = [
  '#6366F1', '#8B5CF6', '#A855F7', '#D946EF', '#EC4899',
  '#F43F5E', '#EF4444', '#F97316', '#EAB308', '#84CC16',
  '#22C55E', '#14B8A6', '#06B6D4', '#0EA5E9', '#3B82F6',
  '#64748B', '#78716C', '#A16207', '#15803D', '#0F766E',
  '#1D4ED8', '#7E22CE', '#BE185D', '#C2410C', '#4D7C0F',
] as const

/** Crew/job roles for roster employees (role on job) — e.g. Foreman, Superintendent. */
export const ROLE_OPTS = [
  'Project Manager',
  'Superintendent',
  'Foreman',
  'Laborer',
  'Electrician',
  'Plumber',
  'Framer',
  'Tile Setter',
  'Painter',
  'Inspector',
  'Subcontractor',
]

/** Trades for subcontractors (external team). Use these in Project Setup and Directory so subs show as HVAC, Plumbing, etc., not job roles like Foreman. */
export const SUBCONTRACTOR_TRADE_OPTS = [
  'HVAC',
  'Plumbing',
  'Electrical',
  'Framing',
  'Concrete',
  'Roofing',
  'Drywall',
  'Tile',
  'Painting',
  'Flooring',
  'Excavation',
  'Other',
]

export const PHASE_TEMPLATES = [
  { name: 'Demo', color: '#c0392b' },
  { name: 'Rough Framing', color: '#6366f1' },
  { name: 'Rough Plumbing', color: '#0ea5e9' },
  { name: 'Rough Electrical', color: '#f59e0b' },
  { name: 'Insulation', color: '#16a34a' },
  { name: 'Drywall', color: '#8b5cf6' },
  { name: 'Finish Work', color: '#ec4899' },
  { name: 'Final Inspection', color: '#64748b' },
]

export function uid(): string {
  return Math.random().toString(36).slice(2, 9)
}

export function pctDone(proj: {
  client?: string
  clientName?: string
  phases?: unknown[]
  budget?: number
  budgetCategories?: unknown[]
  team?: unknown[]
  workTypes?: unknown[]
  milestones?: unknown[]
}): number {
  const total = 6
  let filled = 0
  if (proj.clientName || proj.client) filled++
  if (proj.phases?.length) filled++
  const hasBudget = (proj.budget && proj.budget > 0) || (proj.budgetCategories?.length ?? 0) > 0
  if (hasBudget) filled++
  if (proj.team?.length) filled++
  if (hasFilledWorkTypes(proj.workTypes as unknown[] | undefined)) filled++
  if (proj.milestones?.length) filled++
  return Math.round((filled / total) * 100)
}

/** True when at least one work type has a name and a positive rate. */
export function hasFilledWorkTypes(workTypes: unknown[] | undefined): boolean {
  if (!Array.isArray(workTypes)) return false
  return workTypes.some(
    (w: unknown) =>
      typeof w === 'object' &&
      w !== null &&
      typeof (w as { name?: string }).name === 'string' &&
      (w as { name: string }).name.trim() !== '' &&
      (Number((w as { rate?: number }).rate) || 0) > 0
  )
}

/** Returns whether a given step index (0..5) is complete for the given project-like state. */
function stepDoneAt(proj: {
  clientName?: string
  client?: string
  phases?: unknown[]
  budget?: number
  budgetCategories?: unknown[]
  team?: unknown[]
  workTypes?: unknown[]
  milestones?: unknown[]
}, stepIndex: number): boolean {
  if (stepIndex === 0) return !!(proj.clientName || proj.client)
  if (stepIndex === 1) return !!proj.phases?.length
  if (stepIndex === 2) return (proj.budget && proj.budget > 0) || (proj.budgetCategories?.length ?? 0) > 0
  if (stepIndex === 3) return !!proj.team?.length
  if (stepIndex === 4) return hasFilledWorkTypes(proj.workTypes as unknown[] | undefined)
  if (stepIndex === 5) return !!proj.milestones?.length
  return false
}

/** Index of the first incomplete step (0..5), or 6 (Review) if all steps are complete. */
export function getFirstIncompleteStepIndex(proj: {
  clientName?: string
  client?: string
  phases?: unknown[]
  budget?: number
  budgetCategories?: unknown[]
  team?: unknown[]
  workTypes?: unknown[]
  milestones?: unknown[]
}): number {
  for (let i = 0; i < STEPS.length; i++) {
    if (!stepDoneAt(proj, i)) return i
  }
  return STEPS.length
}
