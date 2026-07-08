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

const NON_LOCATION_WORDS =
  /\b(founder|co-?founder|ceo|cto|coo|cfo|cmo|director|manager|consultant|forbes|brand|toys?|crafting|montessori|building|helping|passionate|entrepreneur|president|owner|partner|advisor|coach|specialist|engineer|developer|designer|marketer|investor|mentor|head|lead|winner|award)\b/i

const STATE_NAME_RE =
  /\b(andhra pradesh|arunachal|assam|bihar|chhattisgarh|delhi|goa|gujarat|haryana|himachal|jharkhand|karnataka|kerala|madhya pradesh|maharashtra|manipur|meghalaya|mizoram|nagaland|odisha|punjab|rajasthan|sikkim|tamil nadu|telangana|tripura|uttar pradesh|uttarakhand|west bengal)\b/i

function isNoiseLocationText(text = '') {
  return /connection|follower|contact info|^\d+\+?$/i.test(String(text || '').trim())
}

/**
 * Decide whether a snippet is an actual place vs a headline/tagline/job title.
 * `exclude` holds already-known headline/name/company text to reject outright,
 * which prevents a marketing headline like "India's No.1 … Brand" (which contains
 * the word "India") from being captured as the location.
 */
function isLikelyLocationText(text = '', exclude = []) {
  const value = String(text || '').trim()
  if (!value || value.length > 80) return false
  if (isNoiseLocationText(value)) return false

  const key = normalizeLocationKey(value)
  for (const other of exclude) {
    const otherKey = normalizeLocationKey(other)
    if (otherKey && (otherKey === key || otherKey.includes(key) || key.includes(otherKey))) {
      return false
    }
  }

  if (/['’]s\b/i.test(value)) return false
  if (/\d/.test(value)) return false
  if (/[|–—]/.test(value)) return false
  if (/\s-\s/.test(value)) return false
  if (NON_LOCATION_WORDS.test(value)) return false

  if (value.includes(',')) return true
  if (/\b(area|india|metropolitan|region|district|county)\b/i.test(value)) return true
  if (/^greater\s+[a-z]/i.test(value)) return true
  if (STATE_NAME_RE.test(value)) return true
  return false
}

/**
 * Pull the employer from a LinkedIn Experience list item's text lines.
 * Item lines look like: ["Founder", "Ariro toys · Full-time",
 * "Jun 2020 - Present · 6 yrs", "Chennai, Tamil Nadu, India"]. The first line is
 * the role; the company is the next line that is not a date range or duration.
 */
function companyFromExperienceLines(lines = []) {
  const arr = (Array.isArray(lines) ? lines : [])
    .map((l) => String(l || '').trim())
    .filter(Boolean)
  for (let i = 1; i < arr.length; i += 1) {
    const line = arr[i]
    if (/\b(present|yrs?|mos?|months?|years?)\b/i.test(line)) continue
    if (/\b(19|20)\d{2}\b/.test(line)) continue
    if (/^(full-?time|part-?time|self-?employed|freelance|internship|contract)$/i.test(line)) continue
    const cleaned = line.split('·')[0].trim()
    if (cleaned) return cleaned
  }
  return ''
}

// Headline/tagline text masquerading as a company: possessives ("India's"),
// "No.1"/rankings, or overly long marketing phrases.
function isHeadlineJunkCompany(value = '') {
  const v = String(value || '').trim()
  if (!v) return true
  if (/['’]s\b/i.test(v)) return true
  if (/\bno\.?\s*\d/i.test(v)) return true
  if (/\b(india's|world's|no\.?\s*1|montessori|crafting)\b/i.test(v)) return true
  if (v.split(/\s+/).length > 6) return true
  return false
}

function basicCompanyLabel(value = '') {
  const v = cleanCompanyLabel(value)
  if (!v || v.length < 2 || v.length > 120) return ''
  if (/forbes|consultant|\d+u\d+/i.test(v)) return ''
  return v
}

/**
 * Resolve the person's company from the various sources, most trustworthy first.
 * Structural sources (top-card / current-company button / Experience) are trusted
 * as-is; the headline is only used as a last resort and rejected when it looks
 * like a tagline. Page-wide links are never used, so followed/recommended
 * companies (e.g. a toy brand the person merely follows) can never win.
 */
function pickCompanyName(sources = {}) {
  const { topCardCompany, buttonCompany, experienceCompany, experienceLinkCompany, headlineCompany } =
    sources
  const reliable = [topCardCompany, buttonCompany, experienceCompany, experienceLinkCompany]
    .map((c) => basicCompanyLabel(c))
    .filter(Boolean)
  if (reliable.length) return reliable[0]

  const headline = basicCompanyLabel(headlineCompany)
  if (headline && !isHeadlineJunkCompany(headline)) return headline
  return ''
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
  isLikelyLocationText,
  pickCompanyName,
  companyFromExperienceLines,
  isHeadlineJunkCompany,
}

if (typeof globalThis !== 'undefined') {
  globalThis.__connectIntelLinkedInParse = api
}
