import { AUTH_STORE_COLLECTIONS, createId, readStore, updateStore, writeStoreCollections } from './store.js'
import { parseCookies, setSessionCookie, clearSessionCookie } from './cookies.js'
import {
  DEFAULT_TRIAL_CREDITS_PAISE,
  FREE_FULL_LEAD_PREVIEW_COUNT,
  LEAD_UNLOCK_PRICE_PAISE,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  getAdminEmails,
} from './config.js'
import {
  payloadToUserRecord,
  signSessionToken,
  verifySessionToken,
} from './sessionJwt.js'
import {
  applyPendingInvites,
  buildOrgUserResponse,
  consumeOrgSearchQuota,
} from './organizations.js'

function getEmailDomain(email) {
  return String(email || '').split('@')[1]?.toLowerCase() || 'personal'
}

function resolvePlatformRole(email) {
  const admins = getAdminEmails()
  if (admins.includes(String(email || '').toLowerCase())) return 'admin'
  return 'member'
}

export async function upsertUser(profile) {
  const store = await readStore({ only: AUTH_STORE_COLLECTIONS })
  const now = new Date().toISOString()
  const email = String(profile.email || '').toLowerCase()
  const existing = store.users.find((entry) => String(entry.email || '').toLowerCase() === email)
  const dirty = new Set(['users'])
  let userSnapshot = null

  if (existing) {
    existing.name = profile.name || existing.name
    existing.company = profile.company || existing.company
    existing.picture = profile.picture || existing.picture || null
    existing.lastLoginAt = now
    existing.authProvider = profile.authProvider || existing.authProvider || 'google'
    existing.role = resolvePlatformRole(email)
    const beforeOrg = existing.organizationId
    applyPendingInvites(store, existing)
    if (existing.organizationId !== beforeOrg) {
      dirty.add('organizationMemberships')
      dirty.add('organizations')
    }
    userSnapshot = { ...existing }
  } else {
    const created = {
      id: createId('user'),
      email,
      name: profile.name || email.split('@')[0] || 'User',
      company: profile.company || getEmailDomain(email),
      picture: profile.picture || null,
      plan: profile.plan || 'free',
      role: resolvePlatformRole(email),
      searchesLeft: profile.searchesLeft ?? 25,
      authProvider: profile.authProvider || 'google',
      organizationId: null,
      creditsPaise: DEFAULT_TRIAL_CREDITS_PAISE,
      onboardingComplete: false,
      accountType: null,
      createdAt: now,
      lastLoginAt: now,
    }
    store.users.push(created)
    applyPendingInvites(store, created)
    if (created.organizationId) {
      dirty.add('organizationMemberships')
      dirty.add('organizations')
    }
    store.creditLedger.push({
      id: createId('credit'),
      userId: created.id,
      kind: 'grant',
      amountPaise: DEFAULT_TRIAL_CREDITS_PAISE,
      description: 'Welcome trial credits',
      createdAt: now,
    })
    dirty.add('creditLedger')
    userSnapshot = created
  }

  await writeStoreCollections(store, [...dirty])
  return buildOrgUserResponse(userSnapshot, store)
}

export async function createSession(res, user) {
  const token = signSessionToken(user)
  setSessionCookie(res, token)
  return { token }
}

async function getLegacySessionUser(sessionId) {
  const now = Date.now()
  const store = await readStore({ only: AUTH_STORE_COLLECTIONS })
  const session = store.sessions.find((entry) => entry.id === sessionId)

  if (!session) return null
  if (new Date(session.expiresAt).getTime() <= now) {
    await updateStore((fresh) => {
      fresh.sessions = fresh.sessions.filter((entry) => entry.id !== sessionId)
      return fresh
    })
    return null
  }

  const user = store.users.find((entry) => entry.id === session.userId)
  return user ? buildOrgUserResponse(user, store) : null
}

function readBearerToken(req) {
  const header = String(req.headers?.authorization || '')
  if (header.startsWith('Bearer ')) {
    return header.slice(7).trim()
  }
  return null
}

export function findUserInStore(store, payload) {
  if (!payload) return null
  const byId = store.users.find((u) => u.id === payload.userId)
  if (byId) return byId
  const email = String(payload.email || '').toLowerCase()
  if (!email) return null
  return store.users.find((u) => String(u.email || '').toLowerCase() === email) || null
}

async function userFromSessionToken(token) {
  if (!token) return null

  const payload = verifySessionToken(token)
  if (payload) {
    const store = await readStore({ only: AUTH_STORE_COLLECTIONS })
    const user = findUserInStore(store, payload)
    if (user) return buildOrgUserResponse(user, store)
    return null
  }

  return getLegacySessionUser(token)
}

export async function getSessionUser(req) {
  const cookies = parseCookies(req)
  const cookieValue = cookies[SESSION_COOKIE]
  const fromCookie = await userFromSessionToken(cookieValue)
  if (fromCookie) return fromCookie

  const bearer = readBearerToken(req)
  if (bearer) return userFromSessionToken(bearer)

  return null
}

/** Reload user from database and refresh session cookie (keeps Gmail OAuth + org data in sync). */
export async function refreshSessionFromDatabase(req, res) {
  const cookies = parseCookies(req)
  const token = cookies[SESSION_COOKIE] || readBearerToken(req)
  const payload = verifySessionToken(token)
  if (!payload) return null

  const store = await readStore({ only: AUTH_STORE_COLLECTIONS })
  const user = findUserInStore(store, payload)
  if (!user) return null

  const view = buildOrgUserResponse(user, store)
  let sessionToken = token
  if (res) {
    sessionToken = await refreshSessionCookie(res, view)
  }
  return { user: view, token: sessionToken }
}

export async function destroySession(req, res) {
  clearSessionCookie(res)
}

export async function requireUser(req, res) {
  const user = await getSessionUser(req)
  if (!user) {
    res.status(401).json({ error: 'Authentication required. Please sign out and sign in again.' })
    return null
  }
  return user
}

export async function requireAdmin(req, res) {
  const user = await requireUser(req, res)
  if (!user) return null
  if (user.role !== 'admin') {
    res.status(403).json({ error: 'Platform admin access required' })
    return null
  }
  return user
}

/** Company org_admin or platform admin — for team pipeline upload. */
export async function requireOrgAdmin(req, res) {
  const user = await requireUser(req, res)
  if (!user) return null
  if (user.role === 'admin') return user
  if (user.isOrgAdmin && user.accountType === 'company' && user.organizationId) return user
  res.status(403).json({ error: 'Company admin access required' })
  return null
}

export async function consumeSearchQuota(req, res) {
  const sessionUser = await getSessionUser(req)
  if (!sessionUser) {
    throw new Error('Authentication required')
  }

  const store = await readStore()
  let user = findUserInStore(store, {
    userId: sessionUser.id,
    email: sessionUser.email,
  })
  if (!user) {
    throw new Error('Session out of date — please sign out and sign in again.')
  }

  const orgView = buildOrgUserResponse(user, store)
  if (!orgView.canSearch) {
    throw new Error('Lead search is not enabled for your account. Ask your company admin.')
  }

  let updatedStore = store

  try {
    const result = consumeOrgSearchQuota(store, orgView)
    updatedStore = result.store
    user = result.user
  } catch (error) {
    throw error
  }

  if (orgView.accountType === 'individual' || !orgView.organizationId) {
    const left = user.searchesLeft ?? 25
    if (left <= 0) throw new Error('No searches remaining on your plan.')
    user.searchesLeft = left - 1
  }

  await updateStore(() => updatedStore)

  const refreshed = buildOrgUserResponse(user, updatedStore)
  setSessionCookie(res, signSessionToken(refreshed))
  return refreshed
}

export async function refreshSessionCookie(res, user) {
  const token = signSessionToken(user)
  setSessionCookie(res, token)
  return token
}
