/** Supabase REST client — no npm dependency (works on Vercel serverless). */

export function isSupabaseEnabled() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

function baseUrl() {
  return String(process.env.SUPABASE_URL).replace(/\/$/, '')
}

function headers(extra = {}) {
  return {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
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
