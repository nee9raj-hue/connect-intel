import { buildAssistantUserContext } from '../assistantContext.js'
import { listPipelineSavedEntries } from '../organizations.js'
import { normalizeExtendedCrm } from '../crmWorkflow.js'
import { buildStructuredReply } from './structuredResponse.js'

const HOT_SCORE = 70

function leadName(entry) {
  const lead = entry.lead || {}
  return [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.company || 'Lead'
}

function isMine(entry, userId) {
  const uid = String(userId)
  if (entry.assignedToUserId) return String(entry.assignedToUserId) === uid
  return [entry.savedByUserId, entry.userId].some((v) => v && String(v) === uid)
}

export async function buildMorningBrief(store, user) {
  const ctx = buildAssistantUserContext(store, user)
  const entries = listPipelineSavedEntries(store, user)
  const now = Date.now()
  const endToday = new Date()
  endToday.setHours(23, 59, 59, 999)

  const tasksToday = []
  const meetingsToday = []
  const hotLeads = []
  const atRisk = []

  for (const entry of entries) {
    if (!isMine(entry, user.id)) continue
    const crm = normalizeExtendedCrm(entry.crm)
    const leadId = entry.lead?.id || entry.id
    const name = leadName(entry)
    const company = entry.lead?.company || ''

    if ((crm.leadScore ?? 0) >= HOT_SCORE) {
      hotLeads.push({ name, company, leadId, score: crm.leadScore })
    }

    const status = crm.status || 'new'
    if (['new', 'contacted'].includes(status) && crm.nextFollowUpAt) {
      const due = new Date(crm.nextFollowUpAt).getTime()
      if (due < now - 3 * 86400000) {
        atRisk.push({ name, company, leadId, reason: 'Overdue follow-up' })
      }
    }

    for (const task of crm.tasks || []) {
      if (task.completedAt) continue
      const due = task.dueAt ? new Date(task.dueAt).getTime() : null
      if (due && due <= endToday.getTime()) {
        tasksToday.push({ title: task.title, name, leadId, dueAt: task.dueAt })
      }
    }

    for (const mtg of crm.meetings || []) {
      const at = mtg.scheduledAt ? new Date(mtg.scheduledAt).getTime() : null
      if (at && at >= now && at <= endToday.getTime()) {
        meetingsToday.push({ title: mtg.title, name, leadId, scheduledAt: mtg.scheduledAt })
      }
    }
  }

  const crmFindings = [
    `**${ctx.pipelineLeadCount}** leads in pipeline · **${ctx.overdueFollowUps}** overdue follow-ups`,
    `**${tasksToday.length}** task(s) due today · **${meetingsToday.length}** meeting(s) today`,
    hotLeads.length ? `**${hotLeads.length}** hot lead(s) (score ≥ ${HOT_SCORE})` : null,
    atRisk.length ? `**${atRisk.length}** lead(s) at risk (stale follow-up)` : null,
  ].filter(Boolean)

  const webFindings = []
  if (hotLeads.length) {
    webFindings.push(
      ...hotLeads.slice(0, 3).map((h) => `**${h.name}** @ ${h.company} — score ${h.score}`)
    )
  }

  const shortAnswer = `Good ${getGreeting()} — here's your sales brief for today.`

  const reply = buildStructuredReply({
    shortAnswer,
    crmFindings: [
      ...crmFindings,
      ...tasksToday.slice(0, 4).map((t) => `Task: **${t.title}** · ${t.name}`),
      ...meetingsToday.slice(0, 4).map((m) => `Meeting: **${m.title || 'Call'}** · ${m.name}`),
    ],
    webFindings: webFindings.length ? webFindings : undefined,
    nextStep:
      ctx.overdueFollowUps > 0
        ? 'Clear overdue follow-ups first — open Calendar or Pipeline.'
        : 'Pick your top hot lead and draft outreach.',
  })

  const actions = []
  if (tasksToday[0]?.leadId) {
    actions.push({
      type: 'navigate',
      panel: 'pipeline',
      leadId: tasksToday[0].leadId,
      leadTab: 'schedule',
      label: "Today's first task",
    })
  }
  actions.push({ type: 'navigate', panel: 'crm-calendar', label: 'Open calendar' })
  actions.push({ type: 'navigate', panel: 'pipeline', label: 'Open pipeline' })

  return {
    reply,
    source: 'crm',
    sources: [{ type: 'crm', label: 'Morning brief' }],
    confidence: 'high',
    suggestions: ['Who needs follow-up today?', 'Draft follow-up email for a lead', 'Highlight stalled deals'],
    actions,
  }
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
