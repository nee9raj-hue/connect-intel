#!/usr/bin/env node
/**
 * Backfill Meilisearch CRM index for all organizations (or one org).
 *
 *   MEILI_HOST=... MEILI_API_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \\
 *     node scripts/backfill-meilisearch.mjs
 *
 *   node scripts/backfill-meilisearch.mjs --org=ORG_ID
 */

import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const syncUrl = pathToFileURL(join(ROOT, 'lib/server/meilisearch/sync.js')).href
const configUrl = pathToFileURL(join(ROOT, 'lib/server/infra/config.js')).href

const { syncAllOrganizationsToMeilisearch, syncOrgCrmToMeilisearch } = await import(syncUrl)
const { isMeilisearchEnabled } = await import(configUrl)

const orgArg = process.argv.find((a) => a.startsWith('--org='))?.split('=')[1]

if (!isMeilisearchEnabled()) {
  console.error('Set MEILI_HOST and MEILI_API_KEY (and Supabase vars) before running backfill.')
  process.exit(1)
}

console.log('Connect Intel — Meilisearch backfill\n')

if (orgArg) {
  const result = await syncOrgCrmToMeilisearch(orgArg)
  console.log(JSON.stringify(result, null, 2))
} else {
  const result = await syncAllOrganizationsToMeilisearch()
  console.log(`Indexed ${result.total} documents across ${result.organizations.length} organizations`)
  for (const row of result.organizations) {
    console.log(`  ${row.name || row.organizationId}: ${row.indexed}`)
  }
}

console.log('\nDone.')
