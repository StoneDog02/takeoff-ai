const fs = require('fs')
const path = require('path')
const pdfParse = require('pdf-parse')
const XLSX = require('xlsx')
const mammoth = require('mammoth')

const PROMPTS_DIR = path.join(__dirname, '../prompts')
const CUSTOM_PROJECT_DIR = path.join(__dirname, 'material-takeoff-project')
const KNOWLEDGE_DIR = path.join(CUSTOM_PROJECT_DIR, 'knowledge')

const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.csv', '.json', '.py'])
const BINARY_EXTENSIONS = new Set(['.pdf', '.xlsx', '.xls', '.docx'])

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

function readPromptFile(name) {
  const p = path.join(PROMPTS_DIR, name)
  try {
    return fs.readFileSync(p, 'utf8').trim()
  } catch (err) {
    return ''
  }
}

function readCustomProjectInstructions() {
  const p = path.join(CUSTOM_PROJECT_DIR, 'instructions.txt')
  try {
    return fs.readFileSync(p, 'utf8').trim()
  } catch (err) {
    return ''
  }
}

/**
 * Read knowledge files as plain text. .txt, .md, .csv, .json are read as UTF-8.
 * .pdf, .xlsx, .xls, .docx are parsed and their text content extracted.
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

function getOutputFormatSection() {
  return (
    '\n\n---\nOutput format: Respond with a single JSON object matching this structure (no markdown, no code fence). Include trade_tag and cost_estimate when you can:\n' +
    JSON.stringify(OUTPUT_FORMAT_JSON, null, 2)
  )
}

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

/**
 * Build the system message for the material takeoff custom project: instructions + knowledge files + output format.
 * Used when running takeoff from the project detail Takeoff tab.
 * Knowledge files can be .txt, .md, .csv, .json (read as text) or .pdf, .xlsx, .xls, .docx (text extracted).
 * @returns {Promise<string>}
 */
async function buildCustomProjectSystemPrompt() {
  const instruction = readCustomProjectInstructions()
  const parts = [instruction || 'You are an expert construction takeoff assistant. Analyze the build plan and produce a material list.']

  const knowledgeFiles = await readKnowledgeFilesAsync()
  if (knowledgeFiles.length > 0) {
    parts.push('\n\n---\nReference / knowledge (use when producing the takeoff):')
    for (const { name, content } of knowledgeFiles) {
      if (content) parts.push(`\n\n--- Reference: ${name}\n\n${content}`)
    }
  }

  parts.push(getOutputFormatSection())
  return parts.join('')
}

module.exports = { buildSystemPrompt, buildCustomProjectSystemPrompt }