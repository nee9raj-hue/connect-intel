/** Free driving distance via OpenStreetMap (Nominatim) + OSRM — no API key required. */

const CACHE = new Map()
const CACHE_MAX = 400
const NOMINATIM_UA = 'ConnectIntel/1.0 (https://connectintel.net; field-visit-distance)'

function mapsApiKey() {
  return String(
    process.env.GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_DISTANCE_MATRIX_API_KEY ||
      process.env.GOOGLE_MAPS_SERVER_API_KEY ||
      ''
  ).trim()
}

/** Always available — uses free OSRM + Nominatim. Google key is optional fallback only. */
export function isFieldVisitDistanceConfigured() {
  return true
}

export function fieldVisitDistanceProvider() {
  return mapsApiKey() ? 'osrm_with_google_fallback' : 'osrm'
}

/** Expand pincode-only input for better geocoding in India. */
export function normalizeLocationQuery(label) {
  let s = String(label || '').trim()
  if (!s) return ''
  if (/^\d{6}$/.test(s)) return `${s}, India`
  if (/^\d{6}\s*,?\s*india$/i.test(s)) return s
  if (!/\bindia\b/i.test(s) && /,\s*[A-Za-z]/.test(s) === false && s.length < 40) {
    // Short place names without country — bias geocoder to India
    return `${s}, India`
  }
  return s
}

function osrmProfile(travelMode) {
  return travelMode === 'bike' ? 'cycling' : 'driving'
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function geocodePlace(query) {
  const q = normalizeLocationQuery(query)
  if (!q) return null

  const params = new URLSearchParams({
    q,
    format: 'json',
    limit: '1',
    addressdetails: '0',
    countrycodes: 'in',
  })

  let rows
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        'User-Agent': NOMINATIM_UA,
        Accept: 'application/json',
      },
    })
    if (!res.ok) return null
    rows = await res.json()
  } catch {
    return null
  }

  const row = Array.isArray(rows) ? rows[0] : null
  if (!row?.lat || !row?.lon) return null

  const lat = Number(row.lat)
  const lon = Number(row.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null

  return {
    lat,
    lon,
    label: String(row.display_name || q).slice(0, 300),
  }
}

function haversineKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180
  const R = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  const straight = 2 * R * Math.asin(Math.sqrt(h))
  // Road distance is typically ~1.25–1.45× straight line in cities
  return Math.round(straight * 1.35 * 10) / 10
}

async function routeOsrm(from, to, travelMode) {
  const profile = osrmProfile(travelMode)
  const coords = `${from.lon},${from.lat};${to.lon},${to.lat}`
  const url = `https://router.project-osrm.org/route/v1/${profile}/${coords}?overview=false`

  let data
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    data = await res.json()
  } catch {
    return null
  }

  if (data.code !== 'Ok' || !data.routes?.[0]) return null
  const route = data.routes[0]
  return {
    distanceKm: Math.round((route.distance / 1000) * 10) / 10,
    durationMinutes: Math.max(1, Math.round(route.duration / 60)),
  }
}

async function suggestViaOsrm({ startLabel, endLabel, travelMode }) {
  const from = await geocodePlace(startLabel)
  await sleep(1100)
  const to = await geocodePlace(endLabel)
  if (!from || !to) {
    return {
      ok: false,
      error:
        'Could not find one or both locations. Try area + city, full address, or a 6-digit pincode — or enter km manually.',
    }
  }

  let route = await routeOsrm(from, to, travelMode)
  let approximate = false
  if (!route) {
    route = {
      distanceKm: haversineKm(from, to),
      durationMinutes: null,
    }
    approximate = true
  }

  return {
    ok: true,
    distanceKm: route.distanceKm,
    durationMinutes: route.durationMinutes,
    distanceSource: approximate ? 'estimated' : 'osrm',
    startResolved: from.label,
    endResolved: to.label,
    provider: approximate ? 'nominatim_haversine' : 'osrm',
  }
}

async function suggestViaGoogle({ startLabel, endLabel, travelMode, key }) {
  const start = normalizeLocationQuery(startLabel)
  const end = normalizeLocationQuery(endLabel)
  const params = new URLSearchParams({
    origins: start,
    destinations: end,
    mode: travelMode === 'bike' ? 'bicycling' : 'driving',
    units: 'metric',
    key,
  })

  const res = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?${params}`)
  const data = await res.json()
  if (data.status !== 'OK') return null
  const el = data.rows?.[0]?.elements?.[0]
  if (!el || el.status !== 'OK') return null

  return {
    ok: true,
    distanceKm: Math.round((el.distance.value / 1000) * 10) / 10,
    durationMinutes: Math.max(1, Math.round(el.duration.value / 60)),
    distanceSource: 'google',
    startResolved: data.origin_addresses?.[0] || start,
    endResolved: data.destination_addresses?.[0] || end,
    provider: 'google',
  }
}

/**
 * @returns {Promise<{ ok: true, distanceKm, durationMinutes, distanceSource, startResolved, endResolved, provider? } | { ok: false, error: string }>}
 */
export async function suggestDrivingDistance({ startLabel, endLabel, travelMode = 'car' }) {
  const start = normalizeLocationQuery(startLabel)
  const end = normalizeLocationQuery(endLabel)
  if (!start || !end) {
    return { ok: false, error: 'Enter both start and destination to get a distance estimate.' }
  }

  const cacheKey = `${start.toLowerCase()}|${end.toLowerCase()}|${travelMode}`
  const cached = cacheGet(cacheKey)
  if (cached) return { ok: true, ...cached, cached: true }

  let result = await suggestViaOsrm({ startLabel, endLabel, travelMode })

  const googleKey = mapsApiKey()
  if (!result.ok && googleKey) {
    const googleResult = await suggestViaGoogle({
      startLabel,
      endLabel,
      travelMode,
      key: googleKey,
    })
    if (googleResult?.ok) result = googleResult
  }

  if (!result.ok) return result

  const payload = {
    distanceKm: result.distanceKm,
    durationMinutes: result.durationMinutes,
    distanceSource: result.distanceSource,
    startResolved: result.startResolved,
    endResolved: result.endResolved,
    provider: result.provider,
  }
  cacheSet(cacheKey, payload)
  return { ok: true, ...payload, cached: false }
}
