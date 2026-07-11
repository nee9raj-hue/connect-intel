#!/usr/bin/env node
/**
 * Post-deploy production smoke — no auth required.
 *
 *   npm run prod:smoke
 */

const PRODUCTION = 'https://connectintel.net'
const TIMEOUT_MS = 25_000

const checks = [
  { name: 'Health API', path: '/api/health', expectJson: true },
  { name: 'Public config', path: '/api/public-config', expectJson: true },
  { name: 'Landing HTML', path: '/', expectHtml: true },
  { name: 'Dashboard shell', path: '/home/dashboard', expectHtml: true },
]

async function fetchCheck({ path }) {
  const res = await fetch(`${PRODUCTION}${path}`, {
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { Accept: 'text/html,application/json' },
  })
  const text = await res.text()
  return { status: res.status, text, ok: res.ok }
}

async function main() {
  console.log(`Connect Intel — production smoke (${PRODUCTION})\n`)
  let failed = 0

  for (const check of checks) {
    try {
      const { status, text, ok } = await fetchCheck(check)
      if (!ok) {
        console.log(`✗ ${check.name} — HTTP ${status}`)
        failed += 1
        continue
      }
      if (check.expectJson) {
        JSON.parse(text)
        const health = check.path.includes('health') ? JSON.parse(text) : null
        if (health) {
          const supa = health.supabase?.connected ?? health.readiness?.supabase
          console.log(`✓ ${check.name} — supabase: ${supa ?? 'n/a'}`)
        } else {
          console.log(`✓ ${check.name}`)
        }
      } else if (check.expectHtml) {
        if (!text.includes('<!DOCTYPE html') && !text.includes('<html')) {
          console.log(`✗ ${check.name} — not HTML`)
          failed += 1
        } else {
          console.log(`✓ ${check.name}`)
        }
      }
    } catch (e) {
      console.log(`✗ ${check.name} — ${e.message}`)
      failed += 1
    }
  }

  console.log('')
  if (failed) {
    console.log(`${failed} check(s) failed. See docs/RELEASE_CHECKLIST.md for manual smoke.`)
    process.exit(1)
  }
  console.log('All automated smoke checks passed.')
  console.log('Manual: pipeline, operator panels, auth — docs/RELEASE_CHECKLIST.md')
}

main()
