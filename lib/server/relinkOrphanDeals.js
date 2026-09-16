import { normalizeDealsList } from './crmWorkflow.js'
import { patchPipelineEntryCrm } from './pipelineShard.js'
import { listPipelineDealRowsForOrg, existingPipelineLeadIds } from './pipelineDealsTable.js'
import { syncPipelineDealsAfterSave } from './pipelineDealsSync.js'

export function normalizeDealCompanyKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\b(private|pvt|ltd|limited|llp|inc|llc|co|company)\b\.?/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function companiesMatchForDealRelink(a, b) {
  const left = normalizeDealCompanyKey(a)
  const right = normalizeDealCompanyKey(b)
  if (!left || !right) return false
  if (left === right) return true
  if (left.length >= 6 && right.includes(left)) return true
  if (right.length >= 6 && left.includes(right)) return true
  return false
}

function dealFromRow(row) {
  const payload = row?.payload && typeof row.payload === 'object' ? row.payload : {}
  const deal = payload.deal && typeof payload.deal === 'object' ? payload.deal : null
  if (deal?.id) return deal
  if (!row?.deal_id) return null
  return {
    id: row.deal_id,
    stage: row.stage || 'rfq',
    amount: row.amount ?? null,
    name: payload.leadName || payload.company || 'Deal',
  }
}

function rowCompany(row) {
  const payload = row?.payload && typeof row.payload === 'object' ? row.payload : {}
  return payload.company || payload.deal?.company || payload.deal?.name || ''
}

export function selectOrphanDealsForLead(rows, entry, liveLeadIds) {
  const lead = entry?.lead || {}
  const leadId = String(lead.id || entry?.id || '')
  const company = lead.company || ''
  const have = new Set((entry?.crm?.deals || []).map((d) => String(d.id)))
  const live = liveLeadIds instanceof Set ? liveLeadIds : new Set(liveLeadIds || [])
  const attached = []

  for (const row of rows || []) {
    const deal = dealFromRow(row)
    if (!deal?.id) continue
    const id = String(deal.id)
    if (have.has(id)) continue
    const owner = String(row.lead_id || '')
    if (owner === leadId) {
      attached.push(deal)
      have.add(id)
      continue
    }
    if (owner && live.has(owner)) continue
    if (!companiesMatchForDealRelink(company, rowCompany(row))) continue
    attached.push(deal)
    have.add(id)
  }
  return attached
}

/** Attach leftover pipeline_deals (deleted lead, same company) onto a re-added lead. */
export async function relinkOrphanDealsToEntry(user, entry, { persist = true } = {}) {
  const organizationId = user?.organizationId || entry?.organizationId
  const leadId = entry?.lead?.id || entry?.id
  if (!organizationId || !leadId || !entry?.lead?.company) {
    return { entry, relinked: 0 }
  }

  const rows = await listPipelineDealRowsForOrg(organizationId)
  if (!rows.length) return { entry, relinked: 0 }

  const ownerIds = [...new Set(rows.map((r) => String(r.lead_id || '')).filter(Boolean))]
  const live = await existingPipelineLeadIds(organizationId, ownerIds)
  const orphanDeals = selectOrphanDealsForLead(rows, entry, live)
  if (!orphanDeals.length) return { entry, relinked: 0 }

  const merged = normalizeDealsList([...(entry.crm?.deals || []), ...orphanDeals])
  if (!persist) {
    return { entry: { ...entry, crm: { ...entry.crm, deals: merged } }, relinked: orphanDeals.length }
  }

  const updated = await patchPipelineEntryCrm(user, leadId, (crm) => ({
    ...crm,
    deals: normalizeDealsList([...(crm?.deals || []), ...orphanDeals]),
  }))
  const next = updated || { ...entry, crm: { ...entry.crm, deals: merged } }
  syncPipelineDealsAfterSave({ organizationId, entry: next })
  return { entry: next, relinked: orphanDeals.length }
}
