import { insertPipelineActivity } from './pipelineActivitiesTable.js'

/** Fire-and-forget: mirror CRM activity into pipeline_activities for indexed reads. */
export function syncCrmActivityToTable({
  organizationId,
  leadId,
  leadName,
  company,
  activity,
}) {
  if (!organizationId || !leadId || !activity?.createdAt) return

  void insertPipelineActivity({
    organizationId,
    leadId: String(leadId),
    actorId: activity.createdByUserId || activity.userId || null,
    type: activity.type || 'note',
    summary: activity.summary || '',
    occurredAt: activity.createdAt,
    payload: {
      activityId: activity.id || null,
      createdByName: activity.createdByName || activity.userName || null,
      leadName: leadName || null,
      company: company || null,
      meta: activity.meta || null,
    },
  }).catch((err) => {
    console.warn('pipeline_activities sync:', err?.message || err)
  })
}

/** Sync activities added during a CRM patch (skip ids present before the mutation). */
export function syncNewCrmActivitiesSince({ organizationId, entry, crm, previousActivityIds }) {
  if (!organizationId || !entry) return
  const lead = entry.lead || entry
  const leadId = lead?.id || entry.id
  if (!leadId) return
  const leadName = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.company || null
  const seen = previousActivityIds instanceof Set ? previousActivityIds : new Set(previousActivityIds || [])

  for (const activity of crm?.activities || []) {
    if (activity?.id && seen.has(activity.id)) continue
    syncCrmActivityToTable({
      organizationId,
      leadId,
      leadName,
      company: lead.company || null,
      activity,
    })
  }
}

/** Sync the most recently appended activity (activities[0] after prepend). */
export function syncLatestCrmActivityToTable({ organizationId, entry, crm }) {
  if (!organizationId || !entry) return
  const lead = entry.lead || entry
  const leadId = lead?.id || entry.id
  const acts = crm?.activities
  if (!leadId || !Array.isArray(acts) || !acts.length) return
  const activity = acts[0]
  const leadName = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.company || null
  syncCrmActivityToTable({
    organizationId,
    leadId,
    leadName,
    company: lead.company || null,
    activity,
  })
}
