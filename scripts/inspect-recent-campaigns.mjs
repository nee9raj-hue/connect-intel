#!/usr/bin/env node
/** List recent pipeline bulk / marketing campaigns and send progress (ops script). */
import { readStore } from '../lib/server/store.js'
import { getCampaignSendProgress } from '../lib/server/email/campaignProgress.js'

const store = await readStore({ only: ['marketingCampaigns'] })
const campaigns = (store.marketingCampaigns || [])
  .filter((c) => c.source === 'pipeline_bulk' || c.status === 'active' || c.stats?.sent)
  .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
  .slice(0, 8)

if (!campaigns.length) {
  console.log('No recent campaigns found.')
  process.exit(0)
}

for (const c of campaigns) {
  const progress = await getCampaignSendProgress(c.id, null)
  console.log('---')
  console.log('id:', c.id)
  console.log('name:', c.name || c.subject || '(no name)')
  console.log('source:', c.source)
  console.log('status:', c.status, '| sendStatus:', c.sendStatus || c.stats?.sendStatus)
  console.log('created:', c.createdAt)
  console.log('updated:', c.updatedAt)
  if (progress) {
    console.log(
      'progress:',
      progress.sendStatus,
      `| ${progress.sent} sent | ${progress.remaining} remaining | ${progress.failed} failed | ${progress.total} total`
    )
    console.log('done:', progress.done)
  }
}
