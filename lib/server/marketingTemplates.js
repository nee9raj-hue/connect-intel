export function mergeTemplateText(text, lead = {}) {
  const firstName =
    lead.firstName ||
    String(lead.name || lead.fullName || '')
      .trim()
      .split(/\s+/)[0] ||
    'there'
  const companyName = lead.company || lead.companyName || 'your company'
  const fullName = lead.name || lead.fullName || firstName

  return String(text || '')
    .replace(/\{\{\s*firstName\s*\}\}/gi, firstName)
    .replace(/\{\{\s*companyName\s*\}\}/gi, companyName)
    .replace(/\{\{\s*company\s*\}\}/gi, companyName)
    .replace(/\{\{\s*name\s*\}\}/gi, fullName)
    .replace(/\{\{\s*title\s*\}\}/gi, lead.title || '')
    .replace(/\[Name\]/gi, firstName)
    .replace(/\[name\]/g, firstName)
    .replace(/\[Company\]/gi, companyName)
    .replace(/\[company\]/g, companyName)
}

export function mergeTemplateFields({ subject, body }, lead) {
  return {
    subject: mergeTemplateText(subject, lead),
    body: mergeTemplateText(body, lead),
  }
}

function escapeRegExp(text) {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function leadFirstName(lead = {}) {
  return (
    lead.firstName ||
    String(lead.name || lead.fullName || '')
      .trim()
      .split(/\s+/)[0] ||
    ''
  )
}

function leadFullName(lead = {}) {
  const first = leadFirstName(lead)
  const last = String(lead.lastName || '').trim()
  if (first && last) return `${first} ${last}`.trim()
  return String(lead.name || lead.fullName || first || '').trim()
}

/** Swap sample-lead names in an AI draft so per-recipient preview shows the right person. */
export function localizeSampleDraftForLead({ subject, body }, sampleLead, targetLead) {
  const merged = mergeTemplateFields({ subject, body }, targetLead)
  if (!sampleLead || !targetLead || String(sampleLead.id) === String(targetLead.id)) {
    return merged
  }

  const pairs = [
    [leadFullName(sampleLead), leadFullName(targetLead)],
    [leadFirstName(sampleLead), leadFirstName(targetLead)],
    [String(sampleLead.lastName || '').trim(), String(targetLead.lastName || '').trim()],
    [String(sampleLead.company || sampleLead.companyName || '').trim(), String(targetLead.company || targetLead.companyName || '').trim()],
  ].filter(([from, to]) => from && from.length > 1 && to)

  let nextSubject = merged.subject
  let nextBody = merged.body
  for (const [from, to] of pairs) {
    const re = new RegExp(`\\b${escapeRegExp(from)}\\b`, 'gi')
    nextSubject = nextSubject.replace(re, to)
    nextBody = nextBody.replace(re, to)
  }

  return { subject: nextSubject, body: nextBody }
}
