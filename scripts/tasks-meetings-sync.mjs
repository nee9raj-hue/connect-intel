#!/usr/bin/env node
/**
 * Verify pipeline_tasks / pipeline_meetings backfill; run when counts diverge.
 *
 * Usage:
 *   npm run tasks:sync
 *   npm run tasks:sync -- --org=ORG_ID
 *   npm run tasks:sync -- --dry-run
 */

import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const backfillUrl = pathToFileURL(join(ROOT, 'lib/server/pipelineCrmEntitiesBackfill.js')).href
const supabaseUrl = pathToFileURL(join(ROOT, 'lib/server/supabaseClient.js')).href

const {
  backfillAllPipelineCrmEntities,
  backfillPipelineCrmEntitiesForOrg,
  verifyPipelineCrmEntitiesBackfill,
} = await import(backfillUrl)
const { isSupabaseEnabled } = await import(supabaseUrl)

const orgArg = process.argv.find((a) => a.startsWith('--org='))?.split('=')[1]
const dryRun = process.argv.includes('--dry-run')

if (!isSupabaseEnabled()) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running tasks sync.')
  process.exit(1)
}

console.log('Connect Intel — pipeline_tasks / pipeline_meetings verify + backfill\n')

const verifyBefore = await verifyPipelineCrmEntitiesBackfill({ orgId: orgArg || null })
console.log('Verify before:', verifyBefore.ok ? 'OK' : 'MISMATCH', verifyBefore)

if (verifyBefore.ok) {
  console.log('\nNo backfill needed.')
  process.exit(0)
}

if (dryRun) {
  console.log('\n(dry-run — would backfill now)')
  process.exit(verifyBefore.ok ? 0 : 1)
}

const backfill = orgArg
  ? await backfillPipelineCrmEntitiesForOrg(orgArg, { batchSize: 50 })
  : await backfillAllPipelineCrmEntities({ batchSize: 50 })

console.log('\nBackfill:', backfill)

const verifyAfter = await verifyPipelineCrmEntitiesBackfill({ orgId: orgArg || null })
console.log('\nVerify after:', verifyAfter.ok ? 'OK' : 'MISMATCH', verifyAfter)
process.exit(verifyAfter.ok ? 0 : 1)
