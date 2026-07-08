/**
 * Optional AI pre-send checks (spam, variables, CTA, tone).
 * Returns suggestions only — never blocks send unless caller opts in.
 */
export function inspectMessageBeforeSend({ subject, body, lead, variables = [] } = {}) {
  const issues = []
  const suggestions = []
  const text = `${subject || ''}\n${body || ''}`

  for (const key of variables) {
    const token = `{{${key}}}`
    if (text.includes(token)) {
      issues.push({ type: 'missing_variable', field: key, message: `Unresolved variable ${token}` })
    }
  }

  if (!String(subject || '').trim()) {
    issues.push({ type: 'missing_subject', message: 'Subject line is empty' })
  }
  if (!String(body || '').trim()) {
    issues.push({ type: 'missing_body', message: 'Message body is empty' })
  }
  if (String(body || '').length > 2500) {
    suggestions.push({ type: 'length', message: 'Consider shortening the body for better reply rates' })
  }
  if (!/\?|call|meet|schedule|reply|let me know/i.test(text)) {
    suggestions.push({ type: 'cta', message: 'Add a clear, low-friction call to action' })
  }
  if (/free!!!|act now|guaranteed|100%/i.test(text)) {
    suggestions.push({ type: 'spam_tone', message: 'Tone may trigger spam filters — soften promotional language' })
  }
  if (lead?.firstName && !text.includes(lead.firstName)) {
    suggestions.push({
      type: 'personalization',
      message: `Consider using ${lead.firstName} in the opening line`,
    })
  }

  return {
    ok: issues.length === 0,
    issues,
    suggestions,
    spamScore: Math.min(100, issues.length * 20 + suggestions.filter((s) => s.type === 'spam_tone').length * 15),
  }
}
