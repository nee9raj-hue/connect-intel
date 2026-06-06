import { findPipelineEntry } from './pipelineAccess.js'
import { listPipelineSavedEntries } from './organizations.js'
import {
  applyEmailToCrm,
  applyLeadEmailBounce,
  crmGmailHasReadScope,
  pruneCrmEmailsToTrail,
  syncLeadEmailThreadFromGmail,
} from './crmEmailThread.js'
import { getUserCrmGmail } from './crmUserGmail.js'
import { updateStorePartial } from './store.js'
import { updatePipelineStore } from './pipelineShard.js'

const DEFAULT_MAX_AGE_MS = 8 * 60 * 1000
const MAX_LEADS_PER_SYNC = 10

function leadSyncPriority(entry) {
  const crm = entry.crm || {}
  const t = Math.max(
    new Date(crm.lastCommunicationAt || 0).getTime(),
    new Date(crm.lastEmailSentAt || 0).getTime(),
    new Date(entry.savedAt || 0).getTime()
  )
  return t
}

export async function syncUserEmailThreadsIfStale(user, store, { maxAgeMs = DEFAULT_MAX_AGE_MS } = {}) {
  const oauth = getUserCrmGmail(user)
  if (!oauth || !crmGmailHasReadScope(oauth)) {
    return { synced: 0, skipped: 'no_gmail_read' }
  }

  const lastAt = user.lastEmailAutoSyncAt
  if (lastAt && Date.now() - new Date(lastAt).getTime() < maxAgeMs) {
    return { synced: 0, skipped: 'fresh' }
  }

  const entries = listPipelineSavedEntries(store, user)
    .filter((e) => {
      const email = String(e.lead?.email || '').trim()
      return email.includes('@')
    })
    .sort((a, b) => leadSyncPriority(b) - leadSyncPriority(a))
    .slice(0, MAX_LEADS_PER_SYNC)

  if (!entries.length) {
    await updateStorePartial(['users'], (draft) => {
      const row = draft.users.find((u) => u.id === user.id)
      if (row) row.lastEmailAutoSyncAt = new Date().toISOString()
      return draft
    })
    return { synced: 0, skipped: 'no_leads' }
  }

  let synced = 0
  let newMessages = 0

  await updatePipelineStore(user, async (draft) => {
    for (const entry of entries) {
      const lead = entry.lead || entry
      const row = findPipelineEntry(draft, user, lead.id)
      if (!row) continue

      const result = await syncLeadEmailThreadFromGmail(user, lead, row.crm)
      if (!result.ok || !result.messages?.length) continue

      let crm = row.crm
      const beforeCount = (crm?.emails || []).length
      for (const msg of result.messages) {
        crm = applyEmailToCrm(crm, msg, { userId: user.id, userName: user.name })
        if (msg.isBounce) {
          applyLeadEmailBounce(row, { detectedAt: msg.sentAt, reason: msg.subject })
        }
      }
      newMessages += Math.max(0, (crm?.emails || []).length - beforeCount)

      const leadEmail = String(lead.email || '').trim()
      const userEmail = String(result.userEmail || user.email || '')
        .trim()
        .toLowerCase()
      if (leadEmail.includes('@') && userEmail) {
        const pruned = pruneCrmEmailsToTrail(crm?.emails || [], leadEmail, userEmail)
        crm = { ...crm, emails: pruned }
      }
      if (result.bounceDetected) {
        applyLeadEmailBounce(row, { reason: 'Delivery failure detected in mailbox' })
      }
      row.crm = crm
      synced += 1
    }
    return draft
  })

  await updateStorePartial(['users'], (draft) => {
    const row = draft.users.find((u) => u.id === user.id)
    if (row) row.lastEmailAutoSyncAt = new Date().toISOString()
    return draft
  })

  return { synced, newMessages, pipelineUpdated: synced > 0 }
}
