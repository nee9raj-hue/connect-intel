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

export function buildWhatsAppUrl(phone, message = '') {
  const digits = normalizePhoneDigits(phone)
  if (!digits) return null
  const base = `https://wa.me/${digits}`
  const text = String(message || '').trim()
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}

export function leadHasCallablePhone(lead) {
  const phone = String(lead?.phone || '').trim()
  if (!phone || phone.includes('•') || /locked/i.test(phone)) return false
  return Boolean(normalizePhoneDigits(phone))
}
