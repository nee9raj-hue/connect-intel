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
  const now = Date.now()
  const expiresAt = new Date(now + SESSION_TTL_MS).toISOString()
  const session = {
    id: createId('session'),
    userId: user.id,
    createdAt: new Date(now).toISOString(),
    expiresAt,
  }

  await updateStore((store) => {
    store.sessions = store.sessions.filter((entry) => new Date(entry.expiresAt).getTime() > now)
    store.sessions.push(session)
    return store
  })

  setSessionCookie(res, session.id)
  return session
}

export async function getSessionUser(req) {
  const cookies = parseCookies(req)
  const sessionId = cookies[SESSION_COOKIE]
  if (!sessionId) return null

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

export async function destroySession(req, res) {
  const cookies = parseCookies(req)
  const sessionId = cookies[SESSION_COOKIE]

  if (sessionId) {
    await updateStore((store) => {
      store.sessions = store.sessions.filter((entry) => entry.id !== sessionId)
      return store
    })
  }

  clearSessionCookie(res)
}

export async function requireUser(req, res) {
  const user = await getSessionUser(req)
  if (!user) {
    res.status(401).json({ error: 'Authentication required' })
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

export async function consumeSearchQuota(userId) {
  let updatedUser = null

  await updateStore((store) => {
    const user = store.users.find((entry) => entry.id === userId)
    if (!user) {
      throw new Error('User not found')
    }

    const left = user.searchesLeft ?? 25
    if (left <= 0) {
      throw new Error('No searches remaining on your plan.')
    }

    user.searchesLeft = left - 1
    updatedUser = buildUserResponse(user)
    return store
  })

  return updatedUser
}
