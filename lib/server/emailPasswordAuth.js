import { upsertUser } from './auth.js'
import { readStore, updateStorePartial } from './store.js'
import { buildOrgUserResponse, applyPendingInvites } from './organizations.js'
import { CRM_SOLO_FREE_TIER } from './crmProductFlags.js'
import {
  hashPassword,
  validateEmailAddress,
  validatePassword,
  verifyPassword,
} from './passwordAuth.js'

function emailDomain(email) {
  return String(email || '')
    .split('@')[1]
    ?.toLowerCase() || 'personal'
}

const LOGIN_STORE = ['users', 'organizations', 'organizationMemberships', 'organizationInvites']

async function persistLastLogin(userId, lastLoginAt, authProvider) {
  try {
    await updateStorePartial(['users'], (draft) => {
      const row = (draft.users || []).find((u) => String(u.id) === String(userId))
      if (!row) return draft
      row.lastLoginAt = lastLoginAt
      row.authProvider = authProvider || row.authProvider
      return draft
    })
  } catch (err) {
    console.warn('login lastLogin persist:', err?.message || err)
  }
}

export async function registerWithEmailPassword({ email, password, name }) {
  const normalizedEmail = validateEmailAddress(email)
  validatePassword(password, { forSignup: true })
  const displayName = String(name || '').trim() || normalizedEmail.split('@')[0] || 'User'

  const store = await readStore({ only: ['users'] })
  const existing = (store.users || []).find(
    (u) => String(u.email || '').toLowerCase() === normalizedEmail
  )
  if (existing) {
    if (existing.passwordHash) {
      throw new Error('An account with this email already exists. Sign in instead.')
    }
    throw new Error('This email is registered with Google sign-in. Continue with Google.')
  }

  const passwordHash = await hashPassword(password)
  const profile = {
    name: displayName,
    email: normalizedEmail,
    company: emailDomain(normalizedEmail),
    picture: null,
    plan: 'free',
    searchesLeft: CRM_SOLO_FREE_TIER ? 0 : 25,
    authProvider: 'email',
    passwordHash,
  }

  return upsertUser(profile)
}

export async function loginWithEmailPassword({ email, password }) {
  const normalizedEmail = validateEmailAddress(email)
  validatePassword(password)

  const store = await readStore({ only: LOGIN_STORE })
  const existing = (store.users || []).find(
    (u) => String(u.email || '').toLowerCase() === normalizedEmail
  )
  if (!existing) {
    throw new Error('No account found for this email. Create an account first.')
  }

  if (!existing.passwordHash) {
    throw new Error('This account uses Google sign-in. Continue with Google.')
  }

  const ok = await verifyPassword(password, existing.passwordHash)
  if (!ok) throw new Error('Incorrect email or password')

  const now = new Date().toISOString()
  existing.lastLoginAt = now
  existing.authProvider = existing.authProvider || 'email'
  applyPendingInvites(store, existing)

  const persist = persistLastLogin(existing.id, now, existing.authProvider)
  void import('@vercel/functions')
    .then(({ waitUntil }) => waitUntil(persist))
    .catch(() => {
      void persist
    })

  return buildOrgUserResponse(existing, store)
}

/** Optional: set password on Google-only account (not exposed in UI yet). */
export async function setPasswordForUser(userId, password) {
  validatePassword(password, { forSignup: true })
  const passwordHash = await hashPassword(password)
  await updateStorePartial(['users'], (store) => {
    const row = store.users.find((u) => u.id === userId)
    if (!row) throw new Error('User not found')
    row.passwordHash = passwordHash
    return store
  })
}
