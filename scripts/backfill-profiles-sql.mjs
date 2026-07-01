#!/usr/bin/env node
/**
 * Backfill company member profiles JSON → Supabase SQL (Phase 4).
 *
 * Usage:
 *   npm run profiles:sql-backfill
 *   npm run profiles:sql-backfill -- --org-id=org_xxx
 */

import { readStore } from '../lib/server/store.js'
import { isOrgSqlSyncEnabled, syncAllMemberProfilesToSql } from '../lib/server/orgSqlSync.js'
import { listProfilesNeedingSqlSync } from '../lib/server/orgSqlResolve.js'

const orgIdFlag = process.argv.find((a) => a.startsWith('--org-id='))
const onlyOrgId = orgIdFlag ? orgIdFlag.split('=')[1] : null

async function main() {
  if (!isOrgSqlSyncEnabled()) {
    console.error('Org SQL sync is not enabled (Supabase required)')
    process.exit(1)
  }

  const store = await readStore({
    only: ['users', 'organizations', 'organizationMemberships'],
  })
  const pending = listProfilesNeedingSqlSync(store, { orgId: onlyOrgId })
  console.log(`Profiles pending sqlProfileId: ${pending.length}`)

  const result = await syncAllMemberProfilesToSql({ store, orgId: onlyOrgId })
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
