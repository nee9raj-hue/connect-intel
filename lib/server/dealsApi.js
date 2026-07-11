import { buildAutoDealName } from '../dealNaming.js'
import { getOrganization } from './organizations.js'
import { isFreightDealOrg } from '../freightDeal.js'
import { loadPipelineDealsPage } from './pipelineListLoad.js'
import {
  getPipelineDealById,
  orgHasPipelineDeals,
  pipelineDealsTableActive,
} from './pipelineDealsTable.js'
import { patchPipelineEntryCrm } from './pipelineShard.js'
import {
  addDeal,
  closeDealLost,
  closeDealWon,
  deleteDeal,
  duplicateDeal,
  normalizeExtendedCrm,
  updateDeal,
} from './crmWorkflow.js'
import { syncPipelineDealsAfterSave } from './pipelineDealsSync.js'
import { dealActivityFromPatch, emitChithiCrmActivity } from './chithiActivityBridge.js'
import { postCrmWorkflowDispatch } from './workflowEngine.js'

function mapDealRecord(row, { freightOrg = false } = {}) {
  if (!row) return null
  const deal = row.deal || row.payload?.deal
  return {
    id: deal?.id || row.deal_id,
    dealId: deal?.id || row.deal_id,
    leadId: row.leadId || row.lead_id,
    leadName: row.leadName || row.payload?.leadName || null,
    company: row.company || row.payload?.company || null,
    assigneeUserId: row.assigneeUserId || row.owner_id || null,
    stage: deal?.stage || row.stage,
    amount: deal?.amount ?? row.amount,
    deal,
    updatedAt: deal?.updatedAt || row.updated_at || null,
    freightOrg,
  }
}

/** Pipeline deals table row shape (LeadWorkspace + PipelineDealsView). */
export function toPipelineDealListRow(record) {
  if (!record) return null
  return {
    deal: record.deal,
    leadId: record.leadId,
    leadName: record.leadName || record.company || 'Lead',
    company: record.company || '',
    assigneeUserId: record.assigneeUserId || null,
    savedAt: record.updatedAt || record.deal?.updatedAt || record.deal?.createdAt || null,
  }
}

function leadLabelFromEntry(entry) {
  const lead = entry?.lead || entry
  return (
    [lead?.firstName, lead?.lastName].filter(Boolean).join(' ') ||
    lead?.company ||
    lead?.email ||
    'Lead'
  )
}

function emitDealMutationEffects({
  user,
  organizationId,
  leadId,
  leadLabel,
  deal,
  previousStage,
  action,
  actor,
}) {
  const kind =
    action === 'add'
      ? 'deal_created'
      : action === 'won'
        ? 'deal_won'
        : action === 'lost'
          ? 'deal_lost'
          : action === 'update'
            ? 'deal_stage_changed'
            : null
  const payload = dealActivityFromPatch({
    organizationId,
    leadId,
    leadLabel,
    deal,
    previousStage,
    actor,
    kind,
  })
  if (payload) void emitChithiCrmActivity(payload)
  if (action === 'won' && organizationId) {
    void postCrmWorkflowDispatch({
      firedRules: [],
      trigger: 'deal_won',
      leadId,
      organizationId,
      actor: user,
      meta: { dealId: deal?.id, stage: deal?.stage },
    })
  }
}

async function persistDealMutation(user, leadId, mutateCrm, metaStore) {
  let previousStage = null
  let mutationAction = null
  let resultDeal = null

  const updatedEntry = await patchPipelineEntryCrm(
    user,
    leadId,
    (crm) => {
      const normalized = normalizeExtendedCrm(crm)
      const outcome = mutateCrm(normalized)
      if (outcome?.error) {
        const err = new Error(outcome.error)
        err.status = outcome.status || 400
        throw err
      }
      if (outcome?.crm) {
        mutationAction = outcome.action
        previousStage = outcome.previousStage
        resultDeal = outcome.deal
        return outcome.crm
      }
      return outcome
    },
    { metaStore }
  ).catch((error) => {
    if (error?.status) return { error: error.message, status: error.status }
    throw error
  })

  if (updatedEntry?.error) return updatedEntry
  if (!updatedEntry) return { error: 'Lead not in pipeline', status: 404 }

  if (user.organizationId) {
    syncPipelineDealsAfterSave({ organizationId: user.organizationId, entry: updatedEntry })
  }

  const actor = { userId: user.id, name: user.name || user.email }
  const deal =
    resultDeal ||
    updatedEntry.crm?.deals?.find((d) => d.id === resultDeal?.id) ||
    updatedEntry.crm?.deals?.[0]
  emitDealMutationEffects({
    user,
    organizationId: user.organizationId,
    leadId,
    leadLabel: leadLabelFromEntry(updatedEntry),
    deal,
    previousStage,
    action: mutationAction,
    actor,
  })

  return { entry: updatedEntry, deal }
}

export async function getCrmDeal(user, dealId, metaStore) {
  if (!dealId || !user?.organizationId) return null

  if (pipelineDealsTableActive() && (await orgHasPipelineDeals(user.organizationId))) {
    const sqlRow = await getPipelineDealById(user.organizationId, dealId)
    if (sqlRow) {
      const org = getOrganization(metaStore, user.organizationId)
      const freightOrg = isFreightDealOrg(org, user)
      return { ...mapDealRecord(sqlRow, { freightOrg }), fromTable: true }
    }
  }

  const org = getOrganization(metaStore, user.organizationId)
  const freightOrg = isFreightDealOrg(org, user)
  const page = await loadPipelineDealsPage(user, { dealStage: 'all', offset: 0, limit: 500, freightOrg })
  const match = (page?.deals || []).find((row) => String(row.deal?.id) === String(dealId))
  if (!match) return null
  return { ...mapDealRecord(match, { freightOrg }), fromTable: Boolean(page?.fromTable) }
}

export async function listCrmDeals(
  user,
  metaStore,
  { search = '', dealStage = 'all', limit = 50, offset = 0, leadId = null, assigneeUserId = null } = {}
) {
  const org = user.organizationId ? getOrganization(metaStore, user.organizationId) : null
  const freightOrg = isFreightDealOrg(org, user)
  const filters = {}
  if (assigneeUserId) filters.assigneeUserId = assigneeUserId

  const page = await loadPipelineDealsPage(user, {
    dealStage,
    offset,
    limit,
    freightOrg,
    filters,
  })
  if (!page) {
    return { deals: [], total: 0, limit, offset, hasMore: false, dealStage, fromTable: false }
  }

  let records = (page.deals || []).map((row) => mapDealRecord(row, { freightOrg }))
  const leadFilter = String(leadId || '').trim()
  if (leadFilter) {
    records = records.filter((row) => String(row.leadId) === leadFilter)
  }

  const q = String(search || '').trim().toLowerCase()
  if (q) {
    records = records.filter((row) => {
      const hay = [row.leadName, row.company, row.deal?.name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }

  const deals = records.map(toPipelineDealListRow).filter(Boolean)

  return {
    deals,
    total: q || leadFilter ? deals.length : page.total ?? deals.length,
    limit: page.limit ?? limit,
    offset: page.offset ?? offset,
    hasMore: page.hasMore ?? false,
    dealStage: page.dealStage || dealStage,
    fromTable: Boolean(page.fromTable || page.fromDealsTable),
  }
}

export async function createCrmDeal(user, payload, metaStore) {
  const leadId = String(payload?.leadId || '').trim()
  if (!leadId) return { error: 'leadId is required', status: 400 }

  const actor = { userId: user.id, name: user.name || user.email }
  const result = await persistDealMutation(
    user,
    leadId,
    (crm) => {
      let dealName = String(payload.name || '').trim()
      if (!dealName && payload.autoName) {
        dealName = buildAutoDealName({
          company: payload.company || crm.company,
          existingDeals: crm.deals,
        })
      }
      if (!dealName) dealName = 'Deal'
      const added = addDeal(
        crm,
        {
          name: dealName,
          stage: payload.stage,
          amount: payload.amount,
          currency: payload.currency,
          expectedCloseDate: payload.expectedCloseDate,
          notes: payload.notes,
          freight: payload.freight,
        },
        actor
      )
      return { crm: added.crm, deal: added.deal, action: 'add' }
    },
    metaStore
  )

  if (result.error) return result
  const dealId = result.deal?.id
  const refreshed = dealId ? await getCrmDeal(user, dealId, metaStore) : null
  return { deal: refreshed, entry: result.entry }
}

export async function duplicateCrmDeal(user, dealId, payload, metaStore) {
  const existing = await getCrmDeal(user, dealId, metaStore)
  if (!existing?.leadId) return { error: 'Deal not found', status: 404 }

  const actor = { userId: user.id, name: user.name || user.email }
  const result = await persistDealMutation(
    user,
    existing.leadId,
    (crm) => {
      const duplicated = duplicateDeal(
        crm,
        dealId,
        {
          company: payload.company || existing.company,
          stage: payload.stage,
        },
        actor
      )
      if (!duplicated.deal) return crm
      return { crm: duplicated.crm, deal: duplicated.deal, action: 'add' }
    },
    metaStore
  )

  if (result.error) return result
  const refreshed = await getCrmDeal(user, result.deal?.id, metaStore)
  return { deal: refreshed, entry: result.entry }
}

export async function patchCrmDeal(user, dealId, patch, metaStore) {
  const existing = await getCrmDeal(user, dealId, metaStore)
  if (!existing?.leadId) return { error: 'Deal not found', status: 404 }

  const actor = { userId: user.id, name: user.name || user.email }
  const action = patch.action
  const previousStage = existing.deal?.stage

  const result = await persistDealMutation(
    user,
    existing.leadId,
    (crm) => {
      let next = normalizeExtendedCrm(crm)
      if (action === 'won') {
        next = closeDealWon(next, dealId, actor)
      } else if (action === 'lost') {
        next = closeDealLost(next, dealId, { lostReason: patch.lostReason }, actor)
      } else {
        next = updateDeal(next, dealId, patch, actor)
      }
      const deal = next.deals?.find((d) => d.id === dealId)
      return {
        crm: next,
        deal,
        action: action || (patch.stage !== undefined ? 'update' : 'update'),
        previousStage,
      }
    },
    metaStore
  )

  if (result.error) return result
  const refreshed = await getCrmDeal(user, dealId, metaStore)
  return { deal: refreshed, entry: result.entry }
}

export async function deleteCrmDeal(user, dealId, metaStore) {
  const existing = await getCrmDeal(user, dealId, metaStore)
  if (!existing?.leadId) return { error: 'Deal not found', status: 404 }

  const actor = { userId: user.id, name: user.name || user.email }
  const result = await persistDealMutation(
    user,
    existing.leadId,
    (crm) => {
      const next = deleteDeal(crm, dealId, actor)
      return { crm: next, deal: existing.deal, action: null }
    },
    metaStore
  )

  if (result.error) return result
  return { ok: true, entry: result.entry }
}
