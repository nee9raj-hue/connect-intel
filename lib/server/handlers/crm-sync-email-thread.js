import { requireUser } from '../auth.js'
import { readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { mergeLeadForTenant } from '../tenantIsolation.js'
import { findPipelineEntry } from '../pipelineAccess.js'
import { listPipelineEntries } from '../organizations.js'
import {
  applyEmailToCrm,
  applyLeadEmailBounce,
  ensureCrmGmailReadScopeRecorded,
  syncLeadEmailThreadFromGmail,
} from '../crmEmailThread.js'
import { getUserCrmGmail } from '../crmUserGmail.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const { leadId } = getBody(req)
  if (!leadId) return sendJson(res, 400, { error: 'leadId is required' })

  const storeBefore = await readStore()
  const user = storeBefore.users.find((u) => u.id === sessionUser.id) || sessionUser
  const entry = findPipelineEntry(storeBefore, user, leadId)
  if (!entry) return sendJson(res, 404, { error: 'Lead not in pipeline' })

  const lead = entry.lead || entry
  const sync = await syncLeadEmailThreadFromGmail(user, lead, entry.crm)
  if (!sync.ok) {
    return sendJson(res, 400, {
      error: sync.error,
      needsGmailConnect: sync.needsGmailConnect,
      needsReconnect: sync.needsReconnect,
    })
  }

  let added = 0
  let bounceMarked = false
  const store = await updateStore((draft) => {
    const row = findPipelineEntry(draft, user, leadId)
    if (!row) return draft
    let crm = row.crm
    const before = (crm?.emails || []).length
    for (const msg of sync.messages || []) {
      crm = applyEmailToCrm(crm, msg, { userId: user.id, userName: user.name })
      if (msg.isBounce) {
        applyLeadEmailBounce(row, {
          detectedAt: msg.sentAt,
          reason: msg.subject,
        })
        bounceMarked = true
      }
    }
    if (sync.bounceDetected && !bounceMarked) {
      applyLeadEmailBounce(row, { reason: 'Delivery failure detected in mailbox' })
      bounceMarked = true
    }
    row.crm = crm
    added = Math.max(0, (crm.emails || []).length - before)
    return draft
  })

  await ensureCrmGmailReadScopeRecorded(user.id, getUserCrmGmail(user))

  const updated = findPipelineEntry(store, user, leadId)
  return sendJson(res, 200, {
    lead: mergeLeadForTenant(store, user, updated),
    leads: listPipelineEntries(store, user, { light: true }),
    importedCount: added,
    scannedCount: sync.messages?.length || 0,
    bounceDetected: Boolean(sync.bounceDetected || bounceMarked),
    trailOnly: true,
  })
}
