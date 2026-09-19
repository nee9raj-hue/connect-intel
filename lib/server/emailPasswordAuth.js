import { findAuthUserByEmail } from './storeUserLookup.js'
import { upsertUser } from './auth.js'
import { updateStorePartial } from './store.js'
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

export async function registerWithEmailPassword({ email, password, name }) {
  const normalizedEmail = validateEmailAddress(email)
  validatePassword(password, { forSignup: true })
  const displayName = String(name || '').trim() || normalizedEmail.split('@')[0] || 'User'

  const looked = await findAuthUserByEmail(normalizedEmail)
  if (looked?.user) {
    if (looked.user.passwordHash) {
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

  const looked = await findAuthUserByEmail(normalizedEmail)
  const existing = looked?.user
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
  const store = {
    users: [existing],
    organizations: looked.organization ? [looked.organization] : [],
    organizationMemberships: looked.memberships || [],
  }
  applyPendingInvites(store, existing)
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
