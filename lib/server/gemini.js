export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY)
}

function geminiModel() {
  return process.env.GEMINI_MODEL || 'gemini-2.0-flash'
}

async function generateText(prompt) {
  const apiKey = process.env.GEMINI_API_KEY
  const model = geminiModel()
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error?.message || `Gemini API error (${response.status})`)
  }

  return (data.candidates || [])
    .flatMap((c) => c.content?.parts || [])
    .map((p) => p.text || '')
    .join('\n')
    .trim()
}

function parseJsonBlock(text) {
  const match = String(text).match(/\{[\s\S]*\}|\[[\s\S]*\]/)
  if (!match) return null
  try {
    return JSON.parse(match[0])
  } catch {
    return null
  }
}

/** Suggest richer keywords for Indian B2B search when the database returns few matches. */
export async function expandSearchKeywords(filters) {
  if (!isGeminiConfigured()) {
    return { keywords: filters.keywords || '', aiGenerated: false }
  }

  const prompt = `You help refine B2B lead search queries for India exports.

Current search:
- keywords: ${filters.keywords || '(none)'}
- job titles: ${(filters.jobTitles || []).join(', ') || '(none)'}
- states: ${(filters.states || []).join(', ') || '(none)'}
- cities: ${(filters.cities || []).join(', ') || '(none)'}
- industries: ${(filters.industries || []).join(', ') || '(none)'}

Return ONLY JSON:
{
  "keywords": "short phrase for matching company/title/industry text",
  "extraTerms": ["term1", "term2"]
}

Include export-related terms when the user searches exporters. Keep keywords under 12 words.`

  try {
    const text = await generateText(prompt)
    const parsed = parseJsonBlock(text)
    const keywords =
      parsed?.keywords?.trim() ||
      [filters.keywords, ...(parsed?.extraTerms || [])].filter(Boolean).join(' ')

    return {
      keywords: keywords || filters.keywords || '',
      extraTerms: parsed?.extraTerms || [],
      aiGenerated: true,
      provider: 'gemini',
    }
  } catch (error) {
    return {
      keywords: filters.keywords || '',
      aiGenerated: false,
      error: error.message,
    }
  }
}

export async function generateGeminiEmail(lead, options = {}) {
  const purpose = options.purpose || 'introduction'
  const tone = options.tone || 'professional'
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'there'

  const prompt = `Write a ${tone} B2B email (${purpose}) to ${name}, ${lead.title} at ${lead.company}, ${lead.city || ''} ${lead.state || ''}, India.

Return ONLY JSON: {"subject":"...","body":"..."}
Under 180 words. Sign off as "[Your name]" from Connect Intel.`

  const text = await generateText(prompt)
  const parsed = parseJsonBlock(text)
  if (parsed?.subject && parsed?.body) {
    return { subject: String(parsed.subject), body: String(parsed.body), aiGenerated: true, provider: 'gemini' }
  }

  throw new Error('Gemini did not return a valid email draft')
}
