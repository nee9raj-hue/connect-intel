import { listCrmActivities } from './crmActivityCounts.js'
import { aggregateWorkspaceUsage, buildDailyUsageSeries } from './teamWorkspaceUsage.js'
import { isClosedDealStage } from '../dealPipeline.js'
import { getFreightDealStageMeta } from '../freightDeal.js'

function dealStageLabel(stage, freightOrg) {
  if (freightOrg) return getFreightDealStageMeta(stage)?.label || stage
  return String(stage || 'new').replace(/_/g, ' ')
}

function inPeriod(iso, since, until = Infinity) {
  if (!iso) return false
  const t = new Date(iso).getTime()
  return !Number.isNaN(t) && t >= since && t < until
}

function actorMatches(act, memberUserId) {
  if (!memberUserId) return true
  const actor = String(act?.createdByUserId || act?.userId || '')
  return actor === String(memberUserId)
}

function formatDealAmount(deal) {
  if (deal?.amount == null || deal.amount === '') return ''
  const n = Number(deal.amount)
  if (!Number.isFinite(n)) return ''
  return `₹${n.toLocaleString('en-IN')}`
}

/** Shared shape for Team Intelligence feed + activity log rows. */
export function mapCrmActivityToTimelineItem(act) {
  return {
    id: act.id || `act-${act.leadId}-${act.createdAt}`,
    kind: 'activity',
    type: act.type || 'note',
    at: act.createdAt,
    title: act.leadName || 'Lead',
    company: act.company || '',
    body: act.summary || '',
    leadId: act.leadId,
    actorUserId: act.createdByUserId || act.userId || null,
    actorName: act.createdByName || act.userName || null,
    meta: act.meta || null,
  }
}

export function mergeTimelineItems(primary = [], extras = [], limit = 100) {
  const seen = new Set((primary || []).map((item) => item.id))
  const merged = [...(primary || [])]
  for (const item of extras || []) {
    if (!item?.id || seen.has(item.id)) continue
    seen.add(item.id)
    merged.push(item)
  }
  merged.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  const cap = limit > 0 ? limit : 100
  return merged.slice(0, cap)
}

/** Rich timeline for manager reviews — activities, deals, tasks, meetings. */
export function buildTeamActivityTimeline(
  store,
  user,
  entries,
  { since, until = Infinity, memberUserId = null, limit = 80, freightOrg = false } = {}
) {
  const items = []
  const mid = memberUserId ? String(memberUserId) : null

  const activities = listCrmActivities(store, user, entries, {
    since,
    until,
    memberUserId: mid,
    feedLimit: 500,
    responseLimit: null,
  })

  for (const act of activities) {
    items.push(mapCrmActivityToTimelineItem(act))
  }

  for (const entry of entries || []) {
    const lead = entry.lead || {}
    const leadId = lead.id || entry.id
    const leadName =
      [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.company || 'Lead'
    const company = lead.company || ''
    const crm = entry.crm && typeof entry.crm === 'object' ? entry.crm : {}
    for (const deal of crm.deals || []) {
      const createdAt = deal.createdAt || deal.updatedAt
      const updatedAt = deal.updatedAt || deal.createdAt
      const creator = String(deal.createdByUserId || '')
      const updater = String(deal.updatedByUserId || creator)

      if (createdAt && inPeriod(createdAt, since, until) && (!mid || creator === mid)) {
        const amount = formatDealAmount(deal)
        items.push({
          id: `deal-create-${deal.id}-${createdAt}`,
          kind: 'deal',
          type: 'deal_created',
          at: createdAt,
          title: deal.name || 'Deal',
          company,
          body: amount ? `New deal · ${amount}` : 'New deal logged',
          leadId,
          leadName,
          actorUserId: deal.createdByUserId || null,
          actorName: deal.createdByName || null,
          meta: {
            dealId: deal.id,
            stage: deal.stage,
            stageLabel: dealStageLabel(deal.stage, freightOrg),
            amount: deal.amount,
            currency: deal.currency || 'INR',
            freight: Boolean(deal.freight),
          },
        })
      }

      if (
        updatedAt &&
        createdAt &&
        updatedAt !== createdAt &&
        inPeriod(updatedAt, since, until) &&
        (!mid || updater === mid)
      ) {
        const stage = deal.stage || 'new'
        const closed = isClosedDealStage(stage)
        items.push({
          id: `deal-update-${deal.id}-${updatedAt}`,
          kind: 'deal',
          type: closed ? (stage === 'won' ? 'deal_won' : 'deal_lost') : 'deal_updated',
          at: updatedAt,
          title: deal.name || 'Deal',
          company,
          body: closed
            ? `Deal ${stage === 'won' ? 'won' : 'lost'}${formatDealAmount(deal) ? ` · ${formatDealAmount(deal)}` : ''}`
            : `Stage: ${dealStageLabel(stage, freightOrg)}`,
          leadId,
          leadName,
          actorUserId: deal.updatedByUserId || deal.createdByUserId || null,
          actorName: deal.updatedByName || deal.createdByName || null,
          meta: {
            dealId: deal.id,
            stage,
            amount: deal.amount,
          },
        })
      }
    }

    for (const task of crm.tasks || []) {
      const at = task.completedAt || task.createdAt
      if (!at || !inPeriod(at, since, until)) continue
      const actor = String(
        task.createdByUserId ||
          task.userId ||
          entry.assignedToUserId ||
          entry.savedByUserId ||
          entry.userId ||
          ''
      )
      if (mid && actor !== mid) continue
      items.push({
        id: `task-${task.id}-${at}`,
        kind: 'task',
        type: task.status === 'done' ? 'task_completed' : 'task_created',
        at,
        title: leadName,
        company,
        body: task.title || task.description || 'Task',
        leadId,
        leadName,
        actorUserId: task.createdByUserId || task.userId || null,
        actorName: task.createdByName || null,
        meta: { taskId: task.id, status: task.status, dueAt: task.dueAt || null },
      })
    }

    for (const meeting of crm.meetings || []) {
      const at = meeting.createdAt || meeting.scheduledAt
      if (!at || !inPeriod(at, since, until)) continue
      const actor = String(
        meeting.createdByUserId ||
          meeting.userId ||
          entry.assignedToUserId ||
          entry.savedByUserId ||
          entry.userId ||
          ''
      )
      if (mid && actor !== mid) continue
      items.push({
        id: `meeting-${meeting.id}-${at}`,
        kind: 'meeting',
        type: meeting.visitRecordedAt ? 'field_visit' : 'meeting',
        at: meeting.visitRecordedAt || meeting.scheduledAt || at,
        title: leadName,
        company,
        body: meeting.title || meeting.type || 'Meeting scheduled',
        leadId,
        leadName,
        actorUserId: meeting.createdByUserId || null,
        actorName: meeting.createdByName || null,
        meta: { meetingId: meeting.id, scheduledAt: meeting.scheduledAt },
      })
    }
  }

  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

  const cap = limit > 0 ? limit : 80
  return items.slice(0, cap)
}

export function buildMemberUsageDetail(storeUser, since) {
  const usage = aggregateWorkspaceUsage(storeUser, since)
  const daily = buildDailyUsageSeries(storeUser, since)
  const panelHits = storeUser?.workspaceUsage?.panelHits || {}
  const topPanels = Object.entries(panelHits)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([panel, hits]) => ({ panel, hits }))

  return {
    ...usage,
    daily,
    topPanels,
    lastLoginAt: storeUser?.lastLoginAt || null,
  }
}
