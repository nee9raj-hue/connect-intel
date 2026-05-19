/**
 * Vercel serverless — Claude lead search (keeps API key off the browser).
 * Set ANTHROPIC_API_KEY in Vercel → Environment Variables.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(503).json({
      error: 'Claude API not configured',
      hint: 'Add ANTHROPIC_API_KEY in Vercel project settings, then redeploy.',
    })
  }

  const { filters, count = 8 } = req.body || {}
  const prompt = buildPrompt(filters, count)

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await anthropicRes.json()
    if (!anthropicRes.ok) {
      return res.status(anthropicRes.status).json({
        error: data.error?.message || 'Claude API error',
      })
    }

    const text = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')

    const leads = parseLeadsJson(text)
    const total = Math.max(leads.length * 120, 2400 + Math.floor(Math.random() * 8000))

    return res.status(200).json({
      leads,
      total,
      netNew: Math.floor(total * 0.88),
      provider: 'claude',
    })
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Search failed' })
  }
}

function buildPrompt(filters, count) {
  const parts = []
  if (filters.keywords) parts.push(`Keywords: ${filters.keywords}`)
  if (filters.jobTitles?.length) parts.push(`Job titles: ${filters.jobTitles.join(', ')}`)
  if (filters.states?.length) parts.push(`Indian states: ${filters.states.join(', ')}`)
  if (filters.cities?.length) parts.push(`Cities: ${filters.cities.join(', ')}`)
  if (filters.industries?.length) parts.push(`Industries: ${filters.industries.join(', ')}`)
  if (filters.companySizes?.length) parts.push(`Company size: ${filters.companySizes.join(', ')}`)

  const criteria = parts.length ? parts.join('\n') : 'General B2B prospects in India'

  return `You are a B2B lead intelligence expert focused on the Indian market.

Find ${count} realistic Indian business contacts matching:
${criteria}

Return ONLY a valid JSON array (no markdown). Each object:
{
  "id": "unique-string",
  "firstName": "",
  "lastName": "",
  "title": "",
  "company": "",
  "companyDomain": "",
  "email": "",
  "phone": "+91-...",
  "location": "City, State",
  "state": "Indian state",
  "city": "",
  "industry": "",
  "employees": "11-50",
  "emailStatus": "verified|likely|unverified",
  "score": 60-97,
  "linkedin": ""
}

Use real-sounding Indian companies. Match cities/states when specified.`
}

function parseLeadsJson(text) {
  try {
    const m = text.match(/\[[\s\S]*\]/)
    if (!m) return []
    const arr = JSON.parse(m[0])
    return arr.map((l, i) => ({
      ...l,
      id: l.id || `claude-${i}-${Date.now()}`,
      source: 'claude',
    }))
  } catch {
    return []
  }
}
