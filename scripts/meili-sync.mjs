#!/usr/bin/env node
/**
 * Verify Meilisearch CRM index; run backfill when counts diverge.
 *
 * Usage:
 *   npm run meili:sync
 *   npm run meili:sync -- --org=ORG_ID
 */

import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const backfillUrl = pathToFileURL(join(ROOT, 'lib/server/meilisearchBackfill.js')).href
const configUrl = pathToFileURL(join(ROOT, 'lib/server/infra/config.js')).href

const {
  backfillAllMeilisearch,
  backfillMeilisearchForOrg,
  verifyMeilisearchBackfill,
} = await import(backfillUrl)
const { isMeilisearchEnabled } = await import(configUrl)

const orgArg = process.argv.find((a) => a.startsWith('--org='))?.split('=')[1]
const dryRun = process.argv.includes('--dry-run')

if (!isMeilisearchEnabled()) {
  console.error('Set MEILI_HOST and MEILI_API_KEY before running Meilisearch sync.')
  process.exit(1)
}

console.log('Connect Intel — Meilisearch verify + backfill\n')

const verifyBefore = await verifyMeilisearchBackfill({ orgId: orgArg || null })
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
  ? await backfillMeilisearchForOrg(orgArg)
  : await backfillAllMeilisearch({ orgId: orgArg || null })

console.log('\nBackfill:', backfill)

const verifyAfter = await verifyMeilisearchBackfill({ orgId: orgArg || null })
console.log('\nVerify after:', verifyAfter.ok ? 'OK' : 'MISMATCH', verifyAfter)
process.exit(verifyAfter.ok ? 0 : 1)
