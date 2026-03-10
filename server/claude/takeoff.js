const { PDFDocument } = require('pdf-lib')
const Anthropic = require('@anthropic-ai/sdk')
const {
  buildSystemPrompt,
  buildCustomProjectSystemPrompt,
  buildKeynoteRegisterPrompt,
  buildSheetTakeoffPrompt,
} = require('./build-prompts')

const PDF_BETA = 'pdfs-2024-09-25'
const MODEL = 'claude-sonnet-4-6'
/** Max pages per chunk to stay under API limits. Anthropic allows 100; we use 5 for reliability. */
const PAGES_PER_CHUNK = 5

// --- PDF helpers (civil sheet-aware flow) ---

async function getPDFPageCount(buffer) {
  const doc = await PDFDocument.load(buffer)
  return doc.getPageCount()
}

/**
 * Extract a range of pages from a PDF (1-based inclusive). Returns a new PDF buffer.
 */
async function extractPDFPages(buffer, startPage, endPage) {
  const srcDoc = await PDFDocument.load(buffer)
  const newDoc = await PDFDocument.create()
  const pageIndices = []
  for (let i = startPage - 1; i <= endPage - 1 && i < srcDoc.getPageCount(); i++) {
    pageIndices.push(i)
  }
  if (pageIndices.length === 0) return Buffer.alloc(0)
  const pages = await newDoc.copyPages(srcDoc, pageIndices)
  pages.forEach((p) => newDoc.addPage(p))
  const bytes = await newDoc.save()
  return Buffer.from(bytes)
}

/**
 * Call Claude with a single PDF/image buffer and custom system + user message. Returns raw response text.
 */
async function callClaudeWithPrompt(fileBuffer, mimeType, systemPrompt, userText) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')
  const anthropic = new Anthropic({ apiKey })
  const isPdf = mimeType === 'application/pdf'
  const content = [{ type: 'text', text: userText || 'Process this sheet and return the requested JSON.' }]
  if (isPdf) {
    content.push({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: fileBuffer.toString('base64') },
    })
  } else {
    const mediaType = mimeType === 'image/png' ? 'image/png' : 'image/jpeg'
    content.push({
      type: 'image',
      source: { type: 'base64', media_type, data: fileBuffer.toString('base64') },
    })
  }
  const params = {
    model: MODEL,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: 'user', content }],
    stream: false,
  }
  if (isPdf) params.betas = [PDF_BETA]
  const response = await anthropic.beta.messages.create(params)
  const textBlock = response.content?.find((b) => b.type === 'text')
  return textBlock?.text || ''
}

function stripMarkdown(raw) {
  return raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
}

/**
 * Parse raw Claude response into normalized material list { categories, summary }.
 */
function parseClaudeResponse(raw) {
  try {
    const cleaned = stripMarkdown(raw)
    const data = JSON.parse(cleaned)
    if (data && Array.isArray(data.categories)) return data
    return null
  } catch (_) {
    return null
  }
}

/**
 * Aggregate per-sheet civil results. Merge on category + description only (never keynote number).
 */
function aggregateCivilSheets(sheetResults) {
  const itemMap = {}
  const allMissing = []
  const allFlags = []

  for (const sheet of sheetResults) {
    const sourceSheet = sheet._sourceSheet

    for (const category of sheet.categories || []) {
      const catName = String(category.name || 'Uncategorized').trim()
      for (const item of category.items || []) {
        const key = `${catName}||${String(item.description || '').trim()}`.toLowerCase()
        if (!key.replace(/\|/g, '')) continue

        if (itemMap[key]) {
          itemMap[key].quantity += Number(item.quantity) || 0
          itemMap[key].sourceSheets.push(sourceSheet)
        } else {
          itemMap[key] = {
            description: item.description ?? '',
            quantity: Number(item.quantity) || 0,
            unit: item.unit ?? '',
            notes: item.notes ?? '',
            trade_tag: item.trade_tag ?? '',
            cost_estimate: item.cost_estimate ?? null,
            subcategory: item.subcategory ?? '',
            category: catName,
            sourceSheets: [sourceSheet],
          }
        }
      }
    }
    if (sheet.missing_information && Array.isArray(sheet.missing_information)) allMissing.push(...sheet.missing_information)
    if (sheet.flags && Array.isArray(sheet.flags)) allFlags.push(...sheet.flags)
  }

  const categoryMap = new Map()
  for (const item of Object.values(itemMap)) {
    const catName = item.category || 'Uncategorized'
    if (!categoryMap.has(catName)) categoryMap.set(catName, { name: catName, items: [] })
    categoryMap.get(catName).items.push({
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      notes: item.notes,
      trade_tag: item.trade_tag,
      cost_estimate: item.cost_estimate,
      subcategory: item.subcategory,
      drawing_refs: item.sourceSheets ? item.sourceSheets.map((n) => `Sheet-${n}`) : undefined,
    })
  }

  return {
    categories: Array.from(categoryMap.values()),
    summary: `Civil takeoff across ${sheetResults.length} sheets. Merged ${Object.keys(itemMap).length} unique line items.`,
    missing_information: [...new Set(allMissing)],
    flags: [...new Set(allFlags)],
  }
}

/**
 * Civil-only: Pass 1 keynote register (page 1), Pass 2 one call per sheet, Pass 3 aggregate by material.
 */
async function runTakeoffCivil(fileBuffer, options = {}) {
  const useCustomProject = options.useCustomProject === true
  const totalPages = await getPDFPageCount(fileBuffer)
  console.log(`[Civil Takeoff] ${totalPages} sheets detected — running sheet-aware flow`)

  // Pass 1: Sheet index + keynote register (page 1 only)
  const page1Buffer = await extractPDFPages(fileBuffer, 1, 1)
  const registerPrompt = buildKeynoteRegisterPrompt()
  let registerRaw
  try {
    registerRaw = await callClaudeWithPrompt(page1Buffer, 'application/pdf', registerPrompt, 'Extract the sheet index and keynote legend. Return JSON only.')
  } catch (err) {
    console.warn('[Civil Takeoff] Pass 1 failed:', err.message)
    registerRaw = ''
  }
  let keynoteRegister
  try {
    keynoteRegister = JSON.parse(stripMarkdown(registerRaw))
    if (!keynoteRegister || typeof keynoteRegister !== 'object') keynoteRegister = { sheets: [], keynotes: [], scales: {}, notes: '' }
  } catch (_) {
    keynoteRegister = { sheets: [], keynotes: [], scales: {}, notes: 'No keynote register found on page 1' }
    console.warn('[Civil Takeoff] Pass 1: No valid keynote register JSON, continuing')
  }

  // Pass 2: Per-sheet material extraction
  const perSheetResults = []
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const pageBuffer = await extractPDFPages(fileBuffer, pageNum, pageNum)
    const sheetPrompt = await buildSheetTakeoffPrompt(keynoteRegister, pageNum, totalPages, useCustomProject, options.tradeFilter ?? null)
    console.log(`[Civil Takeoff] Pass 2: Processing sheet ${pageNum}/${totalPages}`)
    let raw
    try {
      raw = await callClaudeWithPrompt(pageBuffer, 'application/pdf', sheetPrompt, 'Process this sheet and return the material list JSON.')
    } catch (err) {
      console.warn(`[Civil Takeoff] Sheet ${pageNum} failed:`, err.message)
      continue
    }
    const parsed = parseClaudeResponse(raw)
    if (parsed) {
      parsed._sourceSheet = pageNum
      perSheetResults.push(parsed)
    }
  }

  if (perSheetResults.length === 0) {
    return {
      materialList: { categories: [], summary: 'Civil takeoff: no sheets could be parsed.' },
      rawText: '',
    }
  }

  const materialList = aggregateCivilSheets(perSheetResults)
  return { materialList, rawText: materialList.summary || '' }
}

/**
 * Split a PDF into chunks of up to PAGES_PER_CHUNK pages. Returns array of PDF buffers.
 * @param {Buffer} pdfBuffer
 * @returns {Promise<Buffer[]>}
 */
async function splitPdfIntoChunks(pdfBuffer) {
  const src = await PDFDocument.load(pdfBuffer)
  const pageCount = src.getPageCount()
  if (pageCount <= 0) return [pdfBuffer]
  const chunks = []
  for (let start = 0; start < pageCount; start += PAGES_PER_CHUNK) {
    const end = Math.min(start + PAGES_PER_CHUNK, pageCount)
    const doc = await PDFDocument.create()
    const indices = []
    for (let i = start; i < end; i++) indices.push(i)
    const copied = await doc.copyPages(src, indices)
    copied.forEach((p) => doc.addPage(p))
    const bytes = await doc.save()
    chunks.push(Buffer.from(bytes))
  }
  return chunks
}

/**
 * Merge multiple material lists into one.
 * KEY: merge on (category + description + unit) only — never on subcategory, keynote number, or
 * any sheet-specific field. That prevents phantom duplication when the same material appears on
 * multiple sheets with different keynotes/subcategory labels.
 * @param {{ categories?: Array<{ name: string, items: Array<{ description?: string, quantity?: number, unit?: string, notes?: string, subcategory?: string, trade_tag?: string, cost_estimate?: number }> }>, summary?: string }[]} materialLists
 * @returns {{ categories: Array, summary: string }}
 */
function mergeMaterialLists(materialLists) {
  const categoryMap = new Map()
  // Identity of a line item for merging: category + description + unit. No subcategory/keynote.
  const mergeKey = (categoryName, item) =>
    [categoryName, String(item.description || '').trim(), String(item.unit || '').trim()].join('\0')
  for (const list of materialLists) {
    const categories = list?.categories && Array.isArray(list.categories) ? list.categories : []
    for (const cat of categories) {
      const name = String(cat.name || 'Uncategorized').trim()
      if (!categoryMap.has(name)) categoryMap.set(name, new Map())
      const itemMap = categoryMap.get(name)
      const items = cat.items && Array.isArray(cat.items) ? cat.items : []
      for (const item of items) {
        const k = mergeKey(name, item)
        const qty = Number(item.quantity) || 0
        if (itemMap.has(k)) {
          const existing = itemMap.get(k)
          existing.quantity = (Number(existing.quantity) || 0) + qty
          if (item.cost_estimate != null && existing.cost_estimate == null) existing.cost_estimate = item.cost_estimate
        } else {
          itemMap.set(k, {
            subcategory: item.subcategory ?? '',
            description: item.description ?? '',
            quantity: qty,
            unit: item.unit ?? '',
            notes: item.notes ?? '',
            trade_tag: item.trade_tag ?? '',
            cost_estimate: item.cost_estimate ?? null,
          })
        }
      }
    }
  }
  const categories = []
  for (const [catName, itemMap] of categoryMap) {
    categories.push({
      name: catName,
      items: Array.from(itemMap.values()),
    })
  }
  const summary =
    materialLists.length > 1
      ? `Combined takeoff from ${materialLists.length} plan sections.`
      : (materialLists[0]?.summary || '')
  return { categories, summary }
}

/**
 * Single takeoff request (one PDF or image). Used internally and for non-PDF / small PDFs.
 */
async function runTakeoffSingle(fileBuffer, mimeType, options = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')

  const anthropic = new Anthropic({ apiKey })
  const planType = options.planType && ['residential', 'commercial', 'civil', 'auto'].includes(options.planType) ? options.planType : 'auto'
  const tradeFilter = options.tradeFilter ?? null
  const system =
    options.useCustomProject === true
      ? await buildCustomProjectSystemPrompt(planType, tradeFilter)
      : buildSystemPrompt()

  const isPdf = mimeType === 'application/pdf'
  const content = [
    {
      type: 'text',
      text:
        'Analyze the attached build plan and produce a complete, accurate material list in the exact JSON format specified in the system prompt. Include all materials with quantities and units.',
    },
  ]

  if (isPdf) {
    content.push({
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: fileBuffer.toString('base64'),
      },
    })
  } else {
    const mediaType = mimeType === 'image/png' ? 'image/png' : 'image/jpeg'
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType,
        data: fileBuffer.toString('base64'),
      },
    })
  }

  const params = {
    model: MODEL,
    max_tokens: 8192,
    system,
    messages: [{ role: 'user', content }],
    stream: false,
  }

  if (isPdf) {
    params.betas = [PDF_BETA]
  }

  let response
  try {
    response = await anthropic.beta.messages.create(params)
  } catch (apiErr) {
    const msg = apiErr?.error?.message ?? apiErr?.message ?? ''
    const status = apiErr?.status ?? apiErr?.httpStatus
    if (status === 400 && (msg.includes('credit') || msg.includes('balance') || msg.includes('billing'))) {
      const err = new Error(
        'Anthropic reports your credit balance is too low for API use. If you have $5 and auto-reload on, try buying more credits once so your balance is above the reload threshold, or wait for auto-reload to complete. Add credits at https://console.anthropic.com (Credit balance / Buy credits).'
      )
      err.status = 402
      throw err
    }
    if (msg.toLowerCase().includes('connection') || msg.toLowerCase().includes('econnrefused') || msg.toLowerCase().includes('network')) {
      const err = new Error(
        'Could not reach the Anthropic API (connection error). Check your internet connection, firewall, and that api.anthropic.com is not blocked. If you use a VPN or proxy, try without it.'
      )
      err.status = 503
      throw err
    }
    if (status === 400 && (msg.includes('Could not process PDF') || msg.includes('process PDF'))) {
      const err = new Error(
        'The PDF could not be processed. Try again once or twice (the API can be flaky). If it still fails: ensure the PDF is under 32MB and 100 pages, not password-protected, and not corrupted. You can also try re-saving the PDF or exporting plan pages as images (PNG/JPEG) and uploading those instead.'
      )
      err.status = 400
      throw err
    }
    if (msg) throw new Error(msg)
    throw apiErr
  }

  const textBlock = response.content?.find((b) => b.type === 'text')
  const rawText = textBlock?.text || ''

  let materialList = { categories: [], summary: '' }
  try {
    const cleaned = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
    materialList = JSON.parse(cleaned)
    if (!Array.isArray(materialList.categories)) materialList = { categories: [], summary: '' }
  } catch (_) {
    materialList = { categories: [], summary: rawText.slice(0, 500) }
  }

  return { materialList, rawText }
}

/**
 * Run takeoff: send plan (PDF/image) to Claude and return parsed material list.
 * Civil PDFs use sheet-aware flow (keynote register → per-sheet → aggregate). Others use chunked flow.
 * @param {Buffer} fileBuffer - Plan file content
 * @param {string} mimeType - e.g. 'application/pdf', 'image/jpeg'
 * @param {{ useCustomProject?: boolean, planType?: string }} [options]
 * @returns {Promise<{ materialList: object, rawText?: string }>}
 */
async function runTakeoff(fileBuffer, mimeType, options = {}) {
  const isPdf = mimeType === 'application/pdf'
  const planType = options.planType && ['residential', 'commercial', 'civil', 'auto'].includes(options.planType) ? options.planType : 'auto'

  if (planType === 'civil' && isPdf) {
    return runTakeoffCivil(fileBuffer, options)
  }

  if (!isPdf) {
    return runTakeoffSingle(fileBuffer, mimeType, options)
  }

  let pageCount
  try {
    const doc = await PDFDocument.load(fileBuffer)
    pageCount = doc.getPageCount()
  } catch (_) {
    return runTakeoffSingle(fileBuffer, mimeType, options)
  }

  if (pageCount <= PAGES_PER_CHUNK) {
    return runTakeoffSingle(fileBuffer, mimeType, options)
  }

  const chunks = await splitPdfIntoChunks(fileBuffer)
  const results = []
  for (let i = 0; i < chunks.length; i++) {
    const { materialList } = await runTakeoffSingle(chunks[i], mimeType, options)
    results.push(materialList)
  }

  const merged = mergeMaterialLists(results)
  return { materialList: merged, rawText: '' }
}

module.exports = { runTakeoff }