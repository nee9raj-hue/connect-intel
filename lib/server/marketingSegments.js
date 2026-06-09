import { createId, readStore, updateStore } from './store.js'
import {
  canAccessMarketingAsset,
  filterMarketingRows,
  marketingScopeKey,
} from './marketingAccess.js'
import { applySegmentFilters } from '../marketingSegmentFilters.js'
import { listPipelineSavedEntries, getPipelineLeadIds } from './organizations.js'
import { filterLeadIdsForMarketingChannel } from './marketingLeadEligibility.js'
import { loadPipelineStoreContext } from './pipelineShard.js'
import { readCampaignEnrollments } from './marketingEnrollmentShard.js'
import { filterMarketingEventsForCampaign } from './marketingEvents.js'
import { applySnapshotToAudience } from './marketingAudienceSnapshots.js'

export const MAX_SEGMENT_LEADS = 2000

export function getMarketingSegment(store, user, segmentId) {
  const row = (store.marketingSegments || []).find((s) => s.id === segmentId)
  if (!row || !canAccessMarketingAsset(row, user)) return null
  return row
}

function engagementSetsForCampaign(store, user, campaignId, type) {
  const opened = new Set()
  const clicked = new Set()
  const notOpened = new Set()
  if (!campaignId) return { openedLeadIds: opened, clickedLeadIds: clicked, notOpenedLeadIds: notOpened }

  const events = filterMarketingEventsForCampaign(store, user, campaignId)
  for (const ev of events) {
    if (!ev.leadId) continue
    if (ev.type === 'open') opened.add(ev.leadId)
    if (ev.type === 'click') clicked.add(ev.leadId)
  }

  if (type === 'notOpened') {
    return readCampaignEnrollments(campaignId).then((rows) => {
      for (const e of rows) {
        if (e.leadId && (e.sentCount || 0) > 0 && !opened.has(e.leadId)) {
          notOpened.add(e.leadId)
        }
      }
      return { openedLeadIds: opened, clickedLeadIds: clicked, notOpenedLeadIds: notOpened }
    })
  }

  return Promise.resolve({ openedLeadIds: opened, clickedLeadIds: clicked, notOpenedLeadIds: notOpened })
}

export async function resolveSegmentLeadIds(store, user, segment, { channel = 'email' } = {}) {
  if (!segment) return []

  if (segment.type === 'static' && Array.isArray(segment.leadIds)) {
    const visible = getPipelineLeadIds(store, user)
    const ids = segment.leadIds.filter((id) => visible.has(id))
    return filterLeadIdsForMarketingChannel(store, user, ids, channel).slice(0, MAX_SEGMENT_LEADS)
  }

  const filters = segment.filterJson || {}
  let engagement = { openedLeadIds: new Set(), clickedLeadIds: new Set(), notOpenedLeadIds: new Set() }

  if (filters.openedCampaignId) {
    engagement = await engagementSetsForCampaign(store, user, filters.openedCampaignId, 'open')
  } else if (filters.clickedCampaignId) {
    engagement = await engagementSetsForCampaign(store, user, filters.clickedCampaignId, 'click')
  } else if (filters.notOpenedCampaignId) {
    engagement = await engagementSetsForCampaign(store, user, filters.notOpenedCampaignId, 'notOpened')
  }

  const entries = listPipelineSavedEntries(store, user)
  const matched = applySegmentFilters(entries, filters, engagement)
  const leadIds = matched
    .map((e) => e.leadId || e.lead?.id || e.id)
    .filter(Boolean)

  return filterLeadIdsForMarketingChannel(store, user, leadIds, channel).slice(0, MAX_SEGMENT_LEADS)
}

export async function previewSegmentCount(user, segmentOrFilters, { channel = 'email' } = {}) {
  const { pipelineStore } = await loadPipelineStoreContext(user)
  const store = {
    ...(await readStore({
      only: ['marketingSegments', 'marketingEvents', 'marketingCampaigns', 'users', 'organizations', 'organizationMemberships'],
    })),
    savedLeads: pipelineStore.savedLeads,
  }

  const segment =
    typeof segmentOrFilters === 'object' && segmentOrFilters.filterJson !== undefined
      ? segmentOrFilters
      : { type: 'dynamic', filterJson: segmentOrFilters, channel }

  if (!segment.channel) segment.channel = channel

  const leadIds = await resolveSegmentLeadIds(store, user, segment, { channel: segment.channel })
  return { count: leadIds.length, leadIds: leadIds.slice(0, 50) }
}

export async function createMarketingSegment(user, payload) {
  const now = new Date().toISOString()
  const type = payload.type === 'static' ? 'static' : 'dynamic'
  const segment = {
    id: createId('mseg'),
    ...marketingScopeKey(user),
    name: String(payload.name || '').trim().slice(0, 120),
    description: String(payload.description || '').trim().slice(0, 400) || null,
    type,
    channel: payload.channel === 'whatsapp' ? 'whatsapp' : 'email',
    filterJson: type === 'dynamic' ? payload.filterJson || {} : null,
    leadIds: type === 'static' ? (payload.leadIds || []).slice(0, MAX_SEGMENT_LEADS) : [],
    memberCount: 0,
    createdByUserId: user.id,
    createdAt: now,
    updatedAt: now,
  }

  if (!segment.name) throw new Error('Segment name is required')

  const { pipelineStore } = await loadPipelineStoreContext(user)
  const store = { ...(await readStore()), savedLeads: pipelineStore.savedLeads }
  const leadIds = await resolveSegmentLeadIds(store, user, segment, { channel: segment.channel })
  segment.memberCount = leadIds.length
  if (type === 'static') segment.leadIds = leadIds
  applySnapshotToAudience(segment, leadIds)

  await updateStore((draft) => {
    draft.marketingSegments = draft.marketingSegments || []
    draft.marketingSegments.push(segment)
    return draft
  })

  return segment
}

export async function updateMarketingSegment(user, segmentId, patch) {
  const store = await readStore({ only: ['marketingSegments'] })
  const existing = getMarketingSegment(store, user, segmentId)
  if (!existing) throw new Error('Segment not found')

  const now = new Date().toISOString()
  await updateStore((draft) => {
    const row = (draft.marketingSegments || []).find((s) => s.id === segmentId)
    if (!row) return draft
    if (patch.name !== undefined) row.name = String(patch.name).trim().slice(0, 120)
    if (patch.description !== undefined) {
      row.description = String(patch.description || '').trim().slice(0, 400) || null
    }
    if (patch.filterJson !== undefined) row.filterJson = patch.filterJson
    if (patch.leadIds !== undefined) row.leadIds = patch.leadIds
    if (patch.channel !== undefined) row.channel = patch.channel === 'whatsapp' ? 'whatsapp' : 'email'
    row.updatedAt = now
    return draft
  })

  const updatedStore = await readStore({ only: ['marketingSegments'] })
  const updated = getMarketingSegment(updatedStore, user, segmentId)
  const { pipelineStore } = await loadPipelineStoreContext(user)
  const fullStore = { ...updatedStore, savedLeads: pipelineStore.savedLeads }
  const leadIds = await resolveSegmentLeadIds(fullStore, user, updated, { channel: updated.channel })

  await updateStore((draft) => {
    const row = (draft.marketingSegments || []).find((s) => s.id === segmentId)
    if (row) {
      row.memberCount = leadIds.length
      if (row.type === 'static') row.leadIds = leadIds
      applySnapshotToAudience(row, leadIds)
      row.updatedAt = now
    }
    return draft
  })

  return {
    ...updated,
    memberCount: leadIds.length,
    leadIds: updated.type === 'static' ? leadIds : updated.leadIds,
    snapshot: updated.snapshot,
  }
}

export async function refreshDynamicSegmentsForOrg(organizationId) {
  const store = await readStore({ only: ['marketingSegments', 'users'] })
  const segments = (store.marketingSegments || []).filter(
    (s) => s.organizationId === organizationId && s.type === 'dynamic'
  )
  if (!segments.length) return 0

  let refreshed = 0
  for (const segment of segments) {
    const owner = store.users.find((u) => u.id === segment.createdByUserId)
    if (!owner) continue
    try {
      await updateMarketingSegment(owner, segment.id, {})
      refreshed += 1
    } catch {
      /* skip */
    }
  }
  return refreshed
}

export function listMarketingSegments(store, user) {
  return filterMarketingRows(store.marketingSegments || [], user).sort(
    (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
  )
}
