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

function getEmailDomain(email) {
  return String(email || '').split('@')[1]?.toLowerCase() || 'personal'
}

function resolveRole(email) {
  const admins = getAdminEmails()
  if (admins.includes(String(email || '').toLowerCase())) return 'admin'
  return 'member'
}

function buildUserResponse(user) {
  if (!user) return null
  const creditsPaise = user.creditsPaise ?? DEFAULT_TRIAL_CREDITS_PAISE
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    company: user.company,
    picture: user.picture || null,
    plan: user.plan || 'free',
    role: user.role || 'member',
    searchesLeft: user.searchesLeft ?? 25,
    authProvider: user.authProvider || 'google',
    organizationId: user.organizationId || null,
    creditsPaise,
    creditBalanceRupees: Number((creditsPaise / 100).toFixed(2)),
    unlockPricePaise: LEAD_UNLOCK_PRICE_PAISE,
    freeFullLeadPreviewCount: FREE_FULL_LEAD_PREVIEW_COUNT,
  }
}

export async function upsertUser(profile) {
  let userSnapshot = null

  await updateStore((store) => {
    const now = new Date().toISOString()
    const email = String(profile.email || '').toLowerCase()
    const existing = store.users.find((entry) => entry.email === email)

    let organization =
      store.organizations.find((entry) => entry.domain === getEmailDomain(email)) ||
      store.organizations.find((entry) => entry.name === profile.company)

    if (!organization) {
      organization = {
        id: createId('org'),
        name: profile.company || getEmailDomain(email),
        domain: getEmailDomain(email),
        createdAt: now,
      }
      store.organizations.push(organization)
    }

    if (existing) {
      existing.name = profile.name || existing.name
      existing.company = profile.company || existing.company
      existing.picture = profile.picture || existing.picture || null
      existing.lastLoginAt = now
      existing.authProvider = profile.authProvider || existing.authProvider || 'google'
      existing.organizationId = organization.id
      existing.creditsPaise = existing.creditsPaise ?? DEFAULT_TRIAL_CREDITS_PAISE
      existing.role = resolveRole(email)
      userSnapshot = { ...existing }
    } else {
      const role = resolveRole(email)
      const created = {
        id: createId('user'),
        email,
        name: profile.name || email.split('@')[0] || 'User',
        company: profile.company || getEmailDomain(email),
        picture: profile.picture || null,
        plan: profile.plan || 'free',
        role,
        searchesLeft: profile.searchesLeft ?? 25,
        authProvider: profile.authProvider || 'google',
        organizationId: organization.id,
        creditsPaise: DEFAULT_TRIAL_CREDITS_PAISE,
        createdAt: now,
        lastLoginAt: now,
      }
      store.users.push(created)
      store.organizationMemberships.push({
        id: createId('membership'),
        userId: created.id,
        organizationId: organization.id,
        role,
        createdAt: now,
      })
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

  return buildUserResponse(userSnapshot)
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
  return buildUserResponse(user)
}

export async function getSessionUser(req) {
  const cookies = parseCookies(req)
  const cookieValue = cookies[SESSION_COOKIE]
  if (!cookieValue) return null

  const payload = verifySessionToken(cookieValue)
  if (payload) {
    return buildUserResponse(payloadToUserRecord(payload))
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
    res.status(403).json({ error: 'Admin access required' })
    return null
  }
  return user
}

export async function consumeSearchQuota(req, res) {
  const cookies = parseCookies(req)
  const cookieValue = cookies[SESSION_COOKIE]
  const payload = verifySessionToken(cookieValue)

  if (payload) {
    const left = payload.searchesLeft ?? 25
    if (left <= 0) {
      throw new Error('No searches remaining on your plan.')
    }

    payload.searchesLeft = left - 1
    const user = buildUserResponse(payloadToUserRecord(payload))
    setSessionCookie(res, signSessionToken(user))

    try {
      await updateStore((store) => {
        const existing = store.users.find((entry) => entry.id === payload.userId)
        if (existing) {
          existing.searchesLeft = payload.searchesLeft
        }
        return store
      })
    } catch {
      // Store may be ephemeral on Vercel — JWT remains source of truth.
    }

    return user
  }

  const user = await getSessionUser(req)
  if (!user) {
    throw new Error('Authentication required')
  }

  let updatedUser = null
  await updateStore((store) => {
    const record = store.users.find((entry) => entry.id === user.id)
    if (!record) {
      throw new Error('User not found')
    }

    const left = record.searchesLeft ?? 25
    if (left <= 0) {
      throw new Error('No searches remaining on your plan.')
    }

    record.searchesLeft = left - 1
    updatedUser = buildUserResponse(record)
    return store
  })

  return updatedUser
}

export async function refreshSessionCookie(res, user) {
  setSessionCookie(res, signSessionToken(user))
}
