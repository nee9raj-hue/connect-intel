/** Supabase REST client — no npm dependency (works on Vercel serverless). */

const KEY_ENV_NAMES = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_KEY',
]

function cleanEnv(name) {
  const raw = process.env[name]
  if (!raw) return ''
  return String(raw).trim().replace(/^["']|["']$/g, '')
}

function resolveServiceRoleKey() {
  for (const name of KEY_ENV_NAMES) {
    const key = cleanEnv(name)
    if (key) return { key, envName: name }
  }
  return { key: '', envName: null }
}

function cleanSupabaseUrl() {
  let url = cleanEnv('SUPABASE_URL')
  if (url) {
    url = url.replace(/\/rest\/v1\/?$/i, '').replace(/\/$/, '')
  }
  return url
}

export function getSupabaseEnvStatus() {
  const url = cleanSupabaseUrl()
  const { key, envName } = resolveServiceRoleKey()
  let urlHost = null
  try {
    if (url) urlHost = new URL(url).hostname
  } catch {
    urlHost = 'invalid-url'
  }

  const missing = []
  if (!url) missing.push('SUPABASE_URL')
  if (!key) missing.push('SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)')

  return {
    urlSet: Boolean(url),
    keySet: Boolean(key),
    keyEnvName: envName,
    urlHost,
    keyLooksValid: key.startsWith('eyJ') && key.length > 100,
    missing,
    hint: !key
      ? 'In Vercel use name SUPABASE_SERVICE_ROLE_KEY with your Supabase Secret key value, then Redeploy.'
      : null,
  }
}

export function isSupabaseEnabled() {
  const { urlSet, keySet } = getSupabaseEnvStatus()
  return urlSet && keySet
}

function baseUrl() {
  return cleanSupabaseUrl()
}

function serviceRoleKey() {
  return resolveServiceRoleKey().key
}

function headers(extra = {}) {
  const key = serviceRoleKey()
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

function isSupabaseQuotaError(response, data) {
  const text = String(data?.message || data?.error || data || '').toLowerCase()
  return (
    response.status === 429 ||
    (/quota|plan|billing|limit|exceeded|throttle|request rate/i.test(text) && response.status >= 400)
  )
}

function isRetryableSupabaseStatus(status) {
  return [408, 425, 500, 502, 503, 504, 520, 522, 524].includes(status)
}

function formatSupabaseError(response, data) {
  if (isSupabaseQuotaError(response, data)) {
    return 'Supabase quota exceeded or request limit reached. Upgrade your Supabase plan or wait until usage resets.'
  }
  if (response.status === 522) {
    return (
      'Supabase connection timed out (522). The database may be waking from pause or under heavy load — wait 1–2 minutes and refresh. ' +
      'If this persists, open your Supabase project dashboard and confirm the project is not paused.'
    )
  }
  if (response.status === 503 || response.status === 504) {
    return `Supabase is temporarily unavailable (${response.status}). Retry in a moment.`
  }
  return data?.message || data?.error || data?.hint || `Supabase error (${response.status})`
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function supabaseRest(path, options = {}, { attempts = 3 } = {}) {
  if (!isSupabaseEnabled()) {
    throw new Error('Supabase is not configured')
  }

  const url = `${baseUrl()}/rest/v1/${path}`
  let lastError = null

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let response
    try {
      response = await fetch(url, {
        ...options,
        headers: headers(options.headers),
        signal: AbortSignal.timeout(45_000),
      })
    } catch (error) {
      const message = String(error?.message || 'Unknown error')
      const timedOut = error?.name === 'TimeoutError' || /aborted|timeout/i.test(message)
      lastError = new Error(
        timedOut
          ? 'Supabase request timed out. The database may be paused or overloaded — wait a minute and retry.'
          : `Supabase request failed: ${message}. Check network availability or Supabase project status.`
      )
      if (attempt < attempts - 1) {
        await delay(400 * (attempt + 1))
        continue
      }
      throw lastError
    }

    const text = await response.text()
    let data = null
    if (text) {
      try {
        data = JSON.parse(text)
      } catch {
        data = text
      }
    }

    if (!response.ok) {
      const message = formatSupabaseError(response, data)
      lastError = new Error(message)
      if (isRetryableSupabaseStatus(response.status) && attempt < attempts - 1) {
        await delay(500 * (attempt + 1))
        continue
      }
      throw lastError
    }

    return data
  }

  throw lastError || new Error('Supabase request failed')
}

export async function testSupabaseConnection() {
  if (!isSupabaseEnabled()) {
    const { missing, hint } = getSupabaseEnvStatus()
    return {
      ok: false,
      error: `Missing on server: ${missing.join(', ')}. ${hint || 'Redeploy after saving env vars on Vercel Production.'}`,
    }
  }

  try {
    await supabaseRest('store_collections?select=collection&limit=1')
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error.message }
  }
}

export async function upsertCollection(collection, json) {
  return supabaseRest('store_collections', {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify([
      {
        collection,
        json,
        updated_at: new Date().toISOString(),
      },
    ]),
  })
}

export async function fetchAllCollections(path = 'store_collections?select=collection,json') {
  const rows = await supabaseRest(path)
  return Array.isArray(rows) ? rows : []
}
