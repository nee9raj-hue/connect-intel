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
