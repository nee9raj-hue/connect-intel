import { api } from './api.js'
import { STARTER_TEMPLATES, blocksToPlainText } from './marketingEmailDesign.js'

/** Saved Marketing Hub templates + built-in starters for CRM compose surfaces. */
export async function loadCrmMarketingTemplates() {
  let saved = []
  try {
    const data = await api.listMarketingTemplates()
    saved = (data.templates || []).map((t) => ({
      id: `saved:${t.id}`,
      name: t.name || 'Untitled',
      subject: t.subject || '',
      blocks: t.blocks || [],
      source: 'saved',
    }))
  } catch {
    saved = []
  }

  const starters = STARTER_TEMPLATES.map((t) => ({
    id: `starter:${t.id}`,
    name: t.name,
    subject: t.subject || '',
    blocks: t.blocks || [],
    source: 'starter',
  }))

  return [...saved, ...starters]
}

export function crmTemplateToComposeFields(template) {
  if (!template) return { subject: '', body: '' }
  return {
    subject: template.subject || '',
    body: blocksToPlainText(template.blocks || []),
  }
}
