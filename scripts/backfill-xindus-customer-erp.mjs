#!/usr/bin/env node
/**
 * Overlay Xindus customer.xlsx ERP fields onto matching pipeline leads.
 *
 * Prefers posting to production (server has Supabase):
 *   node scripts/backfill-xindus-customer-erp.mjs
 *   node scripts/backfill-xindus-customer-erp.mjs --dry-run
 *
 * Direct DB (if SUPABASE_SERVICE_ROLE_KEY is in the env):
 *   node scripts/backfill-xindus-customer-erp.mjs --local
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { erpFromXindusCustomerRow, matchKeysFromXindusRow } from '../lib/xindusCustomerErp.js'
import { compactErp } from '../lib/server/xindusErpOverlayApply.js'
import { isSupabaseEnabled } from '../lib/server/supabaseClient.js'
import { applyOverlaysToLeadPage, resolveXindusOrgId } from '../lib/server/xindusErpOverlayApply.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const dryRun = process.argv.includes('--dry-run')
const forceLocal = process.argv.includes('--local')
const xlsxArg = process.argv.find((a) => a.startsWith('--xlsx='))?.slice('--xlsx='.length)
const xlsx = xlsxArg || '/Users/apple/Downloads/Xindus customer.xlsx'
const apiBase = process.argv.find((a) => a.startsWith('--api='))?.slice('--api='.length) || 'https://connectintel.net'

function loadEnvFile(path) {
  try {
    const text = readFileSync(path, 'utf8')
    for (const line of text.split('\n')) {
      if (!line || line.startsWith('#') || !line.includes('=')) continue
      const i = line.indexOf('=')
      const key = line.slice(0, i).trim()
      const value = line.slice(i + 1).trim().replace(/^["']|["']$/g, '')
      if (key && value && !process.env[key]) process.env[key] = value
    }
  } catch {
    /* optional */
  }
}

loadEnvFile(join(ROOT, '.env.railway.secrets'))
loadEnvFile(join(ROOT, '.env.prod.local'))

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

function buildOverlays(rows) {
  const overlays = []
  for (const row of rows) {
    const overlay = erpFromXindusCustomerRow(row)
    if (!overlay) continue
    const keys = matchKeysFromXindusRow(row)
    overlays.push({
      xindusId: keys.xindusId,
      crmId: keys.crmId,
      phone: keys.phone,
      email: keys.email,
      company: String(row.Company || row.company || '').trim(),
      gst: keys.gst,
      pan: keys.pan,
      crn: keys.crn,
      iec: keys.iec,
      erp: compactErp(overlay),
    })
  }
  return overlays
}

async function pushRemote(overlays) {
  const secret = process.env.CRON_SECRET
  if (!secret) throw new Error('CRON_SECRET missing — cannot call production backfill')
  const overlayBatchSize = 800
  const totals = { scanned: 0, matched: 0, updated: 0 }
  let orgId = null
  for (let start = 0; start < overlays.length; start += overlayBatchSize) {
    const slice = overlays.slice(start, start + overlayBatchSize)
    let offset = 0
    for (;;) {
      const res = await fetch(`${apiBase.replace(/\/$/, '')}/api/crm/xindus-erp-backfill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({
          nameQuery: 'Xindus',
          overlays: slice,
          offset,
          limit: 250,
          dryRun,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      orgId = data.organizationId || orgId
      totals.scanned += data.scanned || 0
      totals.matched += data.matched || 0
      totals.updated += data.updated || 0
      console.log(
        `overlay ${start}-${start + slice.length - 1} offset ${offset}: scanned ${data.scanned} matched ${data.matched} updated ${data.updated} done=${data.done}`
      )
      if (data.done) break
      offset = data.nextOffset
    }
  }
  return { ...totals, orgId, dryRun, mode: 'remote' }
}

async function pushLocal(overlays) {
  if (!isSupabaseEnabled()) {
    throw new Error('Local Supabase env is not configured')
  }
  const organizationId = await resolveXindusOrgId('Xindus')
  let offset = 0
  const totals = { scanned: 0, matched: 0, updated: 0, organizationId }
  for (;;) {
    const data = await applyOverlaysToLeadPage({
      organizationId,
      overlays,
      offset,
      limit: 250,
      dryRun,
    })
    totals.scanned += data.scanned
    totals.matched += data.matched
    totals.updated += data.updated
    console.log(
      `offset ${offset}: scanned ${data.scanned} matched ${data.matched} updated ${data.updated} done=${data.done}`
    )
    if (data.done) break
    offset = data.nextOffset
  }
  return { ...totals, dryRun, mode: 'local' }
}

console.log('Reading', xlsx)
const excelRows = dumpExcelRows()
const overlays = buildOverlays(excelRows)
console.log(`Excel rows ${excelRows.length} → overlays ${overlays.length}`)

const result =
  !forceLocal && process.env.CRON_SECRET
    ? await pushRemote(overlays)
    : await pushLocal(overlays)
console.log(JSON.stringify(result, null, 2))
