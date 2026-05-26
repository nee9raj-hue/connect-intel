import { createId } from './store.js'
import { findPipelineEntry } from './pipelineAccess.js'
import { listPipelineEntries } from './organizations.js'
import { normalizePhoneDigits } from './phoneUtils.js'
import { sendWhatsAppCloudMessage, resolveWhatsAppCloudConfig } from './whatsappCloud.js'

function inboxScope(user) {
  if (user?.organizationId && user?.accountType === 'company') {
    return { organizationId: user.organizationId, userId: user.id }
  }
  return { organizationId: null, userId: user.id }
}

function threadMatchesScope(thread, scope) {
  if (scope.organizationId) return thread.organizationId === scope.organizationId
  return thread.organizationId == null && thread.ownerUserId === scope.userId
}

export function resolveOrganizationByPhoneNumberId(store, phoneNumberId) {
  const id = String(phoneNumberId || '').trim()
  if (!id) return null
  for (const org of store.organizations || []) {
    if (String(org?.whatsappCloud?.phoneNumberId || '') === id) {
      return org
    }
  }
  const platform = store.platform?.[0]?.whatsappCloud
  if (platform && String(platform.phoneNumberId || '') === id) {
    return { id: null, platform: true, whatsappCloud: platform }
  }
  return null
}

export function findPipelineLeadByPhone(store, user, phoneDigits) {
  const digits = normalizePhoneDigits(phoneDigits)
  if (!digits) return null
  for (const entry of listPipelineEntries(store, user, { light: true })) {
    const lead = entry.lead || entry
    if (normalizePhoneDigits(lead.phone) === digits) {
      return { entry, lead, leadId: entry.id || lead.id }
    }
  }
  return null
}

function displayNameFromLead(lead) {
  if (!lead) return ''
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim()
  return name || lead.company || ''
}

export function upsertWhatsAppThread(store, scope, { leadPhone, leadId, leadName, ourPhone }) {
  const phone = normalizePhoneDigits(leadPhone)
  if (!phone) return null

  store.whatsappThreads = store.whatsappThreads || []
  let thread = store.whatsappThreads.find(
    (t) => threadMatchesScope(t, scope) && t.leadPhone === phone
  )

  if (!thread) {
    thread = {
      id: createId('wath'),
      organizationId: scope.organizationId,
      ownerUserId: scope.userId,
      leadPhone: phone,
      leadId: leadId || null,
      leadName: leadName || null,
      ourPhone: ourPhone || null,
      leadTag: null,
      unread: false,
      lastSnippet: '',
      lastMessageAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    store.whatsappThreads.push(thread)
  } else {
    if (leadId && !thread.leadId) thread.leadId = leadId
    if (leadName && !thread.leadName) thread.leadName = leadName
    if (ourPhone) thread.ourPhone = ourPhone
    thread.updatedAt = new Date().toISOString()
  }

  return thread
}

export function appendWhatsAppMessage(store, threadId, message) {
  store.whatsappMessages = store.whatsappMessages || []
  const row = {
    id: createId('wamsg'),
    threadId,
    direction: message.direction,
    body: String(message.body || '').trim(),
    status: message.status || (message.direction === 'outbound' ? 'sent' : 'received'),
    messageId: message.messageId || null,
    senderName: message.senderName || null,
    sentAt: message.sentAt || new Date().toISOString(),
    createdAt: new Date().toISOString(),
  }
  store.whatsappMessages.push(row)

  const thread = (store.whatsappThreads || []).find((t) => t.id === threadId)
  if (thread) {
    thread.lastSnippet = row.body.slice(0, 160)
    thread.lastMessageAt = row.sentAt
    thread.updatedAt = row.sentAt
    if (message.direction === 'inbound') thread.unread = true
    else thread.unread = false
  }

  return row
}

export function recordWhatsAppOutbound(store, user, { phone, body, messageId, leadId, leadName }) {
  const scope = inboxScope(user)
  const config = resolveWhatsAppCloudConfig(user, store)
  const digits = normalizePhoneDigits(phone)
  if (!digits || !String(body || '').trim()) return null

  let resolvedLeadId = leadId
  let resolvedName = leadName
  if (!resolvedLeadId) {
    const match = findPipelineLeadByPhone(store, user, digits)
    if (match) {
      resolvedLeadId = match.leadId
      resolvedName = displayNameFromLead(match.lead)
    }
  }

  const thread = upsertWhatsAppThread(store, scope, {
    leadPhone: digits,
    leadId: resolvedLeadId,
    leadName: resolvedName,
    ourPhone: config?.displayPhone || config?.phoneNumberId || null,
  })
  if (!thread) return null

  appendWhatsAppMessage(store, thread.id, {
    direction: 'outbound',
    body,
    messageId,
    status: messageId ? 'sent' : 'sent',
  })
  return thread
}

export function ingestWhatsAppWebhook(store, phoneNumberId, payload) {
  const resolved = resolveOrganizationByPhoneNumberId(store, phoneNumberId)
  if (!resolved) return { processed: 0 }

  const scope = resolved.platform
    ? { organizationId: null, userId: null }
    : { organizationId: resolved.id, userId: null }

  const ourPhone =
    resolved.whatsappCloud?.displayPhone || resolved.whatsappCloud?.phoneNumberId || phoneNumberId

  let processed = 0
  const entries = payload?.entry || []

  for (const entry of entries) {
    for (const change of entry?.changes || []) {
      const value = change?.value
      if (!value) continue

      for (const msg of value.messages || []) {
        const from = normalizePhoneDigits(msg.from)
        if (!from) continue
        const body =
          msg.type === 'text'
            ? msg.text?.body
            : msg.type === 'button'
              ? msg.button?.text
              : `[${msg.type || 'message'}]`
        if (!body) continue

        const thread = upsertWhatsAppThread(store, scope, {
          leadPhone: from,
          ourPhone,
        })
        if (!thread) continue

        if (scope.organizationId) {
          const adminMember = (store.organizationMemberships || []).find(
            (m) => m.organizationId === scope.organizationId && m.role === 'org_admin'
          )
          const adminUser = adminMember
            ? store.users.find((u) => u.id === adminMember.userId)
            : null
          if (adminUser) {
            const match = findPipelineLeadByPhone(store, adminUser, from)
            if (match && !thread.leadId) {
              thread.leadId = match.leadId
              thread.leadName = displayNameFromLead(match.lead)
            }
          }
        }

        appendWhatsAppMessage(store, thread.id, {
          direction: 'inbound',
          body: String(body),
          messageId: msg.id,
          status: 'received',
          sentAt: msg.timestamp
            ? new Date(Number(msg.timestamp) * 1000).toISOString()
            : new Date().toISOString(),
        })
        processed += 1
      }

      for (const status of value.statuses || []) {
        const messageId = status.id
        const newStatus = status.status
        if (!messageId || !newStatus) continue
        for (const row of store.whatsappMessages || []) {
          if (row.messageId === messageId) {
            row.status = newStatus
            processed += 1
          }
        }
      }
    }
  }

  return { processed }
}

export function listWhatsAppThreads(store, user, filters = {}) {
  const scope = inboxScope(user)
  let threads = (store.whatsappThreads || []).filter((t) => threadMatchesScope(t, scope))

  if (filters.tag === 'interested') {
    threads = threads.filter((t) => t.leadTag === 'interested')
  }
  if (filters.phone) {
    const q = String(filters.phone).replace(/\D/g, '')
    if (q) threads = threads.filter((t) => t.leadPhone.includes(q))
  }
  if (filters.campaignId) {
    const campaignId = String(filters.campaignId)
    const enrolledPhones = new Set(
      (store.marketingEnrollments || [])
        .filter((e) => e.campaignId === campaignId && e.contactPhone)
        .map((e) => normalizePhoneDigits(e.contactPhone))
        .filter(Boolean)
    )
    threads = threads.filter((t) => enrolledPhones.has(t.leadPhone))
  }

  threads.sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0))

  return threads.map((t) => ({
    id: t.id,
    leadPhone: t.leadPhone,
    leadName: t.leadName,
    leadId: t.leadId,
    leadTag: t.leadTag,
    ourPhone: t.ourPhone,
    unread: Boolean(t.unread),
    lastSnippet: t.lastSnippet || '',
    lastMessageAt: t.lastMessageAt,
    chatType: 'individual',
  }))
}

export function getWhatsAppThreadDetail(store, user, threadId) {
  const scope = inboxScope(user)
  const thread = (store.whatsappThreads || []).find(
    (t) => t.id === threadId && threadMatchesScope(t, scope)
  )
  if (!thread) return null

  const messages = (store.whatsappMessages || [])
    .filter((m) => m.threadId === threadId)
    .sort((a, b) => new Date(a.sentAt) - new Date(b.sentAt))

  if (thread.unread) {
    thread.unread = false
    thread.updatedAt = new Date().toISOString()
  }

  return {
    id: thread.id,
    leadPhone: thread.leadPhone,
    leadName: thread.leadName,
    leadId: thread.leadId,
    leadTag: thread.leadTag,
    ourPhone: thread.ourPhone,
    chatType: 'individual',
    messages,
  }
}

export function getWhatsAppInboxStats(store, user) {
  const threads = listWhatsAppThreads(store, user)
  return {
    unread: threads.filter((t) => t.unread).length,
    total: threads.length,
  }
}

export async function replyWhatsAppThread(store, user, threadId, message) {
  const scope = inboxScope(user)
  const thread = (store.whatsappThreads || []).find(
    (t) => t.id === threadId && threadMatchesScope(t, scope)
  )
  if (!thread) throw new Error('Conversation not found')

  const body = String(message || '').trim()
  if (!body) throw new Error('Message is required')

  const config = resolveWhatsAppCloudConfig(user, store)
  if (!config) {
    throw new Error(
      'WhatsApp Business API is not connected. Set it up under Integrations or Team settings.'
    )
  }

  const sendResult = await sendWhatsAppCloudMessage(config, {
    to: thread.leadPhone,
    body,
  })
  if (!sendResult.ok) throw new Error(sendResult.error || 'Send failed')

  appendWhatsAppMessage(store, thread.id, {
    direction: 'outbound',
    body,
    messageId: sendResult.messageId,
    status: 'sent',
  })

  return { threadId, messageId: sendResult.messageId }
}

export function setWhatsAppThreadTag(store, user, threadId, tag) {
  const scope = inboxScope(user)
  const thread = (store.whatsappThreads || []).find(
    (t) => t.id === threadId && threadMatchesScope(t, scope)
  )
  if (!thread) throw new Error('Conversation not found')
  thread.leadTag = tag || null
  thread.updatedAt = new Date().toISOString()
  return thread
}

/** Backfill threads from recent pipeline WhatsApp activity (one-time per empty inbox). */
export function syncWhatsAppThreadsFromPipeline(store, user) {
  const scope = inboxScope(user)
  const existing = (store.whatsappThreads || []).filter((t) => threadMatchesScope(t, scope))
  if (existing.length > 0) return { added: 0 }

  let added = 0
  for (const entry of listPipelineEntries(store, user, { light: false })) {
    const lead = entry.lead || entry
    const phone = normalizePhoneDigits(lead.phone)
    if (!phone) continue
    const activities = entry.crm?.activities || []
    const waActs = activities.filter((a) => a.type === 'whatsapp')
    if (!waActs.length) continue

    const thread = upsertWhatsAppThread(store, scope, {
      leadPhone: phone,
      leadId: entry.id || lead.id,
      leadName: displayNameFromLead(lead),
    })
    if (!thread) continue

    const already = (store.whatsappMessages || []).some((m) => m.threadId === thread.id)
    if (already) continue

    for (const act of waActs.slice(-5)) {
      appendWhatsAppMessage(store, thread.id, {
        direction: 'outbound',
        body: act.summary || 'WhatsApp message',
        status: 'sent',
        sentAt: act.createdAt || new Date().toISOString(),
      })
      added += 1
    }
  }
  return { added }
}
