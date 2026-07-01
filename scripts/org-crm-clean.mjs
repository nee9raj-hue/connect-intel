#!/usr/bin/env node
/**
 * Clean CRM data for one organization (keeps users + org registration).
 *
 *   npm run org:clean -- --name=xindus
 *   npm run org:clean -- --org=ORG_ID --execute
 *
 * Remote:
 *   CRON_SECRET=... npm run org:clean -- --url=https://connectintel.net --name=xindus --execute
 */

import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const cleanUrl = pathToFileURL(join(ROOT, 'lib/server/orgCrmClean.js')).href
const supabaseUrl = pathToFileURL(join(ROOT, 'lib/server/supabaseClient.js')).href

const { cleanOrganizationCrm } = await import(cleanUrl)
const { isSupabaseEnabled } = await import(supabaseUrl)

const execute = process.argv.includes('--execute')
const orgId = process.argv.find((a) => a.startsWith('--org='))?.split('=')[1]
const nameQuery = process.argv.find((a) => a.startsWith('--name='))?.split('=')[1]
const remoteBase = process.argv.find((a) => a.startsWith('--url='))?.split('=')[1]?.replace(/\/$/, '')

console.log('Connect Intel — organization CRM clean\n')

if (remoteBase) {
  const secret = process.env.CRON_SECRET || process.env.MARKETING_CRON_SECRET
  if (!secret) {
    console.error('Set CRON_SECRET for remote org clean.')
    process.exit(1)
  }
  const qs = new URLSearchParams({
    action: 'org-crm-clean',
    dryRun: execute ? '0' : '1',
  })
  if (orgId) qs.set('orgId', orgId)
  if (nameQuery) qs.set('nameQuery', nameQuery)
  const url = `${remoteBase}/api/infra/bootstrap?${qs}`
  console.log(`${execute ? 'POST (EXECUTE)' : 'POST (dry-run)'} ${url}\n`)
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'org-crm-clean',
      dryRun: !execute,
      orgId,
      nameQuery,
    }),
    signal: AbortSignal.timeout(300_000),
  })
  const data = await res.json().catch(() => ({}))
  console.log(JSON.stringify(data, null, 2))
  process.exit(res.ok ? 0 : 1)
}

if (!orgId && !nameQuery) {
  console.error('Pass --org=ORG_ID or --name=xindus')
  process.exit(1)
}

if (!isSupabaseEnabled()) {
  console.error('Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, or use --url with CRON_SECRET.')
  process.exit(1)
}

const report = await cleanOrganizationCrm({ orgId, nameQuery, dryRun: !execute })
console.log(JSON.stringify(report, null, 2))
process.exit(execute && !report.ok ? 2 : 0)
