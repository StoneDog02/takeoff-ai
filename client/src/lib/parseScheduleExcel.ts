/**
 * Parse Custom Home Construction Schedule Excel into phases and tasks.
 * Expects: header with Start Date; columns #, PHASE/TASK, RESP., DURATION (WKS), START WK, END WK.
 * Phase rows: "N. PHASE NAME" (e.g. "1. SITE PREP & EXCAVATION").
 * Task rows: task name, responsible, duration, start wk, end wk.
 */
import * as XLSX from 'xlsx'
import { dayjs } from '@/lib/date'

export interface ParsedPhase {
  name: string
  order: number
  start_date: string
  end_date: string
}

export interface ParsedTask {
  title: string
  phaseIndex: number
  responsible: string
  start_date: string
  end_date: string
  duration_weeks?: number
  order: number
}

export interface ParsedSchedule {
  startDate: string
  phases: ParsedPhase[]
  tasks: ParsedTask[]
}

function parseExcelDate(val: unknown): string | null {
  if (val == null) return null
  if (typeof val === 'string') {
    const d = dayjs(val, ['YYYY-MM-DD', 'M/D/YYYY', 'MM/DD/YYYY', 'M/D/YY', 'MM-DD-YYYY'], true)
    return d.isValid() ? d.format('YYYY-MM-DD') : null
  }
  if (typeof val === 'number' && val >= 1) {
    const d = dayjs(new Date((val - 25569) * 86400000))
    return d.isValid() ? d.format('YYYY-MM-DD') : null
  }
  if (val instanceof Date) return dayjs(val).format('YYYY-MM-DD')
  return null
}

function isPhaseRow(name: string): boolean {
  const s = (name || '').trim()
  return /^\d+\.\s+.+/.test(s) && s.length > 4
}

function phaseOrderFromName(name: string): number {
  const m = (name || '').trim().match(/^(\d+)\./)
  return m ? parseInt(m[1], 10) : 0
}

export function parseScheduleExcel(buffer: ArrayBuffer, fallbackStartDate?: string): ParsedSchedule {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) return { startDate: fallbackStartDate || dayjs().format('YYYY-MM-DD'), phases: [], tasks: [] }

  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')
  let startDate = fallbackStartDate || dayjs().format('YYYY-MM-DD')

  for (let R = range.s.r; R <= Math.min(range.e.r, range.s.r + 20); R++) {
    for (let C = range.s.c; C <= Math.min(range.e.c, 10); C++) {
      const cell = sheet[XLSX.utils.encode_cell({ r: R, c: C })]
      const v = cell?.v
      if (typeof v === 'string' && /start\s*date/i.test(v)) {
        const next = sheet[XLSX.utils.encode_cell({ r: R, c: C + 1 })]
        const parsed = parseExcelDate(next?.v)
        if (parsed) startDate = parsed
        break
      }
    }
  }

  const phases: ParsedPhase[] = []
  const tasks: ParsedTask[] = []
  let phaseIndex = -1
  let taskOrder = 0

  const col = (r: number, c: number): unknown => {
    const ref = XLSX.utils.encode_cell({ r, c })
    return sheet[ref]?.v
  }
  const str = (r: number, c: number): string => String(col(r, c) ?? '').trim()

  for (let R = range.s.r; R <= range.e.r; R++) {
    const name = str(R, 1) || str(R, 0)
    if (!name) continue

    if (isPhaseRow(name)) {
      phaseIndex++
      const order = phaseOrderFromName(name)
      phases.push({
        name,
        order,
        start_date: startDate,
        end_date: startDate,
      })
      continue
    }

    const resp = str(R, 2) || str(R, 3)
    const durationVal = col(R, 3) ?? col(R, 4)
    const duration = typeof durationVal === 'number' ? durationVal : parseInt(String(durationVal), 10) || undefined
    const startWk = typeof col(R, 4) === 'number' ? (col(R, 4) as number) : typeof col(R, 5) === 'number' ? (col(R, 5) as number) : NaN
    const endWk = typeof col(R, 5) === 'number' ? (col(R, 5) as number) : typeof col(R, 6) === 'number' ? (col(R, 6) as number) : NaN

    if (phaseIndex >= 0 && !Number.isNaN(startWk) && !Number.isNaN(endWk)) {
      const start = dayjs(startDate).add((startWk - 1) * 7, 'day').format('YYYY-MM-DD')
      const end = dayjs(startDate).add(endWk * 7 - 1, 'day').format('YYYY-MM-DD')
      taskOrder++
      tasks.push({
        title: name,
        phaseIndex,
        responsible: resp,
        start_date: start,
        end_date: end,
        duration_weeks: duration,
        order: taskOrder,
      })
      const phase = phases[phaseIndex]
      if (phase) {
        if (!phase.start_date || phase.start_date > start) phase.start_date = start
        if (!phase.end_date || phase.end_date < end) phase.end_date = end
      }
    }
  }

  return { startDate, phases, tasks }
}
