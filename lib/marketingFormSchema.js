/** Shared marketing form field schema (used by API + public form page). */

export const FIELD_TYPES = [
  { id: 'text', label: 'Short text' },
  { id: 'textarea', label: 'Long text' },
  { id: 'email', label: 'Email' },
  { id: 'phone', label: 'Phone' },
  { id: 'company', label: 'Company' },
  { id: 'number', label: 'Number' },
  { id: 'date', label: 'Date' },
  { id: 'select', label: 'Dropdown' },
  { id: 'radio', label: 'Single choice' },
  { id: 'checkbox', label: 'Checkboxes' },
  { id: 'section', label: 'Section heading' },
]

export const DEFAULT_FORM_FIELDS = [
  { id: 'firstName', type: 'text', label: 'First name', placeholder: '', required: false },
  { id: 'lastName', type: 'text', label: 'Last name', placeholder: '', required: false },
  { id: 'email', type: 'email', label: 'Email', placeholder: 'you@company.com', required: true },
  { id: 'company', type: 'company', label: 'Company', placeholder: '', required: false },
  { id: 'message', type: 'textarea', label: 'Message', placeholder: '', required: false },
]

export const DEFAULT_FORM_THEME = {
  primaryColor: '#111827',
  pageBackground: '#f3f4f6',
  cardBackground: '#ffffff',
}

const MAX_FIELDS = 30

function slugFieldId(label, index) {
  const base = String(label || 'field')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 32)
  return `${base || 'field'}_${index}`
}

function parseOptions(raw) {
  if (Array.isArray(raw)) {
    return raw.map((o) => String(o).trim()).filter(Boolean).slice(0, 20)
  }
  return String(raw || '')
    .split('\n')
    .map((o) => o.trim())
    .filter(Boolean)
    .slice(0, 20)
}

export function normalizeFields(raw) {
  const list = Array.isArray(raw) && raw.length ? raw : DEFAULT_FORM_FIELDS
  const seen = new Set()
  const out = []
  for (let i = 0; i < Math.min(list.length, MAX_FIELDS); i += 1) {
    const row = list[i] || {}
    const type = FIELD_TYPES.some((t) => t.id === row.type) ? row.type : 'text'
    let id = String(row.id || '').trim()
    if (!id || seen.has(id)) id = slugFieldId(row.label, i)
    seen.add(id)
    const label = String(row.label || (type === 'section' ? 'Section' : 'Field')).trim().slice(0, 120)
    const field = {
      id,
      type,
      label,
      placeholder: String(row.placeholder || '').slice(0, 160),
      helpText: String(row.helpText || '').slice(0, 240),
      required: Boolean(row.required) && type !== 'section',
    }
    if (type === 'select' || type === 'radio' || type === 'checkbox') {
      const options = parseOptions(row.options)
      field.options = options.length ? options : ['Option 1', 'Option 2']
    }
    out.push(field)
  }
  return out.length ? out : [...DEFAULT_FORM_FIELDS]
}

export function normalizeFormTheme(raw) {
  const t = raw && typeof raw === 'object' ? raw : {}
  return {
    primaryColor: String(t.primaryColor || DEFAULT_FORM_THEME.primaryColor).slice(0, 32),
    pageBackground: String(t.pageBackground || DEFAULT_FORM_THEME.pageBackground).slice(0, 32),
    cardBackground: String(t.cardBackground || DEFAULT_FORM_THEME.cardBackground).slice(0, 32),
  }
}

export function createEmptyField(type = 'text') {
  const meta = FIELD_TYPES.find((t) => t.id === type) || FIELD_TYPES[0]
  const id = `f_${Date.now().toString(36)}`
  const field = {
    id,
    type: meta.id,
    label: meta.id === 'section' ? 'New section' : meta.label,
    placeholder: '',
    helpText: '',
    required: meta.id === 'email',
  }
  if (meta.id === 'select' || meta.id === 'radio' || meta.id === 'checkbox') {
    field.options = ['Option 1', 'Option 2']
  }
  return field
}

export function normalizeGoogleFormUrl(raw) {
  const url = String(raw || '').trim()
  if (!url) return ''
  try {
    const parsed = new URL(url)
    if (!/google\.com$/i.test(parsed.hostname.replace(/^www\./, ''))) return ''
    if (!parsed.pathname.includes('/forms/')) return ''
    if (!parsed.pathname.endsWith('/viewform')) {
      parsed.pathname = parsed.pathname.replace(/\/?$/, '') + '/viewform'
    }
    parsed.search = ''
    parsed.hash = ''
    return parsed.toString()
  } catch {
    return ''
  }
}

export function publicFormUrl(slug, appBase) {
  const base = appBase || process.env.APP_URL || 'https://connectintel.net'
  return `${base.replace(/\/$/, '')}/api/marketing/form?slug=${encodeURIComponent(slug)}`
}

export function resolveFormBlockUrl(block, { lead, appBase } = {}) {
  if (!block || block.type !== 'form') return ''
  if (block.formSource === 'google') {
    return normalizeGoogleFormUrl(block.googleUrl || block.url)
  }
  const slug = block.formSlug || block.slug
  if (!slug) return sanitizeUrl(block.url)
  let url = publicFormUrl(slug, appBase)
  const params = new URLSearchParams()
  if (lead?.email) params.set('email', String(lead.email).trim())
  if (lead?.firstName) params.set('firstName', String(lead.firstName).trim())
  if (lead?.lastName) params.set('lastName', String(lead.lastName).trim())
  if (lead?.company || lead?.companyName) {
    params.set('company', String(lead.company || lead.companyName).trim())
  }
  if (lead?.id) params.set('lead', String(lead.id).trim())
  const qs = params.toString()
  if (qs) url += `&${qs}`
  return url
}

function sanitizeUrl(url) {
  const u = String(url || '').trim()
  if (!u) return ''
  if (/^https?:\/\//i.test(u)) return u
  return ''
}

export function applyFormBlockUrl(block, { lead, appBase } = {}) {
  if (!block || block.type !== 'form') return block
  const url = resolveFormBlockUrl(block, { lead, appBase })
  return { ...block, url }
}

export function mergeFormBlocksForLead(blocks, lead, appBase) {
  return (blocks || []).map((block) => {
    if (block.type !== 'form') return block
    const merged = { ...block }
    for (const key of ['title', 'description', 'buttonLabel']) {
      if (typeof merged[key] === 'string' && lead) {
        merged[key] = merged[key]
          .replace(/\{\{firstName\}\}/gi, lead.firstName || '')
          .replace(/\{\{companyName\}\}/gi, lead.company || lead.companyName || '')
          .replace(/\{\{name\}\}/gi, [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.name || '')
      }
    }
    return applyFormBlockUrl(merged, { lead, appBase })
  })
}

export function submissionToPipelineFields(form, body) {
  const fields = normalizeFields(form.fields)
  const extra = []
  const out = {
    firstName: '',
    lastName: '',
    email: '',
    company: '',
    phone: '',
    notes: '',
  }

  for (const field of fields) {
    if (field.type === 'section') continue
    const raw = body[field.id]
    if (field.type === 'checkbox') {
      const vals = Array.isArray(raw) ? raw : raw ? [raw] : []
      const text = vals.map(String).filter(Boolean).join(', ')
      if (!text) continue
      if (field.id === 'message') out.notes = text
      else extra.push(`${field.label}: ${text}`)
      continue
    }
    const value = String(raw ?? '').trim()
    if (!value) continue
    if (field.id === 'firstName' || field.type === 'text' && field.id === 'firstName') {
      out.firstName = value
    } else if (field.id === 'lastName') {
      out.lastName = value
    } else if (field.id === 'email' || field.type === 'email') {
      if (!out.email) out.email = value.toLowerCase()
      else extra.push(`${field.label}: ${value}`)
    } else if (field.id === 'company' || field.type === 'company') {
      if (!out.company) out.company = value
      else extra.push(`${field.label}: ${value}`)
    } else if (field.id === 'phone' || field.type === 'phone') {
      if (!out.phone) out.phone = value
      else extra.push(`${field.label}: ${value}`)
    } else if (field.id === 'message') {
      out.notes = value
    } else {
      extra.push(`${field.label}: ${value}`)
    }
  }

  const noteParts = []
  if (out.notes) noteParts.push(out.notes)
  if (extra.length) noteParts.push(extra.join('\n'))
  out.notes = noteParts.length ? `Form: ${form.name || form.title}\n${noteParts.join('\n')}` : `Form: ${form.name || form.title}`
  return out
}
