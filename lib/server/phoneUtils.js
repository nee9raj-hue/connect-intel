/** Normalize phone for WhatsApp wa.me links (digits only, with country code). */
export function normalizePhoneDigits(input, defaultCountryCode = '91') {
  let digits = String(input || '').replace(/\D/g, '')
  if (!digits) return null

  if (digits.length === 10 && defaultCountryCode === '91') {
    digits = `91${digits}`
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = `${defaultCountryCode}${digits.slice(1)}`
  }

  if (digits.length < 10 || digits.length > 15) return null
  return digits
}

export function formatPhoneDisplay(digits) {
  if (!digits) return ''
  if (digits.startsWith('91') && digits.length === 12) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`
  }
  return `+${digits}`
}

export function buildWhatsAppUrl(phone, message = '') {
  const digits = normalizePhoneDigits(phone)
  if (!digits) return null
  const base = `https://wa.me/${digits}`
  const text = String(message || '').trim()
  if (!text) return base
  return `${base}?text=${encodeURIComponent(text)}`
}

export function validateMobileInput(input) {
  const digits = normalizePhoneDigits(input)
  if (!digits) {
    return { ok: false, error: 'Enter a valid mobile number with country code (e.g. +91 98765 43210).' }
  }
  return { ok: true, mobileE164: digits, display: formatPhoneDisplay(digits) }
}
