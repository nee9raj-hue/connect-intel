#!/usr/bin/env node
/**
 * Verify production Prometheus metrics scrape (Grafana wiring preflight).
 *
 *   npm run grafana:verify
 *
 * Uses METRICS_SECRET, else CRON_SECRET from .env.deploy.local.
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PRODUCTION = 'https://connectintel.net'

function loadSecrets() {
  const out = []
  for (const file of ['.env.deploy.local', '.env.vercel.production', '.env.production.local']) {
    if (!existsSync(join(ROOT, file))) continue
    for (const key of ['METRICS_SECRET', 'CRON_SECRET']) {
      const line = readFileSync(join(ROOT, file), 'utf8').split('\n').find((l) => l.startsWith(`${key}=`))
      if (!line) continue
      let v = line.slice(key.length + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      if (v && !out.includes(v)) out.push(v)
    }
  }
  for (const key of ['METRICS_SECRET', 'CRON_SECRET']) {
    const v = process.env[key]
    if (v && !out.includes(v)) out.push(v)
  }
  return out
}

console.log('Connect Intel — Grafana / Prometheus verify\n')

const health = await fetch(`${PRODUCTION}/api/health`, { signal: AbortSignal.timeout(20_000) })
  .then((r) => r.json())
  .catch(() => ({}))

console.log('Prometheus enabled:', health.infra?.prometheus === true ? 'yes' : 'no')
console.log('Sentry enabled:', health.infra?.sentry === true ? 'yes' : 'no')

const secrets = loadSecrets()
if (!secrets.length) {
  console.log('\n✗ No METRICS_SECRET or CRON_SECRET in .env.deploy.local')
  process.exit(1)
}

let res = null
let body = ''
for (const secret of secrets) {
  const metricsUrl = `${PRODUCTION}/api/metrics?secret=${encodeURIComponent(secret)}`
  res = await fetch(metricsUrl, { signal: AbortSignal.timeout(20_000) })
  body = await res.text()
  if (res.ok) break
}

if (!res?.ok) {
  if (res?.status === 401) {
    console.log('\n✗ /api/metrics returned 401 — copy METRICS_SECRET from Vercel into .env.deploy.local')
  } else {
    console.log(`\n✗ /api/metrics HTTP ${res?.status}`)
  }
  process.exit(1)
}

const sample = body
  .split('\n')
  .filter((l) => l && !l.startsWith('#'))
  .slice(0, 8)
console.log('\n✓ Metrics scrape OK — sample lines:')
for (const line of sample) console.log(' ', line)

console.log(`
Next: deploy Grafana Alloy (infra/grafana/alloy.config) on Railway and import
infra/grafana/dashboard-connectintel.json into Grafana Cloud.
See docs/GRAFANA_SETUP.md
`)
process.exit(0)
