/** Mailchimp-style campaign setup checklist (To → From → Subject → Send time → Content). */

export const CAMPAIGN_CHECKLIST_STEPS = [
  { id: 'to', label: 'To', question: 'Who are you sending this email to?' },
  { id: 'from', label: 'From', question: 'Who is sending this email?' },
  { id: 'subject', label: 'Subject', question: "What's the subject line for this email?" },
  { id: 'sendtime', label: 'Send time', question: 'When should we send this email?' },
  { id: 'content', label: 'Content', question: 'Design your email content' },
]

export function checklistStepIds(channel = 'email') {
  if (channel === 'whatsapp') return ['to', 'from', 'sendtime', 'content']
  return CAMPAIGN_CHECKLIST_STEPS.map((s) => s.id)
}

export function visibleChecklistSteps(channel = 'email') {
  const ids = new Set(checklistStepIds(channel))
  return CAMPAIGN_CHECKLIST_STEPS.filter((s) => ids.has(s.id))
}

export function audienceLabel(campaignForm, lists = [], segments = []) {
  if (campaignForm.audienceMode === 'segment' && campaignForm.segmentId) {
    const seg = segments.find((s) => s.id === campaignForm.segmentId)
    return seg?.name || 'Segment selected'
  }
  if (campaignForm.listId) {
    const list = lists.find((l) => l.id === campaignForm.listId)
    return list?.name || 'List selected'
  }
  return null
}

export function audienceCount(campaignForm, lists = [], segments = []) {
  if (campaignForm.audienceMode === 'segment' && campaignForm.segmentId) {
    const seg = segments.find((s) => s.id === campaignForm.segmentId)
    return seg?.memberCount ?? seg?.snapshot?.contactCount ?? 0
  }
  if (campaignForm.listId) {
    const list = lists.find((l) => l.id === campaignForm.listId)
    return list?.memberCount ?? list?.leadIds?.length ?? list?.snapshot?.contactCount ?? 0
  }
  return 0
}

export function isChecklistStepComplete(stepId, campaignForm, { gmailConnected = false } = {}) {
  switch (stepId) {
    case 'to':
      return Boolean(campaignForm.listId || campaignForm.segmentId)
    case 'from':
      if (campaignForm.channel === 'whatsapp') return true
      return Boolean(
        (campaignForm.fromEmail || '').trim() || gmailConnected || (campaignForm.fromName || '').trim()
      )
    case 'subject':
      if (campaignForm.channel === 'whatsapp') return Boolean(campaignForm.name?.trim())
      return Boolean(campaignForm.subject?.trim())
    case 'sendtime':
      if (campaignForm.sendMode === 'scheduled') return Boolean(campaignForm.scheduledAt)
      return true
    case 'content':
      return Boolean(campaignForm.blocks?.length || campaignForm.body?.trim())
    default:
      return false
  }
}

export function checklistProgress(campaignForm, options = {}) {
  const stepIds = checklistStepIds(campaignForm.channel)
  const complete = stepIds.filter((id) => isChecklistStepComplete(id, campaignForm, options)).length
  return { complete, total: stepIds.length, stepIds }
}

export function canSendCampaign(campaignForm, options = {}) {
  const { stepIds } = checklistProgress(campaignForm, options)
  return stepIds.every((id) => isChecklistStepComplete(id, campaignForm, options))
}

export function defaultFromFields(user, gmailStatus, orgName) {
  const fromEmail = gmailStatus?.email || user?.workEmail || user?.email || ''
  const fromName =
    (orgName && orgName !== 'Your organization' ? orgName : null) ||
    user?.organizationName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    ''
  return { fromName, fromEmail }
}

export function stepSummary(stepId, campaignForm, lists, segments, { gmailStatus } = {}) {
  switch (stepId) {
    case 'to': {
      const label = audienceLabel(campaignForm, lists, segments)
      const count = audienceCount(campaignForm, lists, segments)
      if (!label) return null
      return count ? `${label} · ${count.toLocaleString()} contacts` : label
    }
    case 'from': {
      const name = campaignForm.fromName || defaultFromFields(null, gmailStatus).fromName
      const email = campaignForm.fromEmail || gmailStatus?.email || ''
      if (!name && !email) return null
      return [name, email].filter(Boolean).join(' · ')
    }
    case 'subject':
      return campaignForm.subject?.trim() || null
    case 'sendtime':
      if (campaignForm.sendMode === 'scheduled' && campaignForm.scheduledAt) {
        try {
          return `Scheduled · ${new Date(campaignForm.scheduledAt).toLocaleString()}`
        } catch {
          return 'Scheduled'
        }
      }
      return 'Send now'
    case 'content':
      if (campaignForm.blocks?.length) return 'Email design ready'
      if (campaignForm.body?.trim()) return 'Message drafted'
      return null
    default:
      return null
  }
}
