import {
  normalizeFields,
  normalizeFormTheme,
  submissionToPipelineFields,
} from '../marketingFormSchema.js'
import { siteTrackingFormScript } from './marketingSiteTracking.js'

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fieldHtml(field, prefill = {}) {
  if (field.type === 'section') {
    return `<h2 class="section">${escapeHtml(field.label)}</h2>`
  }
  const req = field.required ? ' required' : ''
  const val = prefill[field.id] != null ? escapeHtml(prefill[field.id]) : ''
  const help = field.helpText ? `<p class="help">${escapeHtml(field.helpText)}</p>` : ''
  const label = `<label for="${escapeHtml(field.id)}">${escapeHtml(field.label)}${field.required ? ' *' : ''}</label>`

  if (field.type === 'textarea') {
    return `${label}${help}<textarea id="${escapeHtml(field.id)}" name="${escapeHtml(field.id)}" placeholder="${escapeHtml(field.placeholder)}" rows="4"${req}>${val}</textarea>`
  }
  if (field.type === 'select') {
    const opts = (field.options || [])
      .map(
        (o) =>
          `<option value="${escapeHtml(o)}"${val === escapeHtml(o) ? ' selected' : ''}>${escapeHtml(o)}</option>`
      )
      .join('')
    return `${label}${help}<select id="${escapeHtml(field.id)}" name="${escapeHtml(field.id)}"${req}><option value="">Choose…</option>${opts}</select>`
  }
  if (field.type === 'radio') {
    const radios = (field.options || [])
      .map(
        (o, i) =>
          `<label class="choice"><input type="radio" name="${escapeHtml(field.id)}" value="${escapeHtml(o)}"${req && i === 0 ? ' required' : ''}${val === escapeHtml(o) ? ' checked' : ''} /> ${escapeHtml(o)}</label>`
      )
      .join('')
    return `<fieldset class="choices"><legend>${escapeHtml(field.label)}${field.required ? ' *' : ''}</legend>${help}${radios}</fieldset>`
  }
  if (field.type === 'checkbox') {
    const boxes = (field.options || [])
      .map(
        (o) =>
          `<label class="choice"><input type="checkbox" name="${escapeHtml(field.id)}" value="${escapeHtml(o)}" /> ${escapeHtml(o)}</label>`
      )
      .join('')
    return `<fieldset class="choices"><legend>${escapeHtml(field.label)}</legend>${help}${boxes}</fieldset>`
  }

  const inputType =
    field.type === 'email'
      ? 'email'
      : field.type === 'phone'
        ? 'tel'
        : field.type === 'number'
          ? 'number'
          : field.type === 'date'
            ? 'date'
            : 'text'
  return `${label}${help}<input id="${escapeHtml(field.id)}" name="${escapeHtml(field.id)}" type="${inputType}" placeholder="${escapeHtml(field.placeholder)}" value="${val}"${req} />`
}

export function buildMarketingFormPageHtml(
  form,
  { action, prefill = {}, success = false, successMessage = '', error = '' } = {}
) {
  const theme = normalizeFormTheme(form.theme)
  const fields = normalizeFields(form.fields)
  const fieldsHtml = fields.map((f) => fieldHtml(f, prefill)).join('\n')
  const leadHidden = prefill.lead
    ? `<input type="hidden" name="_lead" value="${escapeHtml(prefill.lead)}" />`
    : ''

  if (success) {
    const msg =
      String(successMessage || '').trim() ||
      "Thank you — we've received your details. Our team will follow up shortly."
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Thank you</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; font-family: system-ui, -apple-system, sans-serif; background:${theme.pageBackground}; color:#242424; padding:24px; box-sizing:border-box; }
  .card { max-width:440px; width:100%; background:${theme.cardBackground}; border-radius:16px; padding:28px; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
  .ok { color:#166534; background:#f0fdf4; border:1px solid #bbf7d0; padding:16px; border-radius:12px; line-height:1.55; }
</style></head><body><div class="card"><div class="ok">${escapeHtml(msg)}</div></div></body></html>`
  }

  const errBlock = error
    ? `<div class="err">${escapeHtml(error)}</div>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(form.title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin:0; min-height:100vh; font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; background:${theme.pageBackground}; color:#1f2937; padding:32px 16px; }
    .wrap { max-width:480px; margin:0 auto; }
    .card { background:${theme.cardBackground}; border-radius:16px; padding:28px 24px 32px; box-shadow:0 4px 24px rgba(0,0,0,0.07); }
    h1 { font-size:1.5rem; font-weight:700; margin:0 0 8px; letter-spacing:-0.02em; }
    p.desc { color:#6b7280; line-height:1.55; margin:0 0 24px; font-size:0.95rem; }
    label { display:block; font-size:0.8rem; font-weight:600; margin:16px 0 6px; color:#374151; }
    fieldset.choices { border:0; padding:0; margin:16px 0 0; }
    fieldset.choices legend { font-size:0.8rem; font-weight:600; color:#374151; padding:0; }
    .choice { display:flex; align-items:center; gap:8px; font-weight:400; font-size:0.9rem; margin:8px 0; cursor:pointer; }
    h2.section { font-size:1rem; margin:28px 0 4px; padding-top:8px; border-top:1px solid #e5e7eb; color:#111827; }
    input, textarea, select { width:100%; padding:10px 12px; border:1px solid #d1d5db; border-radius:10px; font:inherit; background:#fff; }
    input:focus, textarea:focus, select:focus { outline:2px solid ${theme.primaryColor}33; border-color:${theme.primaryColor}; }
    p.help { margin:4px 0 0; font-size:0.75rem; color:#9ca3af; font-weight:400; }
    button[type=submit] { margin-top:28px; width:100%; padding:14px; background:${theme.primaryColor}; color:#fff; border:0; border-radius:10px; font-weight:600; font-size:1rem; cursor:pointer; }
    button[type=submit]:hover { filter: brightness(1.05); }
    .err { color:#b91c1c; background:#fef2f2; border:1px solid #fecaca; padding:12px; border-radius:10px; margin-bottom:16px; font-size:0.9rem; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>${escapeHtml(form.title)}</h1>
      ${form.description ? `<p class="desc">${escapeHtml(form.description)}</p>` : ''}
      ${errBlock}
      <form method="post" action="${escapeHtml(action)}">
        ${leadHidden}
        ${fieldsHtml}
        <button type="submit">${escapeHtml(form.submitLabel || 'Submit')}</button>
      </form>
    </div>
  </div>
  ${siteTrackingFormScript()}
</body>
</html>`
}

export function parseFormBody(form, body) {
  const fields = normalizeFields(form.fields)
  const out = {}
  for (const field of fields) {
    if (field.type === 'section') continue
    if (field.type === 'checkbox') {
      const raw = body[field.id]
      out[field.id] = Array.isArray(raw) ? raw : raw ? [raw] : []
      continue
    }
    out[field.id] = body[field.id]
  }
  return submissionToPipelineFields(form, out)
}

export function prefillFromQuery(query) {
  const prefill = {}
  for (const key of ['email', 'firstName', 'lastName', 'company']) {
    const v = String(query?.[key] || '').trim()
    if (v) prefill[key] = v.slice(0, 200)
  }
  const lead = String(query?.lead || query?.leadId || '').trim()
  if (lead && /^[a-zA-Z0-9_-]{6,64}$/.test(lead)) {
    prefill.lead = lead.slice(0, 64)
  }
  return prefill
}
