import { buildOrgUserResponse, listPipelineSavedEntries } from './organizations.js'
import { getUserCrmGmail } from './crmUserGmail.js'
import { isGmailOAuthConfigured } from './gmailOAuth.js'
import { canOfferCustomerGmailConnect } from './config.js'

function countByStatus(entries) {
  const counts = {}
  for (const e of entries) {
    const st = e.crm?.status || 'new'
    counts[st] = (counts[st] || 0) + 1
  }
  return counts
}

function countOverdueFollowUps(entries) {
  const now = Date.now()
  let n = 0
  for (const e of entries) {
    const at = e.crm?.nextFollowUpAt
    if (at && new Date(at).getTime() < now) n += 1
  }
  return n
}

export function buildAssistantUserContext(store, user) {
  const profile = buildOrgUserResponse(store.users.find((u) => u.id === user.id) || user, store)
  const entries = listPipelineSavedEntries(store, user)
  const gmail = getUserCrmGmail(profile)
  const statusCounts = countByStatus(entries)

  return {
    name: profile.name || profile.email?.split('@')[0] || 'there',
    email: profile.email,
    organizationName: profile.organizationName,
    accountType: profile.accountType,
    orgRole: profile.orgRole,
    isOrgAdmin: profile.isOrgAdmin,
    isPlatformAdmin: profile.isPlatformAdmin,
    onboardingComplete: profile.onboardingComplete,
    prospectCredits: profile.prospectCredits,
    creditBalanceRupees: profile.creditBalanceRupees,
    aiDiscoverySearchesLeft: profile.aiDiscoverySearchesLeft,
    assignedLeadCount: profile.assignedLeadCount,
    pipelineLeadCount: entries.length,
    pipelineByStatus: statusCounts,
    overdueFollowUps: countOverdueFollowUps(entries),
    gmailConnected: Boolean(gmail),
    gmailMailbox: gmail?.email || null,
    gmailConnectAvailable: isGmailOAuthConfigured() && canOfferCustomerGmailConnect(),
    mobileOnFile: Boolean(profile.mobileE164 || profile.mobile),
    canSearch: profile.canSearch,
    orgOutboundEmailReady: profile.orgOutboundEmailReady,
  }
}

export function formatContextForPrompt(ctx) {
  const lines = [
    `User: ${ctx.name} (${ctx.email})`,
    `Organization: ${ctx.organizationName || 'Individual'}`,
    `Role: ${ctx.isPlatformAdmin ? 'platform operator' : ctx.isOrgAdmin ? 'company admin' : ctx.orgRole || 'member'}`,
    `Onboarding complete: ${ctx.onboardingComplete ? 'yes' : 'no'}`,
    `Pipeline leads visible: ${ctx.pipelineLeadCount}`,
    `Assigned to user: ${ctx.assignedLeadCount}`,
    `Overdue follow-ups: ${ctx.overdueFollowUps}`,
    `Prospect credits: ₹${ctx.prospectCredits ?? 0} (${ctx.aiDiscoverySearchesLeft ?? 0} AI discovery searches left)`,
    `Work Gmail connected: ${ctx.gmailConnected ? `yes (${ctx.gmailMailbox})` : 'no'}`,
    `Gmail connect offered: ${ctx.gmailConnectAvailable ? 'yes' : 'limited — verification pending'}`,
    `Mobile on profile: ${ctx.mobileOnFile ? 'yes' : 'no'}`,
    `Can run AI search: ${ctx.canSearch ? 'yes' : 'no'}`,
  ]
  if (ctx.pipelineByStatus && Object.keys(ctx.pipelineByStatus).length) {
    lines.push(`Pipeline by stage: ${JSON.stringify(ctx.pipelineByStatus)}`)
  }
  return lines.join('\n')
}
