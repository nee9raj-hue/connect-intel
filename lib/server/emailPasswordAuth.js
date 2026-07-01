import { upsertUser } from './auth.js'
import { readStore, updateStore } from './store.js'
import { applyPendingInvites } from './organizations.js'
import {
  hashPassword,
  validateEmailAddress,
  validatePassword,
  verifyPassword,
} from './passwordAuth.js'

function emailDomain(email) {
  return String(email || '').split('@')[1]?.toLowerCase() || 'personal'
}

async function readUserByEmail(email) {
  const store = await readStore({ only: ['users'] })
  const normalized = String(email || '').trim().toLowerCase()
  const user = store.users.find((u) => String(u.email || '').toLowerCase() === normalized) || null
  return { store, user }
}

export async function registerWithEmailPassword({ email, password, name }) {
  const normalizedEmail = validateEmailAddress(email)
  validatePassword(password, { forSignup: true })
  const displayName = String(name || '').trim() || normalizedEmail.split('@')[0] || 'User'

  const { user: existing } = await readUserByEmail(normalizedEmail)
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
    searchesLeft: 25,
    authProvider: 'email',
    passwordHash,
  }

  return upsertUser(profile)
}

export async function loginWithEmailPassword({ email, password }) {
  const normalizedEmail = validateEmailAddress(email)
  validatePassword(password)

  const { user: existing } = await readUserByEmail(normalizedEmail)
  if (!existing) {
    throw new Error('No account found for this email. Create an account first.')
  }

  if (!existing.passwordHash) {
    throw new Error('This account uses Google sign-in. Continue with Google.')
  }

  const ok = await verifyPassword(password, existing.passwordHash)
  if (!ok) throw new Error('Incorrect email or password')

  const now = new Date().toISOString()
  await updateStore((store) => {
    const row = store.users.find((u) => u.id === existing.id)
    if (!row) return store
    row.lastLoginAt = now
    row.authProvider = row.authProvider || 'email'
    applyPendingInvites(store, row)
    return store
  })

  return upsertUser({
    email: normalizedEmail,
    name: existing.name,
    company: existing.company,
    picture: existing.picture,
    plan: existing.plan,
    searchesLeft: existing.searchesLeft,
    authProvider: 'email',
  })
}

/** Optional: set password on Google-only account (not exposed in UI yet). */
export async function setPasswordForUser(userId, password) {
  validatePassword(password, { forSignup: true })
  const passwordHash = await hashPassword(password)
  await updateStore((store) => {
    const row = store.users.find((u) => u.id === userId)
    if (!row) throw new Error('User not found')
    row.passwordHash = passwordHash
    return store
  })
}
