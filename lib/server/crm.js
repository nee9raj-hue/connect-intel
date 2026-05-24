import { normalizeExtendedCrm } from './crmWorkflow.js'

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
  return normalizeExtendedCrm(crm)
}

export function mergeLeadForClient(entry) {
  const crm = normalizeCrm(entry.crm)
  return {
    ...entry.lead,
    contactId: entry.contactId || entry.lead?.contactId || null,
    companyId: entry.companyId || entry.lead?.companyId || null,
    savedAt: entry.savedAt,
    crm,
  }
}

export function buildTemplateEmail(lead, options = {}) {
  const purpose = options.purpose || 'introduction'
  const tone = options.tone || 'professional'
  const senderName = options.senderName || 'Your name'
  const senderCompany = options.senderCompany || 'Your company'
  const agenda =
    options.agenda ||
    'Introduce our company and explore a potential B2B partnership with the recipient.'
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'there'
  const company = lead.company || 'your company'
  const title = lead.title || 'your role'

  const subject =
    purpose === 'follow_up'
      ? `Following up — ${company}`
      : purpose === 'meeting'
        ? `Meeting request — ${company}`
        : `Introduction — ${senderCompany} & ${company}`

  const body = `Hi ${name},

${agenda}

Given your role as ${title} at ${company}, I wanted to reach out from ${senderCompany}.

${options.keyPoints ? `${options.keyPoints}\n\n` : ''}Would you be open to a brief call to discuss next steps?

Best regards,
${senderName}
${senderCompany}`

  return { subject, body, aiGenerated: false, tone, purpose }
}

export async function generateAiEmail(lead, options = {}) {
  const template = buildTemplateEmail(lead, options)

  try {
    const { isPerplexityConfigured, generatePerplexityEmail } = await import('./perplexity.js')
    if (isPerplexityConfigured()) {
      const draft = await generatePerplexityEmail(lead, options)
      if (draft?.subject && draft?.body) return draft
    }
  } catch {
    // fall through
  }

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
      notice: 'AI draft uses templates until PERPLEXITY_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY is configured.',
    }
  }

  const { emailPromptBlock } = await import('./crmEmailPrompt.js')
  const prompt = emailPromptBlock(lead, options)

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
