#!/usr/bin/env node
/**
 * Step 10 — production readiness load gate.
 *
 *   npm run step10:gate
 *   npm run step10:gate -- --concurrency=20 --duration=30
 *
 * Targets (PLATFORM_ROADMAP_V3.md):
 *   - P50 dashboard paths < 500ms
 *   - Email queue API < 3s
 *   - Error rate < 5%
 *
 * Authenticated dashboard probes use SESSION_SECRET + ADMIN_EMAILS from
 * .env.deploy.local (or STEP10_BEARER_TOKEN) to mint a bearer session.
 */

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { signSessionToken } from '../lib/server/sessionJwt.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.env.STEP10_BASE_URL || 'https://connectintel.net'
const concurrency = Number(process.argv.find((a) => a.startsWith('--concurrency='))?.split('=')[1] || 50)
const durationSec = Number(process.argv.find((a) => a.startsWith('--duration='))?.split('=')[1] || 20)

const TARGETS = {
  dashboardP50Ms: 500,
  emailQueueP50Ms: 3000,
  healthP50Ms: 3000,
  errorRateMax: 0.05,
}

function loadEnvValue(key) {
  if (process.env[key]) return process.env[key]
  for (const file of [
    '.env.deploy.local',
    '.env.vercel.production',
    '.env.production.local',
    '.env.prod',
    '.env.local',
  ]) {
    const path = join(ROOT, file)
    if (!existsSync(path)) continue
    const line = readFileSync(path, 'utf8').split('\n').find((l) => l.startsWith(`${key}=`))
    if (!line) continue
    let v = line.slice(key.length + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (v) return v
  }
  return ''
}

function resolveBearerToken() {
  const explicit = process.env.STEP10_BEARER_TOKEN || process.env.STEP10_SESSION_TOKEN
  if (explicit) return explicit

  const secret = loadEnvValue('SESSION_SECRET')
  const adminRaw = loadEnvValue('ADMIN_EMAILS')
  const email = adminRaw.split(',')[0]?.trim().toLowerCase()
  if (!secret || !email) return null

  process.env.SESSION_SECRET = secret
  return signSessionToken({
    id: 'step10-probe',
    email,
    name: 'Step10 probe',
    accountType: 'company',
    plan: 'free',
    role: 'member',
    searchesLeft: 25,
    creditsPaise: 5000,
    authProvider: 'google',
    onboardingComplete: true,
    canSearch: true,
  })
}

function buildRoutes(bearer) {
  const routes = [
    { name: 'health', path: '/api/health', group: 'health', targetMs: TARGETS.healthP50Ms },
    { name: 'public-config', path: '/api/public-config', group: 'health', targetMs: TARGETS.healthP50Ms },
  ]

  if (bearer) {
    routes.push(
      {
        name: 'dashboard-bootstrap',
        path: '/api/dashboard/bootstrap',
        group: 'dashboard',
        targetMs: TARGETS.dashboardP50Ms,
        headers: { Authorization: `Bearer ${bearer}` },
      },
      {
        name: 'team-metrics-summary',
        path: '/api/crm/team-metrics?summary=1',
        group: 'dashboard',
        targetMs: TARGETS.dashboardP50Ms,
        headers: { Authorization: `Bearer ${bearer}` },
      }
    )
  }

  return routes
}

function percentile(sorted, p) {
  if (!sorted.length) return 0
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

async function probeEmailWorker() {
  const started = performance.now()
  const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(20_000) })
  const ms = performance.now() - started
  const data = await res.json().catch(() => ({}))
  const ready = Boolean(res.ok && data?.worker?.ok && data?.emailV3?.ready)
  return { ready, ms: Math.round(ms) }
}

async function fetchOnce(route) {
  const started = performance.now()
  const res = await fetch(`${BASE}${route.path}`, {
    signal: AbortSignal.timeout(15_000),
    headers: route.headers || {},
  })
  const ms = performance.now() - started
  return { ok: res.ok, ms, status: res.status, route: route.name, group: route.group }
}

async function worker(route, until) {
  const samples = []
  while (Date.now() < until) {
    try {
      samples.push(await fetchOnce(route))
    } catch (error) {
      samples.push({
        ok: false,
        ms: 15_000,
        status: 0,
        route: route.name,
        group: route.group,
        error: error?.message,
      })
    }
  }
  return samples
}

const bearer = resolveBearerToken()
const routes = buildRoutes(bearer)
const emailWorker = await probeEmailWorker()

console.log(`Step 10 gate — ${BASE} (${concurrency} workers × ${durationSec}s)`)
console.log(
  `Routes: ${routes.map((r) => r.name).join(', ')}${bearer ? '' : ' (no bearer — set SESSION_SECRET + ADMIN_EMAILS for dashboard probes)'}\n`
)

const until = Date.now() + durationSec * 1000
const workersPerRoute = Math.max(1, Math.floor(concurrency / routes.length))
const batches = await Promise.all(
  routes.flatMap((route) => Array.from({ length: workersPerRoute }, () => worker(route, until)))
)

const all = batches.flat()
const ok = all.filter((s) => s.ok)
const durations = ok.map((s) => s.ms).sort((a, b) => a - b)
const p50 = percentile(durations, 50)
const p95 = percentile(durations, 95)
const errorRate = 1 - ok.length / all.length

const byGroup = {}
for (const route of routes) {
  const group = route.group
  if (!byGroup[group]) byGroup[group] = { samples: [], targetMs: route.targetMs }
}
for (const sample of all) {
  byGroup[sample.group]?.samples.push(sample)
}

const groupStats = {}
let pass = errorRate <= TARGETS.errorRateMax && emailWorker.ready

for (const [group, meta] of Object.entries(byGroup)) {
  const good = meta.samples.filter((s) => s.ok)
  const ms = good.map((s) => s.ms).sort((a, b) => a - b)
  const groupP50 = percentile(ms, 50)
  const groupError = meta.samples.length ? 1 - good.length / meta.samples.length : 1
  const groupPass = groupP50 <= meta.targetMs && groupError <= TARGETS.errorRateMax
  if (!groupPass) pass = false
  groupStats[group] = {
    requests: meta.samples.length,
    ok: good.length,
    errorRate: Number(groupError.toFixed(4)),
    latencyMs: { p50: Math.round(groupP50), p95: Math.round(percentile(ms, 95)) },
    targetMs: meta.targetMs,
    pass: groupPass,
  }
}

if (bearer) {
  const dashboardP50 = groupStats.dashboard?.latencyMs?.p50 ?? 0
  if (dashboardP50 > TARGETS.dashboardP50Ms || !groupStats.dashboard?.pass) pass = false
}

const report = {
  base: BASE,
  concurrency,
  durationSec,
  routes: routes.map((r) => r.name),
  authenticated: Boolean(bearer),
  emailWorker,
  requests: all.length,
  ok: ok.length,
  errorRate: Number(errorRate.toFixed(4)),
  latencyMs: { p50: Math.round(p50), p95: Math.round(p95) },
  groups: groupStats,
  targets: TARGETS,
  pass,
}

console.log(JSON.stringify(report, null, 2))

if (!report.pass) {
  console.error('\nStep 10 gate: FAIL')
  if (!bearer) {
    console.error('Hint: add SESSION_SECRET + ADMIN_EMAILS to .env.deploy.local for dashboard probes')
  }
  process.exit(1)
}
console.log('\nStep 10 gate: PASS')
