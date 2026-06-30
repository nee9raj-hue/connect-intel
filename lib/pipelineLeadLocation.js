/** Shared pipeline lead city/state parsing and exact filter matching */

import { INDIAN_STATES } from '../frontend/src/lib/indiaLocations.js'

const INDIAN_STATE_BY_KEY = new Map(
  INDIAN_STATES.map((state) => [normalizeLocationKey(state), state])
)

/** Common misspellings → normalized key for lookup in INDIAN_STATE_BY_KEY */
const STATE_SPELLING_KEYS = {
  gujrat: 'gujarat',
  gujurat: 'gujarat',
  gujraat: 'gujarat',
  rajastan: 'rajasthan',
  rajsthan: 'rajasthan',
  rajasthan: 'rajasthan',
  tamilnadu: 'tamil nadu',
  'uttar pradesh': 'uttar pradesh',
  'west bengal': 'west bengal',
  'madhya pradesh': 'madhya pradesh',
  'andhra pradesh': 'andhra pradesh',
  'arunachal pradesh': 'arunachal pradesh',
  'himachal pradesh': 'himachal pradesh',
  'jammu & kashmir': 'jammu & kashmir',
  'jammu and kashmir': 'jammu & kashmir',
  delhi: 'delhi ncr',
  'new delhi': 'delhi ncr',
}

export function normalizeLocationKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function resolveIndianStateName(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const key = normalizeLocationKey(raw)
  const aliasKey = STATE_SPELLING_KEYS[key] || key
  return INDIAN_STATE_BY_KEY.get(aliasKey) || raw
}

function stateFromLocationString(location) {
  const parts = String(location || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length >= 2) {
    return resolveIndianStateName(parts[parts.length - 1])
  }
  if (parts.length === 1) {
    const asState = resolveIndianStateName(parts[0])
    if (INDIAN_STATE_BY_KEY.has(normalizeLocationKey(asState))) return asState
    if (STATE_SPELLING_KEYS[normalizeLocationKey(parts[0])]) return asState
  }
  return ''
}

/** Parse city and state from lead fields and comma-separated location string. */
export function parseLeadLocationFields(lead = {}) {
  const cityField = String(lead.city || '').trim()
  const stateField = String(lead.state || '').trim()
  const location = String(lead.location || '').trim()

  let city = cityField
  let state = stateField ? resolveIndianStateName(stateField) : ''

  const locState = stateFromLocationString(location)
  if (location) {
    const parts = location
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
    if (parts.length >= 2) {
      if (!city) city = parts[0]
      state = locState
    } else if (parts.length === 1) {
      if (locState) {
        state = locState
      } else if (!city) {
        city = parts[0]
      }
    }
  }

  // Prefer location-derived state when it disagrees with a stale state column/field.
  if (locState && state && normalizeLocationKey(locState) !== normalizeLocationKey(state)) {
    state = locState
  }

  return { city, state }
}

export function getLeadCityFromFields(lead) {
  return parseLeadLocationFields(lead).city
}

export function getLeadStateFromFields(lead) {
  return parseLeadLocationFields(lead).state
}

/** Expand filter tokens to canonical spellings and common DB typos (e.g. GUJRAT). */
export function expandLocationFilterValues(values) {
  const out = new Set()
  for (const raw of values || []) {
    const v = String(raw || '').trim()
    if (!v) continue
    out.add(v)
    const canon = resolveIndianStateName(v)
    if (canon) out.add(canon)
    const key = normalizeLocationKey(v)
    const aliasKey = STATE_SPELLING_KEYS[key]
    if (aliasKey && INDIAN_STATE_BY_KEY.has(aliasKey)) {
      out.add(INDIAN_STATE_BY_KEY.get(aliasKey))
    }
    if (key === 'gujarat' || key === 'gujrat' || key === 'gujurat') {
      out.add('Gujarat')
      out.add('GUJARAT')
      out.add('GUJRAT')
    }
  }
  return [...out]
}

/** Case-insensitive exact match with Indian state spelling normalization. */
export function locationMatchesField(value, filter) {
  const f = normalizeLocationKey(filter)
  if (!f) return true
  const v = normalizeLocationKey(value)
  if (!v) return false
  if (v === f) return true
  const canonV = normalizeLocationKey(resolveIndianStateName(value))
  const canonF = normalizeLocationKey(resolveIndianStateName(filter))
  return canonV === canonF
}

/** Match a lead against one or more state filters using parsed location signals. */
export function leadMatchesStateFilters(lead, filterStates) {
  const filters = expandLocationFilterValues(filterStates)
  if (!filters.length) return true

  const { city, state } = parseLeadLocationFields(lead)
  const locationParts = String(lead?.location || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)

  const candidates = [state, city, ...locationParts].filter(Boolean)

  return filters.some((f) => candidates.some((c) => locationMatchesField(c, f)))
}
