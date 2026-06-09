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
  audienceDisplayMetrics,
  toAudienceCard,
} from '../marketingAudienceSnapshots.js'
import { buildAudienceRecommendations } from '../marketingAudienceRecommendations.js'
import { createMarketingSegment } from '../marketingSegments.js'
import { createId } from '../store.js'
import { marketingScopeKey } from '../marketingAccess.js'
import {
  filterLeadIdsForMarketingChannel,
  normalizeMarketingChannel,
} from '../marketingLeadEligibility.js'
import { partitionLeadsBySuppression } from '../marketingListMembers.js'
import { MAX_LIST_LEADS } from '../marketingCampaigns.js'

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

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const check = requireMarketingUser(sessionUser)
  if (!check.ok) return sendJson(res, 401, { error: check.error })

  const { store, user } = await loadMarketingStore(sessionUser)

  if (req.method === 'GET') {
    const audiences = unifiedAudienceCards(store, user)
    const totalContacts = audiences.reduce((n, a) => n + (a.contactCount || 0), 0)
    const growthValues = audiences.map((a) => a.growthPct || 0).filter((g) => g !== 0)
    const avgGrowth =
      growthValues.length > 0
        ? Math.round(growthValues.reduce((a, b) => a + b, 0) / growthValues.length)
        : 0

    const recommendations = buildAudienceRecommendations(store, user, {
      campaigns: store.marketingCampaigns || [],
      segments: store.marketingSegments || [],
    })

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
