/**
 * Pure helpers for LinkedIn profile parsing (testable + content-script global).
 */

function normalizeLocationKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Delhi NCR',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu & Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
]

const STATE_BY_KEY = new Map(INDIAN_STATES.map((s) => [normalizeLocationKey(s), s]))

const STATE_ALIASES = {
  gujrat: 'gujarat',
  gujurat: 'gujarat',
  rajastan: 'rajasthan',
  tamilnadu: 'tamil nadu',
  delhi: 'delhi ncr',
  'new delhi': 'delhi ncr',
  bengaluru: 'karnataka',
  bangalore: 'karnataka',
  mumbai: 'maharashtra',
  bengal: 'west bengal',
}

function resolveIndianState(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const key = normalizeLocationKey(raw)
  const alias = STATE_ALIASES[key] || key
  return STATE_BY_KEY.get(alias) || raw
}

function parseHeadline(headline = '') {
  const value = String(headline || '').trim()
  if (!value) return { title: '', company: '' }

  const atMatch = value.match(/^(.+?)\s+at\s+(.+)$/i)
  if (atMatch) {
    return { title: atMatch[1].trim(), company: atMatch[2].trim() }
  }

  const dashCompany = value.match(/^(.+?)\s*[-–]\s*([^|]+)$/)
  if (dashCompany && dashCompany[2].length <= 60) {
    return { title: dashCompany[1].trim(), company: dashCompany[2].trim() }
  }

  const pipeParts = value.split('|').map((p) => p.trim()).filter(Boolean)
  if (pipeParts.length >= 2) {
    const dashInFirst = pipeParts[0].match(/^(.+?)\s*[-–]\s*(.+)$/)
    if (dashInFirst) {
      return { title: dashInFirst[1].trim(), company: dashInFirst[2].trim() }
    }
    const companyCandidate =
      pipeParts.find((p) => p.length <= 48 && !/forbes|consultant|\d+u\d+/i.test(p)) || pipeParts[1]
    return { title: pipeParts[0], company: companyCandidate }
  }

  return { title: value, company: '' }
}

function splitPersonName(fullName = '') {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return { firstName: '', lastName: '' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

function parseLocationToCityState(location = '') {
  let loc = String(location || '').trim()
  if (!loc) return { city: '', state: '', location: '' }

  loc = loc
    .replace(/\s+Metropolitan\s+Area$/i, '')
    .replace(/\s+Area$/i, '')
    .replace(/^Greater\s+/i, '')
    .trim()

  let parts = loc.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length && /india$/i.test(parts[parts.length - 1])) parts = parts.slice(0, -1)

  let city = ''
  let state = ''

  if (parts.length >= 2) {
    city = parts[0]
    state = resolveIndianState(parts[parts.length - 1])
  } else if (parts.length === 1) {
    const resolved = resolveIndianState(parts[0])
    if (STATE_BY_KEY.has(normalizeLocationKey(resolved))) {
      state = resolved
    } else {
      city = parts[0]
    }
  }

  return {
    city,
    state,
    location: [city, state].filter(Boolean).join(', ') || loc,
  }
}

function normalizePhone(raw = '') {
  const digits = String(raw || '').replace(/\D/g, '')
  if (digits.length === 10) return `+91-${digits.slice(0, 5)}-${digits.slice(5)}`
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91-${digits.slice(2, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return `+91-${digits.slice(1, 6)}-${digits.slice(6)}`
  }
  return String(raw || '').trim().slice(0, 40)
}

function findEmailInText(text = '') {
  const match = String(text).match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)
  return match ? match[0].toLowerCase() : ''
}

function findPhoneInText(text = '') {
  const value = String(text || '')
  const plus91 = value.match(/\+91[\s-]?\d{5}[\s-]?\d{5}/)
  if (plus91) return normalizePhone(plus91[0])

  const mobile = value.match(/\b[6-9]\d{9}\b/)
  if (mobile) return normalizePhone(mobile[0])

  const intl = value.match(/\+\d{1,3}[\s-]?\d{4,14}/)
  if (intl) return normalizePhone(intl[0])

  return ''
}

function cleanCompanyLabel(label = '') {
  return String(label || '')
    .replace(/\s+/g, ' ')
    .replace(/^company:\s*/i, '')
    .replace(/\.\s*click.*$/i, '')
    .trim()
    .slice(0, 160)
}

const api = {
  parseHeadline,
  splitPersonName,
  parseLocationToCityState,
  normalizePhone,
  findEmailInText,
  findPhoneInText,
  cleanCompanyLabel,
  resolveIndianState,
}

if (typeof globalThis !== 'undefined') {
  globalThis.__connectIntelLinkedInParse = api
}
