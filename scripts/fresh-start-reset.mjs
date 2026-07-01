#!/usr/bin/env node
/**
 * Wipe all org/user CRM data for a clean go-live (trial-style empty state).
 *
 * Dry-run (default — safe):
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run fresh:start
 *
 * Execute (destructive — requires explicit confirm):
 *   FRESH_START_CONFIRM=yes SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run fresh:start -- --execute
 *
 * Remote via production API (uses Vercel CRON_SECRET):
 *   CRON_SECRET=... npm run fresh:start -- --url=https://connectintel.net --execute
 */

import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const resetUrl = pathToFileURL(join(ROOT, 'lib/server/freshStartReset.js')).href
const supabaseUrl = pathToFileURL(join(ROOT, 'lib/server/supabaseClient.js')).href

const { runFreshStartReset, assertFreshStartAuthorized } = await import(resetUrl)
const { isSupabaseEnabled } = await import(supabaseUrl)

const execute = process.argv.includes('--execute')
const noPreservePlatform = process.argv.includes('--no-preserve-platform')
const remoteBase = process.argv.find((a) => a.startsWith('--url='))?.split('=')[1]?.replace(/\/$/, '')

console.log('Connect Intel — fresh start reset (all organizations)\n')

if (remoteBase) {
  const secret = process.env.CRON_SECRET || process.env.MARKETING_CRON_SECRET
  if (!secret) {
    console.error('Set CRON_SECRET to call the production fresh-start endpoint.')
    process.exit(1)
  }
  if (execute) {
    assertFreshStartAuthorized({ execute: true })
  }
  const qs = new URLSearchParams({
    action: 'fresh-start',
    dryRun: execute ? '0' : '1',
    preservePlatform: noPreservePlatform ? '0' : '1',
  })
  const url = `${remoteBase}/api/infra/bootstrap?${qs}`
  console.log(`${execute ? 'POST (EXECUTE)' : 'POST (dry-run)'} ${url}\n`)
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'fresh-start',
      dryRun: !execute,
      preservePlatform: !noPreservePlatform,
      freshStartConfirm: execute ? 'yes' : undefined,
    }),
    signal: AbortSignal.timeout(600_000),
  })
  const data = await res.json().catch(() => ({}))
  console.log(JSON.stringify(data, null, 2))
  if (!res.ok) process.exit(1)
  if (execute && data?.report?.verify && !data.report.verify.clean) process.exit(2)
  if (execute) {
    console.log('\nDone. Orgs (including Xindus) should register fresh via the admin signup flow.')
    console.log('Preserved: platform invite Gmail OAuth (unless --no-preserve-platform).')
  } else {
    console.log('\nDry-run only. Re-run with --execute and FRESH_START_CONFIRM=yes to wipe production.')
  }
  process.exit(0)
}

if (!isSupabaseEnabled()) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or use --url=https://connectintel.net with CRON_SECRET.')
  process.exit(1)
}

const auth = assertFreshStartAuthorized({ execute })
console.log(auth.mode === 'execute' ? 'MODE: EXECUTE (destructive)\n' : 'MODE: dry-run (pass --execute + FRESH_START_CONFIRM=yes to wipe)\n')

const report = await runFreshStartReset({
  dryRun: !execute,
  preservePlatform: !noPreservePlatform,
  onProgress: (p) => {
    if (p.step === 'sql_table_done' && (p.rowsBefore > 0 || p.deleted)) {
      console.log(`  SQL ${p.table}: ${p.dryRun ? `${p.rowsBefore} rows` : 'cleared'}`)
    }
  },
})

console.log(JSON.stringify(report, null, 2))

if (execute) {
  if (!report.verify?.clean) {
    console.error('\nVerify failed — some data may remain. Inspect report.verify above.')
    process.exit(2)
  }
  console.log('\nFresh start complete. Next steps:')
  console.log('  1. Xindus (and other orgs) register via normal org signup / admin panel')
  console.log('  2. npm run enterprise:setup  (if enterprise SQL tables need seed functions)')
  console.log('  3. Reconnect integrations (Gmail, WhatsApp, etc.) per org')
  console.log('  4. Import or link pipeline data from a clean slate')
} else {
  console.log('\nDry-run complete. No data was changed.')
}
