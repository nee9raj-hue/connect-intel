import { requireUser } from '../auth.js'
import { readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import {
  enrichMarketingRows,
  filterMarketingAssets,
  requireMarketingUser,
} from '../marketingAccess.js'
import { buildOrgUserResponse, getPipelineLeadIds } from '../organizations.js'
import { loadPipelineStoreContext } from '../pipelineShard.js'
import {
  applySnapshotToAudience,
  toAudienceCard,
} from '../marketingAudienceSnapshots.js'
import {
  buildAudienceRecommendationsFromIndex,
} from '../marketingAudienceRecommendations.js'
import { createMarketingSegment, updateMarketingSegment } from '../marketingSegments.js'
import { createId } from '../store.js'
import { marketingScopeKey } from '../marketingAccess.js'
import {
  filterLeadIdsForMarketingChannel,
  normalizeMarketingChannel,
} from '../marketingLeadEligibility.js'
import { partitionLeadsBySuppression } from '../marketingListMembers.js'
import { MAX_LIST_LEADS, getMarketingList } from '../marketingCampaigns.js'
import { getAudienceRecommendationsCache } from '../marketingAudienceCache.js'
import { loadPipelineSummaryFast } from '../pipelineIndex.js'
import { hasSavableSegmentFilterJson } from '../../pipelineFilterToAudience.js'
import {
  insightsForAudienceEntity,
  resolveAudienceEntity,
} from '../marketingAudienceInsights.js'

async function loadMarketingStore(sessionUser) {
  const { pipelineStore } = await loadPipelineStoreContext(sessionUser)
  const store = {
    ...(await readStore({
      only: [
        'marketingLists',
        'marketingSegments',
        'marketingCampaigns',
        'marketingSuppressions',
        'users',
        'organizations',
        'organizationMemberships',
        'savedLeads',
      ],
    })),
    savedLeads: pipelineStore.savedLeads,
  }
  const dbUser = store.users.find((u) => u.id === sessionUser.id)
  const user = buildOrgUserResponse(dbUser || sessionUser, store)
  return { store, user }
}

function unifiedAudienceCards(store, user) {
  const lists = enrichMarketingRows(
    store,
    user,
    filterMarketingAssets(store, user, store.marketingLists || [], {
      filterLeadIds: false,
      hideEmptyLists: false,
    })
  )
  const segments = enrichMarketingRows(store, user, store.marketingSegments || [])
  const cards = [
    ...lists.map((l) => toAudienceCard(l, 'list')),
    ...segments.map((s) => toAudienceCard(s, 'segment')),
  ]
  return cards.sort((a, b) => new Date(b.lastRefreshed || 0) - new Date(a.lastRefreshed || 0))
}

async function resolveRecommendations(store, user) {
  const orgId = user.organizationId
  const cached = getAudienceRecommendationsCache(store, orgId)
  if (cached) return cached

  const summary = await loadPipelineSummaryFast(user, store)
  if (!summary) return []

  return buildAudienceRecommendationsFromIndex(summary, store, user, {
    campaigns: store.marketingCampaigns || [],
    segments: store.marketingSegments || [],
  })
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const { user: gateUser, store: gateStore } = await loadMarketingGateContext(sessionUser)
  const hubCheck = await requireMarketingHubAccess(gateUser, gateStore)
  if (!hubCheck.ok) return sendJson(res, hubCheck.status || 403, { error: hubCheck.error, code: hubCheck.code })

  const { store, user } = await loadMarketingStore(sessionUser)

  if (req.method === 'GET') {
    const audiences = unifiedAudienceCards(store, user)
    const totalContacts = audiences.reduce((n, a) => n + (a.contactCount || 0), 0)
    const growthValues = audiences.map((a) => a.growthPct || 0).filter((g) => g !== 0)
    const avgGrowth =
      growthValues.length > 0
        ? Math.round(growthValues.reduce((a, b) => a + b, 0) / growthValues.length)
        : 0

    const recommendations = await resolveRecommendations(store, user)

    const insightsFor = String(req.query?.insightsFor || '').trim()
    let insights = null
    if (insightsFor) {
      const resolved = resolveAudienceEntity(store, user, { audienceId: insightsFor })
      if (resolved) {
        insights = insightsForAudienceEntity(store, user, resolved.entity, resolved.sourceType)
      }
    }

    return sendJson(res, 200, {
      audiences,
      summary: {
        totalContacts,
        audienceCount: audiences.length,
        listCount: audiences.filter((a) => a.sourceType === 'list').length,
        segmentCount: audiences.filter((a) => a.sourceType === 'segment').length,
        growthPct: avgGrowth,
        engaged: Math.round(totalContacts * 0.22),
        deliverable: totalContacts,
      },
      recommendations,
      insights,
    })
  }

  if (req.method !== 'POST') return methodNotAllowed(res, ['GET', 'POST'])

  const body = getBody(req)
  const action = body.action || 'create_from_leads'

  if (action === 'create_from_leads') {
    const name = String(body.name || '').trim()
    const leadIds = [...new Set(Array.isArray(body.leadIds) ? body.leadIds : [])]
    const channel = normalizeMarketingChannel(body.channel)
    if (!name) return sendJson(res, 400, { error: 'Audience name is required' })
    if (!leadIds.length) return sendJson(res, 400, { error: 'Select at least one contact' })

    const visible = getPipelineLeadIds(store, user)
    let ids = leadIds.filter((id) => visible.has(id))
    ids = filterLeadIdsForMarketingChannel(store, user, ids, channel).slice(0, MAX_LIST_LEADS)
    const { allowed, blocked } = partitionLeadsBySuppression(store, user, ids)
    ids = allowed
    if (!ids.length) {
      return sendJson(res, 400, {
        error: 'No eligible contacts in this selection for the chosen channel.',
        blocked: blocked.length ? blocked : undefined,
      })
    }

    const now = new Date().toISOString()
    const list = {
      id: createId('mlist'),
      ...marketingScopeKey(user),
      name: name.slice(0, 120),
      description: String(body.description || 'Created from pipeline selection').slice(0, 400),
      leadIds: ids,
      channel,
      audienceType: 'static',
      source: 'pipeline_selection',
      createdByUserId: user.id,
      createdAt: now,
      updatedAt: now,
    }
    applySnapshotToAudience(list, ids)

    await updateStore((draft) => {
      draft.marketingLists = draft.marketingLists || []
      draft.marketingLists.push(list)
      return draft
    })

    return sendJson(res, 201, {
      audience: toAudienceCard(list, 'list'),
      list,
      message: 'Audience created successfully',
    })
  }

  if (action === 'create_from_filter') {
    const name = String(body.name || '').trim()
    const filterJson = body.filterJson || {}
    if (!name) return sendJson(res, 400, { error: 'Audience name is required' })
    if (!hasSavableSegmentFilterJson(filterJson)) {
      return sendJson(res, 400, {
        error: 'Add at least one filter (status, location, tags, assignee, or contact) — search alone cannot be saved.',
      })
    }
    try {
      const segment = await createMarketingSegment(user, {
        name,
        type: 'dynamic',
        channel: body.channel || 'email',
        filterJson,
        description: String(body.description || 'Saved from pipeline filters').slice(0, 400),
      })
      return sendJson(res, 201, {
        audience: toAudienceCard(segment, 'segment'),
        segment,
        message: 'Audience created successfully',
      })
    } catch (e) {
      return sendJson(res, 400, { error: e.message || 'Could not create audience' })
    }
  }

  if (action === 'refresh_snapshot') {
    const listId = body.listId || null
    const segmentId = body.segmentId || null
    if (!listId && !segmentId) {
      return sendJson(res, 400, { error: 'listId or segmentId is required' })
    }

    try {
      if (segmentId) {
        await updateMarketingSegment(user, segmentId, {})
        const fresh = await loadMarketingStore(sessionUser)
        const resolved = resolveAudienceEntity(fresh.store, fresh.user, { segmentId })
        if (!resolved) return sendJson(res, 404, { error: 'Audience not found' })
        return sendJson(res, 200, {
          audience: toAudienceCard(resolved.entity, 'segment'),
          segment: resolved.entity,
          insights: insightsForAudienceEntity(fresh.store, fresh.user, resolved.entity, 'segment'),
          message: 'Audience refreshed',
        })
      }

      const list = getMarketingList(store, user, listId)
      if (!list) return sendJson(res, 404, { error: 'Audience not found' })

      const visible = getPipelineLeadIds(store, user)
      const channel = list.channel || 'email'
      let ids = (list.leadIds || []).filter((id) => visible.has(id))
      ids = filterLeadIdsForMarketingChannel(store, user, ids, channel)

      let refreshed = list
      await updateStore((draft) => {
        const row = (draft.marketingLists || []).find((l) => l.id === listId)
        if (row) {
          applySnapshotToAudience(row, ids)
          refreshed = { ...row }
        }
        return draft
      })

      return sendJson(res, 200, {
        audience: toAudienceCard(refreshed, 'list'),
        list: refreshed,
        insights: insightsForAudienceEntity(store, user, refreshed, 'list'),
        message: 'Audience refreshed',
      })
    } catch (e) {
      return sendJson(res, 400, { error: e.message || 'Could not refresh audience' })
    }
  }

  if (action === 'create_from_recommendation') {
    try {
      const segment = await createMarketingSegment(user, {
        name: body.name || body.suggestedName,
        type: 'dynamic',
        channel: body.channel || 'email',
        filterJson: body.filterJson || {},
      })
      return sendJson(res, 201, {
        audience: toAudienceCard(segment, 'segment'),
        segment,
        message: 'Audience created successfully',
      })
    } catch (e) {
      return sendJson(res, 400, { error: e.message || 'Could not create audience' })
    }
  }

  return sendJson(res, 400, { error: 'Unknown action' })
}
