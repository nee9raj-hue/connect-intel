import { createId, readStore, updateStore } from './store.js'
import { loadPipelineStoreContext } from './pipelineShard.js'
import { marketingScopeKey, filterMarketingRows, canAccessMarketingAsset } from './marketingAccess.js'
import { sendMarketingMessage } from './marketingSend.js'
import { mapWithConcurrency } from './bulkEmailSend.js'
function parsePasteEmails(text) {
  const seen = new Set()
  const out = []
  for (const part of String(text || '').split(/[,;\n]+/)) {
    const email = part.trim().toLowerCase()
    if (!email.includes('@') || seen.has(email)) continue
    seen.add(email)
    out.push(email)
    if (out.length >= 5000) break
  }
  return out
}
import { mergeTemplateFields } from './marketingTemplates.js'

const SEND_CONCURRENCY = 5

function parseCsvRecipients(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (!lines.length) return []

  const header = lines[0].toLowerCase()
  const hasHeader = header.includes('email')
  const start = hasHeader ? 1 : 0
  const cols = hasHeader ? lines[0].split(',').map((c) => c.trim().toLowerCase()) : []
  const emailIdx = cols.indexOf('email')
  const firstIdx = cols.indexOf('first_name')
  const lastIdx = cols.indexOf('last_name')
  const companyIdx = cols.indexOf('company')

  const seen = new Set()
  const out = []
  for (let i = start; i < lines.length; i++) {
    const parts = lines[i].split(',').map((c) => c.trim())
    let email = emailIdx >= 0 ? parts[emailIdx] : parts[0]
    email = String(email || '').toLowerCase().trim()
    if (!email.includes('@') || seen.has(email)) continue
    seen.add(email)
    out.push({
      email,
      firstName: firstIdx >= 0 ? parts[firstIdx] || '' : '',
      lastName: lastIdx >= 0 ? parts[lastIdx] || '' : '',
      company: companyIdx >= 0 ? parts[companyIdx] || '' : '',
    })
  }
  return out
}

export function listMarketingBulkSends(store, user) {
  return filterMarketingRows(store.marketingBulkSends || [], user).sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  )
}

export function getMarketingBulkSend(store, user, sendId) {
  const row = (store.marketingBulkSends || []).find((s) => s.id === sendId)
  if (!row || !canAccessMarketingAsset(row, user)) return null
  return row
}

export function getBulkRecipients(store, sendId) {
  return (store.marketingBulkRecipients || []).filter((r) => r.sendId === sendId)
}

export async function createMarketingBulkSend(user, payload) {
  const now = new Date().toISOString()
  const id = createId('mbulk')
  const send = {
    id,
    ...marketingScopeKey(user),
    name: String(payload.name || 'Bulk send').trim().slice(0, 120),
    subject: String(payload.subject || '').trim().slice(0, 200),
    fromName: String(payload.fromName || user.name || '').trim().slice(0, 80),
    fromEmail: String(payload.fromEmail || user.email || '').trim().toLowerCase(),
    replyTo: String(payload.replyTo || '').trim() || null,
    body: String(payload.body || '').trim(),
    bodyHtml: payload.bodyHtml || null,
    blocks: payload.blocks || [],
    design: payload.design || {},
    previewText: String(payload.previewText || '').trim(),
    templateId: payload.templateId || null,
    recipientCount: 0,
    status: 'draft',
    captureAsLead: payload.captureAsLead !== false,
    captureStage: payload.captureStage || 'new',
    captureOwnerId: payload.captureOwnerId || null,
    captureTag: payload.captureTag || null,
    opens: 0,
    clicks: 0,
    leadsCreated: 0,
    createdByUserId: user.id,
    createdAt: now,
    updatedAt: now,
  }

  await updateStore((draft) => {
    draft.marketingBulkSends = draft.marketingBulkSends || []
    draft.marketingBulkSends.push(send)
    return draft
  })

  return send
}

export async function attachBulkRecipients(
  user,
  sendId,
  { source, csvText, emailsText, listId, segmentId, manualEmail }
) {
  const store = await readStore({
    only: [
      'marketingBulkSends',
      'marketingBulkRecipients',
      'marketingLists',
      'marketingSegments',
      'users',
      'organizations',
      'organizationMemberships',
    ],
  })
  const send = getMarketingBulkSend(store, user, sendId)
  if (!send) throw new Error('Bulk send not found')

  let recipients = []
  if (source === 'manual' && manualEmail) {
    const email = String(manualEmail).trim().toLowerCase()
    if (email.includes('@')) {
      recipients = [{ email, firstName: '', lastName: '', company: '' }]
    }
  } else if (source === 'csv') {
    recipients = parseCsvRecipients(csvText)
  } else if (source === 'paste') {
    recipients = parsePasteEmails(emailsText).map((email) => ({ email, firstName: '', lastName: '', company: '' }))
  } else if (source === 'list' && listId) {
    const { pipelineStore } = await loadPipelineStoreContext(user)
    const savedLeads = pipelineStore.savedLeads || []
    const list = (store.marketingLists || []).find((l) => l.id === listId)
    const ids = list?.leadIds || []
    for (const leadId of ids) {
      const entry = savedLeads.find((e) => (e.lead?.id || e.id) === leadId)
      const lead = entry?.lead || entry
      if (!lead?.email) continue
      recipients.push({
        email: String(lead.email).toLowerCase(),
        firstName: lead.firstName || '',
        lastName: lead.lastName || '',
        company: lead.company || '',
        leadId: lead.id,
      })
    }
  }

  if (!recipients.length) {
    throw new Error('No valid email addresses found. Select paste/manual, enter emails, or choose a list with contacts.')
  }

  const seen = new Set()
  const unique = []
  for (const r of recipients) {
    if (!r.email || seen.has(r.email)) continue
    seen.add(r.email)
    unique.push(r)
  }

  const now = new Date().toISOString()
  await updateStore((draft) => {
    draft.marketingBulkRecipients = (draft.marketingBulkRecipients || []).filter((r) => r.sendId !== sendId)
    for (const r of unique) {
      draft.marketingBulkRecipients.push({
        id: createId('mbr'),
        sendId,
        email: r.email,
        firstName: r.firstName || '',
        lastName: r.lastName || '',
        company: r.company || '',
        leadId: r.leadId || null,
        status: 'queued',
        createdAt: now,
      })
    }
    const row = draft.marketingBulkSends.find((s) => s.id === sendId)
    if (row) {
      row.recipientCount = unique.length
      row.updatedAt = now
    }
    return draft
  })

  return { recipientCount: unique.length, duplicatesRemoved: recipients.length - unique.length }
}

function personalizeText(text, recipient) {
  const lead = {
    email: recipient.email,
    firstName: recipient.firstName || '',
    lastName: recipient.lastName || '',
    company: recipient.company || '',
  }
  return mergeTemplateFields({ subject: '', body: String(text || '') }, lead).body
}

export async function processMarketingBulkSend(user, sendId) {
  const store = await readStore()
  const send = getMarketingBulkSend(store, user, sendId)
  if (!send) throw new Error('Bulk send not found')
  if (send.status === 'sent' || send.status === 'sending') {
    throw new Error('Send already in progress or completed')
  }

  const recipients = getBulkRecipients(store, sendId).filter((r) => r.status === 'queued')
  if (!recipients.length) throw new Error('No recipients to send')

  const campaignId = createId('mcamp')
  const now = new Date().toISOString()

  await updateStore((draft) => {
    const row = draft.marketingBulkSends.find((s) => s.id === sendId)
    if (row) {
      row.status = 'sending'
      row.campaignId = campaignId
      row.updatedAt = now
    }
    return draft
  })

  let sent = 0
  let failed = 0

  await mapWithConcurrency(recipients, SEND_CONCURRENCY, async (recipient) => {
    const enrollmentId = createId('menr')
    const lead = {
      email: recipient.email,
      firstName: recipient.firstName,
      lastName: recipient.lastName,
      company: recipient.company,
    }
    const body = personalizeText(send.body || send.subject, recipient)
    const result = await sendMarketingMessage({
      store: await readStore(),
      user,
      lead,
      subject: personalizeText(send.subject, recipient),
      body,
      blocks: send.blocks,
      design: send.design,
      htmlBody: send.bodyHtml,
      previewText: send.previewText,
      campaignId,
      enrollmentId,
      emailProvider: 'auto',
    })

    await updateStore((draft) => {
      const r = draft.marketingBulkRecipients.find((x) => x.id === recipient.id)
      if (r) {
        r.status = result.sent ? 'sent' : 'failed'
        r.errorMessage = result.error || null
        r.sentAt = result.sent ? now : null
      }
      return draft
    })

    if (result.sent) sent += 1
    else failed += 1
  })

  await updateStore((draft) => {
    const row = draft.marketingBulkSends.find((s) => s.id === sendId)
    if (row) {
      row.status = failed && !sent ? 'failed' : 'sent'
      row.sentAt = now
      row.updatedAt = now
    }
    return draft
  })

  return { sent, failed, campaignId }
}
