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
  closeDealLost,
  closeDealWon,
  normalizeExtendedCrm,
  updateDeal,
} from './crmWorkflow.js'
import { syncPipelineDealsAfterSave } from './pipelineDealsSync.js'

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
  { search = '', dealStage = 'all', limit = 50, offset = 0 } = {}
) {
  const org = user.organizationId ? getOrganization(metaStore, user.organizationId) : null
  const freightOrg = isFreightDealOrg(org, user)
  const page = await loadPipelineDealsPage(user, {
    dealStage,
    offset,
    limit,
    freightOrg,
  })
  if (!page) {
    return { deals: [], total: 0, limit, offset, hasMore: false, dealStage, fromTable: false }
  }

  let deals = (page.deals || []).map((row) => mapDealRecord(row, { freightOrg }))
  const q = String(search || '').trim().toLowerCase()
  if (q) {
    deals = deals.filter((row) => {
      const hay = [row.leadName, row.company, row.deal?.name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }

  return {
    deals,
    total: q ? deals.length : page.total ?? deals.length,
    limit: page.limit ?? limit,
    offset: page.offset ?? offset,
    hasMore: page.hasMore ?? false,
    dealStage: page.dealStage || dealStage,
    fromTable: Boolean(page.fromTable || page.fromDealsTable),
  }
}

export async function patchCrmDeal(user, dealId, patch, metaStore) {
  const existing = await getCrmDeal(user, dealId, metaStore)
  if (!existing?.leadId) return { error: 'Deal not found', status: 404 }

  const actor = { userId: user.id, name: user.name || user.email }
  const action = patch.action

  const updatedEntry = await patchPipelineEntryCrm(user, existing.leadId, (crm) => {
    let next = normalizeExtendedCrm(crm)
    if (action === 'won') {
      next = closeDealWon(next, dealId, actor)
    } else if (action === 'lost') {
      next = closeDealLost(next, dealId, { lostReason: patch.lostReason }, actor)
    } else {
      next = updateDeal(next, dealId, patch, actor)
    }
    return next
  }, { metaStore })

  if (!updatedEntry) return { error: 'Lead not in pipeline', status: 404 }

  if (user.organizationId) {
    syncPipelineDealsAfterSave({ organizationId: user.organizationId, entry: updatedEntry })
  }

  const refreshed = await getCrmDeal(user, dealId, metaStore)
  return { deal: refreshed, entry: updatedEntry }
}
