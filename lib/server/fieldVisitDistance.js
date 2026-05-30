/** Driving distance estimates via Google Distance Matrix (server-side). */

const CACHE = new Map()
const CACHE_MAX = 400

function mapsApiKey() {
  return String(
    process.env.GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_DISTANCE_MATRIX_API_KEY ||
      process.env.GOOGLE_MAPS_SERVER_API_KEY ||
      ''
  ).trim()
}

export function isFieldVisitDistanceConfigured() {
  return Boolean(mapsApiKey())
}

/** Expand pincode-only input for better geocoding in India. */
export function normalizeLocationQuery(label) {
  let s = String(label || '').trim()
  if (!s) return ''
  if (/^\d{6}$/.test(s)) return `${s}, India`
  if (/^\d{6}\s*,?\s*india$/i.test(s)) return s
  return s
}

function googleTravelMode(mode) {
  return mode === 'bike' ? 'bicycling' : 'driving'
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

/**
 * @returns {Promise<{ ok: true, distanceKm, durationMinutes, distanceSource, startResolved, endResolved } | { ok: false, error: string }>}
 */
export async function suggestDrivingDistance({ startLabel, endLabel, travelMode = 'car' }) {
  const key = mapsApiKey()
  if (!key) {
    return {
      ok: false,
      error:
        'Distance estimates are not configured yet. Your admin can add GOOGLE_MAPS_API_KEY on Vercel (Google Cloud → enable Distance Matrix API).',
    }
  }

  const start = normalizeLocationQuery(startLabel)
  const end = normalizeLocationQuery(endLabel)
  if (!start || !end) {
    return { ok: false, error: 'Enter both start and destination to get a distance estimate.' }
  }

  const cacheKey = `${start.toLowerCase()}|${end.toLowerCase()}|${travelMode}`
  const cached = cacheGet(cacheKey)
  if (cached) return { ok: true, ...cached, cached: true }

  const params = new URLSearchParams({
    origins: start,
    destinations: end,
    mode: googleTravelMode(travelMode),
    units: 'metric',
    key,
  })

  let data
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?${params}`)
    data = await res.json()
  } catch {
    return { ok: false, error: 'Could not reach Google Maps. Try again or enter km manually.' }
  }

  if (data.status !== 'OK') {
    return {
      ok: false,
      error: data.error_message || 'Google Maps could not estimate this route.',
    }
  }

  const el = data.rows?.[0]?.elements?.[0]
  if (!el || el.status !== 'OK') {
    return {
      ok: false,
      error:
        'No route found for these locations. Try fuller addresses (area, city) or enter km manually.',
    }
  }

  const payload = {
    distanceKm: Math.round((el.distance.value / 1000) * 10) / 10,
    durationMinutes: Math.max(1, Math.round(el.duration.value / 60)),
    distanceSource: 'google',
    startResolved: data.origin_addresses?.[0] || start,
    endResolved: data.destination_addresses?.[0] || end,
  }
  cacheSet(cacheKey, payload)
  return { ok: true, ...payload, cached: false }
}
