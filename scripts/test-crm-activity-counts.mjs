#!/usr/bin/env node
/**
 * Regression: dashboard KPI counts must match activity-log for the same data.
 * Simulates shard (stale) + monolith (today's writes) merge scenario.
 *
 * Usage: node scripts/test-crm-activity-counts.mjs
 */

import { pathToFileURL } from 'node:url'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

async function load(rel) {
  return import(pathToFileURL(join(ROOT, rel)).href)
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`✗ ${msg}`)
    process.exit(1)
  }
}

const { mergePipelineEntry, overlayMonolithCrmForRead } = await load('lib/server/pipelineShard.js')
const { countCrmActivities, listCrmActivities, ACTIVITY_FEED_LIMIT } = await load(
  'lib/server/crmActivityCounts.js'
)
const { rollupFromSanitizedActivityFeed } = await load('lib/server/crmTouchpoints.js')
const { periodStart } = await load('lib/server/dashboardPeriod.js')

const userId = 'user-neeraj'
const orgId = 'org-xindus'
const since = periodStart('week', 'Asia/Kolkata')

const store = {
  users: [
    { id: userId, email: 'neeraj@xindus.net', organizationId: orgId, accountType: 'company' },
  ],
  organizationMemberships: [{ userId, organizationId: orgId, role: 'org_admin' }],
  organizations: [{ id: orgId, name: 'Xindus' }],
}

const user = {
  id: userId,
  email: 'neeraj@xindus.net',
  organizationId: orgId,
  accountType: 'company',
  isOrgAdmin: true,
}

function makeEntry(id, activities) {
  const now = new Date().toISOString()
  return {
    id,
    organizationId: orgId,
    assignedToUserId: userId,
    savedAt: now,
    pipelineUpdatedAt: now,
    lead: { id, firstName: 'Test', company: 'Acme' },
    crm: {
      status: 'contacted',
      activities,
    },
  }
}

function staleActivities(n) {
  const out = []
  for (let i = 0; i < n; i += 1) {
    out.push({
      id: `old-${i}`,
      type: 'note',
      summary: `Old note ${i}`,
      createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      createdByUserId: userId,
      createdByName: 'Neeraj',
    })
  }
  return out
}

const today = new Date().toISOString()
const fresh = [
  { id: 'act-email', type: 'email', summary: 'Email sent', createdAt: today, createdByUserId: userId },
  { id: 'act-call', type: 'call', summary: 'Call logged', createdAt: today, createdByUserId: userId },
  { id: 'act-task', type: 'task', summary: 'Task created', createdAt: today, createdByUserId: userId },
]

const leadId = 'lead-1'
const shardEntry = makeEntry(leadId, staleActivities(80))
const monoEntry = makeEntry(leadId, fresh)

const merged = overlayMonolithCrmForRead([shardEntry], [monoEntry])
assert(merged.length === 1, 'merge should produce one lead')

const mergedActs = merged[0].crm.activities || []
assert(
  mergedActs.some((a) => a.id === 'act-email'),
  'merged CRM must include today email from monolith'
)

// Mirrored shard + monolith copies must not duplicate the same activity id.
const sharedCall = {
  id: 'act-call-dup',
  type: 'call',
  summary: 'Incoming call: test',
  createdAt: today,
  createdByUserId: userId,
  createdByName: 'Neeraj',
}
const shardMirror = makeEntry('lead-dup', [...staleActivities(3), sharedCall])
const monoMirror = makeEntry('lead-dup', [sharedCall])
const mergedMirror = overlayMonolithCrmForRead([shardMirror], [monoMirror])
const dupCalls = (mergedMirror[0].crm.activities || []).filter((a) => a.id === 'act-call-dup')
assert(dupCalls.length === 1, `merge must dedupe activity ids, got ${dupCalls.length} copies`)

const entries = merged
const logActs = listCrmActivities(store, user, entries, {
  since,
  memberUserId: userId,
  feedLimit: ACTIVITY_FEED_LIMIT,
})
const rollup = rollupFromSanitizedActivityFeed(store, user, entries, since)
const counts = countCrmActivities(store, user, entries, {
  since,
  memberUserId: userId,
  feedLimit: ACTIVITY_FEED_LIMIT,
})

const logEmails = logActs.filter((a) => a.type === 'email').length
const logCalls = logActs.filter((a) => a.type === 'call').length
const logTasks = logActs.filter((a) => a.type === 'task').length

assert(logEmails === 1, `activity log should show 1 email, got ${logEmails}`)
assert(logCalls === 1, `activity log should show 1 call, got ${logCalls}`)

const mirrorLogCalls = listCrmActivities(store, user, mergedMirror, {
  since,
  feedLimit: ACTIVITY_FEED_LIMIT,
}).filter((a) => a.type === 'call')
assert(
  mirrorLogCalls.length === 1,
  `activity log must not duplicate mirrored calls, got ${mirrorLogCalls.length}`
)
assert(logTasks === 1, `activity log should show 1 task, got ${logTasks}`)

const perUser = rollup.perUser.get(userId) || rollup.org
assert(perUser.emails === logEmails, `rollup emails ${perUser.emails} !== log ${logEmails}`)
assert(perUser.calls === logCalls, `rollup calls ${perUser.calls} !== log ${logCalls}`)
assert(perUser.tasksCreated === logTasks, `rollup tasks ${perUser.tasksCreated} !== log ${logTasks}`)
assert(counts.org.emails === logEmails, 'countCrmActivities org emails mismatch')

console.log('✓ CRM activity counts match activity log after shard+monolith merge')
console.log(`  emails=${logEmails} calls=${logCalls} tasks=${logTasks}`)
