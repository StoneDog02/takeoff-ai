const Anthropic = require('@anthropic-ai/sdk')
const { buildSystemPrompt } = require('./build-prompts')

const PDF_BETA = 'pdfs-2024-09-25'
const MODEL = 'claude-3-5-sonnet-latest'

/**
 * Run takeoff: send plan (PDF/image) to Claude and return parsed material list.
 * @param {Buffer} fileBuffer - Plan file content
 * @param {string} mimeType - e.g. 'application/pdf', 'image/jpeg'
 * @returns {Promise<{ materialList: object, rawText?: string }>}
 */
async function runTakeoff(fileBuffer, mimeType) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')

  const anthropic = new Anthropic({ apiKey })
  const system = buildSystemPrompt()

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

  const response = await anthropic.beta.messages.create(params)
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

module.exports = { runTakeoff }