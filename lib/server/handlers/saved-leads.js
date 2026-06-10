import { requireUser } from '../auth.js'
import { createId, readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { defaultCrm, normalizeCrm } from '../crm.js'
import { mergeLeadForTenant, mergeLeadForTenantLight } from '../tenantIsolation.js'
import {
  addMeeting,
  addTask,
  addDeal,
  duplicateDeal,
  deleteDeal,
  updateDeal,
  closeDealWon,
  closeDealLost,
  appendActivity,
  completeTask,
  normalizeExtendedCrm,
  normalizeParticipantIds,
  recordFieldVisit,
  updateFieldVisit,
} from '../crmWorkflow.js'
import { findPipelineEntry } from '../pipelineAccess.js'
import { emitChithiCrmActivity, dealActivityFromPatch } from '../chithiActivityBridge.js'
import { repairPipelineEntryCrm } from '../tenantIsolation.js'
import { persistManualPipelineLead } from '../pipelineLeadMutations.js'
import {
  getMembership,
  isCompanyPipelineManager,
  canAssignLead,
  listPipelinePage,
  listPipelineSavedEntries,
  resolveOrgRole,
} from '../organizations.js'
import { canMoveLeadToStatus } from '../pipelineRoles.js'
import { notifyLeadAssigned } from '../assignmentNotify.js'
import { upsertMasterRecordFromLeadFields, updatePipelineContactDetails } from '../pipelineContact.js'
import { applyWorkflowRules, maybeAutoAssignLead } from '../crmWorkflowRules.js'
import { computeCrmLeadScore } from '../crmLeadScore.js'
import { maybeMaintainPipelineStore, resetPipelineMaintainThrottle } from '../pipelineMaintain.js'
import { recordWhatsAppOutbound } from '../whatsappInbox.js'
import { normalizeLeadTagIds } from '../orgLeadTags.js'
import {
  DEFAULT_PIPELINE_PAGE_SIZE,
  MAX_PIPELINE_PAGE_SIZE,
} from '../pipelineStore.js'
import {
  attachPipelineEntriesToStore,
  FAST_PIPELINE_WRITE,
  loadPipelineStoreContext,
  META_STORE_COLLECTIONS,
  pipelineShardNameForUser,
  touchPipelineEntry,
  updatePipelineLeadViaTable,
  updatePipelineStore,
} from '../pipelineShard.js'
import { syncNewCrmActivitiesSince } from '../pipelineActivitySync.js'
import { enqueuePipelineIndexRefresh } from '../queue/producer.js'
import { loadPipelineSummaryOnly } from '../pipelineBootstrap.js'
import {
  loadPipelineBoardView,
  loadPipelineDealsPage,
  loadPipelineListPage,
  loadPipelineSummaryWithDeals,
} from '../pipelineListLoad.js'
import {
  boardPipelineSlice,
  collectPipelineLocationFacets,
  filterPipelineEntries,
  summarizePipelineEntries,
} from '../pipelineQuery.js'
import { mergeLeadForClientListMinimal, CRM_STATUSES } from '../crm.js'
import { syncCrmScheduleToGoogleAfterSave } from '../googleCalendarSync.js'
import { workspaceFeatureEnabled } from '../workspaceFeatures.js'
import { getOrgFieldVisitExpenseSettings } from '../fieldVisitExpenseSettings.js'
import { countDealsByStage, flattenDealsFromEntries } from '../../dealPipeline.js'
import { buildAutoDealName } from '../../dealNaming.js'
import { isFreightDealOrg } from '../../freightDeal.js'
import { getOrganization } from '../organizations.js'

async function sendPipelineJson(res, status, user, payload, filters = {}) {
  const { enrichSavedLeadsPayload } = await import('../enterpriseLeadsRead.js')
  return sendJson(res, status, await enrichSavedLeadsPayload(user, payload, filters))
}

function parseBoardColumnLimits(url) {
  const columnLimits = {}
  for (const status of CRM_STATUSES) {
    const raw = url.searchParams.get(`col_${status}`)
    if (!raw) continue
    const n = Math.floor(Number(raw))
    if (Number.isFinite(n) && n > 0) columnLimits[status] = Math.min(n, 500)
  }
  return columnLimits
}

/** PATCH with only leadId + assignToUserId — skip lead-score recompute and return a slim lead payload. */
function isAssignOnlyPipelinePatch(body) {
  const keys = Object.keys(body || {}).filter((k) => k !== 'leadId')
  if (!keys.length) return false
  const allowed = new Set(['assignToUserId'])
  return keys.every((k) => allowed.has(k))
}

function isStatusOnlyCrmPatch(crmPatch) {
  if (!crmPatch || typeof crmPatch !== 'object') return false
  const keys = Object.keys(crmPatch)
  return keys.length > 0 && keys.every((k) => k === 'status' || k === 'responseReceived')
}

/** PATCH with only task and/or meeting — fast path for schedule tab saves. */
function isScheduleOnlyPipelinePatch(body) {
  const keys = Object.keys(body || {}).filter((k) => k !== 'leadId')
  if (!keys.length) return false
  const allowed = new Set(['task', 'meeting'])
  return keys.every((k) => allowed.has(k))
}

function isActivityOnlyPipelinePatch(body) {
  const keys = Object.keys(body || {}).filter((k) => k !== 'leadId')
  return keys.length === 1 && keys[0] === 'activity'
}

function isFieldVisitOnlyPipelinePatch(body) {
  const keys = Object.keys(body || {}).filter((k) => k !== 'leadId')
  return keys.length === 1 && keys[0] === 'fieldVisit'
}

function isDealOnlyPipelinePatch(body) {
  const keys = Object.keys(body || {}).filter((k) => k !== 'leadId')
  return keys.length === 1 && keys[0] === 'deal'
}

function patchMetaKeys(body) {
  return Object.keys(body || {}).filter(
    (k) => k !== 'leadId' && k !== 'persistNoteActivity'
  )
}

function isNotesOnlyPipelinePatch(body) {
  const keys = patchMetaKeys(body)
  if (keys.length !== 1 || keys[0] !== 'crm') return false
  const crmKeys = Object.keys(body.crm || {})
  return crmKeys.length === 1 && crmKeys[0] === 'notes'
}

/** Call log + optional callback date — keep on fast path (no lead-score recompute). */
function isActivityFollowUpPipelinePatch(body) {
  const keys = patchMetaKeys(body)
  if (!keys.includes('activity')) return false
  if (!keys.includes('crm')) return keys.length === 1
  const crmKeys = Object.keys(body.crm || {})
  return keys.length === 2 && crmKeys.length === 1 && crmKeys[0] === 'nextFollowUpAt'
}

async function deferPipelineMaterialization(user, entry, previousEntry = null) {
  const shardName = pipelineShardNameForUser(user)
  if (!shardName || !entry) return

  if (previousEntry) {
    try {
      const { readPipelineIndexDoc, writePipelineIndexDoc } = await import('../pipelineIndex.js')
      const { applyIncrementalPipelineIndex } = await import('../pipelineIndexDelta.js')
      const doc = await readPipelineIndexDoc(shardName)
      if (doc) {
        const orgStore =
          user.organizationId
            ? await readStore({ only: ['organizations'] })
            : { organizations: [] }
        const orgRow = user.organizationId ? getOrganization(orgStore, user.organizationId) : null
        const freightOrg = isFreightDealOrg(orgRow, user)
        const next = applyIncrementalPipelineIndex(doc, previousEntry, entry, { freightOrg })
        if (next) {
          await writePipelineIndexDoc(shardName, next)
          return
        }
      }
    } catch (error) {
      console.warn('incremental pipeline index:', error?.message || error)
    }
  }

  const queued = await enqueuePipelineIndexRefresh(shardName, { delayMs: 2500 })
  if (!queued) {
    void import('../dashboardMaterialized.js')
      .then(({ refreshPipelineIndexForShard }) => refreshPipelineIndexForShard(shardName))
      .catch(() => {})
  }

  if (previousEntry) return

  try {
    const { pipelineLeadsTableActive, upsertPipelineLeadRows } = await import('../pipelineLeadsTable.js')
    if (pipelineLeadsTableActive() && entry) {
      await upsertPipelineLeadRows(shardName, [entry], { batchSize: 1 })
    }
  } catch {
    /* shard-path row sync */
  }
}

function canManageLeadScheduling(user, entry) {
  return isCompanyPipelineManager(user) || entry?.assignedToUserId === user.id
}

function parsePipelineQueryParams(url) {
  const status = String(url.searchParams.get('status') || 'all').trim()
  const q = String(url.searchParams.get('q') || '').trim()
  const cities = url.searchParams.getAll('city').map((c) => String(c).trim()).filter(Boolean)
  const states = url.searchParams.getAll('state').map((s) => String(s).trim()).filter(Boolean)
  const assigneeUserId = String(url.searchParams.get('assigneeUserId') || '').trim() || null
  const tagIds = url.searchParams.getAll('tagId').filter(Boolean)
  const minLeadScore = url.searchParams.has('minLeadScore')
    ? Number(url.searchParams.get('minLeadScore'))
    : null
  const followUpDue = url.searchParams.get('followUpDue') === '1'
  const overdueFollowUp = url.searchParams.get('overdueFollowUp') === '1'
  return {
    status,
    q,
    city: cities[0] || '',
    state: states[0] || '',
    cities,
    states,
    assigneeUserId,
    tagIds,
    minLeadScore: Number.isFinite(minLeadScore) ? minLeadScore : null,
    followUpDue,
    overdueFollowUp,
  }
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const user = await requireUser(req, res)
  if (!user) return

  if (req.method === 'GET') {
    try {
    const url = new URL(req.url || '', 'http://local')
    const light = url.searchParams.get('light') !== '0'
    const leadId = String(url.searchParams.get('leadId') || '').trim()
    const isSummary = url.searchParams.get('summary') === '1'
    const isBoard = url.searchParams.get('view') === 'board'
    const isDealsView = url.searchParams.get('view') === 'deals'
    const useShardOnly = light && !isBoard
    const filtersEarly = parsePipelineQueryParams(url)

    if (isSummary && !leadId && !isBoard && !isDealsView) {
      try {
        const indexed = await loadPipelineSummaryOnly(user)
        if (indexed?.ready) {
          return sendJson(res, 200, indexed)
        }
      } catch {
        // fall through to full load
      }
    }

    if (leadId) {
      const shardName = pipelineShardNameForUser(user)
      const { pipelineLeadsTableActive, readPipelineLeadById, upsertPipelineLeadRow } = await import(
        '../pipelineLeadsTable.js'
      )
      if (pipelineLeadsTableActive()) {
        const tableEntry = await readPipelineLeadById(shardName, leadId)
        if (tableEntry) {
          const metaStore = await readStore({ only: META_STORE_COLLECTIONS })
          const storeForMerge = attachPipelineEntriesToStore(metaStore, [tableEntry])
          const entry = findPipelineEntry(storeForMerge, user, leadId)
          if (!entry) return sendJson(res, 404, { error: 'Lead not in pipeline' })
          if (repairPipelineEntryCrm(storeForMerge, user, entry)) {
            await upsertPipelineLeadRow(shardName, entry)
          }
          return sendPipelineJson(
            res,
            200,
            user,
            { lead: mergeLeadForTenant(storeForMerge, user, entry) },
            filtersEarly
          )
        }
      }
    }

    if (light && !leadId && !isBoard && !isDealsView && !isSummary) {
      let pageLimit = url.searchParams.has('limit')
        ? Math.floor(Number(url.searchParams.get('limit')))
        : DEFAULT_PIPELINE_PAGE_SIZE
      if (!Number.isFinite(pageLimit) || pageLimit <= 0) pageLimit = DEFAULT_PIPELINE_PAGE_SIZE
      pageLimit = Math.min(pageLimit, MAX_PIPELINE_PAGE_SIZE)
      const pageOffset = Math.max(0, Math.floor(Number(url.searchParams.get('offset') || 0)) || 0)
      const list = await loadPipelineListPage(user, {
        offset: pageOffset,
        limit: pageLimit,
        filters: filtersEarly,
        light: true,
      })
      if (list.fromTable) {
        return sendPipelineJson(
          res,
          200,
          user,
          {
            leads: list.leads,
            total: list.total,
            limit: list.limit,
            offset: list.offset,
            hasMore: list.hasMore,
            pipelineTotal: list.pipelineTotal,
            pipelineSource: 'pipeline_leads_table',
          },
          filtersEarly
        )
      }
    }

    if (isDealsView) {
      const orgStore = await readStore({ only: META_STORE_COLLECTIONS })
      const org = user.organizationId ? getOrganization(orgStore, user.organizationId) : null
      const freightOrg = isFreightDealOrg(org, user)
      if (!freightOrg) {
        return sendJson(res, 403, { error: 'Deal pipeline view is not enabled for this workspace' })
      }
      const dealStage = String(url.searchParams.get('dealStage') || 'all').trim() || 'all'
      let dealLimit = url.searchParams.has('limit')
        ? Math.floor(Number(url.searchParams.get('limit')))
        : 100
      if (!Number.isFinite(dealLimit) || dealLimit <= 0) dealLimit = 100
      dealLimit = Math.min(dealLimit, 500)
      const dealOffset = Math.max(0, Math.floor(Number(url.searchParams.get('offset') || 0)) || 0)
      const dealsPage = await loadPipelineDealsPage(user, {
        filters: filtersEarly,
        dealStage,
        offset: dealOffset,
        limit: dealLimit,
        freightOrg,
      })
      if (dealsPage?.fromTable) {
        return sendJson(res, 200, {
          deals: dealsPage.deals,
          total: dealsPage.total,
          limit: dealsPage.limit,
          offset: dealsPage.offset,
          hasMore: dealsPage.hasMore,
          dealStage: dealsPage.dealStage,
          pipelineSource: 'pipeline_leads_table',
        })
      }
    }

    if (isBoard) {
      const columnLimits = parseBoardColumnLimits(url)
      const boardView = await loadPipelineBoardView(user, {
        filters: filtersEarly,
        columnLimits,
        defaultPerColumn: 50,
      })
      if (boardView?.fromTable) {
        const board = {}
        for (const [status, entries] of Object.entries(boardView.columns)) {
          board[status] = entries.map((entry) => ({
            ...mergeLeadForClientListMinimal(entry),
            assignedToUserId: entry.assignedToUserId || null,
            savedByUserId: entry.savedByUserId || entry.userId,
          }))
        }
        return sendPipelineJson(
          res,
          200,
          user,
          {
            board,
            columnTotals: boardView.totals,
            total: boardView.total,
            visibleTotal: boardView.visibleTotal,
            pipelineSource: 'pipeline_leads_table',
          },
          filtersEarly
        )
      }
    }

    const { pipelineStore, visible } = await loadPipelineStoreContext(user, {
      shardOnly: useShardOnly,
    })
    const { accountType } = resolveOrgRole(user, pipelineStore)
    const organizationId =
      accountType === 'company' && user.organizationId ? user.organizationId : null

    if (leadId) {
      let entry = findPipelineEntry(pipelineStore, user, leadId)
      if (!entry) return sendJson(res, 404, { error: 'Lead not in pipeline' })
      let storeForMerge = pipelineStore
      if (repairPipelineEntryCrm(pipelineStore, user, entry)) {
        await updatePipelineStore(user, (draft) => {
          const row = findPipelineEntry(draft, user, leadId)
          if (row) repairPipelineEntryCrm(pipelineStore, user, row)
          return draft
        })
        const refreshed = await loadPipelineStoreContext(user)
        storeForMerge = refreshed.pipelineStore
        entry = findPipelineEntry(storeForMerge, user, leadId) || entry
      }
      return sendPipelineJson(
        res,
        200,
        user,
        { lead: mergeLeadForTenant(storeForMerge, user, entry) },
        filtersEarly
      )
    }

    if (!light) {
      await maybeMaintainPipelineStore(user, organizationId)
    }

    const filters = filtersEarly
    const filtered = filterPipelineEntries(visible, filters)

    const org = user.organizationId ? getOrganization(pipelineStore, user.organizationId) : null
    const freightOrg = isFreightDealOrg(org, user)

    if (isDealsView) {
      if (!freightOrg) {
        return sendJson(res, 403, { error: 'Deal pipeline view is not enabled for this workspace' })
      }
      const dealStage = String(url.searchParams.get('dealStage') || 'all').trim() || 'all'
      const rows = flattenDealsFromEntries(filtered, {
        dealStage: dealStage === 'all' ? null : dealStage,
        includeClosed: dealStage === 'won' || dealStage === 'lost',
        freightOrg,
      })
      let limit = url.searchParams.has('limit')
        ? Math.floor(Number(url.searchParams.get('limit')))
        : 100
      if (!Number.isFinite(limit) || limit <= 0) limit = 100
      limit = Math.min(limit, 500)
      const offset = Math.max(0, Math.floor(Number(url.searchParams.get('offset') || 0)) || 0)
      const page = rows.slice(offset, offset + limit)
      return sendJson(res, 200, {
        deals: page,
        total: rows.length,
        limit,
        offset,
        hasMore: offset + page.length < rows.length,
        dealStage,
      })
    }

    if (isSummary) {
      const indexedSummary = await loadPipelineSummaryWithDeals(user, { freightOrg })
      if (indexedSummary) {
        return sendJson(res, 200, indexedSummary)
      }
      const summary = summarizePipelineEntries(visible)
      const locations = collectPipelineLocationFacets(visible)
      const payload = { ...summary, ...locations, ready: true }
      if (freightOrg) {
        payload.openDealCounts = countDealsByStage(visible, { openOnly: true, freightOrg: true })
        payload.dealCounts = countDealsByStage(visible, { openOnly: false, freightOrg: true })
      }
      return sendJson(res, 200, payload)
    }

    if (isBoard) {
      const columnLimits = parseBoardColumnLimits(url)
      const { columns, totals } = boardPipelineSlice(filtered, 50, columnLimits)
      const board = {}
      for (const [status, entries] of Object.entries(columns)) {
        board[status] = entries.map((entry) => ({
          ...mergeLeadForClientListMinimal(entry),
          assignedToUserId: entry.assignedToUserId || null,
          savedByUserId: entry.savedByUserId || entry.userId,
        }))
      }
      return sendPipelineJson(
        res,
        200,
        user,
        {
          board,
          columnTotals: totals,
          total: filtered.length,
          visibleTotal: visible.length,
        },
        filters
      )
    }

    let limit = url.searchParams.has('limit')
      ? Math.floor(Number(url.searchParams.get('limit')))
      : DEFAULT_PIPELINE_PAGE_SIZE
    if (!Number.isFinite(limit) || limit <= 0) limit = DEFAULT_PIPELINE_PAGE_SIZE
    limit = Math.min(limit, MAX_PIPELINE_PAGE_SIZE)
    const offset = Math.max(0, Math.floor(Number(url.searchParams.get('offset') || 0)) || 0)

    const { leads, total } = listPipelinePage(pipelineStore, user, {
      light,
      limit,
      offset,
      entries: filtered,
    })
    const hasMore = offset + leads.length < total
    return sendPipelineJson(
      res,
      200,
      user,
      {
        leads,
        total,
        limit,
        offset,
        hasMore,
        pipelineTotal: visible.length,
      },
      filters
    )
    } catch (error) {
      console.error('saved-leads GET failed:', error)
      return sendJson(res, 500, {
        error: error.message || 'Could not load pipeline data',
      })
    }
  }

  const store =
    req.method === 'PATCH'
      ? await readStore({ only: ['users', 'organizations', 'organizationMemberships'] })
      : await readStore()
  const { accountType } = resolveOrgRole(user, store)
  const organizationId =
    accountType === 'company' && user.organizationId ? user.organizationId : null

  if (req.method === 'POST') {
    const body = getBody(req)

    if (body.manual) {
      try {
        const { store: updated, entry, createdLeadId } = await persistManualPipelineLead(
          user,
          organizationId,
          body.manual
        )
        if (
          createdLeadId &&
          organizationId &&
          body.manual?.assignedToUserId &&
          String(body.manual.assignedToUserId) !== user.id &&
          entry
        ) {
          void notifyLeadAssigned({
            store: updated,
            entry,
            assigneeUserId: body.manual.assignedToUserId,
            actorUser: user,
            organizationId,
          }).catch(() => {})
        }
        if (entry) {
          const { queueEnterpriseLeadSync } = await import('../enterpriseLeadsSync.js')
          queueEnterpriseLeadSync(entry)
        }
        return sendPipelineJson(res, 200, user, {
          lead: entry ? mergeLeadForTenant(updated, user, entry) : null,
          message: 'Lead added to pipeline',
        })
      } catch (error) {
        return sendJson(res, 400, { error: error.message })
      }
    }

    const lead = body.lead

    if (!lead?.id) {
      return sendJson(res, 400, { error: 'Lead payload is required' })
    }

    const updated = await updateStore((draft) => {
      const exists = draft.savedLeads.find(
        (e) =>
          e.lead.id === lead.id &&
          (organizationId ? e.organizationId === organizationId : e.userId === user.id)
      )

      if (!exists) {
        let contactId = null
        let companyId = null
        let leadPayload = { ...lead }

        const existingContact = draft.contacts.find((row) => row.id === lead.id)
        if (existingContact) {
          contactId = existingContact.id
          companyId = existingContact.companyId
        } else {
          try {
            const linked = upsertMasterRecordFromLeadFields(
              draft,
              {
                firstName: lead.firstName,
                lastName: lead.lastName,
                title: lead.title,
                company: lead.company,
                email: lead.email,
                phone: lead.phone,
                city: lead.city,
                state: lead.state,
                industry: lead.industry,
                website: lead.companyDomain,
                linkedin: lead.linkedin,
                source: lead.source || 'search',
              },
              user
            )
            contactId = linked.contactId
            companyId = linked.companyId
            leadPayload = {
              ...linked.leadSnapshot,
              score: lead.score,
              source: lead.source || linked.leadSnapshot.source,
            }
          } catch {
            // Keep search snapshot if master upsert fails
          }
        }

        draft.savedLeads.push({
          id: createId('saved'),
          userId: user.id,
          organizationId,
          savedByUserId: user.id,
          assignedToUserId: user.isOrgAdmin ? null : user.id,
          savedAt: new Date().toISOString(),
          contactId,
          companyId,
          crm: defaultCrm(),
          lead: {
            ...leadPayload,
            id: contactId || leadPayload.id || lead.id,
            savedAt: new Date().toISOString(),
            inPipeline: true,
          },
        })
      }
      return draft
    })

    const entry = findPipelineEntry(updated, user, lead.id)
    if (entry) {
      const { queueEnterpriseLeadSync } = await import('../enterpriseLeadsSync.js')
      queueEnterpriseLeadSync(entry)
    }
    return sendPipelineJson(res, 200, user, {
      lead: entry ? mergeLeadForTenant(updated, user, entry) : null,
    })
  }

  if (req.method === 'PATCH') {
    const body = getBody(req)
    const leadId = body.leadId
    const crmPatch = body.crm
    const contactPatch = body.contact
    const assignToUserId = body.assignToUserId
    const activity = body.activity
    const taskAction = body.task
    const meetingAction = body.meeting
    const fieldVisit = body.fieldVisit
    const dealAction = body.deal

    if (!leadId) {
      return sendJson(res, 400, { error: 'leadId is required' })
    }

    const assignOnlyPatch = isAssignOnlyPipelinePatch(body)
    const statusOnlyCrmPatch = crmPatch ? isStatusOnlyCrmPatch(crmPatch) : false
    const scheduleOnlyPatch = isScheduleOnlyPipelinePatch(body)
    const activityOnlyPatch = isActivityOnlyPipelinePatch(body)
    const activityFollowUpPatch = isActivityFollowUpPipelinePatch(body)
    const fieldVisitOnlyPatch = isFieldVisitOnlyPipelinePatch(body)
    const dealOnlyPatch = isDealOnlyPipelinePatch(body)
    const notesOnlyPatch = isNotesOnlyPipelinePatch(body)
    const fastActionPatch =
      scheduleOnlyPatch ||
      activityOnlyPatch ||
      activityFollowUpPatch ||
      fieldVisitOnlyPatch ||
      dealOnlyPatch ||
      notesOnlyPatch
    const lightCrmPatch = assignOnlyPatch || statusOnlyCrmPatch || fastActionPatch

    let pipelineStore = null
    const shardName = pipelineShardNameForUser(user)
    const { pipelineLeadsTableActive, readPipelineLeadById } = await import('../pipelineLeadsTable.js')
    if (pipelineLeadsTableActive()) {
      const tableEntry = await readPipelineLeadById(shardName, leadId)
      if (tableEntry) {
        const metaStore = await readStore({ only: META_STORE_COLLECTIONS })
        pipelineStore = attachPipelineEntriesToStore(metaStore, [tableEntry])
      }
    }
    if (!pipelineStore) {
      const loaded = await loadPipelineStoreContext(user, { shardOnly: fastActionPatch })
      pipelineStore = loaded.pipelineStore
    }
    const entryBefore = findPipelineEntry(pipelineStore, user, leadId)
    if (!entryBefore) {
      return sendJson(res, 404, { error: 'Lead not in pipeline' })
    }

    if (assignToUserId !== undefined) {
      if (assignToUserId === null && !isCompanyPipelineManager(user)) {
        return sendJson(res, 403, { error: 'Only company admins can unassign leads' })
      }
      if (!canAssignLead(user, entryBefore)) {
        return sendJson(res, 403, {
          error: 'Only company admins or the assigned rep can transfer this lead',
        })
      }
    }

    if (crmPatch?.status && organizationId) {
      const membership = getMembership(pipelineStore, user.id, organizationId)
      const { orgRole } = resolveOrgRole(user, pipelineStore)
      const pipelineRole = membership?.pipelineRole || (orgRole === 'org_admin' ? 'org_admin' : 'member')
      if (!canMoveLeadToStatus(orgRole, pipelineRole, crmPatch.status)) {
        return sendJson(res, 403, { error: 'Your role cannot move leads to this stage' })
      }
    }

    if (assignToUserId && organizationId) {
      const member = getMembership(pipelineStore, assignToUserId, organizationId)
      if (!member) {
        return sendJson(res, 400, { error: 'Assignee is not in your team' })
      }
    }

    const creator = { userId: user.id, name: user.name || user.email }

    function validateParticipantIds(draft, primaryId, extraIds) {
      const ids = normalizeParticipantIds(primaryId, extraIds)
      if (!organizationId) return ids
      for (const uid of ids) {
        if (uid === user.id) continue
        const member = getMembership(draft, uid, organizationId)
        if (!member) throw new Error('Each participant must be on your team')
      }
      return ids
    }

    let previousAssignee = null
    let lastAddedMeeting = null
    let lastAddedTask = null
    let completedTaskForGoogle = null
    let previousEntry = null
    let updated
    const applyPatch = async (draft) => {
      const entry = findPipelineEntry(draft, user, leadId)
      if (!entry) return draft

      let crm = normalizeExtendedCrm(entry.crm)
      const previousActivityIds = new Set((crm.activities || []).map((a) => a.id).filter(Boolean))
      const previousStatus = crm.status

      if (assignToUserId !== undefined) {
        if (previousAssignee === null) {
          previousAssignee = entry.assignedToUserId ?? null
        }
        const prev = entry.assignedToUserId
        entry.assignedToUserId = assignToUserId || null
        entry.assignedAt = new Date().toISOString()
        entry.assignedByUserId = user.id
        crm = appendActivity(crm, {
          type: prev && assignToUserId && prev !== assignToUserId ? 'transfer' : 'assignment',
          summary: assignToUserId
            ? `Lead assigned to team member`
            : 'Lead unassigned',
          userId: user.id,
          userName: user.name,
          meta: { assignToUserId, previousAssignee: prev },
        })
      }

      if (contactPatch && typeof contactPatch === 'object') {
        updatePipelineContactDetails(draft, entry, contactPatch)
      }

      if (crmPatch) {
        const notesChanged =
          crmPatch.notes !== undefined && String(crmPatch.notes) !== String(crm.notes || '')
        const patch = { ...crmPatch }
        if (patch.tagIds !== undefined && organizationId) {
          patch.tagIds = normalizeLeadTagIds(patch.tagIds, draft, organizationId)
        } else if (patch.tagIds !== undefined) {
          delete patch.tagIds
        }
        crm = normalizeExtendedCrm({
          ...crm,
          ...patch,
          emails: crmPatch?.emails ?? crm.emails,
          activities: crm.activities,
          tasks: crm.tasks,
          meetings: crm.meetings,
          deals: crm.deals,
        })
        if (notesChanged && crmPatch.notes?.trim() && body.persistNoteActivity) {
          crm = appendActivity(crm, {
            type: 'note',
            summary: crmPatch.notes.trim().slice(0, 280),
            userId: user.id,
            userName: user.name,
          })
        }
        if (crmPatch?.responseReceived === true && !crm.lastResponseAt) {
          crm.lastResponseAt = new Date().toISOString()
          if (['new', 'contacted', 'follow_up'].includes(crm.status)) {
            crm.status = 'replied'
          }
        }
      }

      if (activity && (String(activity.summary || '').trim() || activity.type === 'call')) {
        const activitySummary =
          String(activity.summary || '').trim() ||
          (activity.type === 'call' ? `Call — ${activity.meta?.outcome || 'logged'}` : '')
        if (activitySummary) {
          crm = appendActivity(crm, {
            type: activity.type || 'note',
            summary: activitySummary,
            userId: user.id,
            userName: user.name,
            meta: activity.meta || null,
          })
          if (activity.type === 'call' && crm.status === 'new') {
            crm.status = 'contacted'
          }
          if (activity.type === 'whatsapp') {
            const lead = entry.lead || entry
            const waBody =
              String(activity.meta?.message || '').trim() ||
              String(activitySummary).replace(/^WhatsApp:\s*/i, '').trim()
            recordWhatsAppOutbound(draft, user, {
              phone: lead.phone,
              body: waBody,
              leadId: entry.id || lead.id,
              leadName: [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.company,
            })
          }
        }
      }

      if (taskAction?.action === 'add' && taskAction.title) {
        const assignee = taskAction.assignedToUserId || user.id
        if (assignee !== user.id && !canManageLeadScheduling(user, entry)) {
          throw new Error('Only managers or the assigned rep can set a different primary owner')
        }
        if (assignee !== user.id && organizationId) {
          const member = getMembership(draft, assignee, organizationId)
          if (!member) throw new Error('Assignee is not in your team')
        }
        const participantUserIds = validateParticipantIds(
          draft,
          assignee,
          taskAction.participantUserIds
        )
        const result = addTask(crm, {
          title: taskAction.title,
          dueAt: taskAction.dueAt || null,
          assignedToUserId: assignee,
          participantUserIds,
          createdByUserId: user.id,
          createdByName: user.name,
        })
        crm = result.crm
        lastAddedTask = result.task
      }

      if (taskAction?.action === 'complete' && taskAction.taskId) {
        const taskRow = crm.tasks.find((t) => t.id === taskAction.taskId)
        if (taskRow?.googleEventId) {
          completedTaskForGoogle = { googleEventId: taskRow.googleEventId }
        }
        crm = completeTask(crm, taskAction.taskId, user.id, user.name)
      }

      if (meetingAction?.action === 'add' && meetingAction.scheduledAt) {
        const assignee = meetingAction.assignedToUserId || user.id
        if (assignee !== user.id && !canManageLeadScheduling(user, entry)) {
          throw new Error('Only managers or the assigned rep can set a different primary owner')
        }
        if (assignee !== user.id && organizationId) {
          const member = getMembership(draft, assignee, organizationId)
          if (!member) throw new Error('Assignee is not in your team')
        }
        const participantUserIds = validateParticipantIds(
          draft,
          assignee,
          meetingAction.participantUserIds
        )
        const result = addMeeting(
          crm,
          {
            title: meetingAction.title,
            scheduledAt: meetingAction.scheduledAt,
            durationMinutes: meetingAction.durationMinutes,
            type: meetingAction.type,
            location: meetingAction.location,
            notes: meetingAction.notes,
            assignedToUserId: assignee,
            participantUserIds,
          },
          creator
        )
        crm = result.crm
        lastAddedMeeting = result.meeting
      }

      if (dealAction?.action === 'add') {
        let dealName = String(dealAction.name || '').trim()
        if (!dealName && dealAction.autoName) {
          dealName = buildAutoDealName({
            company: dealAction.company || entry.lead?.company || entry.company,
            existingDeals: crm.deals,
          })
        }
        if (dealName) {
        const result = addDeal(
          crm,
          {
            name: dealName,
            stage: dealAction.stage,
            amount: dealAction.amount,
            currency: dealAction.currency,
            expectedCloseDate: dealAction.expectedCloseDate,
            notes: dealAction.notes,
            freight: dealAction.freight,
          },
          creator
        )
        crm = result.crm
        }
      } else if (dealAction?.action === 'duplicate' && dealAction.dealId) {
        const result = duplicateDeal(
          crm,
          dealAction.dealId,
          {
            company: dealAction.company || entry.lead?.company || entry.company,
            stage: dealAction.stage,
          },
          creator
        )
        if (result.deal) crm = result.crm
      } else if (dealAction?.action === 'update' && dealAction.dealId) {
        const prevDeal = crm.deals?.find((d) => d.id === dealAction.dealId)
        dealAction.previousStage = prevDeal?.stage
        crm = updateDeal(
          crm,
          dealAction.dealId,
          {
            name: dealAction.name,
            stage: dealAction.stage,
            amount: dealAction.amount,
            expectedCloseDate: dealAction.expectedCloseDate,
            notes: dealAction.notes,
            freight: dealAction.freight,
          },
          creator
        )
      } else if (dealAction?.action === 'won' && dealAction.dealId) {
        crm = closeDealWon(crm, dealAction.dealId, creator)
      } else if (dealAction?.action === 'lost' && dealAction.dealId) {
        crm = closeDealLost(
          crm,
          dealAction.dealId,
          { lostReason: dealAction.lostReason },
          creator
        )
      } else if (dealAction?.action === 'delete' && dealAction.dealId) {
        crm = deleteDeal(crm, dealAction.dealId, creator)
      }

      if (fieldVisit?.action === 'update' && fieldVisit.meetingId) {
        const expenseSettings =
          organizationId &&
          workspaceFeatureEnabled(
            draft.organizations.find((o) => o.id === organizationId),
            'fieldVisitExpenses'
          )
            ? getOrgFieldVisitExpenseSettings(draft, organizationId)
            : null
        crm = updateFieldVisit(
          crm,
          fieldVisit.meetingId,
          {
            outcome: fieldVisit.outcome,
            notes: fieldVisit.notes,
            location: fieldVisit.location,
            visitAt: fieldVisit.visitAt,
            title: fieldVisit.title,
            travel: fieldVisit.travel,
          },
          creator,
          expenseSettings
        )
      } else if (fieldVisit && (fieldVisit.meetingId || fieldVisit.quickLog)) {
        const expenseSettings =
          organizationId && workspaceFeatureEnabled(draft.organizations.find((o) => o.id === organizationId), 'fieldVisitExpenses')
            ? getOrgFieldVisitExpenseSettings(draft, organizationId)
            : null
        crm = recordFieldVisit(
          crm,
          fieldVisit.meetingId || null,
          {
            outcome: fieldVisit.outcome,
            notes: fieldVisit.notes,
            location: fieldVisit.location,
            visitAt: fieldVisit.visitAt,
            title: fieldVisit.title,
            quickLog: Boolean(fieldVisit.quickLog),
            travel: fieldVisit.travel,
          },
          creator,
          expenseSettings
        )
      }

      if (crmPatch?.status && crmPatch.status !== previousStatus && organizationId) {
        applyWorkflowRules(draft, entry, {
          trigger: 'status_change',
          previousStatus,
          newStatus: crm.status,
          actor: user,
          organizationId,
        })
        crm = normalizeExtendedCrm(entry.crm)
      }

      if (!lightCrmPatch) {
        crm.leadScore = computeCrmLeadScore(entry, {
          store: draft,
          organizationId,
          marketingEvents: draft.marketingEvents,
        })
      }
      if (organizationId) {
        syncNewCrmActivitiesSince({ organizationId, entry, crm, previousActivityIds })
      }
      entry.crm = crm
      touchPipelineEntry(entry)
      const crmPatchKeys = crmPatch ? Object.keys(crmPatch) : []
      const statusOnlyPatch =
        !crmPatch ||
        crmPatchKeys.every((key) => key === 'status' || key === 'responseReceived')
      const shouldRepairCrm =
        !lightCrmPatch &&
        (Boolean(
          activity?.summary ||
            activity?.type === 'call' ||
            activity?.type === 'whatsapp' ||
            taskAction ||
            meetingAction ||
            fieldVisit ||
            contactPatch
        ) ||
          (crmPatch && !statusOnlyPatch))
      if (shouldRepairCrm) {
        repairPipelineEntryCrm(draft, user, entry)
      }
      return draft
    }
    try {
      const tableResult = await updatePipelineLeadViaTable(user, leadId, applyPatch)
      if (tableResult?.error === 'not_found') {
        return sendJson(res, 404, { error: 'Lead not in pipeline' })
      }
      if (tableResult?.store) {
        updated = tableResult.store
        previousEntry = tableResult.previousEntry
      } else {
        updated = await updatePipelineStore(user, applyPatch, { writeOptions: FAST_PIPELINE_WRITE })
      }
    } catch (error) {
      return sendJson(res, 400, { error: error.message || 'Update failed' })
    }

    const entry = findPipelineEntry(updated, user, leadId)
    void deferPipelineMaterialization(user, entry, previousEntry)
    if (!entry) {
      return sendJson(res, 404, { error: 'Lead not in pipeline' })
    }

    const storeUser = updated.users?.find((u) => u.id === user.id) || user
    const leadForGoogle = entry.lead || entry

    void syncCrmScheduleToGoogleAfterSave({
      user,
      storeUser,
      leadId,
      leadForGoogle,
      lastAddedMeeting,
      lastAddedTask,
      completedTaskForGoogle,
    }).catch((error) => {
      console.warn('Google Calendar sync after CRM save:', error?.message || error)
    })

    if (
      assignToUserId !== undefined &&
      assignToUserId &&
      organizationId &&
      assignToUserId !== previousAssignee
    ) {
      void notifyLeadAssigned({
        store: updated,
        entry,
        assigneeUserId: assignToUserId,
        actorUser: user,
        organizationId,
      }).catch((error) => {
        console.warn('Lead assignment email failed:', error?.message || error)
      })
    }

    const merged = findPipelineEntry(updated, user, leadId) || entry

    if (organizationId && merged) {
      const leadLabel =
        merged.lead?.company || merged.company || merged.lead?.name || 'Customer'
      const actor = { id: user.id, name: user.name || user.email }
      if (dealAction?.action) {
        const deal =
          dealAction.dealId
            ? merged.crm?.deals?.find((d) => d.id === dealAction.dealId)
            : merged.crm?.deals?.[merged.crm.deals.length - 1]
        const kind =
          dealAction.action === 'add'
            ? 'deal_created'
            : dealAction.action === 'won'
              ? 'deal_won'
              : dealAction.action === 'lost'
                ? 'deal_lost'
                : dealAction.action === 'update'
                  ? 'deal_stage_changed'
                  : null
        const payload = dealActivityFromPatch({
          organizationId,
          leadId,
          leadLabel,
          deal,
          previousStage: dealAction.previousStage,
          actor,
          kind,
        })
        if (payload) void emitChithiCrmActivity(payload)
      }
      if (meetingAction?.action === 'add' && lastAddedMeeting) {
        const payload = dealActivityFromPatch({
          organizationId,
          leadId,
          leadLabel,
          deal: { title: lastAddedMeeting.title },
          actor,
          kind: 'meeting_booked',
        })
        if (payload) void emitChithiCrmActivity(payload)
      }
      if (taskAction?.action === 'complete' && taskAction.taskId) {
        const task = merged.crm?.tasks?.find((t) => t.id === taskAction.taskId)
        const payload = dealActivityFromPatch({
          organizationId,
          leadId,
          leadLabel,
          deal: { title: task?.title },
          actor,
          kind: 'task_completed',
        })
        if (payload) void emitChithiCrmActivity(payload)
      }
    }

    const mergeLead =
      lightCrmPatch ||
      notesOnlyPatch ||
      (crmPatch && !activity && !taskAction && !meetingAction && !fieldVisit && !contactPatch &&
        Object.keys(crmPatch).every((key) =>
          ['status', 'responseReceived', 'notes', 'nextFollowUpAt'].includes(key)
        ))
        ? mergeLeadForTenantLight
        : mergeLeadForTenant
    const { queueEnterpriseLeadSync } = await import('../enterpriseLeadsSync.js')
    queueEnterpriseLeadSync(merged)

    return sendPipelineJson(res, 200, user, {
      lead: mergeLead(updated, user, merged),
    })
  }

  if (req.method === 'DELETE') {
    const body = getBody(req)
    const leadId = body.leadId

    if (!leadId) {
      return sendJson(res, 400, { error: 'leadId is required' })
    }

    const updated = await updateStore((draft) => {
      draft.savedLeads = draft.savedLeads.filter(
        (e) =>
          !(
            e.lead.id === leadId &&
            (organizationId ? e.organizationId === organizationId : e.userId === user.id)
          )
      )
      return draft
    })

    return sendJson(res, 200, { leadId })
  }

  return methodNotAllowed(res, ['GET', 'POST', 'PATCH', 'DELETE'])
}
