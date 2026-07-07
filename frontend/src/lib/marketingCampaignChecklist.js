import { DEFAULT_THEME } from './marketingEmailDesign'

/** Mailchimp-style campaign setup checklist (To → From → Subject → Send time → Content). */

function toDatetimeLocal(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Hydrate checklist form when editing an existing draft campaign. */
export function campaignToEditForm(campaign) {
  const steps = campaign?.steps || []
  const s0 = steps[0] || {}
  const s1 = steps[1]
  return {
    id: campaign?.id || '',
    name: String(campaign?.name || '').trim() || 'Untitled',
    channel: campaign?.channel || 'email',
    listId: campaign?.listId || '',
    segmentId: campaign?.segmentId || '',
    audienceMode: campaign?.segmentId ? 'segment' : 'list',
    templateId: campaign?.templateId || '',
    subject: s0.subject || campaign?.subject || '',
    body: s0.body || campaign?.body || '',
    blocks: s0.blocks || campaign?.blocks || [],
    design: s0.design || campaign?.design || { ...DEFAULT_THEME },
    previewText: s0.previewText || campaign?.previewText || '',
    fromName: campaign?.fromName || '',
    fromEmail: campaign?.fromEmail || '',
    sendMode: campaign?.sendMode || (campaign?.scheduledAt ? 'scheduled' : 'immediate'),
    scheduledAt: toDatetimeLocal(campaign?.scheduledAt),
    useSequence: steps.length > 1,
    step2Subject: s1?.subject || '',
    step2Body: s1?.body || '',
    step2Blocks: s1?.blocks || [],
    step2Design: s1?.design || { ...DEFAULT_THEME },
    step2PreviewText: s1?.previewText || '',
    step2Delay: s1?.delayDays ?? 3,
    emailProvider: campaign?.emailProvider || 'auto',
    recurrence: campaign?.recurrence || '',
    abTest: campaign?.abTest || null,
  }
}

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
  if (campaignForm.audienceMode === 'all') return 'Entire audience'
  if (campaignForm.audienceMode === 'segment' && campaignForm.segmentId) {
    const seg = segments.find((s) => s.id === campaignForm.segmentId)
    return seg?.name || 'Segment selected'
  }
  if (campaignForm.listId || campaignForm.audienceMode === 'list') {
    const list = lists.find((l) => l.id === campaignForm.listId)
    return list?.name || 'List selected'
  }
  return null
}

export function audienceCount(campaignForm, lists = [], segments = [], totalContacts = 0) {
  if (campaignForm.audienceMode === 'all') {
    return totalContacts || 0
  }
  if (campaignForm.audienceMode === 'segment' && campaignForm.segmentId) {
    const seg = segments.find((s) => s.id === campaignForm.segmentId)
    return seg?.memberCount ?? seg?.snapshot?.contactCount ?? 0
  }
  if (campaignForm.listId || campaignForm.audienceMode === 'list') {
    const list = lists.find((l) => l.id === campaignForm.listId)
    return list?.memberCount ?? list?.leadIds?.length ?? list?.snapshot?.contactCount ?? 0
  }
  return 0
}

export function isChecklistStepComplete(stepId, campaignForm, { gmailConnected = false } = {}) {
  switch (stepId) {
    case 'to':
      if (campaignForm.audienceMode === 'all') return true
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

export function formatAudienceEligibilityLine(preview) {
  if (!preview || preview.eligible == null) return null
  const { total = 0, eligible = 0, skipped = {} } = preview
  const skips = []
  if (skipped.no_consent) skips.push(`${skipped.no_consent} no consent`)
  if (skipped.no_email) skips.push(`${skipped.no_email} no email`)
  if (skipped.suppressed) skips.push(`${skipped.suppressed} suppressed`)
  if (skipped.not_in_pipeline) skips.push(`${skipped.not_in_pipeline} not in pipeline`)
  const skipPart = skips.length ? ` — ${skips.join(', ')}` : ''
  if (eligible === total) return `${eligible.toLocaleString()} will receive this email`
  return `${eligible.toLocaleString()} of ${total.toLocaleString()} eligible to receive${skipPart}`
}

export function stepSummary(stepId, campaignForm, lists, segments, { gmailStatus, totalContacts = 0, audiencePreview } = {}) {
  switch (stepId) {
    case 'to': {
      const label = audienceLabel(campaignForm, lists, segments)
      const eligibility = formatAudienceEligibilityLine(audiencePreview)
      if (eligibility) return `${label || 'Audience'} · ${eligibility}`
      const count = audienceCount(campaignForm, lists, segments, totalContacts)
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
