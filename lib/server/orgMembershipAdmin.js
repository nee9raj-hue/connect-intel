/**
 * Ops-only org membership fixes (transfer admin, demote mistaken first signup).
 */

import { invalidateSessionUserCache } from './authSessionCache.js'
import { resolveOrganization } from './orgCrmClean.js'
import {
  getMembership,
  getOrganization,
  listTeamMembers,
} from './organizations.js'
import { readStore, updateStorePartial } from './store.js'

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function findUserByEmail(store, email) {
  const needle = normalizeEmail(email)
  if (!needle) return null
  return (store.users || []).find((u) => normalizeEmail(u.email) === needle) || null
}

function findUserByEmailQuery(store, query) {
  const needle = normalizeEmail(query)
  if (!needle) return null
  const exact = findUserByEmail(store, needle)
  if (exact) return exact
  const matches = (store.users || []).filter((u) => normalizeEmail(u.email).includes(needle))
  if (matches.length === 1) return matches[0]
  if (matches.length > 1) {
    throw new Error(`Multiple users match "${query}": ${matches.map((u) => u.email).join(', ')}`)
  }
  return null
}

export async function getOrganizationRoster({ orgId, nameQuery } = {}) {
  const store = await readStore({
    only: ['organizations', 'organizationMemberships', 'users', 'organizationInvites'],
  })
  const org = resolveOrganization(store, { orgId, nameQuery })
  const members = listTeamMembers(store, org.id).map((m) => {
    const membership = getMembership(store, m.userId, org.id)
    return {
      userId: m.userId,
      name: m.name,
      email: m.email,
      role: membership?.role || m.role,
      pipelineRole: m.pipelineRole,
      status: m.status,
      isOwner: org.ownerUserId === m.userId,
      isOrgAdmin: org.ownerUserId === m.userId || membership?.role === 'org_admin',
    }
  })
  const pendingInvites = (store.organizationInvites || [])
    .filter((i) => i.organizationId === org.id && i.status === 'pending')
    .map((i) => ({
      id: i.id,
      email: i.email,
      pipelineRole: i.pipelineRole,
      expiresAt: i.expiresAt,
    }))
  return {
    organization: { id: org.id, name: org.name, ownerUserId: org.ownerUserId || null },
    members,
    pendingInvites,
  }
}

/**
 * Demote current admin/owner and optionally promote another member to org admin.
 * Updates membership.role, pipelineRole, and organizations.ownerUserId.
 */
export async function transferOrgAdmin({
  orgId,
  nameQuery,
  fromEmail,
  toEmail,
  dryRun = true,
} = {}) {
  if (!fromEmail && !toEmail) {
    throw new Error('Provide fromEmail (demote) and/or toEmail (promote).')
  }

  const roster = await getOrganizationRoster({ orgId, nameQuery })
  const orgKey = roster.organization.id
  const store = await readStore({
    only: ['organizations', 'organizationMemberships', 'users'],
  })
  const org = getOrganization(store, orgKey)
  if (!org) throw new Error('Organization not found')

  const fromUser = fromEmail ? findUserByEmailQuery(store, fromEmail) : null
  const toUser = toEmail ? findUserByEmailQuery(store, toEmail) : null

  if (fromEmail && !fromUser) throw new Error(`User not found for fromEmail: ${fromEmail}`)
  if (toEmail && !toUser) throw new Error(`User not found for toEmail: ${toEmail}`)

  const plan = {
    organizationId: org.id,
    organizationName: org.name,
    from: fromUser
      ? { userId: fromUser.id, email: fromUser.email, name: fromUser.name }
      : null,
    to: toUser ? { userId: toUser.id, email: toUser.email, name: toUser.name } : null,
    ownerUserIdAfter: toUser?.id || (fromUser && org.ownerUserId === fromUser.id ? null : org.ownerUserId),
  }

  if (dryRun) {
    return { ok: true, dryRun: true, plan, roster }
  }

  const touchedUserIds = []
  await updateStorePartial(['organizations', 'organizationMemberships', 'users'], (draft) => {
    const orgRow = getOrganization(draft, org.id)
    if (!orgRow) throw new Error('Organization not found')

    if (fromUser) {
      const membership = getMembership(draft, fromUser.id, org.id)
      if (membership) {
        membership.role = 'member'
        membership.pipelineRole = 'member'
        membership.updatedAt = new Date().toISOString()
      }
      if (orgRow.ownerUserId === fromUser.id) {
        orgRow.ownerUserId = toUser?.id || null
      }
      touchedUserIds.push(fromUser.id)
    }

    if (toUser) {
      let membership = getMembership(draft, toUser.id, org.id)
      if (!membership) {
        throw new Error(`${toUser.email} is not a member of ${org.name} — invite them first.`)
      }
      membership.role = 'org_admin'
      membership.pipelineRole = 'org_admin'
      membership.canSearch = true
      membership.status = 'active'
      membership.updatedAt = new Date().toISOString()
      orgRow.ownerUserId = toUser.id
      const userRow = draft.users.find((u) => u.id === toUser.id)
      if (userRow) {
        userRow.organizationId = org.id
        userRow.onboardingComplete = true
        userRow.accountType = 'company'
      }
      touchedUserIds.push(toUser.id)
    }

    return draft
  })

  for (const userId of touchedUserIds) {
    invalidateSessionUserCache(userId)
  }

  const after = await getOrganizationRoster({ orgId: org.id })
  return {
    ok: true,
    dryRun: false,
    plan,
    roster: after,
  }
}
