/** Supabase REST client — no npm dependency (works on Vercel serverless). */

function cleanEnv(name) {
  const raw = process.env[name]
  if (!raw) return ''
  return String(raw).trim().replace(/^["']|["']$/g, '')
}

export function getSupabaseEnvStatus() {
  const url = cleanEnv('SUPABASE_URL')
  const key = cleanEnv('SUPABASE_SERVICE_ROLE_KEY')
  let urlHost = null
  try {
    if (url) urlHost = new URL(url).hostname
  } catch {
    urlHost = 'invalid-url'
  }

  return {
    urlSet: Boolean(url),
    keySet: Boolean(key),
    urlHost,
    keyLooksValid: key.startsWith('eyJ') && key.length > 100,
    missing: [
      !url ? 'SUPABASE_URL' : null,
      !key ? 'SUPABASE_SERVICE_ROLE_KEY' : null,
    ].filter(Boolean),
  }
}

export function isSupabaseEnabled() {
  const { urlSet, keySet } = getSupabaseEnvStatus()
  return urlSet && keySet
}

function baseUrl() {
  return cleanEnv('SUPABASE_URL').replace(/\/$/, '')
}

function serviceRoleKey() {
  return cleanEnv('SUPABASE_SERVICE_ROLE_KEY')
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
    const { missing } = getSupabaseEnvStatus()
    return {
      ok: false,
      error: `Missing on server: ${missing.join(', ')}. Add in Vercel → Settings → Environment Variables → Production, then Redeploy.`,
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
