#!/usr/bin/env node
/**
 * List org roster or transfer org admin (ops).
 *
 *   npm run org:roster -- --name=xindus
 *   npm run org:transfer-admin -- --name=xindus --from=neeraj@xindus.net --to=admin@xindus.net --execute
 *
 * Remote:
 *   CRON_SECRET=... npm run org:roster -- --url=https://connectintel.net --name=xindus
 */

import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const adminUrl = pathToFileURL(join(ROOT, 'lib/server/orgMembershipAdmin.js')).href

const { getOrganizationRoster, transferOrgAdmin } = await import(adminUrl)

const args = process.argv.slice(2)
const isRoster = args.includes('--roster') || process.env.npm_lifecycle_event === 'org:roster'
const isInvite = args.includes('--invite') || process.env.npm_lifecycle_event === 'org:invite'
const inviteEmail = args.find((a) => a.startsWith('--email='))?.split('=')[1]
const execute = args.includes('--execute')
const orgId = args.find((a) => a.startsWith('--org='))?.split('=')[1]
const nameQuery = args.find((a) => a.startsWith('--name='))?.split('=')[1]
const fromEmail = args.find((a) => a.startsWith('--from='))?.split('=')[1]
const toEmail = args.find((a) => a.startsWith('--to='))?.split('=')[1]
const fromPipelineRole = args.find((a) => a.startsWith('--from-role='))?.split('=')[1]
const remoteBase = args.find((a) => a.startsWith('--url='))?.split('=')[1]?.replace(/\/$/, '')

const action = isRoster ? 'org-roster' : isInvite ? 'org-invite-member' : 'org-transfer-admin'

if (remoteBase) {
  const secret = process.env.CRON_SECRET || process.env.MARKETING_CRON_SECRET
  if (!secret) {
    console.error('Set CRON_SECRET for remote org admin ops.')
    process.exit(1)
  }
  const qs = new URLSearchParams({ action, dryRun: execute ? '0' : '1' })
  if (orgId) qs.set('orgId', orgId)
  if (nameQuery) qs.set('nameQuery', nameQuery)
  if (inviteEmail) qs.set('email', inviteEmail)
  const url = `${remoteBase}/api/infra/bootstrap?${qs}`
  const body = {
    action,
    dryRun: !execute,
    orgId,
    nameQuery,
    fromEmail,
    toEmail,
    fromPipelineRole,
    email: inviteEmail,
  }
  console.log(`${execute ? 'POST (EXECUTE)' : 'POST'} ${url}\n`)
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  })
  const data = await res.json().catch(() => ({}))
  console.log(JSON.stringify(data, null, 2))
  process.exit(res.ok ? 0 : 1)
}

if (!orgId && !nameQuery) {
  console.error('Pass --org=ORG_ID or --name=xindus')
  process.exit(1)
}

if (isInvite) {
  if (!inviteEmail) {
    console.error('Invite requires --email=user@company.com')
    process.exit(1)
  }
}

if (isRoster) {
  const roster = await getOrganizationRoster({ orgId, nameQuery })
  console.log(JSON.stringify(roster, null, 2))
  process.exit(0)
}

if (!fromEmail && !toEmail) {
  console.error('Transfer requires --from=email and/or --to=email')
  process.exit(1)
}

const result = await transferOrgAdmin({
  orgId,
  nameQuery,
  fromEmail,
  toEmail,
  fromPipelineRole,
  dryRun: !execute,
})
console.log(JSON.stringify(result, null, 2))
process.exit(execute && !result.ok ? 2 : 0)
