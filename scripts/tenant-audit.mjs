#!/usr/bin/env node
/**
 * Audit (and optionally repair) cross-tenant pipeline ownership.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run tenant:audit
 *   npm run tenant:audit -- --org=ORG_ID
 *   npm run tenant:audit -- --fix
 *   npm run tenant:audit -- --dry-run
 */

import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const cleanupUrl = pathToFileURL(join(ROOT, 'lib/server/tenantPipelineCleanup.js')).href
const supabaseUrl = pathToFileURL(join(ROOT, 'lib/server/supabaseClient.js')).href
const storeUrl = pathToFileURL(join(ROOT, 'lib/server/store.js')).href

const {
  auditAllOrganizationsTenantIsolation,
  findForeignPipelineOwnersForOrg,
  repairForeignPipelineOwnersForOrg,
} = await import(cleanupUrl)
const { isSupabaseEnabled } = await import(supabaseUrl)
const { readStore } = await import(storeUrl)

const orgArg = process.argv.find((a) => a.startsWith('--org='))?.split('=')[1]
const fix = process.argv.includes('--fix')
const dryRun = process.argv.includes('--dry-run') || !fix

if (!isSupabaseEnabled()) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running tenant audit.')
  process.exit(1)
}

console.log('Connect Intel — tenant isolation audit\n')
if (dryRun) console.log('(dry-run — pass --fix to unassign foreign owners)\n')

async function orgLabel(orgId) {
  try {
    const store = await readStore({ only: ['organizations'] })
    const org = (store.organizations || []).find((o) => o.id === orgId)
    return org?.name ? `${org.name} (${orgId})` : orgId
  } catch {
    return orgId
  }
}

if (orgArg) {
  const { foreignOwnerIds, rows, metaStore } = await findForeignPipelineOwnersForOrg(orgArg)
  if (!foreignOwnerIds.length) {
    console.log(`OK — no foreign pipeline owners for ${await orgLabel(orgArg)}`)
    process.exit(0)
  }
  console.log(`ISSUE — ${await orgLabel(orgArg)}`)
  console.log(`  Foreign owner ids: ${foreignOwnerIds.join(', ')}`)
  for (const uid of foreignOwnerIds) {
    const u = (metaStore.users || []).find((row) => String(row.id) === String(uid))
    console.log(`    • ${u?.name || uid} <${u?.email || 'no email'}> (home org: ${u?.organizationId || '—'})`)
  }
  console.log(`  Contaminated pipeline rows: ${rows.length}`)
  if (fix && !dryRun) {
    const result = await repairForeignPipelineOwnersForOrg(orgArg, { dryRun: false })
    console.log(`\nRepaired — unassigned ${result.repaired} lead(s)`)
  }
  process.exit(foreignOwnerIds.length ? 1 : 0)
}

const report = await auditAllOrganizationsTenantIsolation({ dryRun })
if (!report.issueCount) {
  console.log('OK — no cross-tenant pipeline owners found across all organizations.')
  process.exit(0)
}

console.log(`Found ${report.issueCount} organization(s) with foreign pipeline owners:\n`)
for (const item of report.reports) {
  console.log(`• ${item.organizationName || item.organizationId}`)
  console.log(`  Foreign users: ${item.foreignUsers.map((u) => `${u.name || u.userId} <${u.email || '?'}>`).join('; ')}`)
  console.log(`  Contaminated rows: ${item.contaminatedLeadCount}`)
}
if (fix && !dryRun) {
  console.log('\nRepair complete — foreign assignees were cleared on affected leads.')
} else {
  console.log('\nRe-run with --fix to unassign foreign owners on contaminated leads.')
}
process.exit(1)
