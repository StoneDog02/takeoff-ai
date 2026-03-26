/**
 * Parse QuickBooks-style Products & Services Excel/CSV exports into rows for custom_products.
 * Handles common column aliases (QBO / Desktop). Header row is auto-detected.
 */

const XLSX = require('xlsx')

const MAX_DATA_ROWS = 5000
const HEADER_SCAN_ROWS = 30

/** Dedupe key aligned with client EstimatingWorkspace gcScopeLibraryKey */
function libraryKey(name, unit) {
  return `${String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')}|${String(unit || 'ea')
    .trim()
    .toLowerCase()}`
}

function normHeader(h) {
  return String(h ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/** Map normalized header text to logical field (first match wins per column) */
const FIELD_ALIASES = {
  name: [
    'item name',
    'product/service name',
    'product service name',
    'name',
    'product name',
    'service name',
    'product/service',
    'full name',
  ],
  description: ['sales description', 'description', 'purchase description', 'memo', 'notes', 'detail'],
  unit: ['u/m', 'unit', 'uom', 'measure', 'units'],
  salesPrice: [
    'sales price',
    'price',
    'rate',
    'sales rate',
    'amount',
    'sales price/rate',
    'standard rate',
  ],
  cost: ['cost', 'purchase cost', 'cogs', 'purchase price'],
  qbType: ['type', 'item type', 'product/service type', 'service type'],
  taxable: ['taxable', 'sales tax', 'tax', 'tax code'],
}

function headerToField(norm) {
  if (!norm) return null
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const a of aliases) {
      if (norm === a) return field
    }
  }
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const a of aliases) {
      if (norm.includes(a)) return field
    }
  }
  if (norm.includes('product') && norm.includes('service') && norm.includes('name')) return 'name'
  return null
}

function parseMoney(val) {
  if (val == null || val === '') return null
  if (typeof val === 'number' && Number.isFinite(val)) return val
  let s = String(val).trim()
  if (!s) return null
  s = s.replace(/[$€£\s]/g, '')
  if (s === '') return null
  if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s)
  if (/^-?\d+,\d{2}$/.test(s)) return parseFloat(s.replace(',', '.'))
  s = s.replace(/,/g, '')
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

function parseTaxable(val) {
  if (val == null || val === '') return false
  if (typeof val === 'boolean') return val
  const s = String(val).trim().toLowerCase()
  if (['y', 'yes', 'true', '1', 'taxable', 'x', 'tax'].includes(s)) return true
  if (['n', 'no', 'false', '0', 'non', 'non-taxable', 'non taxable', 'exempt'].includes(s)) return false
  return false
}

function qbTypeToItemType(qbRaw) {
  const t = normHeader(qbRaw)
  if (!t) return 'service'
  if (t.includes('category')) return 'category'
  if (t.includes('inventory') || t.includes('non-inventory') || t.includes('non inventory')) return 'product'
  if (t.includes('bundle')) return 'product'
  if (t.includes('service')) return 'service'
  if (t.includes('labor')) return 'labor'
  if (t.includes('material')) return 'material'
  if (t.includes('subcontract')) return 'sub'
  if (t.includes('equipment')) return 'equipment'
  return 'service'
}

/**
 * @param {Buffer} buffer
 * @param {string} filename
 * @returns {{
 *   rows: Array<{
 *     name: string
 *     description: string | null
 *     unit: string
 *     default_unit_price: number
 *     sub_cost: number | null
 *     item_type: string
 *     taxable: boolean
 *     sourceRow: number
 *   }>
 *   warnings: string[]
 *   parseErrors: Array<{ row: number, message: string }>
 * }}
 */
function parseQuickBooksProductsExport(buffer, filename) {
  const warnings = []
  const parseErrors = []
  const ext = (filename || '').toLowerCase()
  const isCsv = ext.endsWith('.csv')

  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    raw: false,
    codepage: isCsv ? 65001 : undefined,
  })

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    return { rows: [], warnings: ['No sheets found in file.'], parseErrors: [] }
  }

  const sheet = workbook.Sheets[sheetName]
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })
  if (!grid || grid.length === 0) {
    return { rows: [], warnings: ['Sheet is empty.'], parseErrors: [] }
  }

  let bestHeaderIdx = -1
  let bestScore = -1
  const maxR = Math.min(grid.length, HEADER_SCAN_ROWS)

  for (let r = 0; r < maxR; r++) {
    const row = grid[r] || []
    let score = 0
    let hasName = false
    for (let c = 0; c < row.length; c++) {
      const field = headerToField(normHeader(row[c]))
      if (field === 'name') hasName = true
      if (field) score += 1
    }
    if (hasName && score >= 2 && score > bestScore) {
      bestScore = score
      bestHeaderIdx = r
    }
  }

  if (bestHeaderIdx < 0) {
    for (let r = 0; r < maxR; r++) {
      const row = grid[r] || []
      for (let c = 0; c < row.length; c++) {
        if (headerToField(normHeader(row[c])) === 'name') {
          bestHeaderIdx = r
          warnings.push('Detected a minimal header row; verify column mapping if results look wrong.')
          break
        }
      }
      if (bestHeaderIdx >= 0) break
    }
  }

  if (bestHeaderIdx < 0) {
    return {
      rows: [],
      warnings,
      parseErrors: [{ row: 1, message: 'Could not find a header row with Product/Service or Item name columns.' }],
    }
  }

  const headerRow = grid[bestHeaderIdx] || []
  const colMap = {}
  for (let c = 0; c < headerRow.length; c++) {
    const field = headerToField(normHeader(headerRow[c]))
    if (field && colMap[field] === undefined) colMap[field] = c
  }

  if (colMap.name === undefined) {
    return {
      rows: [],
      warnings,
      parseErrors: [{ row: bestHeaderIdx + 1, message: 'No name column found (expected Item name or similar).' }],
    }
  }

  const rows = []
  const dataStart = bestHeaderIdx + 1
  const end = Math.min(grid.length, dataStart + MAX_DATA_ROWS)

  for (let r = dataStart; r < end; r++) {
    const line = grid[r] || []
    const excelRow = r + 1
    const name = String(line[colMap.name] ?? '').trim()
    const qbTypeRaw = colMap.qbType !== undefined ? String(line[colMap.qbType] ?? '').trim() : ''
    const itemTypeHint = qbTypeToItemType(qbTypeRaw)

    if (!name) continue
    if (itemTypeHint === 'category') {
      warnings.push(`Skipped row ${excelRow}: category "${name}" (QuickBooks hierarchy).`)
      continue
    }

    const description =
      colMap.description !== undefined ? String(line[colMap.description] ?? '').trim() || null : null
    const unitRaw = colMap.unit !== undefined ? String(line[colMap.unit] ?? '').trim() : ''
    const unit = unitRaw || 'ea'

    let default_unit_price = 0
    if (colMap.salesPrice !== undefined) {
      const p = parseMoney(line[colMap.salesPrice])
      if (p != null) default_unit_price = p
    }

    let sub_cost = null
    if (colMap.cost !== undefined) {
      const c = parseMoney(line[colMap.cost])
      if (c != null && c !== 0) sub_cost = c
    }

    let taxable = false
    if (colMap.taxable !== undefined) {
      taxable = parseTaxable(line[colMap.taxable])
    }

    const item_type = itemTypeHint === 'category' ? 'service' : itemTypeHint

    rows.push({
      name,
      description,
      unit,
      default_unit_price,
      sub_cost,
      item_type,
      taxable,
      sourceRow: excelRow,
    })
  }

  if (grid.length - dataStart > MAX_DATA_ROWS) {
    warnings.push(`Only the first ${MAX_DATA_ROWS} data rows were read; split large files if needed.`)
  }

  return { rows, warnings, parseErrors }
}

module.exports = {
  parseQuickBooksProductsExport,
  libraryKey,
}
