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

/** Parse natural-language prospect search into structured filters. */
export async function parseSearchQueryWithGemini(rawQuery, existingFilters = {}) {
  if (!isGeminiConfigured()) {
    return null
  }

  const prompt = `Parse this B2B lead search request for India.

User query: "${String(rawQuery || '').trim()}"

Existing UI filters (keep unless query overrides location):
- states: ${JSON.stringify(existingFilters.states || [])}
- cities: ${JSON.stringify(existingFilters.cities || [])}
- industries: ${JSON.stringify(existingFilters.industries || [])}

Return ONLY JSON:
{
  "keywords": "2-10 words for matching company/product/role (exclude state/city names)",
  "states": ["Rajasthan"],
  "cities": ["Alwar"],
  "industries": [],
  "intent": "find_companies|find_people|find_contact_at_company",
  "targetCompany": "company name if specific org requested, else null",
  "targetRole": "CEO or null",
  "naturalQuery": "one clear sentence describing who to find"
}

Rules:
- Any industry is valid (food, ghee, SaaS, logistics, etc.) — not limited to exporters or ecommerce.
- "ghee manufacturer in rajasthan alwar" → keywords ghee manufacturer, state Rajasthan, city Alwar.
- "CEO email of Xindus Network Trade" → intent find_contact_at_company, targetCompany Xindus Network Trade, targetRole CEO, keywords Xindus Network Trade CEO.
- Use official Indian state names from the query when present.`

  try {
    const text = await generateText(prompt)
    const parsed = parseJsonBlock(text)
    if (!parsed || typeof parsed !== 'object') return null

    const keywords = String(parsed.keywords || rawQuery).trim() || String(rawQuery).trim()

    return {
      filters: {
        keywords,
        states: Array.isArray(parsed.states) ? parsed.states.filter(Boolean) : [],
        cities: Array.isArray(parsed.cities) ? parsed.cities.filter(Boolean) : [],
        industries: Array.isArray(parsed.industries) ? parsed.industries.filter(Boolean) : [],
      },
      naturalQuery: String(parsed.naturalQuery || rawQuery).trim(),
      intent: parsed.intent || 'find_companies',
      targetCompany: parsed.targetCompany || null,
      targetRole: parsed.targetRole || null,
      parsedBy: 'gemini',
    }
  } catch {
    return null
  }
}

/** Suggest richer keywords for Indian B2B search when the database returns few matches. */
export async function expandSearchKeywords(filters, { naturalQuery = '' } = {}) {
  if (!isGeminiConfigured()) {
    return { keywords: filters.keywords || '', aiGenerated: false }
  }

  const prompt = `You help refine B2B lead search queries for India (any industry — manufacturing, SaaS, food, logistics, etc.).

User request: ${naturalQuery || filters.keywords || '(none)'}
Structured keywords: ${filters.keywords || '(none)'}
- states: ${(filters.states || []).join(', ') || '(none)'}
- cities: ${(filters.cities || []).join(', ') || '(none)'}
- industries: ${(filters.industries || []).join(', ') || '(none)'}

Return ONLY JSON:
{
  "keywords": "short phrase for matching company/title/industry text",
  "extraTerms": ["term1", "term2"]
}

Mirror the user's intent. Do not force "exporter" unless they asked for exports. Keep keywords under 12 words.`

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

/** Short next-step coaching for a rep who was just assigned a lead. */
export async function generateAssignmentSuggestion(lead, crm, assigneeName) {
  const status = crm?.status || 'new'
  const prompt = `You are a B2B sales coach for India export teams. In 2-3 short bullet points (max 75 words total), suggest concrete next actions.

Assignee: ${assigneeName || 'Sales rep'}
Lead: ${[lead?.firstName, lead?.lastName].filter(Boolean).join(' ') || 'Unknown'} — ${lead?.title || 'role unknown'} at ${lead?.company || 'company unknown'}
Contact: ${lead?.email || 'no email'}, ${lead?.phone || 'no phone'}
Pipeline status: ${status}
CRM notes: ${String(crm?.notes || '').slice(0, 400) || 'none'}
Meetings: ${
    (crm?.meetings || [])
      .slice(0, 4)
      .map((m) => `${m.title} @ ${m.scheduledAt}`)
      .join('; ') || 'none'
  }

Plain text only. No JSON. Start bullets with "•".`

  const text = await generateText(prompt)
  const cleaned = String(text || '')
    .trim()
    .slice(0, 600)
  if (!cleaned) throw new Error('Empty suggestion')
  return { text: cleaned, aiGenerated: true, provider: 'gemini' }
}

export async function generateGeminiEmail(lead, options = {}) {
  const { emailPromptBlock } = await import('./crmEmailPrompt.js')
  const prompt = emailPromptBlock(lead, options)

  const text = await generateText(prompt)
  const parsed = parseJsonBlock(text)
  if (parsed?.subject && parsed?.body) {
    return { subject: String(parsed.subject), body: String(parsed.body), aiGenerated: true, provider: 'gemini' }
  }

  throw new Error('Gemini did not return a valid email draft')
}

export async function generateGeminiWhatsApp(lead, options = {}) {
  const { emailPromptBlock } = await import('./crmEmailPrompt.js')
  const prompt = `${emailPromptBlock(lead, options)}

Write a short WhatsApp message. Max 80 words. Return ONLY JSON: {"message":"..."}`

  const text = await generateText(prompt)
  const parsed = parseJsonBlock(text)
  if (parsed?.message) {
    return { message: String(parsed.message).trim(), aiGenerated: true, provider: 'gemini' }
  }
  throw new Error('Gemini did not return a valid WhatsApp message')
}
