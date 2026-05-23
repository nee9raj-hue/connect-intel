const BUILT_IN_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '')
  .trim()
  .replace(/^["']|["']$/g, '')

let cachedClientId = BUILT_IN_CLIENT_ID || null
let loadPromise = null

export function getBuiltInGoogleClientId() {
  return BUILT_IN_CLIENT_ID
}

/** Resolve Google OAuth client ID (build-time env or runtime /api/public-config). */
export async function resolveGoogleClientId() {
  if (cachedClientId !== null) return cachedClientId

  if (!loadPromise) {
    loadPromise = (async () => {
      if (BUILT_IN_CLIENT_ID) {
        cachedClientId = BUILT_IN_CLIENT_ID
        return cachedClientId
      }

      try {
        const response = await fetch('/api/public-config', { credentials: 'same-origin' })
        const data = await response.json()
        cachedClientId = String(data.googleClientId || '').trim()
      } catch {
        cachedClientId = ''
      }

      return cachedClientId
    })()
  }

  return loadPromise
}
