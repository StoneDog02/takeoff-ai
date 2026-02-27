const fs = require('fs')
const path = require('path')

const PROMPTS_DIR = path.join(__dirname, '../prompts')

function readPromptFile(name) {
  const p = path.join(PROMPTS_DIR, name)
  try {
    return fs.readFileSync(p, 'utf8').trim()
  } catch (err) {
    return ''
  }
}

/**
 * Build the system message from system-instruction.txt + rulebook.txt
 */
function buildSystemPrompt() {
  const instruction = readPromptFile('system-instruction.txt')
  const rulebook = readPromptFile('rulebook.txt')
  const parts = [instruction]
  if (rulebook) parts.push('\n\n---\nRulebook:\n' + rulebook)
  parts.push(
    '\n\n---\nOutput format: Respond with a single JSON object matching this structure (no markdown, no code fence):\n' +
      JSON.stringify(
        {
          categories: [
            {
              name: 'Category Name',
              items: [
                { description: 'Item description', quantity: 0, unit: 'LF', notes: '' },
              ],
            },
          ],
          summary: 'Optional brief summary',
        },
        null,
        2
      )
  )
  return parts.join('')
}

module.exports = { buildSystemPrompt }