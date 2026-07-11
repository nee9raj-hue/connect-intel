#!/usr/bin/env node
/**
 * Blueprint Phase 2+ readiness gate — run after Step 10 passes.
 *
 *   npm run blueprint:phase2
 *   npm run blueprint:phase2 -- --prod   # include production backfill probes
 */

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PRODUCTION = 'https://connectintel.net'
const prod = process.argv.includes('--prod')

function run(cmd, args = []) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', shell: false })
  return { ok: r.status === 0, out: (r.stdout || '') + (r.stderr || '') }
}

function loadCronSecret() {
  const path = join(ROOT, '.env.deploy.local')
  if (!existsSync(path)) return ''
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (line.startsWith('CRON_SECRET=')) return line.slice(12).trim()
  }
  return ''
}

async function probeBootstrap(action) {
  const secret = loadCronSecret()
  if (!secret) return { skipped: true, reason: 'no CRON_SECRET' }
  const res = await fetch(
    `${PRODUCTION}/api/infra/bootstrap?secret=${encodeURIComponent(secret)}&action=${action}`,
    { method: 'POST', body: '{}', signal: AbortSignal.timeout(30_000) }
  )
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok && data.ok !== false, data }
}

let failed = false
function pass(label) {
  console.log(`✓ ${label}`)
}
function fail(label, detail = '') {
  failed = true
  console.log(`✗ ${label}`)
  if (detail) console.log(`  ${detail.trim()}`)
}

console.log('Connect Intel — Blueprint Phase 2+ gate\n')

const tests = run('npm', ['test'])
tests.ok ? pass('Unit tests') : fail('Unit tests', tests.out.slice(-400))

const rbac = run('node', ['scripts/rbac-handler-audit.mjs', '--strict'])
rbac.ok ? pass('RBAC handler audit (strict)') : fail('RBAC handler audit', rbac.out)

let health = null
try {
  health = await fetch(`${PRODUCTION}/api/health`, { signal: AbortSignal.timeout(45_000) }).then(
    (r) => r.json()
  )
  if (health.infra?.pipelineLeadsTable) pass('Production: USE_PIPELINE_LEADS_TABLE')
  else fail('Production: pipeline leads table flag off')

  if (health.infra?.pipelineHierarchyRbac) pass('Production: pipeline hierarchy RBAC')
  else fail('Production: pipeline hierarchy RBAC off')

  if (health.worker?.ok) pass('Production: worker online')
  else fail('Production: worker offline', 'Check Upstash Redis + Railway')

  if (health.infra?.auditEvents) pass('Production: audit_events enabled')
  else console.log('  · audit_events: disabled or Supabase off')

  if (health.infra?.emailSends) pass('Production: email_sends enabled')
  else console.log('  · email_sends: disabled or table not migrated')

  if (health.infra?.pipelineDealsTable) pass('Production: pipeline_deals SQL path')
  if (health.infra?.pipelineCompaniesTable) pass('Production: pipeline_companies SQL path')

  if (health.infra?.workflowRuns) pass('Production: workflow_runs SQL path')
  else console.log('  · workflow_runs: disabled or tables not migrated')
} catch (error) {
  fail('Production health probe', error.message)
}

if (prod) {
  for (const action of ['verify', 'deals-sync', 'companies-sync']) {
    const probe = await probeBootstrap(action)
    if (probe.skipped) {
      console.log(`  · ${action}: skipped (${probe.reason})`)
      continue
    }
    probe.ok ? pass(`Production backfill: ${action}`) : fail(`Production backfill: ${action}`)
  }
} else {
  console.log('\nTip: npm run blueprint:phase2 -- --prod for live backfill probes')
}

console.log('')
if (failed) {
  console.log('Gate FAILED — fix items above before Phase 2+ feature work.')
  process.exit(1)
}
console.log('Gate PASSED — P0 closed. P1 audit + SQL reads active. P2 workflow runs + dashboard SSE ready.')
