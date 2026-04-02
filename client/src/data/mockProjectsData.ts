/**
 * Mock projects and detail data for list/detail preview.
 * Import and use in ProjectsPage; add/remove/edit entries here to change mock data.
 */
import type {
  Project,
  Phase,
  Milestone,
  JobWalkMedia,
  Subcontractor,
  BidSheet,
} from '@/types/global'
import { dayjs } from '@/lib/date'

export const DEMO_PROJECT_ID = 'demo'

const now = dayjs().toISOString()
const past = (daysAgo: number) => dayjs().subtract(daysAgo, 'day').toISOString()

// ——— List view: projects to show on /projects ———
export const MOCK_PROJECTS: Project[] = [
  {
    id: DEMO_PROJECT_ID,
    name: 'Riverside Commercial — Phase 4',
    status: 'active',
    scope: 'Full kitchen renovation: cabinets, countertops, flooring, and island.',
    created_at: past(45),
    updated_at: now,
  },
  {
    id: 'mock-bath',
    name: 'Master Bath Renovation – 442 Oak St',
    status: 'active',
    scope: 'Full master bath: tile, vanity, shower enclosure, plumbing.',
    created_at: past(30),
    updated_at: past(1),
  },
  {
    id: 'mock-office',
    name: 'Office Build-Out – Suite 200',
    status: 'planning',
    scope: 'Interior build-out for new tenant. Demising walls, electrical, HVAC zones.',
    created_at: past(14),
    updated_at: past(3),
  },
  {
    id: 'mock-addition',
    name: 'Second-Story Addition – 88 Pine Rd',
    status: 'active',
    scope: 'Add second story: framing, roof tie-in, stairs, MEP.',
    created_at: past(60),
    updated_at: past(0),
  },
  {
    id: 'mock-siding',
    name: 'Exterior Siding & Trim – 1200 Elm',
    status: 'on_hold',
    scope: 'Replace siding, trim, and fascia. Paint.',
    created_at: past(90),
    updated_at: past(20),
  },
  {
    id: 'mock-deck',
    name: 'Deck & Patio – 55 Maple Dr',
    status: 'completed',
    scope: 'New deck, footings, railings, and stamped concrete patio.',
    created_at: past(120),
    updated_at: past(45),
  },
  {
    id: 'mock-roof',
    name: 'Roof Replacement – 200 Cedar Ln',
    status: 'active',
    scope: 'Full tear-off, ice guard, architectural shingles.',
    created_at: past(21),
    updated_at: past(2),
  },
  {
    id: 'mock-basement',
    name: 'Basement Finish – 77 Birch Ave',
    status: 'planning',
    scope: 'Finish basement: egress, framing, electrical, drywall, flooring.',
    created_at: past(7),
    updated_at: past(1),
  },
]

// ——— Helpers: build phases/milestones from card data so detail matches list card ———
function dateOffset(days: number): string {
  return dayjs().add(days, 'day').format('YYYY-MM-DD')
}

function buildPhasesFromCard(projectId: string, phaseProgress: { name: string; completed: boolean }[]): Phase[] {
  if (!phaseProgress.length) return []
  const completedCount = phaseProgress.filter((p) => p.completed).length
  const phases: Phase[] = []
  phaseProgress.forEach((p, i) => {
    const duration = 14
    let startDays: number
    if (p.completed) {
      startDays = -(completedCount - i) * duration - duration
    } else if (i === completedCount) {
      startDays = -7
    } else {
      startDays = (i - completedCount) * duration + 7
    }
    const phaseStart = dateOffset(startDays)
    const phaseEnd = dateOffset(startDays + duration)
    phases.push({
      id: `ph-${projectId}-${i}`,
      project_id: projectId,
      name: p.name,
      start_date: phaseStart,
      end_date: phaseEnd,
      order: i,
    })
  })
  return phases
}

function buildMilestonesFromCard(projectId: string, phaseProgress: { name: string; completed: boolean }[], nextStep: string): Milestone[] {
  const completedCount = phaseProgress.filter((p) => p.completed).length
  const milestones: Milestone[] = []
  phaseProgress.forEach((p, i) => {
    const dueDays = p.completed ? -(completedCount - i) * 20 - 10 : (i - completedCount) * 20 + 14
    const title = p.completed
      ? `${p.name} complete`
      : i === completedCount
        ? (nextStep.replace(/^Next:?\s*/i, '').replace(/^Waiting on\s*/i, '').replace(/\s*–\s*closed out$/i, '') || `${p.name} complete`)
        : `${p.name} complete`
    milestones.push({
      id: `m-${projectId}-${i}`,
      project_id: projectId,
      phase_id: `ph-${projectId}-${i}`,
      title: title.slice(0, 80),
      due_date: dateOffset(dueDays),
      completed: p.completed,
    })
  })
  if (milestones.length === 0) {
    milestones.push({
      id: `m-${projectId}-0`,
      project_id: projectId,
      title: nextStep || 'Kickoff',
      due_date: dateOffset(7),
      completed: false,
    })
  }
  return milestones
}

const TEMPLATE_MEDIA: Omit<JobWalkMedia, 'project_id'>[] = [
  { id: 'med1', url: 'https://placehold.co/400x300?text=Job+walk+1', type: 'photo', uploaded_at: past(1), uploader_name: 'Sarah C.' },
  { id: 'med2', url: 'https://placehold.co/400x300?text=Job+walk+2', type: 'photo', uploaded_at: past(0.5), uploader_name: 'Mike T.' },
]

const TEMPLATE_BUDGET = {
  items: [
    { id: 'b1', project_id: '' as string, label: 'Labor', predicted: 18000, actual: 17200, category: 'labor' },
    { id: 'b2', project_id: '' as string, label: 'Materials', predicted: 24500, actual: 25100, category: 'materials' },
    { id: 'b3', project_id: '' as string, label: 'Subcontractors', predicted: 12000, actual: 11800, category: 'subs' },
  ],
  summary: { predicted_total: 54500, actual_total: 54100, profitability: 400 },
}

const TEMPLATE_TAKEOFFS = [
  {
    id: 'to1',
    material_list: {
      categories: [
        {
          name: 'Lumber',
          items: [
            { description: '2x4 studs', quantity: 45, unit: 'LF', trade_tag: 'Framing', cost_estimate: 2.8 },
            { description: '2x6 header', quantity: 12, unit: 'LF', trade_tag: 'Framing', cost_estimate: 4.2 },
            { description: 'Plywood 4x8', quantity: 8, unit: 'EA', trade_tag: 'TBD', cost_estimate: null },
          ],
        },
        {
          name: 'Electrical',
          items: [
            { description: 'Romex 12/2', quantity: 250, unit: 'LF', trade_tag: 'Electrical', cost_estimate: 0.45 },
            { description: 'Receptacles', quantity: 18, unit: 'EA', trade_tag: 'Electrical', cost_estimate: 3.5 },
          ],
        },
      ],
      summary: 'Initial takeoff from plans.',
    },
    created_at: past(2),
  },
]

const TEMPLATE_SUBCONTRACTORS: Omit<Subcontractor, 'project_id'>[] = [
  { id: 's1', name: 'ABC Electrical', trade: 'Electrical', email: 'bids@abcelectrical.com', phone: '(555) 111-2222' },
  { id: 's2', name: 'Quality Plumbing Co', trade: 'Plumbing', email: 'estimates@qualityplumb.com', phone: '(555) 333-4444' },
  { id: 's3', name: 'Pro Framing LLC', trade: 'Framing', email: 'pro@proframing.com', phone: '(555) 555-6666' },
]

const TEMPLATE_BID_SHEET = {
  project_id: '' as string,
  trade_packages: [
    { id: 'tp1', project_id: '' as string, trade_tag: 'Framing', line_items: TEMPLATE_TAKEOFFS[0].material_list.categories[0].items.slice(0, 2), no_pricing: true },
    { id: 'tp2', project_id: '' as string, trade_tag: 'Electrical', line_items: TEMPLATE_TAKEOFFS[0].material_list.categories[1].items, no_pricing: true },
  ],
  sub_bids: [
    { id: 'sb1', trade_package_id: 'tp1', subcontractor_id: 's3', amount: 4200, notes: 'Includes materials', awarded: true },
    { id: 'sb2', trade_package_id: 'tp2', subcontractor_id: 's1', amount: 1850, notes: null, awarded: true },
  ],
  cost_buckets: {
    awarded_bids: 6050,
    self_supplied_materials: 3200,
    own_labor: 17200,
    overhead_margin: 4200,
  },
  proposal_lines: [
    { id: 'pl1', label: 'Framing & rough carpentry', description: 'Per plan', amount: 4200, group: 'Construction' },
    { id: 'pl2', label: 'Electrical rough & finish', description: 'Per plan', amount: 1850, group: 'MEP' },
    { id: 'pl3', label: 'GC labor & oversight', description: 'Project management', amount: 21400, group: 'Labor & margin' },
  ],
}

function withProjectId<T extends Record<string, unknown>>(projectId: string, items: T[]): (T & { project_id: string })[] {
  return items.map((item) => ({ ...item, project_id: projectId })) as (T & { project_id: string })[]
}

/** Card display data for list view (phase progress, next step, assignee, value). */
export interface ProjectCardData {
  projectId: string
  phaseProgress: { name: string; completed: boolean }[]
  nextStep: string
  isComplete?: boolean
  assignedTo: { initials: string; name: string }
  value: number
  /** Actual spent (from budget); when set, card uses this instead of phase-based estimate. */
  valueUsed?: number
  /** Days left until timeline end; when set, card shows this instead of "—". */
  daysLeft?: number | null
  /** Paper-trail document count from dashboard API; shown when > 0. */
  documentCount?: number
}

/** Card metadata for mock projects; real projects can omit for minimal card. */
export const MOCK_PROJECT_CARD_DATA: Record<string, ProjectCardData> = {
  [DEMO_PROJECT_ID]: {
    projectId: 'PRJ-001',
    phaseProgress: [
      { name: 'Demo', completed: true },
      { name: 'Rough-in', completed: true },
      { name: 'Electrical', completed: true },
      { name: 'Finish', completed: false },
    ],
    nextStep: 'Next: Electrical rough-in complete',
    isComplete: false,
    assignedTo: { initials: 'SN', name: 'Savannah Nguyen' },
    value: 48200,
  },
  'mock-bath': {
    projectId: 'PRJ-002',
    phaseProgress: [
      { name: 'Demo', completed: true },
      { name: 'Rough plumbing', completed: true },
      { name: 'Tile & finish', completed: false },
    ],
    nextStep: 'Next: Rough plumbing inspection',
    assignedTo: { initials: 'JL', name: 'Jordan Lee' },
    value: 22400,
  },
  'mock-office': {
    projectId: 'PRJ-003',
    phaseProgress: [
      { name: 'Permits', completed: false },
      { name: 'Demo', completed: false },
      { name: 'Buildout', completed: false },
      { name: 'Finish', completed: false },
    ],
    nextStep: 'Waiting on permit approval',
    assignedTo: { initials: 'AK', name: 'Alexis Kim' },
    value: 125000,
  },
  'mock-addition': {
    projectId: 'PRJ-004',
    phaseProgress: [
      { name: 'Foundation', completed: true },
      { name: 'Framing', completed: true },
      { name: 'MEP', completed: false },
      { name: 'Finish', completed: false },
    ],
    nextStep: 'Next: MEP rough-in scheduled',
    assignedTo: { initials: 'MR', name: 'Morgan Reed' },
    value: 87500,
  },
  'mock-siding': {
    projectId: 'PRJ-005',
    phaseProgress: [
      { name: 'Prep', completed: true },
      { name: 'Siding', completed: false },
      { name: 'Trim & paint', completed: false },
    ],
    nextStep: 'Waiting on material delivery ETA',
    assignedTo: { initials: 'CB', name: 'Chris Brown' },
    value: 67500,
  },
  'mock-deck': {
    projectId: 'PRJ-006',
    phaseProgress: [
      { name: 'Demo', completed: true },
      { name: 'Framing', completed: true },
      { name: 'Decking', completed: true },
      { name: 'Finish', completed: true },
    ],
    nextStep: 'All phases complete – closed out',
    isComplete: true,
    assignedTo: { initials: 'PW', name: 'Pat Williams' },
    value: 18900,
  },
  'mock-roof': {
    projectId: 'PRJ-007',
    phaseProgress: [
      { name: 'Tear-off', completed: true },
      { name: 'Install', completed: false },
      { name: 'Cleanup', completed: false },
    ],
    nextStep: 'Next: Shingle delivery tomorrow',
    assignedTo: { initials: 'SN', name: 'Savannah Nguyen' },
    value: 14200,
  },
  'mock-basement': {
    projectId: 'PRJ-008',
    phaseProgress: [
      { name: 'Egress', completed: false },
      { name: 'Framing', completed: false },
      { name: 'MEP', completed: false },
      { name: 'Finish', completed: false },
    ],
    nextStep: 'Waiting on engineer drawings',
    assignedTo: { initials: 'JL', name: 'Jordan Lee' },
    value: 52000,
  },
}

/** Whether this id is a mock project (from MOCK_PROJECTS). */
export function isMockProjectId(id: string): boolean {
  return MOCK_PROJECTS.some((p) => p.id === id)
}

/** Full mock detail for a project id. Use for any id in MOCK_PROJECTS. Detail matches card (phases, value, assignee). */
export function getMockProjectDetail(projectId: string): {
  project: Project
  phases: Phase[]
  milestones: Milestone[]
  media: JobWalkMedia[]
  budget: { items: typeof TEMPLATE_BUDGET.items; summary: { predicted_total: number; actual_total: number; profitability: number } }
  takeoffs: typeof TEMPLATE_TAKEOFFS
  subcontractors: Subcontractor[]
  bidSheet: BidSheet
} {
  const project = MOCK_PROJECTS.find((p) => p.id === projectId) ?? MOCK_PROJECTS[0]
  const pid = project.id
  const card = MOCK_PROJECT_CARD_DATA[pid]

  const phaseProgress = card?.phaseProgress ?? []
  const phases = buildPhasesFromCard(pid, phaseProgress)
  const milestones = buildMilestonesFromCard(pid, phaseProgress, card?.nextStep ?? '')

  const value = card?.value ?? TEMPLATE_BUDGET.summary.predicted_total
  const profitability = 400
  const actualTotal = value - profitability

  return {
    project: {
      ...project,
      id: pid,
      assigned_to_name: card?.assignedTo?.name,
      estimated_value: card?.value,
    },
    phases,
    milestones,
    media: withProjectId(pid, TEMPLATE_MEDIA),
    budget: {
      items: TEMPLATE_BUDGET.items.map((b) => ({ ...b, project_id: pid })),
      summary: {
        predicted_total: value,
        actual_total: Math.max(0, actualTotal),
        profitability,
      },
    },
    takeoffs: TEMPLATE_TAKEOFFS.map((t) => ({ ...t, material_list: t.material_list, created_at: t.created_at })),
    subcontractors: TEMPLATE_SUBCONTRACTORS.map((s) => ({ ...s, project_id: pid })) as Subcontractor[],
    bidSheet: {
      ...TEMPLATE_BID_SHEET,
      project_id: pid,
      trade_packages: TEMPLATE_BID_SHEET.trade_packages.map((p) => ({ ...p, project_id: pid })),
    } as BidSheet,
  }
}
