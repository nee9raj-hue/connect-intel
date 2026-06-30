import { buildAssignmentEmailContent, buildBulkAssignmentEmailContent } from './assignmentEmailContent.js'
import { sendOrgNotificationEmail } from './email.js'
import { isGeminiConfigured, generateAssignmentSuggestion } from './gemini.js'
import { normalizeExtendedCrm } from './crmWorkflow.js'
import { getOrganization } from './organizations.js'
import { CRM_STATUSES } from './crm.js'

function defaultSuggestion(status) {
  const map = {
    new: '- Review the lead profile and company fit.\n- Send a personalized introduction email from Pipeline -> Email.\n- Log your first call or note in CRM.',
    contacted:
      '- Read the email thread for context.\n- Schedule a follow-up within 48 hours.\n- Update status after the next touch.',
    follow_up:
      '- Confirm the next meeting or send a concise follow-up.\n- Check tasks and due dates on this lead.\n- Move status when you get a response.',
    replied:
      '- Respond promptly while interest is warm.\n- Propose a specific call time or next step.\n- Update pipeline status after the conversation.',
    won: '- Coordinate delivery or onboarding with your team.\n- Log final notes for handoff.\n- Close open tasks on this lead.',
    lost: '- Add a brief loss reason in notes for the team.\n- No active outreach unless they re-engage.',
  }
  return map[status] || map.new
}

export async function buildAssignmentAiSuggestion(lead, crm, assigneeName) {
  const status = CRM_STATUSES.includes(crm?.status) ? crm.status : 'new'
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
