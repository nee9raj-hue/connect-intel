export const CRM_STATUSES = ['new', 'contacted', 'follow_up', 'replied', 'won', 'lost']

export function defaultCrm() {
  return {
    status: 'new',
    notes: '',
    lastEmailSentAt: null,
    lastResponseAt: null,
    responseReceived: false,
    emails: [],
  }
}

export function normalizeCrm(crm) {
  const base = defaultCrm()
  if (!crm || typeof crm !== 'object') return base
  return {
    ...base,
    ...crm,
    status: CRM_STATUSES.includes(crm.status) ? crm.status : base.status,
    emails: Array.isArray(crm.emails) ? crm.emails : [],
  }
}

export function mergeLeadForClient(entry) {
  const crm = normalizeCrm(entry.crm)
  return {
    ...entry.lead,
    savedAt: entry.savedAt,
    crm,
  }
}

export function buildTemplateEmail(lead, { purpose = 'introduction', tone = 'professional' } = {}) {
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'there'
  const company = lead.company || 'your company'
  const title = lead.title || 'your role'

  const intros = {
    introduction: `I came across ${company} while researching ${lead.industry || 'B2B'} partners in ${lead.state || lead.city || 'India'}.`,
    follow_up: `Following up on my earlier note about a potential partnership with ${company}.`,
    meeting: `I would like to schedule a short call to explore how we might work together.`,
  }

  const subject =
    purpose === 'follow_up'
      ? `Following up — ${company}`
      : purpose === 'meeting'
        ? `Quick intro — partnership with ${company}`
        : `Introduction — ${company} / Connect Intel`

  const body = `Hi ${name},

${intros[purpose] || intros.introduction}

I'm reaching out from Connect Intel. We help export-focused teams find verified B2B contacts and manage outreach in one workspace.

Given your work as ${title} at ${company}, I thought a brief conversation could be valuable.

Would you be open to a 15-minute call this week?

Best regards,
[Your name]
Connect Intel`

  return { subject, body, aiGenerated: false, tone, purpose }
}

export async function generateAiEmail(lead, options = {}) {
  const template = buildTemplateEmail(lead, options)

  try {
    const { isGeminiConfigured, generateGeminiEmail } = await import('./gemini.js')
    if (isGeminiConfigured()) {
      return await generateGeminiEmail(lead, options)
    }
  } catch {
    // fall through
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return {
      ...template,
      aiGenerated: false,
      notice: 'AI draft uses templates until GEMINI_API_KEY or ANTHROPIC_API_KEY is configured.',
    }
  }

  const purpose = options.purpose || 'introduction'
  const tone = options.tone || 'professional'

  const prompt = `Write a short B2B outreach email (${tone} tone).
Purpose: ${purpose}
Recipient: ${lead.firstName} ${lead.lastName}, ${lead.title} at ${lead.company}
Location: ${lead.location || lead.city || ''} ${lead.state || ''}
Industry: ${lead.industry || 'B2B'}

Return ONLY valid JSON: {"subject":"...","body":"..."}
Keep body under 180 words. No markdown. Sign off as "[Your name]" from Connect Intel.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      return { ...template, aiGenerated: false, notice: data.error?.message || 'AI unavailable' }
    }

    const text = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')

    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      if (parsed.subject && parsed.body) {
        return {
          subject: String(parsed.subject),
          body: String(parsed.body),
          aiGenerated: true,
        }
      }
    }
  } catch {
    // fall through to template
  }

  return { ...template, aiGenerated: false, notice: 'Using template draft.' }
}
