/** Production site URL — must match Google OAuth redirect URI host. */
export const CANONICAL_APP_URL = 'https://connectintel.net'

/** Legacy Vercel hostname — redirect to custom domain in vercel.json */
export const LEGACY_VERCEL_HOST = 'connect-intel-mocha.vercel.app'

function cleanAppUrl(value) {
  const url = String(value || '').trim().replace(/^["']|["']$/g, '').replace(/\/$/, '')
  return url || null
}

export function getAppBaseUrl(req) {
  const configured = cleanAppUrl(process.env.APP_URL)
  if (configured) return configured

  if (process.env.VERCEL_ENV === 'production') {
    return CANONICAL_APP_URL
  }

  const forwarded = req?.headers?.['x-forwarded-host'] || req?.headers?.host
  if (forwarded) {
    const host = String(forwarded).split(',')[0].trim()
    if (host && !host.includes('localhost')) {
      const proto = String(req?.headers?.['x-forwarded-proto'] || 'https').split(',')[0].trim()
      return `${proto}://${host}`.replace(/\/$/, '')
    }
  }

  const vercel = cleanAppUrl(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
  if (vercel) return vercel

  return 'http://localhost:5173'
}

/** OAuth redirect must be identical on authorize + token exchange. */
export function getOAuthRedirectBaseUrl() {
  const configured = cleanAppUrl(process.env.APP_URL)
  if (configured) return configured
  if (process.env.VERCEL_ENV === 'production' || process.env.VERCEL) {
    return CANONICAL_APP_URL
  }
  return getAppBaseUrl()
}
