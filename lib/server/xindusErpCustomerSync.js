import {
  applyOverlaysToLeadPage,
  loadStoredXindusCustomerOverlays,
  resolveXindusOrgId,
} from './xindusErpOverlayApply.js'
import { isSupabaseEnabled } from './supabaseClient.js'
import {
  fetchXindusErpCustomers,
  getXindusErpFeedConfig,
  overlaysFromXindusApiCustomers,
} from '../xindusErpCustomerFeed.js'

const PAGE_LIMIT = 250
const TIME_BUDGET_MS = 220_000

export function resolveXindusErpSyncMode(raw, now = new Date()) {
  const mode = String(raw || '').trim().toLowerCase()
  if (mode === 'full' || mode === 'incremental') return mode
  // 21:00 UTC ≈ 02:30 IST — daily full snapshot; other hours incremental.
  return now.getUTCHours() === 21 ? 'full' : 'incremental'
}

export async function runXindusErpCustomerSync({
  mode = 'incremental',
  updatedSince = null,
  offset = 0,
  dryRun = false,
  nameQuery = 'Xindus',
  organizationId = null,
  timeBudgetMs = TIME_BUDGET_MS,
} = {}) {
  const started = Date.now()
  const { configured } = getXindusErpFeedConfig()
  if (!configured) {
    return { ok: false, skipped: true, reason: 'erp_api_not_configured' }
  }
  if (!isSupabaseEnabled()) {
    return { ok: false, skipped: true, reason: 'supabase_not_configured' }
  }

  const feed = await fetchXindusErpCustomers({ mode, updatedSince })
  const overlays = overlaysFromXindusApiCustomers(feed.rows)
  const storedOverlays = await loadStoredXindusCustomerOverlays().catch(() => [])
  const shipmentOverlays = storedOverlays.length ? [...overlays, ...storedOverlays] : overlays
  const orgId = organizationId || (await resolveXindusOrgId(nameQuery))

  const totals = {
    scanned: 0,
    matched: 0,
    updated: 0,
    assigned: 0,
    unassigned: 0,
  }
  let pageOffset = Math.max(0, Number(offset) || 0)
  let done = false
  let pages = 0

  while (Date.now() - started < timeBudgetMs) {
    const page = await applyOverlaysToLeadPage({
      organizationId: orgId,
      overlays,
      shipmentOverlays,
      offset: pageOffset,
      limit: PAGE_LIMIT,
      dryRun,
      reclaimUnmatchedOwners: mode === 'full' || overlays.length >= 500,
    })
    totals.scanned += page.scanned || 0
    totals.matched += page.matched || 0
    totals.updated += page.updated || 0
    totals.assigned += page.assigned || 0
    totals.unassigned += page.unassigned || 0
    totals.reclaimed = (totals.reclaimed || 0) + (page.reclaimed || 0)
    pages += 1
    done = Boolean(page.done)
    pageOffset = page.nextOffset
    if (done) break
  }

  return {
    ok: true,
    mode,
    dryRun,
    organizationId: orgId,
    fetched: feed.rows.length,
    overlayCount: overlays.length,
    updatedSince: feed.updatedSince,
    pages,
    done,
    nextOffset: done ? pageOffset : pageOffset,
    ...totals,
  }
}
