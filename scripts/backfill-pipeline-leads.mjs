#!/usr/bin/env node
/**
 * Backfill pipeline_org_* / pipeline_user_* JSON shards → pipeline_leads table.
 *
 * Prerequisite: run migration in Supabase SQL editor:
 *   supabase/migrations/20260609120000_pipeline_leads.sql
 *   (or 20260610120000_crm_relational_v3.sql for owner_id/email/phone columns)
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run pipeline:backfill
 *   npm run pipeline:backfill -- --org=ORG_ID
 *   npm run pipeline:backfill -- --shard=pipeline_org_abc
 *   npm run pipeline:backfill -- --dry-run
 *   npm run pipeline:backfill -- --verify
 *
 * After backfill + verify, enable on Vercel:
 *   USE_PIPELINE_LEADS_TABLE=true
 */

import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const backfillUrl = pathToFileURL(join(ROOT, 'lib/server/pipelineLeadsBackfill.js')).href
const supabaseUrl = pathToFileURL(join(ROOT, 'lib/server/supabaseClient.js')).href
const storeUrl = pathToFileURL(join(ROOT, 'lib/server/store.js')).href

const {
  backfillAllPipelineShards,
  backfillPipelineShard,
  backfillOrganization,
  verifyPipelineLeadsBackfill,
} = await import(backfillUrl)
const { isSupabaseEnabled } = await import(supabaseUrl)
const { readStore } = await import(storeUrl)

const orgArg = process.argv.find((a) => a.startsWith('--org='))?.split('=')[1]
const shardArg = process.argv.find((a) => a.startsWith('--shard='))?.split('=')[1]
const dryRun = process.argv.includes('--dry-run')
const verifyOnly = process.argv.includes('--verify')
const batchArg = process.argv.find((a) => a.startsWith('--batch='))?.split('=')[1]
const batchSize = Math.min(200, Math.max(10, Number(batchArg) || 50))

if (!isSupabaseEnabled()) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running backfill.')
  process.exit(1)
}

console.log('Connect Intel — pipeline_leads backfill\n')
if (dryRun) console.log('(dry-run — no writes)\n')
if (verifyOnly) console.log('(verify only — compare counts)\n')

const options = { dryRun, batchSize, orgId: orgArg || null }

async function printOrgLabel(orgId) {
  if (!orgId) return orgId
  try {
    const store = await readStore({ only: ['organizations'] })
    const org = (store.organizations || []).find((o) => o.id === orgId)
    return org?.name ? `${org.name} (${orgId})` : orgId
  } catch {
    return orgId
  }
}

if (verifyOnly) {
  const report = await verifyPipelineLeadsBackfill({ orgId: orgArg || null })
  console.log(JSON.stringify(report, null, 2))
  if (!report.ok) {
    console.error(`\n✗ ${report.mismatches.length} shard(s) missing rows in pipeline_leads`)
    process.exit(1)
  }
  console.log('\n✓ All shards in sync with pipeline_leads')
  process.exit(0)
}

let result

if (shardArg) {
  const row = await backfillPipelineShard(shardArg, options)
  result = { shards: [row], totals: null, shardCount: 1 }
  console.log(
    `  ${row.shardName}: ${row.shardRows} in shard → ${dryRun ? 'would upsert' : 'upserted'} ${row.upserted}${
      row.skipped ? ` (${row.skipped} skipped)` : ''
    } · table now ${row.tableRows} rows · ${row.durationMs}ms`
  )
} else if (orgArg) {
  const label = await printOrgLabel(orgArg)
  console.log(`Organization: ${label}\n`)
  const row = await backfillOrganization(orgArg, options)
  result = { shards: [row], totals: null, shardCount: 1 }
  console.log(
    `  ${row.shardName}: ${row.shardRows} in shard → ${dryRun ? 'would upsert' : 'upserted'} ${row.upserted} · table ${
      row.tableRows
    } rows · ${row.durationMs}ms${row.inSync === false ? ' · ⚠ count mismatch' : ''}`
  )
} else {
  result = await backfillAllPipelineShards(options)
  console.log(`Shards processed: ${result.shardCount}\n`)
  for (const row of result.shards) {
    if (!row.shardRows && !row.tableRows) continue
    console.log(
      `  ${row.shardName}: ${row.shardRows} in shard → ${dryRun ? 'would upsert' : 'upserted'} ${row.upserted} · table ${
        row.tableRows
      } · ${row.durationMs}ms${row.inSync === false ? ' · ⚠' : ''}`
    )
  }
  if (result.totals) {
    console.log(
      `\nTotals: ${result.totals.shardRows} shard rows · ${result.totals.upserted} upserted · ${result.totals.tableRows} in table`
    )
    if (result.totals.outOfSync) {
      console.warn(`⚠ ${result.totals.outOfSync} shard(s) may be out of sync — run with --verify`)
    }
  }
}

if (!dryRun) {
  console.log(`
Next steps:
  1. npm run pipeline:backfill -- --verify${orgArg ? ` --org=${orgArg}` : ''}
  2. Set USE_PIPELINE_LEADS_TABLE=true on Vercel (+ redeploy)
  3. Smoke test: send email to 1 lead, save note, open pipeline
`)
}

console.log('\nDone.')
