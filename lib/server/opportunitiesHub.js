import { flattenDealsFromEntries } from '../dealPipeline.js'
import { isFreightDealOrg } from '../freightDeal.js'
import { getOrganization } from './organizations.js'
import { loadPipelineDealsPage } from './pipelineListLoad.js'
import { loadPipelineStoreContext } from './pipelineShard.js'

function matchOpportunitySearch(row, q) {
  const deal = row.deal || {}
  const hay = [row.leadName, row.company, deal.name, deal.notes]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return hay.includes(q)
}

function mapOpportunityRow(row) {
  return {
    id: `${row.leadId}:${row.deal?.id}`,
    leadId: row.leadId,
    leadName: row.leadName,
    company: row.company,
    deal: row.deal,
    assigneeUserId: row.assigneeUserId,
  }
}

export async function buildOpportunitiesHub(user, store, { search = '', dealStage = 'all', limit = 50, offset = 0 } = {}) {
  const org = user.organizationId ? getOrganization(store, user.organizationId) : null
  const freightOrg = isFreightDealOrg(org, user)
  const stage = String(dealStage || 'all').trim() || 'all'
  const off = Math.max(0, Number(offset) || 0)
  const lim = Math.min(100, Math.max(1, Number(limit) || 50))
  const q = String(search || '').trim().toLowerCase()

  const flattenOpts = {
    dealStage: stage === 'all' ? null : stage,
    includeClosed: stage === 'won' || stage === 'lost',
    freightOrg,
  }

  const tablePage = await loadPipelineDealsPage(user, {
    dealStage: stage,
    offset: q ? 0 : off,
    limit: q ? 500 : lim,
    freightOrg,
  })

  let rows = []
  let total = 0
  let hasMore = false

  if (tablePage) {
    rows = tablePage.deals || []
    total = tablePage.total ?? rows.length
    hasMore = tablePage.hasMore
  } else {
    const { visible } = await loadPipelineStoreContext(user, { shardOnly: true })
    rows = flattenDealsFromEntries(visible, flattenOpts)
    total = rows.length
    hasMore = off + lim < total
    if (!q) rows = rows.slice(off, off + lim)
  }

  if (q) {
    rows = rows.filter((row) => matchOpportunitySearch(row, q))
    total = rows.length
    rows = rows.slice(off, off + lim)
    hasMore = off + rows.length < total
  }

  return {
    opportunities: rows.map(mapOpportunityRow),
    total,
    limit: lim,
    offset: off,
    hasMore,
    dealStage: stage,
    freightOrg,
    fromTable: Boolean(tablePage?.fromTable),
  }
}
