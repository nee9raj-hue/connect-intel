import { createId } from './store.js'
import { buildOrgUserResponse, findCompanyOrganizationByDomain, getOrganization, getMembership, listTeamMembers } from './organizations.js'
import { grantOrgAdminOnStore } from './orgMembershipAdmin.js'
import { emailDomainFromAddress } from './orgWorkspaceAccess.js'
import { getAdminEmails } from './config.js'
import { listTicketsForUser, supportTicketMetrics } from './supportTickets.js'

const ADMIN_EMAILS = new Set(getAdminEmails())

function isOperatorEmail(email) {
  return ADMIN_EMAILS.has(String(email || '').toLowerCase())
}

function userDisplayName(user) {
  return user?.name || user?.email?.split('@')[0] || 'User'
}

export function recordAdminAudit(store, { actorUserId, actorEmail, action, targetType, targetId, detail }) {
  store.adminAuditLog = store.adminAuditLog || []
  store.adminAuditLog.push({
    id: createId('audit'),
    actorUserId,
    actorEmail,
    action,
    targetType,
    targetId,
    detail: detail || null,
    createdAt: new Date().toISOString(),
  })
  store.adminAuditLog = store.adminAuditLog.slice(-2000)
}

export function buildSupportOverview(store) {
  const now = Date.now()
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000
  const customers = (store.users || []).filter((u) => u.role !== 'admin' && !isOperatorEmail(u.email))
  const orgs = store.organizations || []
  const activeWeek = customers.filter((u) => u.lastLoginAt && new Date(u.lastLoginAt).getTime() > weekAgo)
  const lowCredits = customers.filter((u) => (u.creditsPaise ?? 0) < 500)
  const pendingOnboarding = customers.filter((u) => !u.onboardingComplete)
  const unlocksToday = (store.leadUnlocks || []).filter((u) => {
    const t = new Date(u.createdAt || 0).getTime()
    return t > now - 24 * 60 * 60 * 1000
  }).length

  const recentAudit = (store.adminAuditLog || [])
    .slice(-12)
    .reverse()
    .map((row) => ({
      id: row.id,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      actorEmail: row.actorEmail,
      createdAt: row.createdAt,
    }))

  const ticketMetrics = supportTicketMetrics(store)

  return {
    metrics: {
      totalUsers: customers.length,
      totalOrganizations: orgs.length,
      activeUsers7d: activeWeek.length,
      lowCreditUsers: lowCredits.length,
      pendingOnboarding: pendingOnboarding.length,
      unlocks24h: unlocksToday,
      totalPipelineLeads: (store.savedLeads || []).filter((e) => e.organizationId || e.userId).length,
      pendingInvites: (store.organizationInvites || []).filter((i) => i.status === 'pending').length,
      supportTicketsActive: ticketMetrics.active,
      supportTicketsOverdue: ticketMetrics.overdue,
      supportTicketsOpen24h: ticketMetrics.openLast24h,
    },
    ticketMetrics,
    recentAudit,
  }
}

function usageForUser(store, user) {
  const orgId = user.organizationId
  const pipelineLeads = (store.savedLeads || []).filter((e) => {
    if (orgId) return e.organizationId === orgId && (e.userId === user.id || e.savedByUserId === user.id || e.assignedToUserId === user.id)
    return e.userId === user.id && !e.organizationId
  }).length
  const unlocks = (store.leadUnlocks || []).filter((u) => u.userId === user.id).length
  const searches = (store.searches || []).filter((s) => s.userId === user.id).length
  return { pipelineLeads, unlocks, searches }
}

function paymentSummary(store, user) {
  const ledger = (store.creditLedger || []).filter((e) => e.userId === user.id)
  const grants = ledger.filter((e) => e.kind === 'grant' || e.kind === 'adjustment')
  const lastGrant = grants.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
  const org = user.organizationId ? getOrganization(store, user.organizationId) : null
  return {
    plan: user.plan || 'free',
    subscriptionActive: Boolean(user.subscriptionActive || org?.subscriptionActive),
    billingNote: user.billingNote || org?.billingNote || null,
    lastCreditGrant: lastGrant
      ? { amountPaise: lastGrant.amountPaise, description: lastGrant.description, createdAt: lastGrant.createdAt }
      : null,
    paymentGateway: 'Manual / support — no live gateway yet',
  }
}

export function searchCustomers(store, { q = '', limit = 50 } = {}) {
  const needle = String(q || '').trim().toLowerCase()
  let users = (store.users || []).filter((u) => u.role !== 'admin' && !isOperatorEmail(u.email))

  if (needle) {
    users = users.filter((u) => {
      const org = u.organizationId ? getOrganization(store, u.organizationId) : null
      const hay = [u.email, u.name, u.company, u.id, org?.name, u.organizationId].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(needle)
    })
  }

  return users
    .sort((a, b) => new Date(b.lastLoginAt || b.createdAt) - new Date(a.lastLoginAt || a.createdAt))
    .slice(0, limit)
    .map((u) => customerListRow(store, u))
}

function customerListRow(store, user) {
  const enriched = buildOrgUserResponse(user, store)
  const org = user.organizationId ? getOrganization(store, user.organizationId) : null
  const usage = usageForUser(store, user)
  return {
    id: user.id,
    email: user.email,
    name: userDisplayName(user),
    accountType: enriched.accountType,
    organizationId: user.organizationId,
    organizationName: org?.name || null,
    creditsPaise: user.creditsPaise ?? 0,
    creditBalanceRupees: enriched.creditBalanceRupees,
    canSearch: enriched.canSearch,
    onboardingComplete: enriched.onboardingComplete,
    subscriptionActive: enriched.subscriptionActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    pipelineLeads: usage.pipelineLeads,
    isOrgAdmin: enriched.isOrgAdmin,
  }
}

export function getCustomerDetail(store, userId) {
  const user = store.users.find((u) => u.id === userId)
  if (!user || user.role === 'admin') return null

  const enriched = buildOrgUserResponse(user, store)
  const org = user.organizationId ? getOrganization(store, user.organizationId) : null
  const membership = user.organizationId ? getMembership(store, user.id, user.organizationId) : null
  const usage = usageForUser(store, user)
  const ledger = (store.creditLedger || [])
    .filter((e) => e.userId === user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 25)

  const members = org ? listTeamMembers(store, org.id) : []
  const domainOrg =
    !user.organizationId && user.email
      ? findCompanyOrganizationByDomain(store, emailDomainFromAddress(user.email))
      : null

  return {
    user: {
      id: user.id,
      email: user.email,
      name: userDisplayName(user),
      company: user.company,
      mobile: user.mobileE164 || user.mobile,
      plan: user.plan || 'free',
      role: user.role,
      accountType: enriched.accountType,
      orgRole: enriched.orgRole,
      isOrgAdmin: enriched.isOrgAdmin,
      organizationId: user.organizationId,
      organizationName: org?.name || null,
      creditsPaise: user.creditsPaise ?? 0,
      creditBalanceRupees: enriched.creditBalanceRupees,
      searchesLeft: user.searchesLeft ?? 0,
      aiDiscoverySearchesLeft: user.aiDiscoverySearchesLeft ?? enriched.aiDiscoverySearchesLeft,
      canSearch: enriched.canSearch,
      membershipCanSearch: membership?.canSearch ?? null,
      pipelineRole: membership?.pipelineRole || null,
      onboardingComplete: enriched.onboardingComplete,
      subscriptionActive: enriched.subscriptionActive,
      billingNote: user.billingNote || null,
      crmGmailConnected: Boolean(user.crmGmailOAuth?.refreshToken || user.gmailOAuth?.refreshToken),
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    },
    organization: org
      ? {
          id: org.id,
          name: org.name,
          searchesLeft: org.searchesLeft ?? 0,
          subscriptionActive: Boolean(org.subscriptionActive),
          onboardingComplete: Boolean(org.onboardingComplete),
          emailDomainStatus: org.emailDomain?.status || null,
          memberCount: members.length,
        }
      : null,
    matchedOrganization: domainOrg
      ? { id: domainOrg.id, name: domainOrg.name, domain: domainOrg.domain }
      : null,
    usage,
    payment: paymentSummary(store, user),
    creditLedger: ledger,
    teamMembers: members,
    supportTickets: listTicketsForUser(store, user.id, { limit: 12 }),
  }
}

export function searchOrganizations(store, { q = '', limit = 40 } = {}) {
  const needle = String(q || '').trim().toLowerCase()
  let orgs = store.organizations || []
  if (needle) {
    orgs = orgs.filter((o) => {
      const owner = store.users.find((u) => u.id === o.ownerUserId)
      const hay = [o.name, o.id, o.domain, owner?.email].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(needle)
    })
  }
  return orgs
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, limit)
    .map((org) => orgListRow(store, org))
}

function orgListRow(store, org) {
  const members = listTeamMembers(store, org.id)
  const pipelineCount = (store.savedLeads || []).filter((e) => e.organizationId === org.id).length
  const owner = store.users.find((u) => u.id === org.ownerUserId)
  return {
    id: org.id,
    name: org.name,
    domain: org.domain,
    ownerEmail: owner?.email || null,
    memberCount: members.length,
    pipelineLeads: pipelineCount,
    searchesLeft: org.searchesLeft ?? 0,
    subscriptionActive: Boolean(org.subscriptionActive),
    onboardingComplete: Boolean(org.onboardingComplete),
    createdAt: org.createdAt,
  }
}

export function getOrganizationDetail(store, organizationId) {
  const org = getOrganization(store, organizationId)
  if (!org) return null
  const members = listTeamMembers(store, org.id)
  const users = members
    .map((m) => store.users.find((u) => u.id === m.userId))
    .filter(Boolean)
    .map((u) => customerListRow(store, u))
  const pipelineCount = (store.savedLeads || []).filter((e) => e.organizationId === org.id).length
  return {
    organization: {
      id: org.id,
      name: org.name,
      domain: org.domain,
      logoUrl: org.logoUrl,
      searchesLeft: org.searchesLeft ?? 0,
      creditsPaise: org.creditsPaise ?? 0,
      subscriptionActive: Boolean(org.subscriptionActive),
      onboardingComplete: Boolean(org.onboardingComplete),
      billingNote: org.billingNote || null,
      emailDomainStatus: org.emailDomain?.status || null,
      emailDomainName: org.emailDomain?.name || null,
      createdAt: org.createdAt,
      pipelineLeads: pipelineCount,
    },
    members: users,
    pendingInvites: (store.organizationInvites || [])
      .filter((i) => i.organizationId === org.id && i.status === 'pending')
      .map((i) => ({ id: i.id, email: i.email, createdAt: i.createdAt, expiresAt: i.expiresAt })),
  }
}

export function applyCustomerSupportAction(store, { actor, userId, action, payload = {} }) {
  const user = store.users.find((u) => u.id === userId)
  if (!user || user.role === 'admin') throw new Error('Customer not found')

  const now = new Date().toISOString()
  let auditDetail = { action, ...payload }

  switch (action) {
    case 'grant_credits': {
      const amountPaise = Math.round(Number(payload.amountPaise) || 0)
      if (amountPaise <= 0 || amountPaise > 500000) throw new Error('Invalid credit amount')
      user.creditsPaise = (user.creditsPaise ?? 0) + amountPaise
      store.creditLedger.push({
        id: createId('credit'),
        userId: user.id,
        kind: 'grant',
        amountPaise,
        description: payload.reason || 'Platform admin credit grant',
        createdBy: actor.id,
        createdAt: now,
      })
      auditDetail = { amountPaise, reason: payload.reason }
      break
    }
    case 'set_credits': {
      const creditsPaise = Math.max(0, Math.round(Number(payload.creditsPaise) || 0))
      const delta = creditsPaise - (user.creditsPaise ?? 0)
      user.creditsPaise = creditsPaise
      store.creditLedger.push({
        id: createId('credit'),
        userId: user.id,
        kind: 'adjustment',
        amountPaise: delta,
        description: payload.reason || 'Platform admin balance set',
        createdBy: actor.id,
        createdAt: now,
      })
      auditDetail = { creditsPaise, reason: payload.reason }
      break
    }
    case 'reset_ai_quota':
      user.aiDiscoverySearchesLeft = 10
      break
    case 'force_onboarding':
      user.onboardingComplete = true
      if (user.organizationId) {
        const org = getOrganization(store, user.organizationId)
        if (org) org.onboardingComplete = true
      }
      break
    case 'set_subscription': {
      user.subscriptionActive = Boolean(payload.active)
      if (payload.plan) user.plan = String(payload.plan).slice(0, 40)
      if (payload.billingNote !== undefined) user.billingNote = String(payload.billingNote || '').slice(0, 500)
      break
    }
    case 'set_searches_left':
      user.searchesLeft = Math.max(0, Math.min(10000, Number(payload.searchesLeft) || 0))
      break
    case 'set_membership_can_search': {
      if (!user.organizationId) throw new Error('User is not on a company account')
      const membership = getMembership(store, user.id, user.organizationId)
      if (!membership) throw new Error('Membership not found')
      membership.canSearch = Boolean(payload.canSearch)
      membership.updatedAt = now
      break
    }
    case 'set_pipeline_role': {
      if (!user.organizationId) throw new Error('User is not on a company account')
      const membership = getMembership(store, user.id, user.organizationId)
      if (!membership) throw new Error('Membership not found')
      const role = String(payload.pipelineRole || 'member')
      if (!['org_admin', 'member', 'sales'].includes(role)) throw new Error('Invalid pipeline role')
      membership.pipelineRole = role
      if (role === 'org_admin') membership.role = 'org_admin'
      membership.updatedAt = now
      break
    }
    case 'grant_org_admin': {
      const org = grantOrgAdminOnStore(store, user, {
        organizationId: payload.organizationId,
        demoteOtherAdmins: payload.demoteOtherAdmins !== false,
      })
      auditDetail = { organizationId: org.id, organizationName: org.name }
      break
    }
    case 'record_payment': {
      const amountPaise = Math.round(Number(payload.amountPaise) || 0)
      if (amountPaise > 0) {
        user.creditsPaise = (user.creditsPaise ?? 0) + amountPaise
        store.creditLedger.push({
          id: createId('credit'),
          userId: user.id,
          kind: 'grant',
          amountPaise,
          description: payload.reference
            ? `Payment recorded: ${payload.reference}`
            : 'Manual payment — credits added',
          createdBy: actor.id,
          createdAt: now,
        })
      }
      user.subscriptionActive = true
      if (payload.plan) user.plan = String(payload.plan).slice(0, 40)
      user.billingNote = String(payload.note || payload.reference || 'Payment recorded by support').slice(0, 500)
      auditDetail = { amountPaise, reference: payload.reference, plan: payload.plan }
      break
    }
    default:
      throw new Error('Unknown action')
  }

  recordAdminAudit(store, {
    actorUserId: actor.id,
    actorEmail: actor.email,
    action,
    targetType: 'user',
    targetId: user.id,
    detail: auditDetail,
  })

  return getCustomerDetail(store, user.id)
}

export function applyOrganizationSupportAction(store, { actor, organizationId, action, payload = {} }) {
  const org = getOrganization(store, organizationId)
  if (!org) throw new Error('Organization not found')
  const now = new Date().toISOString()

  switch (action) {
    case 'set_searches_left':
      org.searchesLeft = Math.max(0, Math.min(100000, Number(payload.searchesLeft) || 0))
      break
    case 'set_subscription':
      org.subscriptionActive = Boolean(payload.active)
      if (payload.billingNote !== undefined) org.billingNote = String(payload.billingNote || '').slice(0, 500)
      break
    case 'force_onboarding':
      org.onboardingComplete = true
      break
    case 'update_member': {
      const membership = getMembership(store, payload.userId, organizationId)
      if (!membership) throw new Error('Member not found')
      if (payload.canSearch !== undefined) membership.canSearch = Boolean(payload.canSearch)
      if (payload.pipelineRole) {
        const role = String(payload.pipelineRole)
        if (!['org_admin', 'member', 'sales'].includes(role)) throw new Error('Invalid role')
        membership.pipelineRole = role
        if (role === 'org_admin') membership.role = 'org_admin'
      }
      if (payload.status) membership.status = payload.status === 'inactive' ? 'inactive' : 'active'
      membership.updatedAt = now
      break
    }
    case 'grant_org_admin': {
      const member = store.users.find((row) => row.id === payload.userId)
      if (!member) throw new Error('User not found')
      grantOrgAdminOnStore(store, member, {
        organizationId: org.id,
        demoteOtherAdmins: payload.demoteOtherAdmins !== false,
      })
      break
    }
    default:
      throw new Error('Unknown action')
  }

  recordAdminAudit(store, {
    actorUserId: actor.id,
    actorEmail: actor.email,
    action,
    targetType: 'organization',
    targetId: org.id,
    detail: { action, ...payload },
  })

  return getOrganizationDetail(store, org.id)
}
