#!/usr/bin/env node
/**
 * Overlay Xindus customer.xlsx ERP fields onto matching pipeline leads.
 *
 *   node scripts/backfill-xindus-customer-erp.mjs
 *   node scripts/backfill-xindus-customer-erp.mjs --dry-run
 *   node scripts/backfill-xindus-customer-erp.mjs --xlsx="/path/to/Xindus customer.xlsx"
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or vercel env run).
 */
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { erpFromXindusCustomerRow, matchKeysFromXindusRow, xindusIdFromLeadEntry } from '../lib/xindusCustomerErp.js'
import { mergeLeadErp } from '../lib/leadErp.js'
import { normalizeCompanyMatchKey } from '../lib/leadErp.js'
import { isSupabaseEnabled, supabaseRest } from '../lib/server/supabaseClient.js'
import { readStore } from '../lib/server/store.js'
import { upsertPipelineLeadRows } from '../lib/server/pipelineLeadsTable.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const dryRun = process.argv.includes('--dry-run')
const xlsxArg = process.argv.find((a) => a.startsWith('--xlsx='))?.slice('--xlsx='.length)
const xlsx = xlsxArg || '/Users/apple/Downloads/Xindus customer.xlsx'

function phoneKey(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length >= 10) return digits.slice(-10)
  return digits || ''
}

function dumpExcelRows() {
  const py = spawnSync('python3', [join(ROOT, 'scripts/xindus_excel_erp_dump.py'), xlsx], {
    encoding: 'utf8',
    maxBuffer: 80 * 1024 * 1024,
  })
  if (py.status !== 0) {
    throw new Error(py.stderr || 'Failed to read Xindus customer.xlsx')
  }
  return JSON.parse(py.stdout)
}

function indexExcel(rows) {
  const byId = new Map()
  const byPhone = new Map()
  const byEmail = new Map()
  const byCompany = new Map()
  for (const row of rows) {
    const overlay = erpFromXindusCustomerRow(row)
    if (!overlay) continue
    const keys = matchKeysFromXindusRow(row)
    const packed = { overlay, keys, company: String(row.Company || row.company || '').trim() }
    if (keys.xindusId) byId.set(keys.xindusId, packed)
    if (keys.phone) byPhone.set(phoneKey(keys.phone), packed)
    if (keys.email) byEmail.set(keys.email, packed)
    const ck = normalizeCompanyMatchKey(packed.company)
    if (ck && !byCompany.has(ck)) byCompany.set(ck, packed)
  }
  return { byId, byPhone, byEmail, byCompany }
}

function matchLead(entry, index) {
  const lead = entry?.lead || {}
  const xid = xindusIdFromLeadEntry(entry)
  if (xid && index.byId.has(xid)) return index.byId.get(xid)
  const email = String(lead.email || '').trim().toLowerCase()
  if (email && index.byEmail.has(email)) return index.byEmail.get(email)
  const phone = phoneKey(lead.phone)
  if (phone && index.byPhone.has(phone)) return index.byPhone.get(phone)
  const ck = normalizeCompanyMatchKey(lead.company)
  if (ck && index.byCompany.has(ck)) return index.byCompany.get(ck)
  return null
}

async function findXindusOrgId() {
  const store = await readStore({ only: ['organizations'] })
  const orgs = store.organizations || []
  const hit =
    orgs.find((o) => String(o.domain || '').toLowerCase().includes('xindus')) ||
    orgs.find((o) => /xindus/i.test(o.name || ''))
  return hit?.id || null
}

async function loadOrgLeads(organizationId) {
  const out = []
  let offset = 0
  for (;;) {
    const path =
      `pipeline_leads?organization_id=eq.${encodeURIComponent(organizationId)}` +
      `&select=lead_id,shard_name,entry&order=lead_id.asc&limit=200&offset=${offset}`
    const rows = await supabaseRest(path, {}, { timeoutMs: 30_000 })
    const list = Array.isArray(rows) ? rows : []
    if (!list.length) break
    out.push(...list)
    offset += list.length
    if (list.length < 200) break
  }
  return out
}

if (!isSupabaseEnabled()) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or: vercel env run -- node scripts/backfill-xindus-customer-erp.mjs)')
  process.exit(1)
}

console.log('Reading', xlsx)
const excelRows = dumpExcelRows()
const index = indexExcel(excelRows)
console.log(`Excel rows: ${excelRows.length}. Indexed ids=${index.byId.size} phones=${index.byPhone.size}`)

const orgId = await findXindusOrgId()
if (!orgId) {
  console.error('Could not find Xindus organization in store.')
  process.exit(1)
}
console.log('Org', orgId)

const tableRows = await loadOrgLeads(orgId)
console.log('Pipeline leads', tableRows.length)

let matched = 0
let updated = 0
const pendingByShard = new Map()

function queueWrite(shardName, entry) {
  const list = pendingByShard.get(shardName) || []
  list.push(entry)
  pendingByShard.set(shardName, list)
}

async function flushWrites() {
  if (dryRun) {
    pendingByShard.clear()
    return
  }
  for (const [shardName, entries] of pendingByShard) {
    await upsertPipelineLeadRows(shardName, entries, {
      force: true,
      skipMembershipGuard: true,
      batchSize: 50,
    })
    updated += entries.length
  }
  pendingByShard.clear()
}

for (const row of tableRows) {
  const entry = row.entry
  if (!entry) continue
  const hit = matchLead(entry, index)
  if (!hit) continue
  matched += 1
  const nextErp = mergeLeadErp(entry.erp || entry.lead?.erp, hit.overlay)
  entry.erp = nextErp
  if (entry.lead) entry.lead.erp = nextErp
  queueWrite(row.shard_name, entry)
  const queued = [...pendingByShard.values()].reduce((n, list) => n + list.length, 0)
  if (queued >= 100) {
    await flushWrites()
    console.log(`  wrote ${updated}`)
  }
}
await flushWrites()

console.log(JSON.stringify({ matched, updated, dryRun, totalLeads: tableRows.length, excelRows: excelRows.length }, null, 2))
