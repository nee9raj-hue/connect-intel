#!/usr/bin/env node
/**
 * Verify production platform readiness (infra flags + worker heartbeat).
 *
 *   node scripts/infra-verify.mjs
 *   node scripts/infra-verify.mjs --url=https://connectintel.net
 */

const base = (process.argv.find((a) => a.startsWith('--url='))?.split('=')[1] || 'https://connectintel.net').replace(
  /\/$/,
  ''
)

async function get(path) {
  const started = Date.now()
  const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(20_000) })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, ms: Date.now() - started, data }
}

console.log(`Connect Intel — infra verify (${base})\n`)

const health = await get('/api/health')
const config = await get('/api/public-config')

const checks = [
  { name: 'API health', ok: health.data?.ok === true, detail: `${health.ms}ms` },
  { name: 'Supabase connected', ok: health.data?.supabase?.connected === true },
  { name: 'Redis enabled', ok: health.data?.infra?.redis === true },
  { name: 'Background email', ok: health.data?.infra?.backgroundEmail === true },
  { name: 'Worker heartbeat', ok: health.data?.worker?.ok === true, detail: health.data?.worker?.ageMs != null ? `${health.data.worker.ageMs}ms` : '' },
  { name: 'Meilisearch', ok: health.data?.infra?.meilisearch === true && health.data?.meilisearch?.ok === true },
  { name: 'Public backgroundEmailSends', ok: config.data?.backgroundEmailSends === true },
  { name: 'Public meilisearchEnabled', ok: config.data?.meilisearchEnabled === true },
]

let failed = 0
for (const row of checks) {
  const mark = row.ok ? '✓' : '✗'
  if (!row.ok) failed += 1
  console.log(`${mark} ${row.name}${row.detail ? ` (${row.detail})` : ''}`)
}

if (health.data?.queues?.queues) {
  const email = health.data.queues.queues['ci-email']
  if (email) {
    console.log(`\nEmail queue: waiting=${email.waiting || 0} active=${email.active || 0} delayed=${email.delayed || 0}`)
  }
}

if (health.data?.readiness) {
  console.log('\nReadiness:', JSON.stringify(health.data.readiness, null, 2))
}

console.log(failed ? `\n${failed} check(s) failed — see docs/PLATFORM_HARDENING.md` : '\nAll platform checks passed.')
process.exit(failed ? 1 : 0)
