/** Shared pipeline lead city/state parsing and exact filter matching */

export function normalizeLocationKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/** Parse city and state from lead fields and comma-separated location string. */
export function parseLeadLocationFields(lead = {}) {
  const cityField = String(lead.city || '').trim()
  const stateField = String(lead.state || '').trim()
  const location = String(lead.location || '').trim()

  let city = cityField
  let state = stateField

  if (location) {
    const parts = location
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
    if (!city && parts[0]) city = parts[0]
    if (!state && parts.length >= 2) state = parts[1]
  }

  return { city, state }
}

export function getLeadCityFromFields(lead) {
  return parseLeadLocationFields(lead).city
}

export function getLeadStateFromFields(lead) {
  return parseLeadLocationFields(lead).state
}

/** Case-insensitive exact match (no partial/substring matching). */
export function locationMatchesField(value, filter) {
  const v = normalizeLocationKey(value)
  const f = normalizeLocationKey(filter)
  if (!f) return true
  if (!v) return false
  return v === f
}
