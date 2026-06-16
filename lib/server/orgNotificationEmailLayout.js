import { getAppBaseUrl } from './appUrl.js'

const ASCII_REPLACEMENTS = [
  [/[\u2013\u2014\u2015\u2212]/g, '-'],
  [/[\u2192\u2794\u27A1\uFFEB]/g, '->'],
  [/[\u2018\u2019\u201A]/g, "'"],
  [/[\u201C\u201D\u201E]/g, '"'],
  [/[\u2026]/g, '...'],
  [/[\u00B7\u2022\u2023]/g, '-'],
  [/\u00A0/g, ' '],
]

/** Keep email subjects ASCII-only so Gmail/Outlook never show mojibake (e.g. em-dash as Ã¢Â€Â"). */
export function sanitizeEmailSubject(raw) {
  let subject = String(raw || '').trim()
  for (const [pattern, replacement] of ASCII_REPLACEMENTS) {
    subject = subject.replace(pattern, replacement)
  }
  subject = subject.replace(/[^\x20-\x7E]/g, '')
  return subject.replace(/\s+/g, ' ').trim().slice(0, 200)
}

export function normalizeOrgNotificationPlainText(raw) {
  let text = String(raw || '')
  for (const [pattern, replacement] of ASCII_REPLACEMENTS) {
    text = text.replace(pattern, replacement)
  }
  return text
    .replace(/[^\x20-\x7E\n\r\t]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function connectIntelLogoUrl() {
  return `${getAppBaseUrl()}/connect-intel-logo-icon-light.png?v=4`
}

/** Branded header with Connect Intel logo for transactional CRM emails from invite@. */
export function wrapOrgNotificationHtml(innerHtml) {
  const body = String(innerHtml || '').trim()
  if (!body) return body
  if (body.includes('data-ci-org-notification="1"')) return body

  const logoUrl = connectIntelLogoUrl()
  const appUrl = getAppBaseUrl()

  return `
<div data-ci-org-notification="1" style="font-family:system-ui,-apple-system,BlinkMacSystemFont,sans-serif;background:#f6f7f9;padding:24px 12px;margin:0">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e8eaed;overflow:hidden">
    <div style="padding:18px 24px 14px;text-align:center;border-bottom:1px solid #f0f0f0;background:#fffdf5">
      <img src="${logoUrl}" alt="Connect Intel" width="44" height="44" style="display:inline-block;width:44px;height:44px;border-radius:10px;vertical-align:middle" />
    </div>
    <div style="padding:4px 24px 20px">
      ${body}
    </div>
    <div style="padding:10px 24px 18px;text-align:center;border-top:1px solid #f0f0f0">
      <a href="${appUrl}" style="font-size:12px;color:#666;text-decoration:none">Connect Intel</a>
    </div>
  </div>
</div>`.trim()
}
