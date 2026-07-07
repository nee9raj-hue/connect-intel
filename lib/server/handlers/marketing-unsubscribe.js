import { readStore, updateStore } from '../store.js'
import { applyCors, handleOptions, sendJson } from '../http.js'
import { parseUnsubscribeToken, recordUnsubscribe } from '../marketingUnsubscribe.js'
import { removeEmailFromMarketingLists } from '../marketingListMembers.js'
import { recordMarketingEvent } from '../marketingEvents.js'

function htmlPage(title, message) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 420px; margin: 48px auto; padding: 0 20px; color: #242424; }
    h1 { font-size: 1.25rem; }
    p { line-height: 1.5; color: #555; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p>${message}</p>
</body>
</html>`
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return sendJson(res, 405, { error: 'Method not allowed' })
  }

  const token = req.query?.token
  const parsed = parseUnsubscribeToken(token)
  if (!parsed?.email) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.statusCode = 400
    return res.end(htmlPage('Invalid link', 'This unsubscribe link is invalid or expired.'))
  }

  const result = await recordUnsubscribe({
    organizationId: parsed.organizationId,
    createdByUserId: parsed.createdByUserId,
    email: parsed.email,
  })

  const unsubLeadEvents = []
  await updateStore((draft) => {
    removeEmailFromMarketingLists(draft, {
      organizationId: parsed.organizationId,
      createdByUserId: parsed.createdByUserId,
    }, parsed.email)

    const campaignIds = new Set()
    for (const e of draft.marketingEnrollments || []) {
      if (e.contactEmail !== parsed.email || e.status !== 'active') continue
      const inScope =
        (parsed.organizationId && e.organizationId === parsed.organizationId) ||
        (!parsed.organizationId && e.createdByUserId === parsed.createdByUserId)
      if (!inScope) continue
      e.status = 'unsubscribed'
      e.updatedAt = new Date().toISOString()
      if (e.campaignId) campaignIds.add(e.campaignId)
      if (e.leadId) {
        unsubLeadEvents.push({
          leadId: e.leadId,
          campaignId: e.campaignId || null,
          enrollmentId: e.id || null,
        })
      }
    }
    for (const campaignId of campaignIds) {
      const c = draft.marketingCampaigns.find((x) => x.id === campaignId)
      if (!c) continue
      c.stats = c.stats || {}
      c.stats.unsubscribed = (c.stats.unsubscribed || 0) + 1
      c.updatedAt = new Date().toISOString()
    }
    return draft
  })

  for (const row of unsubLeadEvents) {
    void recordMarketingEvent({
      organizationId: parsed.organizationId,
      createdByUserId: parsed.createdByUserId,
      campaignId: row.campaignId,
      enrollmentId: row.enrollmentId,
      leadId: row.leadId,
      type: 'unsubscribe',
    }).catch(() => {})
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.statusCode = result.ok ? 200 : 400
  return res.end(
    htmlPage(
      'Unsubscribed',
      result.ok
        ? `${parsed.email} will no longer receive marketing emails from this sender.`
        : result.error || 'Could not process unsubscribe.'
    )
  )
}
