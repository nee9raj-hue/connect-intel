import { getOrganization } from './organizations.js'
import { readStore } from './store.js'
import { getLatestWorkspaceImport, listOrgWorkspaceImports } from './orgWorkspaceImport.js'
import { normalizePhoneDigits } from './phoneUtils.js'
import {
  buildErpFromFacts,
  resolveLeadTradingProfile,
  normalizeCompanyMatchKey,
} from '../leadErp.js'

const INDEX_TTL_MS = 120_000
const indexes = new Map()

function rowValue(row, keys) {
  if (!row || typeof row !== 'object') return ''
  for (const key of keys) {
    if (row[key] != null && String(row[key]).trim()) return String(row[key]).trim()
  }
  const lower = {}
  for (const [k, v] of Object.entries(row)) {
    lower[String(k).trim().toLowerCase()] = v
  }
  for (const key of keys) {
    const v = lower[key.toLowerCase()]
    if (v != null && String(v).trim()) return String(v).trim()
  }
  return ''
}

function parseAmount(value) {
  if (value == null || value === '') return 0
  const n = Number(String(value).replace(/[,₹\s]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function shipmentFromRow(row) {
  const date = rowValue(row, [
    'shipment_date',
    'date',
    'trade_date',
    'invoice_date',
    'last_shipment',
  ])
  if (!date) return null
  return {
    date,
    amount: parseAmount(rowValue(row, ['final_amount', 'amount', 'revenue', 'invoice', 'value'])),
    description: rowValue(row, ['notes', 'awb', 'shipping_method', 'shipper']) || 'Shipment',
    company: rowValue(row, ['shipper', 'company', 'customer', 'customer_name', 'client']),
    customerCode: rowValue(row, ['customer_code', 'erp_id', 'account_code', 'account', 'crn']),
    gstin: String(rowValue(row, ['gstin', 'gst', 'gst_no'])).replace(/\s+/g, '').toUpperCase(),
    phone: normalizePhoneDigits(rowValue(row, ['phone', 'mobile', 'mobile_number'])),
  }
}

function pushIndex(map, key, event) {
  if (!key) return
  const list = map.get(key) || []
  list.push(event)
  map.set(key, list)
}

export function buildWorkspaceShipmentIndex(rows = []) {
  const byCode = new Map()
  const byCompany = new Map()
  const byGst = new Map()
  const byPhone = new Map()
  for (const row of rows || []) {
    const event = shipmentFromRow(row)
    if (!event) continue
    pushIndex(byCode, String(event.customerCode || '').trim().toLowerCase(), event)
    pushIndex(byCompany, normalizeCompanyMatchKey(event.company), event)
    pushIndex(byGst, event.gstin, event)
    pushIndex(byPhone, event.phone, event)
  }
  return { byCode, byCompany, byGst, byPhone }
}

function workspaceRowsForOrg(store, orgId) {
  const org = getOrganization(store, orgId)
  const latest = getLatestWorkspaceImport(store, org)
  const seen = new Set()
  const rows = []
  const add = (list) => {
    for (const row of list || []) {
      rows.push(row)
    }
  }
  add(latest?.rows)
  if (latest?.id) seen.add(latest.id)
  for (const rec of listOrgWorkspaceImports(store, orgId)) {
    if (!rec?.rows?.length || seen.has(rec.id)) continue
    seen.add(rec.id)
    add(rec.rows)
  }
  return rows
}

function indexForOrg(store, orgId) {
  if (!orgId) return null
  const rows = workspaceRowsForOrg(store, orgId)
  const importId = `${rows.length}:${listOrgWorkspaceImports(store, orgId)
    .map((r) => r.id)
    .join(',')}`
  const hit = indexes.get(orgId)
  if (hit && hit.importId === importId && Date.now() - hit.builtAt < INDEX_TTL_MS) {
    return hit
  }
  const built = {
    importId,
    builtAt: Date.now(),
    ...buildWorkspaceShipmentIndex(rows),
  }
  indexes.set(orgId, built)
  return built
}

function codesFromLeadText(entry) {
  const lead = entry?.lead || {}
  const trading = resolveLeadTradingProfile(entry) || {}
  const codes = new Set()
  const add = (value) => {
    const s = String(value || '').trim().toLowerCase()
    if (s) codes.add(s)
  }
  add(trading?.customerCode)
  add(lead?.customerCode)
  add(lead?.accountCode)
  add(lead?.erpId)
  add(lead?.externalId)
  const blob = [lead?.notes, lead?.remarks, entry?.crm?.notes].filter(Boolean).join(' ')
  for (const match of blob.matchAll(/(?:account|xindusid|crn)\s*:?\s*([a-z0-9._-]+)/gi)) {
    add(match[1])
  }
  return [...codes]
}

export function matchWorkspaceShipments(index, entry) {
  if (!index) return []
  const lead = entry?.lead || {}
  const trading = resolveLeadTradingProfile(entry) || {}
  const seen = new Set()
  const out = []
  const addAll = (list) => {
    for (const event of list || []) {
      const key = `${event.date}|${event.amount}|${event.company}|${event.customerCode}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(event)
    }
  }

  for (const code of codesFromLeadText(entry)) {
    addAll(index.byCode.get(code))
  }
  const gst = String(lead.gstin || lead.gst || lead.GST || '')
    .replace(/\s+/g, '')
    .toUpperCase()
  addAll(index.byGst.get(gst))
  addAll(index.byPhone.get(normalizePhoneDigits(lead.phone || trading.phone || '')))
  const companyKey = normalizeCompanyMatchKey(lead.company || trading.company)
  addAll(index.byCompany.get(companyKey))
  if (!out.length && companyKey && companyKey.length >= 8) {
    for (const [key, list] of index.byCompany.entries()) {
      if (!key) continue
      if (key.includes(companyKey) || companyKey.includes(key)) addAll(list)
    }
  }
  return out
}

export function populateLeadErp(store, user, entry) {
  const orgId = user?.organizationId || entry?.organizationId || null
  const shipments = matchWorkspaceShipments(indexForOrg(store, orgId), entry)
  return buildErpFromFacts({
    stored: entry?.erp || entry?.lead?.erp || null,
    trading: resolveLeadTradingProfile(entry),
    shipments,
    deals: entry?.crm?.deals || [],
  })
}

export async function attachOrgWorkspaceImports(store) {
  if (!store || Array.isArray(store.orgWorkspaceImports)) return store
  const extra = await readStore({ only: ['orgWorkspaceImports'] })
  store.orgWorkspaceImports = extra.orgWorkspaceImports || []
  return store
}
