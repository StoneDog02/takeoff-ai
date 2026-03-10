/**
 * In-memory cache of knowledge dir file contents. Warmed once at server startup
 * so takeoff requests don't re-read or re-parse PDF/DOCX on every call.
 */
const fs = require('fs')
const path = require('path')
const pdfParse = require('pdf-parse')
const XLSX = require('xlsx')
const mammoth = require('mammoth')

const KNOWLEDGE_BASE = path.join(__dirname, 'material-takeoff-project', 'knowledge')
/** Subdirs in load order; tier1 first so overrides win. */
const KNOWLEDGE_SUBDIRS = [
  'tier1-overrides',
  'tier2-process',
  'tier3-residential',
  'tier3-civil',
  'tier3-commercial',
  'shared',
]
const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.csv', '.json', '.py'])

let _cache = null

/**
 * Extract text from a single file (sync for text, async for pdf/xlsx/docx).
 * @param {string} fullPath - Absolute path to file
 * @returns {Promise<string>}
 */
async function extractContent(fullPath) {
  const ext = path.extname(fullPath).toLowerCase()
  try {
    if (TEXT_EXTENSIONS.has(ext)) {
      return fs.readFileSync(fullPath, 'utf8').trim()
    }
    if (ext === '.pdf') {
      const buffer = fs.readFileSync(fullPath)
      const data = await pdfParse(buffer)
      return (data?.text || '').trim()
    }
    if (ext === '.xlsx' || ext === '.xls') {
      const buffer = fs.readFileSync(fullPath)
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const parts = []
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName]
        parts.push(`[Sheet: ${sheetName}]\n${XLSX.utils.sheet_to_csv(sheet)}`)
      }
      return parts.join('\n\n').trim()
    }
    if (ext === '.docx') {
      const buffer = fs.readFileSync(fullPath)
      const result = await mammoth.extractRawText({ buffer })
      return (result?.value || '').trim()
    }
  } catch (err) {
    const name = path.basename(fullPath)
    console.warn(`[knowledge-cache] extractContent(${name}):`, err.message)
    if (ext === '.docx' && (err.message.includes('central directory') || err.message.includes('zip') || err.message.includes('JSZip'))) {
      console.warn(`[knowledge-cache] ${name} may be corrupted or not a valid .docx. Re-save from Word (Save As → .docx) or replace the file.`)
    }
  }
  return ''
}

/**
 * Warm the cache: load all files from knowledge tier subdirs and extract their content.
 * Keyed by basename so build-prompts / plan-type-docs still reference files by name.
 * Call once at server startup (e.g. in index.js).
 * @returns {Promise<void>}
 */
async function warmKnowledgeCache() {
  if (_cache) return
  _cache = Object.create(null)
  try {
    if (!fs.existsSync(KNOWLEDGE_BASE)) {
      console.log('[Knowledge Cache] Knowledge dir not found, cache empty')
      return
    }
    for (const subdir of KNOWLEDGE_SUBDIRS) {
      const dirPath = path.join(KNOWLEDGE_BASE, subdir)
      if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) continue
      const names = fs.readdirSync(dirPath).sort()
      for (const name of names) {
        const fullPath = path.join(dirPath, name)
        if (!fs.statSync(fullPath).isFile()) continue
        const content = await extractContent(fullPath)
        if (content) {
          _cache[name] = content
          if (name.endsWith(' (1).docx')) {
            const canonical = name.replace(' (1).docx', '.docx')
            _cache[canonical] = content
          }
        }
      }
    }
    console.log(`[Knowledge Cache] Loaded ${Object.keys(_cache).length} files from ${KNOWLEDGE_SUBDIRS.length} tier dirs`)
  } catch (err) {
    console.warn('[Knowledge Cache] warm failed:', err.message)
  }
}

/**
 * Return the in-memory cache (object from filename -> content).
 * Empty object if not warmed yet.
 */
function getKnowledgeCache() {
  return _cache || Object.create(null)
}

module.exports = {
  getKnowledgeCache,
  warmKnowledgeCache,
}
