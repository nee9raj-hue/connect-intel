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

export function setSessionCookie(res, sessionId) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ]

  if (isProduction()) parts.push('Secure')
  appendCookie(res, parts.join('; '))
}

export function clearSessionCookie(res) {
  const parts = [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ]

  if (isProduction()) parts.push('Secure')
  appendCookie(res, parts.join('; '))
}

