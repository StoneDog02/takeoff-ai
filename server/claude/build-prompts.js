const fs = require('fs')
const path = require('path')

const PROMPTS_DIR = path.join(__dirname, '../prompts')
const CUSTOM_PROJECT_DIR = path.join(__dirname, 'material-takeoff-project')
const KNOWLEDGE_DIR = path.join(CUSTOM_PROJECT_DIR, 'knowledge')

const OUTPUT_FORMAT_JSON = {
  categories: [
    {
      name: 'Category Name',
      items: [
        {
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

function readKnowledgeFiles() {
  try {
    if (!fs.existsSync(KNOWLEDGE_DIR)) return []
    const names = fs.readdirSync(KNOWLEDGE_DIR).sort()
    return names
      .map((name) => {
        const fullPath = path.join(KNOWLEDGE_DIR, name)
        if (!fs.statSync(fullPath).isFile()) return null
        try {
          return { name, content: fs.readFileSync(fullPath, 'utf8').trim() }
        } catch (err) {
          return null
        }
      })
      .filter(Boolean)
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
 */
function buildCustomProjectSystemPrompt() {
  const instruction = readCustomProjectInstructions()
  const parts = [instruction || 'You are an expert construction takeoff assistant. Analyze the build plan and produce a material list.']

  const knowledgeFiles = readKnowledgeFiles()
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