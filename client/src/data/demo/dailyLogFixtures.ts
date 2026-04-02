/**
 * Daily log rows for public demo: two sample logs per active project (PM + employee daily log tab).
 */
import { dayjs } from '@/lib/date'
import type { DailyLogRow } from '@/types/global'
import { MOCK_PROJECTS, getMockProjectDetail } from '@/data/mockProjectsData'

type LogSeed = {
  daysAgo: number
  weather: string
  temperature: string
  crew_count: number
  crew_present: { name: string; role?: string; hours?: number }[]
  work_summary: string
  materials: { description: string; quantity: string }[]
  issues: { severity: string; description: string }[]
  visitor_log: { name: string; notes?: string }[]
}

function makeRow(
  projectId: string,
  index: number,
  logDate: string,
  phaseId: string | null,
  seed: LogSeed
): DailyLogRow {
  const id = `dl-${projectId}-${index}`
  const created = dayjs(logDate).hour(17).minute(15).second(0).toISOString()
  return {
    id,
    project_id: projectId,
    log_date: logDate,
    weather: seed.weather,
    temperature: seed.temperature,
    crew_count: seed.crew_count,
    crew_present: seed.crew_present,
    work_summary: seed.work_summary,
    phase_id: phaseId,
    materials: seed.materials,
    issues: seed.issues,
    visitor_log: seed.visitor_log,
    notes: null,
    created_by: 'demo-user',
    locked_at: null,
    created_at: created,
    updated_at: created,
  }
}

/** Two logs per active mock project — copy matches job type where possible. */
const LOG_PAIRS: Record<string, [LogSeed, LogSeed]> = {
  demo: [
    {
      daysAgo: 1,
      weather: 'cloudy',
      temperature: '54°F',
      crew_count: 7,
      crew_present: [
        { name: 'Marcus T.', role: 'Carpenter', hours: 8 },
        { name: 'Jamie K.', role: 'Laborer', hours: 7.5 },
        { name: 'Sarah C.', role: 'Electrician', hours: 6 },
      ],
      work_summary:
        'Continued rough-in at south wing. Installed temporary lighting circuits and coordinated ceiling grid layout with HVAC sleeves.',
      materials: [
        { description: 'EMT conduit — 3/4"', quantity: '120 lf' },
        { description: 'MC cable — 12/2', quantity: '4 rolls' },
      ],
      issues: [
        { severity: 'info', description: 'Ceiling access panel in corridor B still missing — follow up with supplier.' },
      ],
      visitor_log: [{ name: 'Alex Rivera', notes: 'Owner walk-through; signed off on kitchen soffit height.' }],
    },
    {
      daysAgo: 4,
      weather: 'sunny',
      temperature: '62°F',
      crew_count: 5,
      crew_present: [
        { name: 'Drew L.', role: 'Foreman', hours: 8 },
        { name: 'Marcus T.', role: 'Carpenter', hours: 8 },
      ],
      work_summary:
        'Demolition complete in prep area. Debris hauled; floor protection laid for upcoming cabinet install.',
      materials: [{ description: 'Ram board floor protection', quantity: '3 rolls' }],
      issues: [],
      visitor_log: [],
    },
  ],
  'mock-bath': [
    {
      daysAgo: 1,
      weather: 'sunny',
      temperature: '61°F',
      crew_count: 4,
      crew_present: [
        { name: 'Rico M.', role: 'Tile', hours: 8 },
        { name: 'Pat N.', role: 'Plumber', hours: 6 },
      ],
      work_summary:
        'Shower pan flood test passed. Started wall tile to 48" — layout checked against niche dimensions.',
      materials: [
        { description: 'Large-format wall tile', quantity: '85 sf' },
        { description: 'Thinset — modified', quantity: '3 bags' },
      ],
      issues: [{ severity: 'warning', description: 'Vanity delivery slipped to Friday — confirm rough valve depth before close-in.' }],
      visitor_log: [{ name: 'Homeowner', notes: 'Selected grout color — warm gray.' }],
    },
    {
      daysAgo: 5,
      weather: 'rain',
      temperature: '48°F',
      crew_count: 3,
      crew_present: [{ name: 'Pat N.', role: 'Plumber', hours: 7 }],
      work_summary: 'Pressure test on supply lines; replaced one slow shutoff. Drywall patch cure time documented.',
      materials: [{ description: '1/2" copper fittings', quantity: 'Assorted' }],
      issues: [],
      visitor_log: [],
    },
  ],
  'mock-addition': [
    {
      daysAgo: 2,
      weather: 'wind',
      temperature: '56°F',
      crew_count: 6,
      crew_present: [
        { name: 'Chris V.', role: 'Framing', hours: 8 },
        { name: 'Jordan P.', role: 'Laborer', hours: 8 },
      ],
      work_summary:
        'Second-story deck joists hung; engineer clip detail at ledger verified. Temporary guardrails installed.',
      materials: [
        { description: 'LVL beams — 11-7/8"', quantity: '4 pcs' },
        { description: 'Joist hangers — Simpson', quantity: '24' },
      ],
      issues: [{ severity: 'info', description: 'Roof tie-in meeting scheduled with roofer for next Tuesday.' }],
      visitor_log: [{ name: 'Building inspector', notes: 'Rough framing — deferred to next visit after shear.' }],
    },
    {
      daysAgo: 6,
      weather: 'cloudy',
      temperature: '52°F',
      crew_count: 4,
      crew_present: [{ name: 'Chris V.', role: 'Framing', hours: 8 }],
      work_summary: 'Wall layout snapped; sill plate anchored per detail A-3. Hold-downs installed at corners.',
      materials: [{ description: 'Anchor bolts — 5/8"', quantity: '18' }],
      issues: [],
      visitor_log: [],
    },
  ],
  'mock-roof': [
    {
      daysAgo: 1,
      weather: 'sunny',
      temperature: '59°F',
      crew_count: 5,
      crew_present: [
        { name: 'Lee W.', role: 'Roofing', hours: 8 },
        { name: 'Sam H.', role: 'Laborer', hours: 8 },
      ],
      work_summary:
        'North slope shingled to ridge; starter course and ice guard checked. Magnet sweep of driveway completed.',
      materials: [
        { description: 'Architectural shingles — bundle', quantity: '42' },
        { description: 'Synthetic underlayment', quantity: '4 rolls' },
      ],
      issues: [],
      visitor_log: [{ name: 'Supplier', notes: 'Dropped ridge vent order; receipt in office.' }],
    },
    {
      daysAgo: 3,
      weather: 'cloudy',
      temperature: '55°F',
      crew_count: 4,
      crew_present: [{ name: 'Lee W.', role: 'Roofing', hours: 8 }],
      work_summary: 'Tear-off day 2 complete; decking repairs at rear valley — 3 sheets OSB replaced and taped.',
      materials: [{ description: 'OSB 7/16 roof sheathing', quantity: '3 sheets' }],
      issues: [{ severity: 'critical', description: 'Small active leak at chimney flashing — tarped; flashing crew tomorrow AM.' }],
      visitor_log: [],
    },
  ],
}

export function getDemoDailyLogsForProject(projectId: string): DailyLogRow[] {
  const proj = MOCK_PROJECTS.find((p) => p.id === projectId)
  if (!proj || proj.status !== 'active') return []

  const pair = LOG_PAIRS[projectId]
  if (!pair) return []

  const detail = getMockProjectDetail(projectId)
  const phaseId = detail.phases[0]?.id ?? null

  return pair.map((seed, i) => {
    const logDate = dayjs().subtract(seed.daysAgo, 'day').format('YYYY-MM-DD')
    return makeRow(projectId, i + 1, logDate, phaseId, seed)
  })
}
