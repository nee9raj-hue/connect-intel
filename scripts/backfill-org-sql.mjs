#!/usr/bin/env node
/**
 * Backfill organizations + profiles JSON → Supabase SQL (Phase 3+).
 *
 * Usage:
 *   npm run org:sql-backfill
 *   npm run org:sql-backfill -- --org-id=org_xxx
 */

import { readStore } from '../lib/server/store.js'
import { isOrgSqlSyncEnabled, syncAllOrganizationsToSql } from '../lib/server/orgSqlSync.js'
import { listOrganizationsNeedingSqlSync } from '../lib/server/orgSqlResolve.js'

const args = process.argv.slice(2)
const orgIdFlag = args.find((a) => a.startsWith('--org-id='))
const onlyOrgId = orgIdFlag ? orgIdFlag.split('=')[1] : null

async function main() {
  if (!isOrgSqlSyncEnabled()) {
    console.error('Org SQL sync is not enabled (Supabase required)')
    process.exit(1)
  }

  const store = await readStore({
    only: ['users', 'organizations', 'organizationMemberships'],
  })
  const pending = listOrganizationsNeedingSqlSync(store)
  console.log(`Organizations pending SQL UUID: ${pending.length}`)

  const result = await syncAllOrganizationsToSql({ store, orgId: onlyOrgId })
  console.log(
    `Done — ${result.orgs} org(s), ${result.profiles} profile(s), ${result.errors.length} error(s)`
  )
  if (result.errors.length) {
    for (const row of result.errors) console.warn('  •', row.orgId, row.error)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
