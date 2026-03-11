const fs = require('fs')
const path = require('path')
const pdfParse = require('pdf-parse')
const XLSX = require('xlsx')
const mammoth = require('mammoth')
const { selectRelevantDocs } = require('./plan-type-docs')
const { getKnowledgeCache } = require('./knowledge-cache')
const { getTradeFilter } = require('./trade-definitions')

const PROMPTS_DIR = path.join(__dirname, '../prompts')
const CUSTOM_PROJECT_DIR = path.join(__dirname, 'material-takeoff-project')
const KNOWLEDGE_DIR = path.join(CUSTOM_PROJECT_DIR, 'knowledge')

const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.csv', '.json', '.py'])
const BINARY_EXTENSIONS = new Set(['.pdf', '.xlsx', '.xls', '.docx'])

// --- Tier hierarchy (custom project only) ---

/** TIER 1: Always first, always applied. Overrides all other rules below. */
const TIER1_FILES = [
  'Burt_Takeoff_Instruction_Updates.pdf', // PDF preferred; .docx also supported if valid
]

/** TIER 2: Process instructions — core takeoff process + context (tier2-process/). */
const TIER2_CONTEXT = [
  'AI_Bluebeam_Prompt.md',
  'Civil_Takeoff_Claude_Prompts.md',
  'teaching-ai-to-measure.pdf',
  '100%-accuracy-material-takeoff-guide.pdf',
  'accuracy-fix-plan.pdf',
  'bluebeam-rev-complete-tracing-and-measurement-guide.pdf',
]

/** TIER 3 doc list is in plan-type-docs.js (selectRelevantDocs). */

const OUTPUT_FORMAT_JSON = {
  categories: [
    {
      name: 'Category Name',
      items: [
        {
          subcategory: 'Subcategory within category (e.g. Footings, Pipe, Manholes)',
          description: 'Item description',
          quantity: 0,
          unit: 'LF',
          notes: '',
          trade_tag: 'Framing',
          cost_estimate: 0,
        },
      ],
    },
  ],
  summary: 'Optional brief summary',
}

// --- Helpers ---

function readPromptFile(name) {
  const p = path.join(PROMPTS_DIR, name)
  try {
    return fs.readFileSync(p, 'utf8').trim()
  } catch (err) {
    return ''
  }
}

/** Read a text file from custom project dir (e.g. instructions.txt). */
function readFile(name, baseDir = CUSTOM_PROJECT_DIR) {
  const p = path.join(baseDir, name)
  try {
    return fs.readFileSync(p, 'utf8').trim()
  } catch (err) {
    return ''
  }
}

/**
 * Get content for a knowledge file by filename (from cache, warmed at startup).
 * @param {string} filename - Basename (e.g. 'AI_Bluebeam_Prompt.md', 'Burt_Takeoff_Instruction_Updates.docx')
 * @returns {string}
 */
function extractFileContent(filename) {
  const cache = getKnowledgeCache()
  return cache[filename] || `[WARNING: ${filename} not found in knowledge cache]`
}

/** Build the output-format block (always last in the prompt). Must be strict so the parser can find the JSON. */
function buildOutputFormatBlock() {
  const divider = '='.repeat(60)
  return `

${divider}
OUTPUT FORMAT — CRITICAL
${divider}

Your response MUST begin with { and end with }. No markdown fences. No preamble. No text outside the JSON.

JSON SAFETY RULES — violations break the parser:
- Use "in" or "inch" instead of the inch symbol (") inside any string value (e.g. "20 in wide" not "20\\" wide").
- Use "ft" or "foot" instead of the foot symbol (') inside any string value.
- Use "--" instead of em dashes (—) inside strings.
- Never put unescaped double quotes inside a string value (e.g. write "2-#4 rebar continuous" not "2-#4 rebar \\"continuous\\"").
- No newlines inside description, notes, or other string fields — use a single line per value.

Use the key "categories" (array of { "name", "items" }) and optionally "summary" (string).

Structure (include trade_tag and cost_estimate when you can):

` +
    JSON.stringify(OUTPUT_FORMAT_JSON, null, 2) +
    `
`
}

/** Alias for default prompt path; same content as buildOutputFormatBlock(). */
function getOutputFormatSection() {
  return buildOutputFormatBlock()
}

/**
 * Build the trade scope filter block injected into the system prompt.
 * Insert after TIER 3, before output format. Returns empty string when tradeFilter is null (full takeoff).
 *
 * @param {{ label: string, csi: string, categories: string[], prompt: string }|null} tradeFilter - Result of getTradeFilter(), or null
 * @returns {string}
 */
function buildTradeFilterBlock(tradeFilter) {
  if (!tradeFilter) return ''

  const divider = '='.repeat(60)
  return `

${divider}
TRADE SCOPE FILTER — READ THIS BEFORE EXTRACTING ANYTHING
${divider}

This takeoff is scoped to the following trade(s): ${tradeFilter.label} (${tradeFilter.csi})

INSTRUCTIONS:
${tradeFilter.prompt}

OUTPUT RULES FOR TRADE-SCOPED TAKEOFFS:
- Include ONLY line items that belong to the trade categories listed above.
- Set project_summary.notes to: "Trade-scoped takeoff: ${tradeFilter.label} only"
- If a material is ambiguous (could belong to this trade or another), INCLUDE it and add a flag: "Verify trade scope with GC"
- Do NOT add missing_information entries for categories outside this trade — their absence is intentional.
- All Burt Override Rules still apply to items within this trade scope.
- Confidence flags still apply — low confidence items within scope should still be flagged.

CATEGORIES IN SCOPE: ${tradeFilter.categories.join(', ')}
`
}

// --- Default prompt (standalone /takeoff, no custom project) ---

/**
 * Build the system message from system-instruction.txt + rulebook.txt
 */
function buildSystemPrompt() {
  const instruction = readPromptFile('system-instruction.txt')
  const rulebook = readPromptFile('rulebook.txt')
  const parts = [instruction]
  if (rulebook) parts.push('\n\n---\nRulebook:\n' + rulebook)
  parts.push(getOutputFormatSection())
  return parts.join('')
}

// --- Custom project prompt (project Takeoff tab) — tiered hierarchy ---

/**
 * Build the system message for the material takeoff custom project with tiered hierarchy:
 * - TIER 1: Burt overrides (supersede all other rules)
 * - TIER 2: instructions.txt + process context (Bluebeam, Civil prompts)
 * - TIER 3: Reference rules (subset by planType when not 'auto')
 * - Output format block (always last)
 *
 * @param {string} [planType='auto'] - 'residential' | 'civil' | 'commercial' | 'auto' for TIER 3 doc set (see plan-type-docs.js)
 * @param {null|string|string[]} [tradeKeys] - Single trade key, array of keys, or null for full takeoff
 * @returns {Promise<string>}
 */
async function buildCustomProjectSystemPrompt(planType = 'auto', tradeKeys = null) {
  let prompt = ''

  // === TIER 1: ABSOLUTE OVERRIDES — READ FIRST, APPLY ALWAYS ===
  prompt += `\n\n${'='.repeat(60)}\n`
  prompt += `TIER 1 — BURT OVERRIDES (supersede ALL other rules below)\n`
  prompt += `${'='.repeat(60)}\n`
  for (const file of TIER1_FILES) {
    const content = extractFileContent(file)
    if (content) prompt += `\n\n--- ${file}\n\n${content}`
  }

  // === TIER 2: PROCESS INSTRUCTIONS ===
  prompt += `\n\n${'='.repeat(60)}\n`
  prompt += `TIER 2 — TAKEOFF PROCESS INSTRUCTIONS\n`
  prompt += `${'='.repeat(60)}\n`
  const instructions = readFile('instructions.txt')
  prompt += instructions || 'You are an expert construction takeoff assistant. Analyze the build plan and produce a material list.'
  for (const file of TIER2_CONTEXT) {
    const content = extractFileContent(file)
    if (content) prompt += `\n\n--- ${file}\n\n${content}`
  }

  // === TIER 3: REFERENCE RULES (relevant subset only) ===
  prompt += `\n\n${'='.repeat(60)}\n`
  prompt += `TIER 3 — REFERENCE RULES (apply only where Tier 1 and 2 are silent)\n`
  prompt += `${'='.repeat(60)}\n`
  const relevantDocs = selectRelevantDocs(planType)
  for (const file of relevantDocs) {
    const content = extractFileContent(file)
    if (content) prompt += `\n\n--- ${file}\n\n${content}`
  }

  // === TRADE SCOPE (after tier 3, before output format) ===
  const resolvedTradeFilter = getTradeFilter(tradeKeys)
  prompt += buildTradeFilterBlock(resolvedTradeFilter)

  // === OUTPUT FORMAT (always last) ===
  prompt += buildOutputFormatBlock()

  return prompt
}

// Legacy: readCustomProjectInstructions for any code that still references it
function readCustomProjectInstructions() {
  return readFile('instructions.txt')
}

// --- Civil sheet-aware takeoff (Pass 1: keynote register) ---

/**
 * System prompt for Pass 1 of civil takeoff: extract sheet index, keynote legend, and scales from cover/index sheet.
 * Returns JSON only; no explanation.
 */
function buildKeynoteRegisterPrompt() {
  return `
You are a civil engineering plan reader performing Pass 1 of a sheet-aware takeoff.

This is the COVER SHEET or SHEET INDEX of a civil plan set.

YOUR ONLY TASK: Extract the following and return ONLY valid JSON, no other text.

{
  "sheets": [
    { "sheet_number": "C-101", "title": "Site Plan", "discipline": "civil" }
  ],
  "keynotes": [
    { "number": 1, "description": "6\\" DIP Water Main", "material": "DIP pipe", "unit": "LF" }
  ],
  "scales": {
    "C-101": "1 inch = 20 feet",
    "C-102": "1 inch = 20 feet"
  },
  "notes": "Any drafting conventions observed (e.g. keynotes reset per sheet)"
}

If this sheet has no keynote legend, return:
{ "sheets": [], "keynotes": [], "scales": {}, "notes": "No keynote legend on this sheet" }

Do not describe the sheet. Do not add explanation. Return JSON only.
`.trim()
}

/**
 * System prompt for Pass 2 of civil takeoff: one sheet, with keynote register as context.
 * @param {object} keynoteRegister - Parsed Pass 1 result { sheets, keynotes, scales, notes }
 * @param {number} pageNum - Current sheet number (1-based)
 * @param {number} totalPages - Total sheet count
 * @param {boolean} useCustomProject - If true, use civil custom project prompt as base
 * @param {null|string|string[]} [tradeFilter] - Optional trade scope (single key or array of keys)
 * @returns {Promise<string>}
 */
async function buildSheetTakeoffPrompt(keynoteRegister, pageNum, totalPages, useCustomProject, tradeFilter = null) {
  const basePrompt = useCustomProject
    ? await buildCustomProjectSystemPrompt('civil', tradeFilter)
    : buildSystemPrompt()

  const registerBlock =
    keynoteRegister.keynotes && keynoteRegister.keynotes.length > 0
      ? `
KEYNOTE REGISTER FROM COVER SHEET (do NOT re-number or re-interpret these):
${JSON.stringify(keynoteRegister.keynotes, null, 2)}

IMPORTANT: Keynote numbers reset per sheet in this plan set.
- Keynote 3 on THIS sheet may be a different material than Keynote 3 on another sheet.
- Always resolve keynotes to their MATERIAL DESCRIPTION before counting.
- Never aggregate by keynote number — aggregate by material category + description only.
`
      : `
No keynote register was found on the cover sheet.
Resolve all keynote symbols on this sheet by reading the keynote legend ON THIS SHEET ONLY.
Do not carry forward keynote numbers from other sheets.
`

  return `
${basePrompt}

${registerBlock}

─────────────────────────────────────────
YOU ARE PROCESSING: Sheet ${pageNum} of ${totalPages}
─────────────────────────────────────────
RULES FOR THIS PASS:
1. Count and measure only what is visible on THIS sheet.
2. Do not reference or assume quantities from other sheets.
3. Resolve every keynote symbol to its material description before recording it.
4. Flag any keynote symbol whose description you cannot resolve on this sheet.
5. Include "sheet_number": ${pageNum} on every line item in your output.

Return the standard JSON output format (categories array with name and items; each item has description, quantity, unit, notes, trade_tag, cost_estimate).
`.trim()
}

/**
 * Read all knowledge files (flat list). Used if something still needs the old "all files in one go" behavior.
 * @returns {Promise<Array<{ name: string, content: string }>>}
 */
async function readKnowledgeFilesAsync() {
  try {
    if (!fs.existsSync(KNOWLEDGE_DIR)) return []
    const names = fs.readdirSync(KNOWLEDGE_DIR).sort()
    const results = []
    for (const name of names) {
      const fullPath = path.join(KNOWLEDGE_DIR, name)
      if (!fs.statSync(fullPath).isFile()) continue
      const ext = path.extname(name).toLowerCase()
      let content = ''
      try {
        if (TEXT_EXTENSIONS.has(ext)) {
          content = fs.readFileSync(fullPath, 'utf8').trim()
        } else if (ext === '.pdf') {
          const buffer = fs.readFileSync(fullPath)
          const data = await pdfParse(buffer)
          content = (data?.text || '').trim()
        } else if (ext === '.xlsx' || ext === '.xls') {
          const buffer = fs.readFileSync(fullPath)
          const workbook = XLSX.read(buffer, { type: 'buffer' })
          const parts = []
          for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName]
            parts.push(`[Sheet: ${sheetName}]\n${XLSX.utils.sheet_to_csv(sheet)}`)
          }
          content = parts.join('\n\n').trim()
        } else if (ext === '.docx') {
          const buffer = fs.readFileSync(fullPath)
          const result = await mammoth.extractRawText({ buffer })
          content = (result?.value || '').trim()
        } else {
          continue
        }
        if (content) results.push({ name, content })
      } catch (err) {
        console.warn(`[knowledge] Skipped ${name}:`, err.message)
      }
    }
    return results
  } catch (err) {
    return []
  }
}

module.exports = {
  buildSystemPrompt,
  buildCustomProjectSystemPrompt,
  buildKeynoteRegisterPrompt,
  buildSheetTakeoffPrompt,
  getOutputFormatSection,
  readCustomProjectInstructions,
  readKnowledgeFilesAsync,
  extractFileContent,
  selectRelevantDocs,
  TIER1_FILES,
  TIER2_CONTEXT,
}
