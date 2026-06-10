#!/usr/bin/env node
/** Trigger one-click enterprise Supabase setup on production (no local Supabase keys needed). */

const base = (process.argv.find((a) => a.startsWith('--url='))?.split('=')[1] || 'https://connectintel.net').replace(
  /\/$/,
  ''
)
const dryRun = process.argv.includes('--dry-run')
const force = process.argv.includes('--force')

const url = `${base}/api/infra/bootstrap?action=enterprise-setup${dryRun ? '&dryRun=1' : ''}${force ? '&force=1' : ''}`

console.log(`POST ${url}\n`)

const res = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(300_000) })
const data = await res.json().catch(() => ({}))
console.log(JSON.stringify(data, null, 2))
process.exit(res.ok ? 0 : 1)
