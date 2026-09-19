import { SESSION_COOKIE, SESSION_TTL_MS, isProduction } from './config.js'

export function parseCookies(req) {
  const header = req.headers.cookie || ''
  return header
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const idx = part.indexOf('=')
      if (idx === -1) return acc
      const key = decodeURIComponent(part.slice(0, idx).trim())
      const value = decodeURIComponent(part.slice(idx + 1).trim())
      acc[key] = value
      return acc
    }, {})
}

function appendCookie(res, value) {
  const current = res.getHeader('Set-Cookie')
  if (!current) {
    res.setHeader('Set-Cookie', value)
    return
  }
  if (Array.isArray(current)) {
    res.setHeader('Set-Cookie', [...current, value])
    return
  }
  res.setHeader('Set-Cookie', [current, value])
}

function cookieDomainFromRequest(req) {
  const host = String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '')
    .split(',')[0]
    .trim()
    .split(':')[0]
    .toLowerCase()
  if (host.endsWith('connectintel.net')) return '.connectintel.net'
  return null
}

function getCookieDomain(req) {
  if (!isProduction()) return null
  return cookieDomainFromRequest(req)
}

function buildCookieParts(sessionId, maxAgeSeconds, req) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ]
  if (isProduction()) parts.push('Secure')
  const domain = getCookieDomain(req)
  if (domain) parts.push(`Domain=${domain}`)
  return parts
}

export function setSessionCookie(res, sessionId, req) {
  appendCookie(res, buildCookieParts(sessionId, Math.floor(SESSION_TTL_MS / 1000), req).join('; '))
}

export function clearSessionCookie(res, req) {
  appendCookie(res, buildCookieParts('', 0, req).join('; '))
}

export { cookieDomainFromRequest }

