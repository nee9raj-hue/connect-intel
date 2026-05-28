import crypto from 'node:crypto'
import { updateStorePartial } from './store.js'

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
const TOKEN_REVOKED =
  'https://schemas.openid.net/secevent/oauth/event-type/tokens-revoked'
const SESSION_REVOKED =
  'https://schemas.openid.net/secevent/risc/event-type/sessions-revoked'
const ACCOUNT_DISABLED =
  'https://schemas.openid.net/secevent/risc/event-type/account-disabled'

let jwksCache = { at: 0, keys: [] }

async function getGoogleJwks() {
  if (Date.now() - jwksCache.at < 60 * 60 * 1000 && jwksCache.keys.length) {
    return jwksCache.keys
  }
  const response = await fetch(GOOGLE_JWKS_URL)
  const data = await response.json()
  if (!response.ok) throw new Error('Failed to load Google JWKS')
  jwksCache = { at: Date.now(), keys: data.keys || [] }
  return jwksCache.keys
}

function decodePart(part) {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'))
}

async function verifyRiscJwt(token) {
  const parts = String(token || '').split('.')
  if (parts.length !== 3) throw new Error('Invalid JWT')
  const header = decodePart(parts[0])
  const payload = decodePart(parts[1])
  const keys = await getGoogleJwks()
  const jwk = keys.find((k) => k.kid === header.kid)
  if (!jwk) throw new Error('Unknown signing key')

  const keyObject = crypto.createPublicKey({ format: 'jwk', key: jwk })
  const data = `${parts[0]}.${parts[1]}`
  const signature = Buffer.from(parts[2], 'base64url')
  const ok = crypto.verify('RSA-SHA256', Buffer.from(data), keyObject, signature)
  if (!ok) throw new Error('Invalid JWT signature')

  const clientId = String(process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '').trim()
  if (clientId && payload.aud && payload.aud !== clientId) {
    throw new Error('Unexpected JWT audience')
  }

  return payload
}

async function clearCrmGmailByGoogleSub(googleSub) {
  if (!googleSub) return 0
  let cleared = 0
  await updateStorePartial(['users'], (draft) => {
    for (const row of draft.users || []) {
      if (row.googleSub === googleSub && row.crmGmailOAuth) {
        row.crmGmailOAuth = null
        row.calendarSyncEnabled = false
        cleared += 1
      }
    }
    return draft
  })
  return cleared
}

export async function handleGoogleRiscRequest(authHeader) {
  const token = String(authHeader || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) throw new Error('Missing Security Event Token')

  const payload = await verifyRiscJwt(token)
  const events = payload.events || {}
  let handled = 0

  for (const [type, detail] of Object.entries(events)) {
    if (![TOKEN_REVOKED, SESSION_REVOKED, ACCOUNT_DISABLED].includes(type)) continue
    const sub = detail?.subject?.sub || payload.sub
    handled += await clearCrmGmailByGoogleSub(sub)
  }

  return { ok: true, handled, iss: payload.iss }
}

export function rememberGoogleSubOnUser(userRow, googleSub) {
  if (!userRow || !googleSub) return
  userRow.googleSub = String(googleSub)
}
