import { createId, ONBOARDING_STORE_COLLECTIONS, updateStorePartial } from './store.js'
import { getAppBaseUrl, sendOrgNotificationEmail } from './email.js'
import {
  findCompanyOrganizationByDomain,
  getMembership,
  getOrganization,
  listTeamMembers,
} from './organizations.js'

export function emailDomainFromAddress(email) {
  return String(email || '').split('@')[1]?.trim().toLowerCase() || ''
}

export function listOrgAdminMembers(store, organizationId) {
  const org = getOrganization(store, organizationId)
  if (!org) return []
  return listTeamMembers(store, organizationId).filter((member) => {
    if (member.status === 'inactive') return false
    const membership = getMembership(store, member.userId, organizationId)
    return (
      member.role === 'org_admin' ||
      membership?.role === 'org_admin' ||
      org.ownerUserId === member.userId
    )
  })
}

export function listPendingOrgAccessRequests(store, organizationId) {
  const org = getOrganization(store, organizationId)
  if (!org) return []
  return (org.accessRequests || []).filter((row) => row.status === 'pending')
}

export function buildWorkspaceLookupForUser(store, user) {
  const domain = emailDomainFromAddress(user?.email)
  if (!domain) {
    return { domain: null, companyWorkspaceExists: false }
  }

  const org = findCompanyOrganizationByDomain(store, domain)
  if (!org) {
    return { domain, companyWorkspaceExists: false }
  }

  const membership =
    user?.organizationId === org.id ? getMembership(store, user.id, org.id) : null
  const alreadyMember = Boolean(membership && membership.status !== 'inactive')
  const pendingRequest = (org.accessRequests || []).find(
    (row) => row.userId === user.id && row.status === 'pending'
  )

  return {
    domain,
    companyWorkspaceExists: true,
    organizationId: org.id,
    organizationName: org.name,
    alreadyMember,
    adminContacts: listOrgAdminMembers(store, org.id).map((member) => ({
      name: member.name,
      email: member.email,
    })),
    pendingAccessRequest: Boolean(pendingRequest),
    pendingAccessRequestAt: pendingRequest?.createdAt || null,
  }
}

function upsertPendingAccessRequest(org, user, payload = {}) {
  org.accessRequests = Array.isArray(org.accessRequests) ? org.accessRequests : []
  const now = new Date().toISOString()
  const existing = org.accessRequests.find(
    (row) => row.userId === user.id && row.status === 'pending'
  )

  if (existing) {
    const lastNotifiedAt = existing.lastNotifiedAt || existing.createdAt
    const hoursSinceNotify =
      (Date.now() - new Date(lastNotifiedAt).getTime()) / (1000 * 60 * 60)
    existing.mobile = payload.mobile || existing.mobile || null
    existing.message = payload.message || existing.message || null
    if (hoursSinceNotify < 24) {
      return { request: existing, notifyAdmins: false }
    }
    existing.lastNotifiedAt = now
    return { request: existing, notifyAdmins: true }
  }

  const request = {
    id: createId('access'),
    userId: user.id,
    email: String(user.email || '').trim().toLowerCase(),
    name: user.name || user.email,
    mobile: payload.mobile || null,
    message: payload.message || null,
    status: 'pending',
    createdAt: now,
    lastNotifiedAt: now,
  }
  org.accessRequests.push(request)
  return { request, notifyAdmins: true }
}

export async function submitOrgAccessRequest(userId, payload = {}) {
  let meta = null

  await updateStorePartial(ONBOARDING_STORE_COLLECTIONS, (draft) => {
    const user = draft.users.find((row) => row.id === userId)
    if (!user) throw new Error('User not found')

    const domain = emailDomainFromAddress(user.email)
    const org = findCompanyOrganizationByDomain(draft, domain)
    if (!org) throw new Error('No company workspace exists for your email domain.')

    const existingMembership = getMembership(draft, user.id, org.id)
    if (existingMembership && existingMembership.status !== 'inactive') {
      throw new Error('You are already a member of this workspace.')
    }

    const { request, notifyAdmins } = upsertPendingAccessRequest(org, user, payload)
    meta = { org, user, request, notifyAdmins }
    return draft
  })

  return meta
}

export async function notifyOrgAdminsOfAccessRequest(store, { org, user, request }) {
  const admins = listOrgAdminMembers(store, org.id)
  if (!admins.length) {
    return { notified: 0, error: 'NO_ORG_ADMIN' }
  }

  const appUrl = getAppBaseUrl()
  const teamUrl = `${appUrl}/?panel=team&teamTab=members`
  const subject = `${user.name || user.email} requested access to ${org.name}`
  const text = [
    `${user.name || user.email} (${user.email}) requested to join your Connect Intel workspace.`,
    request.mobile ? `Mobile: ${request.mobile}` : null,
    request.message ? `Message: ${request.message}` : null,
    '',
    `Open Team → Members to send an invite: ${teamUrl}`,
  ]
    .filter(Boolean)
    .join('\n')

  const html = `
    <p><strong>${user.name || user.email}</strong> (${user.email}) requested to join <strong>${org.name}</strong> on Connect Intel.</p>
    ${request.mobile ? `<p>Mobile: ${request.mobile}</p>` : ''}
    ${request.message ? `<p>Message: ${request.message}</p>` : ''}
    <p><a href="${teamUrl}">Open Team → Members</a> to send an invite.</p>
  `

  let notified = 0
  for (const admin of admins) {
    if (!admin.email) continue
    const result = await sendOrgNotificationEmail({
      to: admin.email,
      subject,
      html,
      text,
      replyTo: user.email,
      organizationId: org.id,
      organizationName: org.name,
      senderName: user.name || user.email,
    })
    if (result.sent) notified += 1
  }

  return { notified, adminCount: admins.length }
}

export async function resolveOrgAccessRequest(organizationId, requestId, resolverUserId, status) {
  return updateStorePartial(ONBOARDING_STORE_COLLECTIONS, (draft) => {
    const org = getOrganization(draft, organizationId)
    if (!org) throw new Error('Organization not found')
    const request = (org.accessRequests || []).find((row) => row.id === requestId)
    if (!request) throw new Error('Access request not found')
    request.status = status
    request.resolvedAt = new Date().toISOString()
    request.resolvedBy = resolverUserId
    return draft
  })
}
