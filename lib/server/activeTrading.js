import { createId } from './store.js'
import { normalizePhoneDigits } from './phoneUtils.js'
import { CRM_STATUSES, defaultCrm } from './crm.js'
import { appendActivity, normalizeExtendedCrm } from './crmWorkflow.js'
import { listPipelineSavedEntries } from './organizations.js'

const PHONE_KEYS = ['mobile', 'phone', 'contact_phone', 'whatsapp', 'mobile_number']
const FIRST_SHIP_KEYS = [
  'first_shipment_date',
  'first_shipment',
  'first_shipment_at',
  'first_ship_date',
  'first shipment date',
]
const LAST_SHIP_KEYS = ['last_shipment_date', 'last_shipment', 'last_shipment_at', 'last_ship_date']
const COUNT_KEYS = ['shipment_count', 'shipments_count', 'total_shipments', 'shipment_count_total']
const SHIPMENTS_LIST_KEYS = ['shipments', 'shipment_dates', 'all_shipment_dates']
const COMPANY_KEYS = ['company', 'company_name', 'customer_name']
const CODE_KEYS = ['customer_code', 'erp_id', 'external_id', 'account_id']
const GST_KEYS = ['gstin', 'gst', 'gst_no']

function pickField(row, keys) {
  for (const key of keys) {
    const direct = row[key]
    if (direct !== undefined && direct !== null && String(direct).trim()) {
      return String(direct).trim()
    }
  }
  const lower = {}
  for (const [k, v] of Object.entries(row || {})) {
    lower[String(k).trim().toLowerCase()] = v
  }
  for (const key of keys) {
    const v = lower[key.toLowerCase()]
    if (v !== undefined && v !== null && String(v).trim()) return String(v).trim()
  }
  return ''
}

export function parseFlexibleDate(value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const d = new Date(raw.length === 10 ? `${raw}T12:00:00Z` : raw)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  const dmY = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/)
  if (dmY) {
    const day = Number(dmY[1])
    const month = Number(dmY[2]) - 1
    let year = Number(dmY[3])
    if (year < 100) year += 2000
    const d = new Date(Date.UTC(year, month, day, 12, 0, 0))
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function parseShipmentList(value) {
  const raw = String(value || '').trim()
  if (!raw) return []
  const parts = raw.split(/[;|,|\n]+/).map((s) => s.trim()).filter(Boolean)
  const dates = []
  for (const part of parts) {
    const iso = parseFlexibleDate(part)
    if (iso) dates.push(iso)
  }
  return [...new Set(dates)].sort()
}

export function rowToTradingRow(row) {
  const phone = normalizePhoneDigits(pickField(row, PHONE_KEYS))
  const shipmentList = parseShipmentList(pickField(row, SHIPMENTS_LIST_KEYS))
  let firstShipmentAt = parseFlexibleDate(pickField(row, FIRST_SHIP_KEYS))
  let lastShipmentAt = parseFlexibleDate(pickField(row, LAST_SHIP_KEYS))
  const countRaw = pickField(row, COUNT_KEYS)
  let shipmentCount = countRaw ? Math.max(0, Number(countRaw) || 0) : 0

  if (shipmentList.length) {
    if (!firstShipmentAt) firstShipmentAt = shipmentList[0]
    if (!lastShipmentAt) lastShipmentAt = shipmentList[shipmentList.length - 1]
    if (!shipmentCount) shipmentCount = shipmentList.length
  }

  if (firstShipmentAt && lastShipmentAt && new Date(firstShipmentAt) > new Date(lastShipmentAt)) {
    const swap = firstShipmentAt
    firstShipmentAt = lastShipmentAt
    lastShipmentAt = swap
  }

  if (!shipmentCount && (firstShipmentAt || lastShipmentAt)) shipmentCount = 1

  const custom = {}
  for (const [k, v] of Object.entries(row || {})) {
    const key = String(k).trim().toLowerCase()
    if (
      [
        ...PHONE_KEYS,
        ...FIRST_SHIP_KEYS,
        ...LAST_SHIP_KEYS,
        ...COUNT_KEYS,
        ...SHIPMENTS_LIST_KEYS,
        ...COMPANY_KEYS,
        ...CODE_KEYS,
        ...GST_KEYS,
        'notes',
        'note',
      ].includes(key)
    ) {
      continue
    }
    if (v !== undefined && v !== null && String(v).trim()) custom[k] = String(v).trim()
  }

  return {
    phone,
    company: pickField(row, COMPANY_KEYS),
    customerCode: pickField(row, CODE_KEYS),
    gstin: pickField(row, GST_KEYS),
    notes: pickField(row, ['notes', 'note']),
    firstShipmentAt,
    lastShipmentAt,
    shipmentCount: shipmentCount || (firstShipmentAt ? 1 : 0),
    shipments: shipmentList.map((date) => ({ date })),
    custom,
  }
}

export function normalizeTradingProfile(raw) {
  if (!raw || typeof raw !== 'object') return null
  const firstShipmentAt = raw.firstShipmentAt || null
  const lastShipmentAt = raw.lastShipmentAt || null
  const shipments = Array.isArray(raw.shipments) ? raw.shipments.filter((s) => s?.date) : []
  if (!firstShipmentAt && !lastShipmentAt && !shipments.length && !raw.active) return null
  return {
    active: Boolean(raw.active ?? (firstShipmentAt || lastShipmentAt || shipments.length)),
    firstShipmentAt,
    lastShipmentAt,
    shipmentCount: Math.max(0, Number(raw.shipmentCount) || shipments.length || (firstShipmentAt ? 1 : 0)),
    shipments: shipments.slice(0, 120),
    customerCode: raw.customerCode ? String(raw.customerCode).slice(0, 80) : null,
    gstin: raw.gstin ? String(raw.gstin).slice(0, 20) : null,
    source: raw.source === 'api' ? 'api' : 'upload',
    lastSyncAt: raw.lastSyncAt || null,
    custom: raw.custom && typeof raw.custom === 'object' ? raw.custom : {},
    notes: raw.notes ? String(raw.notes).slice(0, 500) : null,
  }
}

function mergeTradingProfile(existing, incoming) {
  const prev = normalizeTradingProfile(existing) || {}
  const dates = [
    ...(prev.shipments || []).map((s) => s.date),
    ...(incoming.shipments || []).map((s) => s.date),
    prev.firstShipmentAt,
    prev.lastShipmentAt,
    incoming.firstShipmentAt,
    incoming.lastShipmentAt,
  ]
    .filter(Boolean)
    .sort()

  const uniqueDates = [...new Set(dates)]
  const firstShipmentAt = uniqueDates[0] || incoming.firstShipmentAt || prev.firstShipmentAt || null
  const lastShipmentAt =
    uniqueDates[uniqueDates.length - 1] || incoming.lastShipmentAt || prev.lastShipmentAt || null
  const shipmentCount = Math.max(
    incoming.shipmentCount || 0,
    prev.shipmentCount || 0,
    uniqueDates.length,
    firstShipmentAt ? 1 : 0
  )

  return normalizeTradingProfile({
    active: true,
    firstShipmentAt,
    lastShipmentAt,
    shipmentCount,
    shipments: uniqueDates.map((date) => ({ date })),
    customerCode: incoming.customerCode || prev.customerCode,
    gstin: incoming.gstin || prev.gstin,
    notes: incoming.notes || prev.notes,
    source: incoming.source || prev.source || 'upload',
    lastSyncAt: new Date().toISOString(),
    custom: { ...prev.custom, ...incoming.custom },
  })
}

function buildPhoneIndex(store, organizationId) {
  const index = new Map()
  for (const entry of store.savedLeads || []) {
    if (entry.organizationId !== organizationId) continue
    const phone = normalizePhoneDigits(entry.lead?.phone)
    if (!phone) continue
    if (!index.has(phone)) index.set(phone, [])
    index.get(phone).push(entry)
  }
  return index
}

export function importActiveTradingRows(
  store,
  { organizationId, actor, rows, promoteToActive = true }
) {
  const phoneIndex = buildPhoneIndex(store, organizationId)
  const now = new Date().toISOString()
  let matchedRows = 0
  let updatedLeads = 0
  const unmatched = []
  const matched = []

  for (const rawRow of rows) {
    const parsed = rowToTradingRow(rawRow)
    if (!parsed.phone) {
      unmatched.push({ row: rawRow, reason: 'Missing or invalid mobile number' })
      continue
    }

    const entries = phoneIndex.get(parsed.phone) || []
    if (!entries.length) {
      unmatched.push({
        row: rawRow,
        phone: parsed.phone,
        company: parsed.company,
        reason: 'No pipeline lead with this mobile',
      })
      continue
    }

    matchedRows += 1
    for (const entry of entries) {
      entry.tradingProfile = mergeTradingProfile(entry.tradingProfile, {
        ...parsed,
        source: 'upload',
        lastSyncAt: now,
      })

      if (promoteToActive && parsed.firstShipmentAt) {
        const crm = normalizeExtendedCrm(entry.crm || defaultCrm())
        if (crm.status !== 'lost') {
          crm.status = 'active_trading'
          entry.crm = crm
        }
        entry.crm = appendActivity(entry.crm, {
          type: 'note',
          summary: `Active trading: first shipment ${parsed.firstShipmentAt.slice(0, 10)}`,
          userId: actor?.id,
          userName: actor?.name || actor?.email,
          meta: { tradingImport: true },
        })
      }
      updatedLeads += 1

      matched.push({
        leadId: entry.lead?.id,
        phone: parsed.phone,
        company: entry.lead?.company || parsed.company,
        firstShipmentAt: entry.tradingProfile?.firstShipmentAt,
      })
    }
  }

  const importRecord = {
    id: createId('atimport'),
    organizationId,
    uploadedByUserId: actor?.id,
    uploadedAt: now,
    rowCount: rows.length,
    matchedRows,
    updatedLeads,
    unmatchedCount: unmatched.length,
  }

  store.activeTradingImports = store.activeTradingImports || []
  store.activeTradingImports.unshift(importRecord)
  store.activeTradingImports = store.activeTradingImports.slice(0, 30)

  return {
    store,
    importRecord,
    stats: { matchedRows, updatedLeads, unmatched: unmatched.length, totalRows: rows.length },
    unmatched: unmatched.slice(0, 200),
    matched: matched.slice(0, 200),
  }
}

export function listActiveTradingCustomers(store, user) {
  const entries = listPipelineSavedEntries(store, user)
  const customers = []

  for (const entry of entries) {
    const profile = normalizeTradingProfile(entry.tradingProfile)
    const isActive =
      profile?.active ||
      entry.crm?.status === 'active_trading' ||
      Boolean(profile?.firstShipmentAt)
    if (!isActive && entry.crm?.status !== 'active_trading') continue

    const lead = entry.lead || {}
    customers.push({
      leadId: lead.id,
      name: [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.name || '—',
      company: lead.company || lead.companyName || '—',
      phone: lead.phone || '',
      email: lead.email || '',
      crmStatus: entry.crm?.status || 'new',
      assignedToUserId: entry.assignedToUserId || null,
      tradingProfile: profile || {
        active: entry.crm?.status === 'active_trading',
        firstShipmentAt: null,
        lastShipmentAt: null,
        shipmentCount: 0,
        shipments: [],
      },
      firstShipmentAt: profile?.firstShipmentAt || null,
      lastShipmentAt: profile?.lastShipmentAt || null,
      shipmentCount: profile?.shipmentCount || 0,
    })
  }

  customers.sort((a, b) => {
    const ta = a.lastShipmentAt || a.firstShipmentAt || ''
    const tb = b.lastShipmentAt || b.firstShipmentAt || ''
    return tb.localeCompare(ta)
  })

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  const newThisMonth = customers.filter(
    (c) => c.firstShipmentAt && c.firstShipmentAt >= monthStart
  ).length

  return {
    customers,
    stats: {
      total: customers.length,
      newThisMonth,
      withMultipleShipments: customers.filter((c) => (c.shipmentCount || 0) > 1).length,
      pipelineActiveStage: customers.filter((c) => c.crmStatus === 'active_trading').length,
    },
  }
}

export function listActiveTradingImportOverview(store, organizationId) {
  const imports = (store.activeTradingImports || [])
    .filter((j) => j.organizationId === organizationId)
    .slice(0, 15)
  const { stats } = listActiveTradingCustomers(store, {
    id: 'overview',
    organizationId,
    orgRole: 'org_admin',
    accountType: 'company',
  })
  return { imports, stats }
}
