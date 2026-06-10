#!/usr/bin/env node
/**
 * Backfill pipeline_activities from pipeline_leads / org shards for indexed activity log reads.
 *
 * Prerequisite: run migration in Supabase SQL editor:
 *   supabase/migrations/20260617120000_pipeline_activities_indexes.sql
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run activities:backfill
 *   npm run activities:backfill -- --org=ORG_ID
 *   npm run activities:backfill -- --dry-run
 *   npm run activities:backfill -- --verify
 */

import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const backfillUrl = pathToFileURL(join(ROOT, 'lib/server/pipelineActivitiesBackfill.js')).href
const supabaseUrl = pathToFileURL(join(ROOT, 'lib/server/supabaseClient.js')).href
const storeUrl = pathToFileURL(join(ROOT, 'lib/server/store.js')).href

const {
  backfillAllPipelineActivities,
  backfillPipelineActivitiesForOrg,
  verifyPipelineActivitiesBackfill,
} = await import(backfillUrl)
const { isSupabaseEnabled } = await import(supabaseUrl)
const { readStore } = await import(storeUrl)

const orgArg = process.argv.find((a) => a.startsWith('--org='))?.split('=')[1]
const dryRun = process.argv.includes('--dry-run')
const verifyOnly = process.argv.includes('--verify')
const batchArg = process.argv.find((a) => a.startsWith('--batch='))?.split('=')[1]
const batchSize = Math.min(200, Math.max(10, Number(batchArg) || 100))

if (!isSupabaseEnabled()) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running backfill.')
  process.exit(1)
}

console.log('Connect Intel — pipeline_activities backfill\n')
if (dryRun) console.log('(dry-run — no writes)\n')
if (verifyOnly) console.log('(verify only)\n')

const options = { dryRun, batchSize, orgId: orgArg || null }

if (verifyOnly) {
  const report = await verifyPipelineActivitiesBackfill({ orgId: orgArg || null })
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.ok ? 0 : 1)
}

let results
if (orgArg) {
  results = [await backfillPipelineActivitiesForOrg(orgArg, options)]
} else {
  results = await backfillAllPipelineActivities(options)
}

for (const row of results) {
  const store = await readStore({ only: ['organizations'] })
  const org = (store.organizations || []).find((o) => o.id === row.organizationId)
  const label = org?.name || row.organizationId
  console.log(
    `  ${dryRun ? '~' : '✓'} ${label}: scanned ${row.scanned} leads, ${dryRun ? 'would insert' : 'inserted'} ${row.inserted} activities (${row.source}, ${row.durationMs}ms)`
  )
}

console.log('\nDone. Warm snapshots: npm run dash:warm')
