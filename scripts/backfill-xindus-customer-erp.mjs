#!/usr/bin/env node
/**
 * Overlay Xindus ERP customer fields onto matching pipeline leads.
 *
 * Live customer-service API (preferred):
 *   node scripts/backfill-xindus-customer-erp.mjs --from-api
 *
 * Excel dump (fallback):
 *   node scripts/backfill-xindus-customer-erp.mjs --xlsx=/path/to/Xindus\ customer.xlsx
 *
 * Direct DB (if SUPABASE_SERVICE_ROLE_KEY is in the env):
 *   node scripts/backfill-xindus-customer-erp.mjs --local --from-api
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { erpFromXindusCustomerRow, matchKeysFromXindusRow } from '../lib/xindusCustomerErp.js'
import { compactErp } from '../lib/server/xindusErpOverlayApply.js'
import { isSupabaseEnabled } from '../lib/server/supabaseClient.js'
import { applyOverlaysToLeadPage, resolveXindusOrgId } from '../lib/server/xindusErpOverlayApply.js'
import {
  fetchXindusErpCustomers,
  getXindusErpFeedConfig,
  overlaysFromXindusApiCustomers,
} from '../lib/xindusErpCustomerFeed.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const resetOwners = process.argv.includes('--reset-owners')
const forceLocal = process.argv.includes('--local')
const fromOverlay = Math.max(
  0,
  Number(process.argv.find((a) => a.startsWith('--from-overlay='))?.slice('--from-overlay='.length) || 0) || 0
)
const pageOffsetStart = Math.max(
  0,
  Number(process.argv.find((a) => a.startsWith('--from-offset='))?.slice('--from-offset='.length) || 0) || 0
)
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

const fromApi = process.argv.includes('--from-api') || (!xlsxArg && getXindusErpFeedConfig().configured)

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
    const erp = compactErp(overlay)
    erp.ownership = {}
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
      ownerAuthoritative: false,
      erp,
    })
  }
  return overlays
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function postBackfill(secret, body) {
  let lastErr
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const res = await fetch(`${apiBase.replace(/\/$/, '')}/api/crm/xindus-erp-backfill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      return data
    } catch (err) {
      lastErr = err
      console.warn(`retry ${attempt}/6: ${err.message || err}`)
      await sleep(2500 * attempt)
    }
  }
  throw lastErr
}

async function postOverlayPage(secret, slice, offset) {
  return postBackfill(secret, {
    nameQuery: 'Xindus',
    overlays: slice,
    offset,
    limit: 250,
    dryRun,
  })
}

async function resetRemoteOwners(secret) {
  const totals = { scanned: 0, updated: 0, reclaimed: 0 }
  let offset = 0
  for (;;) {
    const data = await postBackfill(secret, {
      nameQuery: 'Xindus',
      resetOwners: true,
      offset,
      limit: 250,
      dryRun,
    })
    totals.scanned += data.scanned || 0
    totals.updated += data.updated || 0
    totals.reclaimed += data.reclaimed || 0
    console.log(
      `reset offset ${offset}: scanned ${data.scanned} updated ${data.updated} reclaimed ${data.reclaimed} done=${data.done}`
    )
    if (data.done) break
    offset = data.nextOffset
  }
  return totals
}

async function pushRemote(overlays) {
  const secret = process.env.CRON_SECRET
  if (!secret) throw new Error('CRON_SECRET missing — cannot call production backfill')
  if (resetOwners) {
    console.log('Clearing ERP dump owners on existing Xindus leads (deals/notes kept)')
    await resetRemoteOwners(secret)
  }
  const overlayBatchSize = overlays.length <= 8000 ? overlays.length || 1 : 800
  const totals = { scanned: 0, matched: 0, updated: 0 }
  let orgId = null
  for (let start = fromOverlay; start < overlays.length; start += overlayBatchSize) {
    const slice = overlays.slice(start, start + overlayBatchSize)
    let offset = start === fromOverlay ? pageOffsetStart : 0
    for (;;) {
      const data = await postOverlayPage(secret, slice, offset)
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
  const totals = { scanned: 0, matched: 0, updated: 0, reclaimed: 0, organizationId }
  if (resetOwners) {
    let offset = 0
    for (;;) {
      const data = await applyOverlaysToLeadPage({
        organizationId,
        overlays: [],
        offset,
        limit: 250,
        dryRun,
        resetOwners: true,
      })
      totals.scanned += data.scanned
      totals.updated += data.updated
      totals.reclaimed += data.reclaimed || 0
      console.log(
        `reset offset ${offset}: scanned ${data.scanned} updated ${data.updated} done=${data.done}`
      )
      if (data.done) break
      offset = data.nextOffset
    }
  }
  let offset = 0
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

console.log(fromApi ? 'Fetching ERP customer-service feed' : `Reading ${xlsx}`)
const overlays = fromApi
  ? overlaysFromXindusApiCustomers((await fetchXindusErpCustomers({ mode: 'full' })).rows)
  : buildOverlays(dumpExcelRows())
console.log(`overlays ${overlays.length}`)

const result =
  !forceLocal && process.env.CRON_SECRET
    ? await pushRemote(overlays)
    : await pushLocal(overlays)
console.log(JSON.stringify(result, null, 2))
