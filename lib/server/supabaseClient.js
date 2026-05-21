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

export async function supabaseRest(path, options = {}) {
  if (!isSupabaseEnabled()) {
    throw new Error('Supabase is not configured')
  }

  const url = `${baseUrl()}/rest/v1/${path}`
  const response = await fetch(url, {
    ...options,
    headers: headers(options.headers),
  })

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
    const message =
      data?.message || data?.error || data?.hint || `Supabase error (${response.status})`
    throw new Error(message)
  }

  return data
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

export async function fetchAllCollections() {
  const rows = await supabaseRest('store_collections?select=collection,json')
  return Array.isArray(rows) ? rows : []
}
