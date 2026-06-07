export function normalizePhoneDigits(input, defaultCountryCode = '91') {
  let digits = String(input || '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.length === 10 && defaultCountryCode === '91') digits = `91${digits}`
  else if (digits.length === 11 && digits.startsWith('0')) digits = `${defaultCountryCode}${digits.slice(1)}`
  if (digits.length < 10 || digits.length > 15) return null
  return digits
}

export function formatPhoneDisplay(digits) {
  if (!digits) return ''
  const d = String(digits).replace(/\D/g, '')
  if (d.startsWith('91') && d.length === 12) {
    return `+91 ${d.slice(2, 7)} ${d.slice(7)}`
  }
  return `+${d}`
}

/** wa.me URLs break on very long `text=` query strings on mobile clients. */
const WA_MAX_TEXT_LEN = 1500

export function buildWhatsAppUrl(phone, message = '') {
  const digits = normalizePhoneDigits(phone)
  if (!digits) return null
  const base = `https://wa.me/${digits}`
  let text = String(message || '').trim()
  if (text.length > WA_MAX_TEXT_LEN) {
    text = `${text.slice(0, WA_MAX_TEXT_LEN - 20)}\n\n…(truncated)`
  }
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}

export function isMobileDevice() {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
}

/** Open an external URL in the same user gesture (required for mobile WhatsApp). */
export function openExternalUrl(url, { newTab = true } = {}) {
  if (!url || typeof document === 'undefined') return false
  const link = document.createElement('a')
  link.href = url
  link.rel = 'noopener noreferrer'
  if (newTab) link.target = '_blank'
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  return true
}

export function openWhatsAppChat(phone, message = '') {
  const url = buildWhatsAppUrl(phone, message)
  if (!url) return false
  return openExternalUrl(url, { newTab: true })
}

export function leadHasCallablePhone(lead) {
  const phone = String(lead?.phone ?? lead ?? '').trim()
  if (!phone || phone.includes('•') || /locked/i.test(phone)) return false
  return Boolean(normalizePhoneDigits(phone))
}

/** `tel:` URL for the device dialer (mobile, softphone, or desktop phone app). */
export function buildTelUrl(phone) {
  const digits = normalizePhoneDigits(phone)
  if (!digits) return null
  return `tel:+${digits}`
}
