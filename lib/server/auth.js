import { createId, readStore, updateStore } from './store.js'
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
  let userSnapshot = null

  await updateStore((store) => {
    const now = new Date().toISOString()
    const email = String(profile.email || '').toLowerCase()
    const existing = store.users.find((entry) => entry.email === email)

    if (existing) {
      existing.name = profile.name || existing.name
      existing.company = profile.company || existing.company
      existing.picture = profile.picture || existing.picture || null
      existing.lastLoginAt = now
      existing.authProvider = profile.authProvider || existing.authProvider || 'google'
      existing.role = resolvePlatformRole(email)
      applyPendingInvites(store, existing)
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
      store.creditLedger.push({
        id: createId('credit'),
        userId: created.id,
        kind: 'grant',
        amountPaise: DEFAULT_TRIAL_CREDITS_PAISE,
        description: 'Welcome trial credits',
        createdAt: now,
      })
      userSnapshot = created
    }

    return store
  })

  const store = await readStore()
  return buildOrgUserResponse(userSnapshot, store)
}

export async function createSession(res, user) {
  const token = signSessionToken(user)
  setSessionCookie(res, token)
  return { token }
}

async function getLegacySessionUser(sessionId) {
  const now = Date.now()
  const store = await readStore()
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

export async function getSessionUser(req) {
  const cookies = parseCookies(req)
  const cookieValue = cookies[SESSION_COOKIE]
  if (!cookieValue) return null

  const payload = verifySessionToken(cookieValue)
  if (payload) {
    const store = await readStore()
    const user = store.users.find((u) => u.id === payload.userId)
    if (user) return buildOrgUserResponse(user, store)
    return buildOrgUserResponse(payloadToUserRecord(payload), store)
  }

  return getLegacySessionUser(cookieValue)
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
  const cookies = parseCookies(req)
  const cookieValue = cookies[SESSION_COOKIE]
  const payload = verifySessionToken(cookieValue)

  if (!payload) {
    const user = await getSessionUser(req)
    if (!user) throw new Error('Authentication required')
    throw new Error('Session expired — please sign in again')
  }

  const store = await readStore()
  let user = store.users.find((u) => u.id === payload.userId)
  if (!user) throw new Error('User not found')

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
  setSessionCookie(res, signSessionToken(user))
}
