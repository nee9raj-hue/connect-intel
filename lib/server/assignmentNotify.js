import { buildAssignmentEmailContent, buildBulkAssignmentEmailContent } from './assignmentEmailContent.js'
import { sendOrgNotificationEmail } from './email.js'
import { isGeminiConfigured, generateAssignmentSuggestion } from './gemini.js'
import { normalizeExtendedCrm } from './crmWorkflow.js'
import { getOrganization } from './organizations.js'
import { normalizeCrmLeadStatus } from './crm.js'

function defaultSuggestion(status) {
  const map = {
    unqualified:
      '- Confirm trade lanes and monthly volumes.\n- Send a personalized introduction from Pipeline → Email.\n- Log your first call or note in CRM.',
    qualified:
      '- Confirm target corridors and service mix.\n- Schedule a discovery call within 48 hours.\n- Move to Sales Opportunity when they ask for rates.',
    opportunity:
      '- Send or follow the live quote.\n- Confirm decision timing and competing forwarders.\n- Update the account when terms are agreed.',
    onboarding:
      '- Complete credit checks, KYC, and POA paperwork.\n- Confirm first booking window.\n- Hand off to ops when trading starts.',
    new_account:
      '- Confirm first booking window and SOP.\n- Introduce ops and credit contacts.\n- Move to Active Trader after the first shipment.',
    active_trading:
      '- Watch shipment cadence and service issues.\n- Expand lanes where volume is growing.\n- Log exceptions so the account does not go quiet.',
    at_risk:
      '- Review the 60-day volume drop with the customer.\n- Offer a recovery plan or rate review.\n- Set a next conversation date.',
    churned:
      '- Confirm whether they moved volume elsewhere.\n- Attempt a win-back conversation.\n- Mark Lost if they will not return.',
    lost: '- Add a brief loss reason in notes for the team.\n- No active outreach unless they re-engage.',
  }
  return map[status] || map.unqualified
}

export async function buildAssignmentAiSuggestion(lead, crm, assigneeName) {
  const status = normalizeCrmLeadStatus(crm?.status)
  if (isGeminiConfigured()) {
    try {
      return await generateAssignmentSuggestion(lead, crm, assigneeName)
    } catch {
      // fall through
    }
  }
  return { text: defaultSuggestion(status), aiGenerated: false }
}

/**
 * Email the assignee when a lead is assigned to them (not on unassign or self-assign).
 */
export async function notifyLeadAssigned({
  store,
  entry,
  assigneeUserId,
  actorUser,
  organizationId,
}) {
  if (!assigneeUserId || !organizationId || !entry?.lead) {
    return { sent: false, skipped: 'missing_data' }
  }
  if (assigneeUserId === actorUser?.id) {
    return { sent: false, skipped: 'self_assign' }
  }

  const assignee = store.users.find((u) => u.id === assigneeUserId)
  if (!assignee?.email) {
    return { sent: false, error: 'Assignee has no email on file' }
  }

  const org = getOrganization(store, organizationId)
  const lead = entry.lead
  const crm = normalizeExtendedCrm(entry.crm)
  const suggestion = await buildAssignmentAiSuggestion(lead, crm, assignee.name || assignee.email)

  const content = buildAssignmentEmailContent({
    to: assignee.email,
    assigneeName: assignee.name || assignee.email,
    actorName: actorUser?.name || actorUser?.email || 'Your admin',
    actorEmail: actorUser?.email,
    organizationName: org?.name || actorUser?.organizationName,
    lead,
    crm,
    aiSuggestion: suggestion.text,
    aiGenerated: suggestion.aiGenerated,
  })

  return sendOrgNotificationEmail({
    to: content.normalizedTo,
    subject: content.subject,
    html: content.html,
    text: content.text,
    replyTo: actorUser?.email,
    organizationId,
    senderName: actorUser?.name,
    organizationName: org?.name,
  })
}

/**
 * One digest email when many leads are bulk-assigned to the same teammate.
 */
export async function notifyBulkLeadsAssigned({
  store,
  entries,
  assigneeUserId,
  actorUser,
  organizationId,
}) {
  const list = (entries || []).filter((e) => e?.lead)
  if (!assigneeUserId || !organizationId || !list.length) {
    return { sent: false, skipped: 'missing_data' }
  }
  if (assigneeUserId === actorUser?.id) {
    return { sent: false, skipped: 'self_assign' }
  }

  const assignee = store.users.find((u) => u.id === assigneeUserId)
  if (!assignee?.email) {
    return { sent: false, error: 'Assignee has no email on file' }
  }

  const org = getOrganization(store, organizationId)
  const content = buildBulkAssignmentEmailContent({
    to: assignee.email,
    assigneeName: assignee.name || assignee.email,
    actorName: actorUser?.name || actorUser?.email || 'Your admin',
    actorEmail: actorUser?.email,
    organizationName: org?.name || actorUser?.organizationName,
    entries: list,
  })

  return sendOrgNotificationEmail({
    to: content.normalizedTo,
    subject: content.subject,
    html: content.html,
    text: content.text,
    replyTo: actorUser?.email,
    organizationId,
    senderName: actorUser?.name,
    organizationName: org?.name,
  })
}
