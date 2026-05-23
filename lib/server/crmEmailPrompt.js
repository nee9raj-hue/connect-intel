/** Shared sender context for CRM AI drafts — uses customer company, not Connect Intel platform. */

export function buildCrmDraftOptions(user, body = {}) {
  const agenda = String(body.agenda || '').trim()
  const keyPoints = String(body.keyPoints || '').trim()
  const senderName = String(body.senderName || user?.name || 'Your name').trim()
  const senderCompany =
    String(body.senderCompany || user?.organizationName || user?.company || 'Your company').trim()
  const senderTitle = String(body.senderTitle || body.senderRole || 'Sales').trim()

  return {
    purpose: body.purpose || 'introduction',
    tone: body.tone || 'professional',
    agenda,
    keyPoints,
    senderName,
    senderCompany,
    senderTitle,
  }
}

export function requireAgenda(options) {
  if (!options.agenda || options.agenda.length < 8) {
    return 'Describe your email goal in at least a few words (agenda) before generating a draft.'
  }
  return null
}

export function emailPromptBlock(lead, options) {
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'the contact'
  const location = lead.location || [lead.city, lead.state].filter(Boolean).join(', ') || 'India'

  return `You are writing on behalf of ${options.senderName} from ${options.senderCompany} (NOT "Connect Intel" unless that is their company name).

Tone: ${options.tone}
Email purpose: ${options.purpose}
Writer agenda (MUST follow): ${options.agenda}
${options.keyPoints ? `Key points to include:\n${options.keyPoints}` : ''}

Recipient: ${name}, ${lead.title || 'contact'} at ${lead.company || 'their company'}
Location: ${location}
Industry: ${lead.industry || 'B2B'}

Rules:
- Write as ${options.senderName} from ${options.senderCompany} only
- Do not invent Connect Intel services unless agenda mentions them
- Under 200 words, plain text body
- Sign off as ${options.senderName}, ${options.senderCompany}
- Return ONLY JSON: {"subject":"...","body":"..."}`
}
