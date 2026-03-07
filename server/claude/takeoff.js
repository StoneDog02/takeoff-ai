const { PDFDocument } = require('pdf-lib')
const Anthropic = require('@anthropic-ai/sdk')
const { buildSystemPrompt, buildCustomProjectSystemPrompt } = require('./build-prompts')

const PDF_BETA = 'pdfs-2024-09-25'
const MODEL = 'claude-sonnet-4-6'
/** Max pages per chunk to stay under API limits. Anthropic allows 100; we use 5 for reliability. */
const PAGES_PER_CHUNK = 5

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
 * Merge multiple material lists into one: same category names combined, same (description, unit, trade_tag) items have quantities summed.
 * @param {{ categories?: Array<{ name: string, items: Array<{ description?: string, quantity?: number, unit?: string, notes?: string, trade_tag?: string, cost_estimate?: number }> }>, summary?: string }[]} materialLists
 * @returns {{ categories: Array, summary: string }}
 */
function mergeMaterialLists(materialLists) {
  const categoryMap = new Map()
  const key = (item) =>
    [String(item.subcategory || '').trim(), String(item.description || '').trim(), String(item.unit || '').trim(), String(item.trade_tag || '').trim()].join('\0')
  for (const list of materialLists) {
    const categories = list?.categories && Array.isArray(list.categories) ? list.categories : []
    for (const cat of categories) {
      const name = String(cat.name || 'Uncategorized').trim()
      if (!categoryMap.has(name)) categoryMap.set(name, new Map())
      const itemMap = categoryMap.get(name)
      const items = cat.items && Array.isArray(cat.items) ? cat.items : []
      for (const item of items) {
        const k = key(item)
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
  const system =
    options.useCustomProject === true
      ? await buildCustomProjectSystemPrompt()
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
 * For PDFs over PAGES_PER_CHUNK pages, splits into chunks, runs takeoff per chunk, and merges results.
 * @param {Buffer} fileBuffer - Plan file content
 * @param {string} mimeType - e.g. 'application/pdf', 'image/jpeg'
 * @param {{ useCustomProject?: boolean }} [options] - If useCustomProject is true, use custom project instructions + knowledge
 * @returns {Promise<{ materialList: object, rawText?: string }>}
 */
async function runTakeoff(fileBuffer, mimeType, options = {}) {
  const isPdf = mimeType === 'application/pdf'

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