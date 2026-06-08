import { updateStorePartial } from './store.js'
import { postChithiActivity } from './chithiV2.js'

/** Fire-and-forget CRM activity post into Chithi entity channels. */
export async function emitChithiCrmActivity(payload) {
  try {
    await updateStorePartial(['chithiChannels', 'chithiMessages'], (draft) => {
      postChithiActivity(draft, payload)
      return draft
    })
  } catch {
    /* non-blocking */
  }
}

export function dealActivityFromPatch({ organizationId, leadId, leadLabel, deal, previousStage, actor, kind }) {
  const name = deal?.name || 'Deal'
  const stage = deal?.stage || ''
  let summary = ''
  if (kind === 'deal_created') summary = `${actor?.name || 'Someone'} created deal ${name}`
  else if (kind === 'deal_won') summary = `🎉 Deal won — ${name}`
  else if (kind === 'deal_lost') summary = `Deal lost — ${name}`
  else if (kind === 'deal_stage_changed' && previousStage && stage) {
    summary = `${actor?.name || 'Someone'} moved ${name} from ${previousStage} → ${stage}`
  } else if (kind === 'meeting_booked') summary = `Meeting scheduled with **${leadLabel || 'customer'}**`
  else if (kind === 'task_completed') summary = `Task completed: ${deal?.title || name}`
  else return null

  return {
    organizationId,
    roomType: 'customer',
    entityId: leadId,
    parentLeadId: leadId,
    label: leadLabel,
    activityKind: kind,
    summary,
    actorUserId: actor?.id,
    actorName: actor?.name || actor?.email,
    meta: { dealId: deal?.id, stage },
  }
}
