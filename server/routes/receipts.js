const express = require('express')
const Anthropic = require('@anthropic-ai/sdk')
const router = express.Router()

const RECEIPT_PROMPT = `You are a receipt parser for a construction project management app. Extract the following from this receipt image and return ONLY valid JSON with no markdown, no explanation:
{
  "vendor": "store or vendor name",
  "date": "MM/DD/YYYY format if visible, else empty string",
  "total": numeric total amount as a number,
  "description": "brief 3-6 word description of main items purchased",
  "category": "one of: Labor, Materials, Equipment, Subs, Other"
}
If something is not visible or unclear, use an empty string or 0.`

/** POST /api/receipts/scan - extract fields from receipt image via Claude */
router.post('/scan', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(503).json({ error: 'Receipt scanning not configured (ANTHROPIC_API_KEY)' })
  }
  const { image_base64: imageBase64, media_type: mediaType } = req.body
  if (!imageBase64 || !mediaType) {
    return res.status(400).json({ error: 'image_base64 and media_type required' })
  }
  // Normalize media_type (e.g. image/jpg -> image/jpeg) for Anthropic
  const normalizedMediaType =
    mediaType === 'image/jpg' ? 'image/jpeg' : mediaType
  try {
    const anthropic = new Anthropic({ apiKey })
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: normalizedMediaType,
                data: imageBase64,
              },
            },
            { type: 'text', text: RECEIPT_PROMPT },
          ],
        },
      ],
    })
    const textBlock = response.content?.find((b) => b.type === 'text')
    const text = textBlock?.text || '{}'
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    res.json({
      vendor: parsed.vendor ?? '',
      date: parsed.date ?? '',
      total: parsed.total != null ? Number(parsed.total) : 0,
      description: parsed.description ?? '',
      category: parsed.category ?? 'Materials',
    })
  } catch (err) {
    console.error('Receipt scan error:', err)
    res.status(500).json({ error: err.message || 'Could not read receipt' })
  }
})

module.exports = router
