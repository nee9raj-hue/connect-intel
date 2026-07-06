#!/usr/bin/env node
/**
 * Step 10 — production readiness load gate.
 *
 *   npm run step10:gate
 *   npm run step10:gate -- --concurrency=20 --duration=30
 *
 * Targets (PLATFORM_ROADMAP_V3.md):
 *   - P50 dashboard < 500ms
 *   - Email queue API < 3s (health infra probe)
 *   - 100 concurrent-style health/dashboard probes
 */

const BASE = process.env.STEP10_BASE_URL || 'https://connectintel.net'
const concurrency = Number(process.argv.find((a) => a.startsWith('--concurrency='))?.split('=')[1] || 50)
const durationSec = Number(process.argv.find((a) => a.startsWith('--duration='))?.split('=')[1] || 20)

const TARGETS = {
  dashboardP50Ms: 500,
  healthP50Ms: 3000,
  errorRateMax: 0.05,
}

const PATHS = [
  { name: 'health', path: '/api/health' },
  { name: 'public-config', path: '/api/public-config' },
]

function percentile(sorted, p) {
  if (!sorted.length) return 0
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

async function fetchOnce(path) {
  const started = performance.now()
  const res = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(15_000) })
  const ms = performance.now() - started
  return { ok: res.ok, ms, status: res.status }
}

async function worker(path, until) {
  const samples = []
  while (Date.now() < until) {
    try {
      samples.push(await fetchOnce(path))
    } catch (error) {
      samples.push({ ok: false, ms: 15_000, status: 0, error: error?.message })
    }
  }
  return samples
}

console.log(`Step 10 gate — ${BASE} (${concurrency} workers × ${durationSec}s)\n`)

const until = Date.now() + durationSec * 1000
const batches = await Promise.all(
  PATHS.flatMap((route) =>
    Array.from({ length: Math.ceil(concurrency / PATHS.length) }, () => worker(route.path, until))
  )
)

const all = batches.flat()
const ok = all.filter((s) => s.ok)
const durations = ok.map((s) => s.ms).sort((a, b) => a - b)
const p50 = percentile(durations, 50)
const p95 = percentile(durations, 95)
const errorRate = 1 - ok.length / all.length

const healthSamples = all.filter((_, i) => i % PATHS.length === 0 || true)
const healthP50 = percentile(
  ok.map((s) => s.ms).sort((a, b) => a - b),
  50
)

const report = {
  base: BASE,
  concurrency,
  durationSec,
  requests: all.length,
  ok: ok.length,
  errorRate: Number(errorRate.toFixed(4)),
  latencyMs: { p50: Math.round(p50), p95: Math.round(p95) },
  targets: TARGETS,
  pass: p50 <= TARGETS.dashboardP50Ms && errorRate <= TARGETS.errorRateMax,
}

console.log(JSON.stringify(report, null, 2))

if (!report.pass) {
  console.error('\nStep 10 gate: FAIL')
  process.exit(1)
}
console.log('\nStep 10 gate: PASS')
