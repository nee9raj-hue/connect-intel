#!/usr/bin/env node
/**
 * One-time / cron: rebuild dashboard snapshots for all organizations.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/warm-dashboard-snapshots.mjs
 *   node scripts/warm-dashboard-snapshots.mjs --org=ORG_ID
 */

import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const storeUrl = pathToFileURL(join(ROOT, 'lib/server/store.js')).href
const snapUrl = pathToFileURL(join(ROOT, 'lib/server/dashboardSnapshots.js')).href

const { readStore } = await import(storeUrl)
const { refreshDashboardSnapshotsForUser } = await import(snapUrl)

const orgArg = process.argv.find((a) => a.startsWith('--org='))?.split('=')[1]

const store = await readStore({ only: ['organizations', 'users'] })
const orgs = orgArg
  ? (store.organizations || []).filter((o) => o.id === orgArg)
  : store.organizations || []

console.log(`Warming dashboard snapshots for ${orgs.length} organization(s)…\n`)

for (const org of orgs) {
  const admin =
    (store.users || []).find(
      (u) => u.organizationId === org.id && (u.orgRole === 'org_admin' || u.isOrgAdmin)
    ) || (store.users || []).find((u) => u.organizationId === org.id)
  if (!admin) {
    console.warn(`  skip ${org.name || org.id}: no user`)
    continue
  }
  const started = Date.now()
  try {
    const result = await refreshDashboardSnapshotsForUser(admin, 'week')
    console.log(
      `  ✓ ${org.name || org.id}: ${result?.entryCount ?? 0} leads (${Date.now() - started}ms)`
    )
  } catch (error) {
    console.error(`  ✗ ${org.name || org.id}:`, error?.message || error)
  }
}

console.log('\nDone.')
