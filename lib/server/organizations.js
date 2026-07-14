import { createId, readStore, updateStore, updateStorePartial, INVITE_STORE_COLLECTIONS, ONBOARDING_STORE_COLLECTIONS } from './store.js'
import { isWhatsAppCloudConfigured } from './whatsappCloud.js'
import { DEFAULT_TRIAL_CREDITS_PAISE, getAdminEmails } from './config.js'
import { getAiDiscoverySearchesLeft } from './aiSearchQuota.js'
import { mergeLeadForClient, defaultCrm, normalizeCrm } from './crm.js'
import { mergeLeadForTenant, mergeLeadForTenantLight } from './tenantIsolation.js'
import { mergeLeadForClientListMinimal } from './crm.js'
import { buildInviteUrl, createInviteToken, getAppBaseUrl, sendTeamInviteEmail } from './email.js'
import { TEAM_PIPELINE_ROLES } from './pipelineRoles.js'
import { entryHasUserCalendarItem } from '../pipelineCollaborators.js'
import { resolveOrgWorkspaceFeatures, workspaceFeatureEnabled } from './workspaceFeatures.js'
import { getOrgCrmSettings } from './crmWorkflowRules.js'
import { pipelineOwnerUserId, repPipelineEntryVisible, isPipelineLeadUnassigned } from '../pipelineOwner.js'
import { CRM_SOLO_FREE_TIER } from './crmProductFlags.js'
import {
  buildPlanUsage,
  buildUpgradeQuote,
  buildUpgradeQuotes,
  resolvePlanForOrg,
  assertWithinPlanLimits,
} from './crmPlanLimits.js'
import { deferMemberSqlSync } from './orgSqlSync.js'
import { COMPANY_MAILBOX } from './gmailOAuth.js'

function deferOrgSqlSync(organizationId, userId, store) {
  deferMemberSqlSync(organizationId, userId, store)
}

export function isPlatformOperatorUser(user) {
  if (!user) return false
  if (user.role === 'admin') return true
  const email = String(user.email || '').toLowerCase()
  if (email === COMPANY_MAILBOX) return true
  return getAdminEmails().includes(email)
}

export function getOrganization(store, organizationId) {
  return store.organizations.find((o) => o.id === organizationId) || null
}

export function findCompanyOrganizationByDomain(store, domain) {
  const needle = String(domain || '')
    .trim()
    .toLowerCase()
  if (!needle) return null
  return (
    store.organizations.find(
      (org) =>
        org.accountType === 'company' &&
        String(org.domain || '')
          .trim()
          .toLowerCase() === needle
    ) || null
  )
}

export function getMembership(store, userId, organizationId) {
  return store.organizationMemberships.find(
    (m) => m.userId === userId && m.organizationId === organizationId
  )
}

/** Company admin or sales manager — org-wide pipeline management. */
export function isCompanyPipelineManager(user, store = null) {
  if (Boolean(user?.isOrgAdmin || user?.orgRole === 'org_admin')) return true
  if (String(user?.pipelineRole || '').toLowerCase() === 'manager') return true
  if (store && user?.id && user?.organizationId) {
    const membership = getMembership(store, user.id, user.organizationId)
    if (String(membership?.pipelineRole || '').toLowerCase() === 'manager') return true
  }
  return false
}

function isPipelineLeadOwner(user, entry) {
  if (!user?.id || !entry) return false
  return String(entry.assignedToUserId || '') === String(user.id)
}

/** Admins/managers, assignees reassigning their lead, or reps claiming unassigned leads. */
export function canAssignLead(user, entry, assignToUserId = undefined) {
  if (!user?.organizationId || user.accountType !== 'company') return false
  if (isCompanyPipelineManager(user)) return true
  if (!entry) return false
  if (isPipelineLeadOwner(user, entry)) {
    if (assignToUserId === undefined) return true
    return true
  }
  if (!entry.assignedToUserId) {
    if (assignToUserId === undefined) return true
    return String(assignToUserId) === String(user.id)
  }
  return false
}

export function resolveOrgRole(user, store) {
  if (!user.organizationId) return { orgRole: 'individual', accountType: 'individual' }
  const org = getOrganization(store, user.organizationId)
  const membership = getMembership(store, user.id, user.organizationId)
  const accountType = org?.accountType || user.accountType || 'individual'
  let orgRole = membership?.role || 'member'
  if (orgRole === 'admin') orgRole = 'org_admin'
  if (org?.ownerUserId === user.id) orgRole = 'org_admin'
  return { orgRole, accountType, org, membership }
}

export function buildOrgUserResponse(user, store) {
  const { orgRole, accountType, org, membership } = resolveOrgRole(user, store)
  const isPlatformAdmin = isPlatformOperatorUser(user)
  const isCompanyAdmin = orgRole === 'org_admin' && accountType === 'company'

  const workspace = org ? resolveOrgWorkspaceFeatures(store, org) : null
  const { passwordHash: _passwordHash, ...publicUser } = user || {}

  const base = {
    ...publicUser,
    accountType,
    orgRole,
    isPlatformAdmin,
    /** Company customer admin (team, org pipeline) — not the Connect Intel platform operator. */
    isOrgAdmin: isCompanyAdmin,
    canSearch:
      !CRM_SOLO_FREE_TIER &&
      (isPlatformAdmin ||
        accountType === 'individual' ||
        orgRole === 'org_admin' ||
        Boolean(membership?.canSearch)),
    organizationName: isPlatformAdmin && !org ? 'Connect Intel' : org?.name || user.company,
    organizationLogoUrl: org?.logoUrl || null,
    mobile: user.mobile || null,
    mobileE164: user.mobileE164 || null,
    orgEmailDomain: org?.emailDomain?.name || null,
    orgOutboundEmailReady: String(org?.emailDomain?.status || '').toLowerCase() === 'verified',
    whatsappAutoSendReady: isWhatsAppCloudConfigured(user, store),
    subscriptionActive: CRM_SOLO_FREE_TIER
      ? false
      : Boolean(user.subscriptionActive || org?.subscriptionActive),
    crmFreeMode: true,
    plan: org ? resolvePlanForOrg(org).id : CRM_SOLO_FREE_TIER ? 'free' : publicUser.plan || 'free',
    subscriptionPlan: org
      ? resolvePlanForOrg(org).label
      : CRM_SOLO_FREE_TIER
        ? 'Free'
        : publicUser.subscriptionPlan || publicUser.plan || 'free',
    prospectCredits: CRM_SOLO_FREE_TIER
      ? 0
      : Math.max(0, Math.floor((user.creditsPaise ?? 0) / 100)),
    creditBalanceRupees: CRM_SOLO_FREE_TIER
      ? 0
      : Number(((user.creditsPaise ?? 0) / 100).toFixed(2)),
    aiDiscoverySearchesLeft: CRM_SOLO_FREE_TIER ? 0 : getAiDiscoverySearchesLeft(user),
    searchesLeft: CRM_SOLO_FREE_TIER ? 0 : (user.searchesLeft ?? org?.searchesLeft ?? 0),
    seatLimit: resolvePlanForOrg(org).maxSeats,
    leadLimit: resolvePlanForOrg(org).maxLeads,
    planTier: org?.planTier || 'free',
    planUsage: org ? buildPlanUsage(store, org, user) : null,
    upgradeQuote: org ? buildUpgradeQuote(org) : null,
    upgradeQuotes: org ? buildUpgradeQuotes(org) : [],
    pendingPayment: org?.pendingPayment || null,
    pipelineRole: normalizePipelineRole(
      membership?.pipelineRole || (orgRole === 'org_admin' ? 'org_admin' : 'member')
    ),
    marketingRole: membership?.marketingRole || null,
    onboardingComplete: isPlatformAdmin || Boolean(user.onboardingComplete ?? org?.onboardingComplete),
    assignedLeadCount:
      store.savedLeads?.filter(
        (e) =>
          e.organizationId === user.organizationId &&
          e.assignedToUserId === user.id
      ).length || 0,
    workspacePreset: workspace?.presetId ?? 'general_crm',
    workspaceFeatures: workspace?.features ?? {},
    workspacePageTitle:
      org?.workspacePageTitle?.trim() ||
      (org?.name ? `${org.name} Workspace` : 'Company Workspace'),
    companyWorkspaceEnabled: workspaceFeatureEnabled(workspace, 'companyWorkspacePage'),
    orgCrmSettings: org ? getOrgCrmSettings(store, org.id) : null,
  }

  return base
}

function memberCanSeePipelineEntry(entry, user, { orgRole, visibleOwnerIds }) {
  if (!entry) return false
  const owner = pipelineOwnerUserId(entry)
  if (orgRole === 'org_admin') return true
  if (!owner) return isPipelineLeadUnassigned(entry)
  if (Array.isArray(visibleOwnerIds) && visibleOwnerIds.length) {
    return new Set(visibleOwnerIds.map(String)).has(owner)
  }
  return repPipelineEntryVisible(entry, user.id)
}

export function listPipelineSavedEntries(store, user, options = {}) {
  const { orgRole, accountType } = resolveOrgRole(user, store)
  const savedLeads = Array.isArray(store?.savedLeads) ? store.savedLeads : []
  const visibleOwnerIds = options.visibleOwnerIds

  if (accountType === 'individual' || !user.organizationId) {
    return savedLeads.filter((e) => e.userId === user.id)
  }

  const inOrg = (e) => e.organizationId === user.organizationId

  let entries
  if (orgRole === 'org_admin') {
    entries = savedLeads.filter(inOrg)
  } else if (Array.isArray(visibleOwnerIds) && visibleOwnerIds.length) {
    entries = savedLeads.filter(
      (e) => inOrg(e) && memberCanSeePipelineEntry(e, user, { orgRole, visibleOwnerIds })
    )
  } else {
    entries = savedLeads.filter(
      (e) => inOrg(e) && repPipelineEntryVisible(e, user.id)
    )
  }

  // Rows saved before organizationId was stamped on pipeline entries
  const memberIds = new Set(listTeamMembers(store, user.organizationId).map((m) => m.userId))
  const legacy = savedLeads.filter((e) => {
    if (e.organizationId) return false
    if (orgRole === 'org_admin') {
      return (
        memberIds.has(e.userId) ||
        memberIds.has(e.savedByUserId) ||
        memberIds.has(e.assignedToUserId)
      )
    }
    return (
      e.assignedToUserId === user.id || e.userId === user.id || e.savedByUserId === user.id
    )
  })
  const seen = new Set(entries.map((e) => e.id))
  for (const row of legacy) {
    if (!seen.has(row.id)) {
      entries.push(row)
      seen.add(row.id)
    }
  }
  return entries
}

/** Pipeline rows visible on CRM calendar (assignee + task/meeting participants). */
export function listCalendarPipelineEntries(store, user) {
  const { orgRole, accountType } = resolveOrgRole(user, store)
  const savedLeads = Array.isArray(store?.savedLeads) ? store.savedLeads : []

  if (accountType === 'individual' || !user.organizationId) {
    return savedLeads.filter((e) => e.userId === user.id)
  }
  if (orgRole === 'org_admin') {
    return savedLeads.filter((e) => e.organizationId === user.organizationId)
  }
  return savedLeads.filter(
    (e) =>
      e.organizationId === user.organizationId &&
      (e.assignedToUserId === user.id || entryHasUserCalendarItem(e, user.id))
  )
}

export function listPipelinePage(
  store,
  user,
  { light = false, limit = 0, offset = 0, entries: prefiltered } = {}
) {
  const entries = (prefiltered || listPipelineSavedEntries(store, user)).slice()
  const total = entries.length
  entries.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())

  const off = Math.max(0, Number(offset) || 0)
  const lim = Number(limit) > 0 ? Math.floor(Number(limit)) : 0
  const page =
    lim > 0 ? entries.slice(off, off + lim) : off > 0 ? entries.slice(off) : entries

  let leads
  if (light) {
    leads = page.map((entry) => ({
      ...mergeLeadForClientListMinimal(entry),
      assignedToUserId: entry.assignedToUserId || null,
      savedByUserId: entry.savedByUserId || entry.userId,
    }))
  } else {
    const merge = mergeLeadForTenant
    leads = page.map((entry) => ({
      ...merge(store, user, entry),
      assignedToUserId: entry.assignedToUserId || null,
      savedByUserId: entry.savedByUserId || entry.userId,
    }))
  }

  return { leads, total }
}

export function listPipelineEntries(store, user, { light = false, limit = 0, offset = 0 } = {}) {
  return listPipelinePage(store, user, { light, limit, offset }).leads
}

export function countPipelineEntries(store, user) {
  return listPipelineSavedEntries(store, user).length
}

export function getPipelineLeadIds(store, user) {
  return new Set(
    listPipelineSavedEntries(store, user)
      .map((e) => e.lead?.id)
      .filter(Boolean)
  )
}

export function getOrganizationPipelineLeadIds(store, organizationId) {
  if (!organizationId) return new Set()
  return new Set(
    store.savedLeads.filter((e) => e.organizationId === organizationId).map((e) => e.lead.id)
  )
}

export async function completeOnboarding(userId, payload) {
  const store = await updateStorePartial(ONBOARDING_STORE_COLLECTIONS, (store) => {
    const user = store.users.find((u) => u.id === userId)
    if (!user) throw new Error('User not found')

    const accountType = payload.accountType === 'company' ? 'company' : 'individual'
    const now = new Date().toISOString()

    if (payload.mobileE164) {
      user.mobileE164 = payload.mobileE164
      user.mobile = payload.mobile || payload.mobileE164
    }

    if (accountType === 'company') {
      const domain = (user.email.split('@')[1] || '').trim().toLowerCase()
      if (domain) {
        const existingOrg = findCompanyOrganizationByDomain(store, domain)
        if (existingOrg) {
          throw new Error(
            `A company workspace already exists for @${domain}. Ask your admin for an invite — signing up as Company again creates a duplicate workspace.`
          )
        }
      }

      const org = {
        id: createId('org'),
        name: payload.companyName || user.company || 'My Company',
        logoUrl: payload.logoUrl || null,
        domain: user.email.split('@')[1] || 'company',
        accountType: 'company',
        ownerUserId: userId,
        adminMobileE164: payload.adminMobileE164 || payload.mobileE164 || null,
        creditsPaise: CRM_SOLO_FREE_TIER ? 0 : DEFAULT_TRIAL_CREDITS_PAISE,
        searchesLeft: CRM_SOLO_FREE_TIER ? 0 : 100,
        onboardingComplete: true,
        createdAt: now,
        workspacePreset: 'general_crm',
        workspaceFeatures: {},
        planTier: 'free',
      }
      store.organizations.push(org)
      user.organizationId = org.id
      user.company = org.name
      user.accountType = 'company'
      user.onboardingComplete = true

      store.organizationMemberships.push({
        id: createId('membership'),
        userId: user.id,
        organizationId: org.id,
        role: 'org_admin',
        pipelineRole: 'org_admin',
        canSearch: true,
        status: 'active',
        createdAt: now,
      })
    } else {
      user.onboardingComplete = true
      user.accountType = 'individual'
    }

    return store
  })

  const user = store.users.find((u) => u.id === userId)
  if (user?.organizationId && user.accountType === 'company') {
    deferOrgSqlSync(user.organizationId, userId, store)
  }

  return store
}

function normalizePipelineRole(role) {
  const value = String(role || 'member').toLowerCase()
  // Legacy "sales" limited sidebar to early funnel; treat as member everywhere.
  if (value === 'sales') return 'member'
  if (value === 'manager') return 'manager'
  if (value === 'org_admin') return 'org_admin'
  return 'member'
}

function roleLabel(pipelineRole) {
  return TEAM_PIPELINE_ROLES.find((r) => r.id === pipelineRole)?.label || 'Team member'
}

export async function inviteTeamMember(organizationId, inviterUserId, options = {}) {
  const normalizedEmail = String(options.email || '').trim().toLowerCase()
  if (!normalizedEmail) throw new Error('Email is required')

  const pipelineRole = normalizePipelineRole(options.pipelineRole)
  const canSearch =
    options.canSearch !== undefined ? Boolean(options.canSearch) : pipelineRole !== 'org_admin'
  const name = options.name || ''

  const store = await updateStorePartial(INVITE_STORE_COLLECTIONS, (draft) => {
    const org = getOrganization(draft, organizationId)
    if (!org) throw new Error('Organization not found')

    const existingUser = draft.users.find((u) => u.email === normalizedEmail)
    const alreadyMember = existingUser && getMembership(draft, existingUser.id, organizationId)
    if (!alreadyMember) {
      assertWithinPlanLimits(draft, org, { extraSeats: 1 })
    }
    const now = new Date().toISOString()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const token = createInviteToken()

    if (existingUser) {
      const already = getMembership(draft, existingUser.id, organizationId)
      if (!already) {
        draft.organizationMemberships.push({
          id: createId('membership'),
          userId: existingUser.id,
          organizationId,
          role: 'member',
          pipelineRole,
          canSearch,
          status: 'active',
          invitedBy: inviterUserId,
          createdAt: now,
        })
        existingUser.organizationId = organizationId
        existingUser.onboardingComplete = true
      }
    } else {
      draft.organizationInvites = draft.organizationInvites || []
      const prior = draft.organizationInvites.find(
        (i) => i.organizationId === organizationId && i.email === normalizedEmail && i.status === 'pending'
      )
      if (prior) {
        prior.token = token
        prior.expiresAt = expiresAt
        prior.canSearch = canSearch
        prior.pipelineRole = pipelineRole
        prior.invitedBy = inviterUserId
      } else {
        draft.organizationInvites.push({
          id: createId('invite'),
          organizationId,
          email: normalizedEmail,
          name,
          token,
          expiresAt,
          pipelineRole,
          canSearch,
          invitedBy: inviterUserId,
          status: 'pending',
          createdAt: now,
        })
      }
    }

    for (const row of org.accessRequests || []) {
      if (
        row.status === 'pending' &&
        String(row.email || '')
          .trim()
          .toLowerCase() === normalizedEmail
      ) {
        row.status = 'invited'
        row.resolvedAt = now
        row.resolvedBy = inviterUserId
      }
    }

    return draft
  })

  const org = getOrganization(store, organizationId)
  const inviter = store.users.find((u) => u.id === inviterUserId)
  const invite = (store.organizationInvites || []).find(
    (i) => i.organizationId === organizationId && i.email === normalizedEmail && i.status === 'pending'
  )

  const inviteUrl = invite?.token ? buildInviteUrl(invite.token) : null
  const joinedImmediately = !invite?.token

  const emailParams = {
    to: normalizedEmail,
    inviterName: inviter?.name,
    inviterEmail: inviter?.email,
    organizationName: org?.name || 'your company',
    organizationId,
    inviteUrl: inviteUrl || getAppBaseUrl(),
    roleLabel: roleLabel(invite?.pipelineRole || pipelineRole),
    existingAccount: joinedImmediately,
    store,
    skipDeliveryStatusCheck: true,
  }

  if (options.skipEmail) {
    if (joinedImmediately) {
      const member = store.users.find((u) => u.email === normalizedEmail)
      if (member?.organizationId === organizationId) {
        deferOrgSqlSync(organizationId, member.id, store)
      }
    }
    return { store, inviteUrl, joinedImmediately, emailParams }
  }

  const emailResult = await sendTeamInviteEmail(emailParams)

  if (joinedImmediately) {
    const member = store.users.find((u) => u.email === normalizedEmail)
    if (member?.organizationId === organizationId) {
      deferOrgSqlSync(organizationId, member.id, store)
    }
  }

  return { store, inviteUrl, email: emailResult, joinedImmediately }
}

export function findInviteByToken(store, token) {
  return (store.organizationInvites || []).find(
    (i) => i.token === token && i.status === 'pending'
  )
}

export function acceptInviteForUser(store, user, token) {
  const invite = findInviteByToken(store, token)
  if (!invite) return { store, accepted: false, reason: 'Invite not found or already used' }

  if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
    invite.status = 'expired'
    return { store, accepted: false, reason: 'Invite link has expired' }
  }

  if (user.email !== invite.email) {
    return {
      store,
      accepted: false,
      reason: `Sign in with ${invite.email} to accept this invitation`,
    }
  }

  const existing = getMembership(store, user.id, invite.organizationId)
  if (!existing) {
    store.organizationMemberships.push({
      id: createId('membership'),
      userId: user.id,
      organizationId: invite.organizationId,
      role: 'member',
      pipelineRole: invite.pipelineRole || 'member',
      canSearch: Boolean(invite.canSearch),
      status: 'active',
      invitedBy: invite.invitedBy,
      createdAt: new Date().toISOString(),
    })
  }

  user.organizationId = invite.organizationId
  user.onboardingComplete = true
  user.accountType = 'company'
  invite.status = 'accepted'
  invite.acceptedAt = new Date().toISOString()

  return { store, accepted: true, organizationId: invite.organizationId }
}

export function applyPendingInvites(store, user) {
  const invites = (store.organizationInvites || []).filter(
    (i) => i.email === user.email && i.status === 'pending'
  )
  for (const invite of invites) {
    store.organizationMemberships.push({
      id: createId('membership'),
      userId: user.id,
      organizationId: invite.organizationId,
      role: 'member',
      pipelineRole: invite.pipelineRole || 'member',
      canSearch: invite.canSearch,
      status: 'active',
      invitedBy: invite.invitedBy,
      createdAt: new Date().toISOString(),
    })
    user.organizationId = invite.organizationId
    user.onboardingComplete = true
    invite.status = 'accepted'
  }
  return store
}

export async function assignLeadToMember(organizationId, leadId, assignToUserId, actorUserId) {
  return updateStore((store) => {
    const entry = store.savedLeads.find(
      (e) => e.organizationId === organizationId && e.lead.id === leadId
    )
    if (!entry) throw new Error('Lead not in pipeline')

    const member = getMembership(store, assignToUserId, organizationId)
    if (!member) throw new Error('Assignee is not in your team')

    entry.assignedToUserId = assignToUserId
    entry.assignedAt = new Date().toISOString()
    entry.assignedByUserId = actorUserId
    return store
  })
}

export async function updateOrganizationBranding(organizationId, { name, logoUrl }) {
  return updateStore((store) => {
    const org = getOrganization(store, organizationId)
    if (!org) throw new Error('Organization not found')
    if (name) org.name = name
    if (logoUrl !== undefined) org.logoUrl = logoUrl
    return store
  })
}

const MARKETING_ROLE_VALUES = new Set([
  'marketing_manager',
  'marketing_executive',
  'marketing_readonly',
  null,
  '',
])

export async function updateMemberPermissions(
  organizationId,
  memberUserId,
  { canSearch, pipelineRole, marketingRole }
) {
  return updateStore((store) => {
    const membership = getMembership(store, memberUserId, organizationId)
    if (!membership) throw new Error('Member not found')
    if (canSearch !== undefined) membership.canSearch = Boolean(canSearch)
    if (pipelineRole !== undefined) membership.pipelineRole = normalizePipelineRole(pipelineRole)
    if (marketingRole !== undefined) {
      const role = marketingRole ? String(marketingRole).trim() : null
      membership.marketingRole = MARKETING_ROLE_VALUES.has(role) ? role || null : membership.marketingRole
    }
    return store
  })
}

export async function updateMemberStatus(organizationId, memberUserId, status) {
  const next = status === 'inactive' ? 'inactive' : 'active'
  return updateStore((store) => {
    const membership = getMembership(store, memberUserId, organizationId)
    if (!membership) throw new Error('Member not found')
    if (membership.role === 'org_admin' && next === 'inactive') {
      throw new Error('Cannot deactivate the organization owner')
    }
    membership.status = next
    membership.updatedAt = new Date().toISOString()
    return store
  })
}

export function listTeamMembers(store, organizationId) {
  const org = getOrganization(store, organizationId)
  const memberships = store.organizationMemberships.filter((m) => m.organizationId === organizationId)
  const members = memberships.map((m) => {
    const u = store.users.find((user) => user.id === m.userId)
    return {
      id: m.id,
      userId: m.userId,
      name: u?.name || 'Member',
      email: u?.email,
      role: m.role,
      pipelineRole: m.pipelineRole || 'member',
      marketingRole: m.marketingRole || null,
      canSearch: Boolean(m.canSearch),
      status: m.status || 'active',
    }
  })
  if (org?.ownerUserId && !members.some((m) => m.userId === org.ownerUserId)) {
    const owner = store.users.find((u) => u.id === org.ownerUserId)
    members.unshift({
      id: `owner_${org.ownerUserId}`,
      userId: org.ownerUserId,
      name: owner?.name || owner?.email || 'Owner',
      email: owner?.email,
      role: 'org_admin',
      pipelineRole: 'org_admin',
      marketingRole: 'marketing_manager',
      canSearch: true,
      status: 'active',
    })
  }
  return members
}

export function getExcludedPipelineLeadIds(store, user) {
  const { accountType } = resolveOrgRole(user, store)
  if (user.organizationId && accountType === 'company') {
    return getOrganizationPipelineLeadIds(store, user.organizationId)
  }
  return getPipelineLeadIds(store, user)
}

export function consumeOrgSearchQuota(store, user) {
  const { orgRole, accountType, org, membership } = resolveOrgRole(user, store)

  if (accountType === 'individual' || !org) {
    return { store, user, billing: 'user' }
  }

  if (orgRole !== 'org_admin' && !membership?.canSearch) {
    throw new Error('Your admin has not enabled lead search for your account.')
  }

  const left = org.searchesLeft ?? 100
  if (left <= 0) {
    throw new Error('No searches remaining on your company plan.')
  }

  org.searchesLeft = left - 1
  user.searchesLeft = org.searchesLeft

  return { store, user: { ...user, searchesLeft: org.searchesLeft }, billing: 'organization' }
}
