#!/usr/bin/env node
/**
 * Constitution ops runner — executes post-Deploy-15 backlog in order.
 *
 *   npm run constitution:ops
 *
 * Blockers that need dashboard access are reported with links.
 */

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PRODUCTION = 'https://connectintel.net'

function run(cmd, args = []) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', shell: false })
  return { ok: r.status === 0, out: (r.stdout || '') + (r.stderr || '') }
}

async function health() {
  const res = await fetch(`${PRODUCTION}/api/health`, { signal: AbortSignal.timeout(20_000) })
  return res.json()
}

console.log('Connect Intel — constitution ops\n')

const h = await health()
console.log('Worker:', h.worker?.ok ?? h.readiness?.worker, '| Email V3:', h.emailV3?.ready)
console.log('Prometheus:', h.infra?.prometheus, '| Sentry:', h.infra?.sentry)

if (!h.worker?.ok) {
  console.log(`
⚠ Worker down — Upstash Redis quota exceeded (adjusted-raccoon) or archived DB (living-snail).
  Fix: Upstash Console → upgrade pay-as-you-go OR create new Redis → update REDIS_URL on Vercel + Railway.
  https://console.upstash.com/redis
`)
}

const hasDbCreds =
  process.env.SUPABASE_DB_PASSWORD ||
  process.env.DATABASE_URL ||
  process.env.SUPABASE_ACCESS_TOKEN

if (!hasDbCreds) {
  console.log(`
⚠ Deploy 12 SQL — run in Supabase SQL editor:
  supabase/migrations/20260702140000_campaigns_v3_bootstrap.sql
  https://supabase.com/dashboard/project/hkdrannqcnszfukcqchj/sql/new
  Then: npm run campaigns:sql-ops

  Or add SUPABASE_DB_PASSWORD to Vercel (Settings → Database).
`)
} else {
  const migrate = run('node', ['scripts/apply-campaigns-v3-migration.mjs'])
  console.log(migrate.out)
  if (migrate.ok) run('node', ['scripts/campaigns-v3-sql-ops.mjs'])
}

const tests = run('npm', ['test'])
console.log(tests.ok ? '✓ Unit tests pass' : '✗ Unit tests failed')

const gate = run('node', ['scripts/step10-load-gate.mjs', '--concurrency=30', '--duration=15'])
console.log(gate.out)

console.log(`
Done. Ship code: npm run prod:ship && git push && npm run prod:log
Sentry: add SENTRY_DSN on Vercel when you have a project.
Step 10 gate must PASS before Blueprint Phase 2+.
`)
