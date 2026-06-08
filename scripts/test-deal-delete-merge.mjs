#!/usr/bin/env node
/**
 * Regression: deleted deals must not reappear when shard and monolith CRM are merged.
 *
 * Usage: node scripts/test-deal-delete-merge.mjs
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

const { mergePipelineEntry } = await load('lib/server/pipelineShard.js')
const { flattenDealsFromEntries } = await load('lib/dealPipeline.js')

const leadId = 'lead-1'
const dealKeep = { id: 'deal-keep', name: 'Keep', stage: 'rfq', updatedAt: '2026-06-08T10:00:00.000Z' }
const dealGone = { id: 'deal-gone', name: 'Gone', stage: 'rfq', updatedAt: '2026-06-08T09:00:00.000Z' }

const shardEntry = {
  lead: { id: leadId, company: 'Acme' },
  pipelineUpdatedAt: '2026-06-08T11:00:00.000Z',
  crm: {
    status: 'contacted',
    deals: [dealKeep],
    activities: [
      {
        id: 'act-del',
        type: 'status',
        summary: 'Deal deleted: Gone',
        createdAt: '2026-06-08T11:00:00.000Z',
      },
    ],
  },
}

const monolithEntry = {
  lead: { id: leadId, company: 'Acme' },
  pipelineUpdatedAt: '2026-06-08T08:00:00.000Z',
  crm: {
    status: 'contacted',
    deals: [dealKeep, dealGone],
    activities: [],
  },
}

const merged = mergePipelineEntry(shardEntry, monolithEntry)
const dealIds = (merged.crm?.deals || []).map((d) => d.id).sort()

assert(dealIds.length === 1, `expected 1 deal after merge, got ${dealIds.length}: ${dealIds.join(', ')}`)
assert(dealIds[0] === 'deal-keep', `expected deal-keep, got ${dealIds[0]}`)

const rows = flattenDealsFromEntries([{ lead: { id: leadId }, crm: merged.crm }], { freightOrg: true })
assert(rows.length === 1, `flatten expected 1 open deal, got ${rows.length}`)
assert(rows[0].deal.id === 'deal-keep', 'flatten kept wrong deal')

console.log('✓ Deal delete merge regression passed')
