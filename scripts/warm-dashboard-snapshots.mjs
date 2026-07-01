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
const warmUrl = pathToFileURL(join(ROOT, 'lib/server/dashboardWarm.js')).href

const orgArg = process.argv.find((a) => a.startsWith('--org='))?.split('=')[1]

const { warmAllDashboardSnapshots } = await import(warmUrl)

console.log(`Warming dashboard snapshots${orgArg ? ` for org ${orgArg}` : ''}…\n`)

const { orgCount, results } = await warmAllDashboardSnapshots({ orgId: orgArg || null })

for (const row of results) {
  if (row.skipped) {
    console.warn(`  skip ${row.orgId}: ${row.reason}`)
    continue
  }
  if (row.ok) {
    console.log(`  ✓ ${row.orgId}: ${row.entryCount ?? 0} leads`)
  } else {
    console.error(`  ✗ ${row.orgId}:`, row.error)
  }
}

console.log(`\nDone. ${orgCount} organization(s) processed.`)
