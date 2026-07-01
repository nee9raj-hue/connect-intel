#!/usr/bin/env node
/**
 * Backfill organizations, profiles, leads from store_collections JSON → enterprise tables.
 *
 * Prereqs:
 *   1. Run supabase/migrations/20260613120000_enterprise_crm_schema.sql
 *   2. Create Vault secret:
 *      SELECT vault.create_secret('<random-32+chars>', 'connect_intel_lead_pii', 'Lead PII key');
 *
 * Usage:
 *   npm run enterprise:backfill [-- --dry-run] [-- --org-id=org_xxx]
 */

import { backfillEnterpriseCrm } from '../lib/server/enterpriseCrmBackfill.js'
import { isSupabaseEnabled } from '../lib/server/supabaseClient.js'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const orgIdFlag = args.find((a) => a.startsWith('--org-id='))
const onlyOrgId = orgIdFlag ? orgIdFlag.split('=')[1] : null

async function main() {
  if (!isSupabaseEnabled()) {
    console.error('Supabase not configured')
    process.exit(1)
  }

  const summary = await backfillEnterpriseCrm({ dryRun, orgId: onlyOrgId })
  console.log(
    dryRun
      ? `Dry run — ${summary.orgs} org(s), ${summary.profiles} profile(s), ${summary.leads} lead(s)`
      : `Backfill complete — ${summary.orgs} org(s), ${summary.profiles} profile(s), ${summary.leads} lead(s)`
  )
  if (summary.errors?.length) {
    for (const row of summary.errors) console.warn('  •', row.org, row.error)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
