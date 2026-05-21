import crypto from 'node:crypto'
import { SESSION_TTL_MS } from './config.js'

function getSecret() {
  const secret =
    process.env.SESSION_SECRET ||
    process.env.APOLLO_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    'connect-intel-dev-only-secret'
  return String(secret)
}

function signBody(body) {
  return crypto.createHmac('sha256', getSecret()).update(body).digest('base64url')
}

export function signSessionToken(user) {
  const exp = Date.now() + SESSION_TTL_MS
  const payload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    company: user.company,
    picture: user.picture || null,
    plan: user.plan || 'free',
    role: user.role || 'member',
    searchesLeft: user.searchesLeft ?? 25,
    creditsPaise: user.creditsPaise ?? 5000,
    authProvider: user.authProvider || 'google',
    organizationId: user.organizationId || null,
    accountType: user.accountType || 'individual',
    orgRole: user.orgRole || 'individual',
    isOrgAdmin: Boolean(user.isOrgAdmin),
    canSearch: user.canSearch !== false,
    organizationName: user.organizationName || user.company,
    organizationLogoUrl: user.organizationLogoUrl || null,
    onboardingComplete: Boolean(user.onboardingComplete),
    pipelineRole: user.pipelineRole || 'member',
    exp,
  }

  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${signBody(body)}`
}

export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null

  const dot = token.indexOf('.')
  if (dot <= 0) return null

  const body = token.slice(0, dot)
  const signature = token.slice(dot + 1)
  if (signBody(body) !== signature) return null

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (!payload?.userId || !payload?.email || !payload?.exp) return null
    if (payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export function payloadToUserRecord(payload) {
  return {
    id: payload.userId,
    email: payload.email,
    name: payload.name,
    company: payload.company,
    picture: payload.picture,
    plan: payload.plan,
    role: payload.role,
    searchesLeft: payload.searchesLeft,
    creditsPaise: payload.creditsPaise,
    authProvider: payload.authProvider,
    organizationId: payload.organizationId,
    accountType: payload.accountType,
    orgRole: payload.orgRole,
    isOrgAdmin: payload.isOrgAdmin,
    canSearch: payload.canSearch,
    organizationName: payload.organizationName,
    organizationLogoUrl: payload.organizationLogoUrl,
    onboardingComplete: payload.onboardingComplete,
    pipelineRole: payload.pipelineRole,
  }
}
