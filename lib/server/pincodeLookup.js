const CACHE = new Map()
const CACHE_MAX = 500
const NOMINATIM_UA = 'ConnectIntel/1.0 (https://connectintel.net; pincode-lookup)'
const LOOKUP_TIMEOUT_MS = 8_000

async function fetchWithTimeout(url, options = {}, timeoutMs = LOOKUP_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function cacheGet(key) {
  return CACHE.get(key) || null
}

function cacheSet(key, value) {
  if (CACHE.size >= CACHE_MAX) {
    const first = CACHE.keys().next().value
    CACHE.delete(first)
  }
  CACHE.set(key, value)
}

async function lookupIndiaPincode(pin) {
  const res = await fetchWithTimeout(`https://api.postalpincode.in/pincode/${encodeURIComponent(pin)}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) return null
  const rows = await res.json()
  const row = Array.isArray(rows) ? rows[0] : null
  if (row?.Status !== 'Success' || !row.PostOffice?.length) return null
  const po = row.PostOffice[0]
  return {
    pincode: pin,
    city: po.District || po.Name || '',
    state: po.State || '',
    country: po.Country || 'India',
    area: po.Name || '',
  }
}

async function lookupNominatimPostal(postalCode, countryHint = '') {
  const params = new URLSearchParams({
    postalcode: postalCode,
    format: 'json',
    limit: '1',
    addressdetails: '1',
  })
  if (countryHint && countryHint.length === 2) {
    params.set('countrycodes', countryHint.toLowerCase())
  }
  const res = await fetchWithTimeout(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: {
      'User-Agent': NOMINATIM_UA,
      Accept: 'application/json',
    },
  })
  if (!res.ok) return null
  const rows = await res.json()
  const hit = rows?.[0]
  if (!hit?.address) return null
  const addr = hit.address
  return {
    pincode: postalCode,
    city:
      addr.city ||
      addr.town ||
      addr.village ||
      addr.municipality ||
      addr.county ||
      addr.state_district ||
      '',
    state: addr.state || addr.region || '',
    country: addr.country || '',
    area: addr.suburb || addr.neighbourhood || addr.road || '',
  }
}

/** Resolve city/state/country from a postal or ZIP code. */
export async function lookupPostalCode(rawPin, { side = 'delivery' } = {}) {
  const pin = String(rawPin || '').trim()
  if (!pin) return null

  const cacheKey = `${side}:${pin.toLowerCase()}`
  const cached = cacheGet(cacheKey)
  if (cached) return cached

  let result = null
  if (/^\d{6}$/.test(pin)) {
    result = await lookupIndiaPincode(pin)
  } else if (/^\d{5}(-\d{4})?$/.test(pin)) {
    result = await lookupNominatimPostal(pin.replace(/-\d{4}$/, ''), 'us')
    if (result) result.pincode = pin
  } else if (/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/i.test(pin)) {
    const normalized = pin.replace(/\s/g, '').toUpperCase()
    result = await lookupNominatimPostal(normalized, 'ca')
    if (result) result.pincode = normalized
  } else if (/^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i.test(pin)) {
    result = await lookupNominatimPostal(pin.toUpperCase(), 'gb')
    if (result) result.pincode = pin.toUpperCase()
  } else {
    result = await lookupNominatimPostal(pin)
  }

  if (result) cacheSet(cacheKey, result)
  return result
}
