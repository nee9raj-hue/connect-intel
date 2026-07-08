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
  const firstName =
    String(lead.firstName || '')
      .trim() ||
    String(lead.name || lead.fullName || '')
      .trim()
      .split(/\s+/)[0] ||
    ''
  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim()
  const name = fullName || firstName || 'the contact'
  const company = String(lead.company || lead.companyName || '').trim()
  const location = lead.location || [lead.city, lead.state].filter(Boolean).join(', ') || 'India'

  const greetingRule = firstName
    ? `- Open the body with "Hi ${firstName}," or "Dear ${firstName}," — use this exact first name; never "Dear Sir/Madam" when first name is known`
    : company
      ? `- No first name on file: open with "Dear team at ${company}," or "Hello ${company}," — avoid "Dear Sir/Madam" when company is known`
      : `- Use "Dear Sir/Madam," only if neither first name nor company is available`

  return `You are writing a B2B sales email on behalf of ${options.senderName} from ${options.senderCompany} (this is the SENDER's own company — never call it "Connect Intel" unless that is literally the sender's company name).

Tone: ${options.tone}
Email purpose: ${options.purpose}

What the sender wants to say (AGENDA — this is the ONLY source of truth for what the sender does or offers):
${options.agenda}
${options.keyPoints ? `Key points to include:\n${options.keyPoints}\n` : ''}
About the recipient (for relevance only — NEVER invent facts about them):
- First name: ${firstName || '(not on file)'}
- Full name: ${fullName || '(not on file)'}
- Role: ${lead.title || '(unknown)'}
- Company: ${company || '(their company)'}
- Recipient's city/region: ${location}  ← the RECIPIENT is located here. This is NOT the sender's location, office, or service area.
- Industry: ${lead.industry || 'B2B'}

Hard rules (breaking any one makes the email unusable):
- Base every statement about the sender ONLY on the agenda and key points above. Do NOT invent services, coverage, offices, transit times, statistics, pricing, guarantees, client counts, or capabilities that are not in the agenda.
- Do NOT say or imply the sender is located in, based in, operates in, or serves "in and around" the recipient's city. The recipient's city must NEVER appear inside a claim about the sender (e.g. never "we help exporters in and around ${location}").
- Do NOT fabricate any facts about the recipient or their company beyond the fields listed above.
- Be specific to the agenda and the recipient's role, company, and industry. Avoid generic filler, boilerplate, and clichés.
- Write as ${options.senderName} from ${options.senderCompany} only.
${greetingRule}
- Keep the body tight: 90–140 words, plain text, 2–3 short paragraphs, ending with one clear, low-friction ask.
- Sign off as ${options.senderName}, ${options.senderCompany}.
- Return ONLY JSON: {"subject":"...","body":"..."}`
}
