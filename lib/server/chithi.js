import { createId } from './store.js'
import { listTeamMembers } from './organizations.js'
import {
  createTeamNoteRow,
  filterOrgRows,
  parseLeadMentions,
  userCanViewNote,
  validateLeadMentions,
  validateRecipient,
} from './teamCollaboration.js'
import { notifyTeamNoteRecipient } from './teamCollaborationNotify.js'
import { notifyChithiPushRecipients, pruneExpiredPushSubscriptions } from './chithiPush.js'
import { parseUserMentions, validateUserMentions } from './chithiMentions.js'
import { notifyChithiMessageAudience } from './chithiNotify.js'

export const GENERAL_CHANNEL_SLUG = 'general'

const DEFAULT_PUBLIC_CHANNELS = [
  {
    slug: GENERAL_CHANNEL_SLUG,
    name: 'general',
    topic: 'Company-wide updates · @ teammates · # customers',
  },
  { slug: 'sales', name: 'sales', topic: 'Pipeline wins, handoffs, and deal updates' },
  { slug: 'support', name: 'support', topic: 'Customer issues, fixes, and follow-ups' },
]

export const CHITHI_REACTIONS = ['👍', '✅', '👀', '🎉']

export function dmPairKey(userIdA, userIdB) {
  return [userIdA, userIdB].filter(Boolean).sort().join(':')
}

export function getChithiLastSeenMs(user) {
  const raw = user?.chithiLastSeenAt || user?.teamHubLastSeenAt
  if (!raw) return 0
  const ms = new Date(raw).getTime()
  return Number.isFinite(ms) ? ms : 0
}

function slugifyChannelName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
}

export function createPublicChannel(store, organizationId, { name, topic }, createdByUserId) {
  const slug = slugifyChannelName(name)
  if (!slug || slug.length < 2) throw new Error('Channel name must be at least 2 characters')
  if (slug === 'dm') throw new Error('Invalid channel name')

  store.chithiChannels = store.chithiChannels || []
  const exists = store.chithiChannels.some(
    (c) => c.organizationId === organizationId && c.type === 'public' && c.slug === slug
  )
  if (exists) throw new Error(`#${slug} already exists`)

  const now = new Date().toISOString()
  const channel = {
    id: createId('chch'),
    organizationId,
    type: 'public',
    slug,
    name: slug,
    topic: String(topic || '').trim().slice(0, 200) || null,
    memberUserIds: null,
    dmUserIds: null,
    createdByUserId: createdByUserId || null,
    createdAt: now,
    updatedAt: now,
  }
  store.chithiChannels.push(channel)
  return channel
}

export function ensureGeneralChannel(store, organizationId) {
  ensureDefaultPublicChannels(store, organizationId)
  return store.chithiChannels.find(
    (c) => c.organizationId === organizationId && c.type === 'public' && c.slug === GENERAL_CHANNEL_SLUG
  )
}

export function ensureDefaultPublicChannels(store, organizationId) {
  store.chithiChannels = store.chithiChannels || []
  let added = false
  for (const row of DEFAULT_PUBLIC_CHANNELS) {
    const exists = store.chithiChannels.some(
      (c) => c.organizationId === organizationId && c.type === 'public' && c.slug === row.slug
    )
    if (exists) continue
    const now = new Date().toISOString()
    store.chithiChannels.push({
      id: createId('chch'),
      organizationId,
      type: 'public',
      slug: row.slug,
      name: row.name,
      topic: row.topic,
      memberUserIds: null,
      dmUserIds: null,
      createdAt: now,
      updatedAt: now,
    })
    added = true
  }
  return added
}

export function findDmChannel(store, organizationId, userIdA, userIdB) {
  const key = dmPairKey(userIdA, userIdB)
  return (store.chithiChannels || []).find(
    (c) => c.organizationId === organizationId && c.type === 'dm' && c.dmPairKey === key
  )
}

export function ensureDmChannel(store, organizationId, userIdA, userIdB) {
  const existing = findDmChannel(store, organizationId, userIdA, userIdB)
  if (existing) return { channel: existing, created: false }

  const now = new Date().toISOString()
  const channel = {
    id: createId('chch'),
    organizationId,
    type: 'dm',
    slug: null,
    name: null,
    topic: null,
    memberUserIds: [userIdA, userIdB],
    dmUserIds: [userIdA, userIdB].sort(),
    dmPairKey: dmPairKey(userIdA, userIdB),
    createdAt: now,
    updatedAt: now,
  }
  store.chithiChannels = store.chithiChannels || []
  store.chithiChannels.push(channel)
  return { channel, created: true }
}

export function userCanAccessChannel(channel, user) {
  if (!channel || channel.organizationId !== user.organizationId) return false
  if (channel.type === 'public') return true
  if (channel.type === 'dm') {
    return (channel.dmUserIds || []).includes(user.id)
  }
  return false
}

export function ensureDmChannelsFromNotes(store, user) {
  const peers = new Set()
  for (const note of filterOrgRows(store.teamNotes, user.organizationId)) {
    if (!userCanViewNote(note, user)) continue
    const peer = note.authorUserId === user.id ? note.recipientUserId : note.authorUserId
    if (peer && peer !== user.id) peers.add(peer)
  }
  let added = false
  for (const peerId of peers) {
    const { created } = ensureDmChannel(store, user.organizationId, user.id, peerId)
    if (created) added = true
  }
  return added
}

/** Ensure default + DM channels in memory; returns true if persistence is needed. */
export function syncChithiChannels(store, user) {
  let changed = ensureDefaultPublicChannels(store, user.organizationId)
  if (ensureDmChannelsFromNotes(store, user)) changed = true
  return changed
}

export const CHITHI_READ_COLLECTIONS = [
  'users',
  'organizations',
  'organizationMemberships',
  'chithiChannels',
  'chithiMessages',
  'teamNotes',
  'teamTasks',
]

export function getChannelLabel(channel, user, store) {
  if (channel.type === 'public') return `#${channel.name || channel.slug || 'channel'}`
  const peerId = (channel.dmUserIds || []).find((id) => id !== user.id)
  const u = store.users.find((x) => x.id === peerId)
  return u?.name || u?.email || 'Direct message'
}

export function mapMessageRow(m, user) {
  const reactions = m.reactions && typeof m.reactions === 'object' ? m.reactions : {}
  return {
    id: m.id,
    source: 'chithi',
    channelId: m.channelId,
    authorUserId: m.authorUserId,
    authorName: m.authorName,
    body: m.body,
    leadMentions: m.leadMentions || [],
    userMentions: m.userMentions || [],
    threadParentId: m.threadParentId || null,
    reactions,
    messageType: m.messageType || 'user',
    activityKind: m.activityKind || null,
    activityMeta: m.activityMeta || null,
    createdAt: m.createdAt,
    isMine: m.authorUserId === user.id,
  }
}

export function formatChannelForUser(store, user, channel) {
  if (!channel) return null
  if (channel.type === 'public') {
    return {
      id: channel.id,
      type: 'public',
      slug: channel.slug,
      name: channel.name,
      label: `#${channel.name}`,
      topic: channel.topic || '',
    }
  }
  const members = listTeamMembers(store, user.organizationId).filter((m) => m.status === 'active')
  const memberById = new Map(members.map((m) => [m.userId, m]))
  const otherId = (channel.dmUserIds || []).find((id) => id !== user.id)
  const other = memberById.get(otherId)
  const u = store.users.find((x) => x.id === otherId)
  const label = other?.name || u?.name || u?.email || 'Teammate'
  return {
    id: channel.id,
    type: 'dm',
    slug: null,
    name: label,
    label,
    peerUserId: otherId || null,
  }
}

export function listChannelsForUser(store, user) {
  syncChithiChannels(store, user)
  const channels = filterOrgRows(store.chithiChannels, user.organizationId).filter((c) =>
    userCanAccessChannel(c, user)
  )

  return channels
    .map((channel) => formatChannelForUser(store, user, channel))
    .sort((a, b) => {
      if (a.type === 'public' && b.type !== 'public') return -1
      if (b.type === 'public' && a.type !== 'public') return 1
      return a.label.localeCompare(b.label)
    })
}

function noteToFeedMessage(note, user) {
  const mine = note.authorUserId === user.id
  const peerId = mine ? note.recipientUserId : note.authorUserId
  return {
    id: `note-${note.id}`,
    source: 'team_note',
    noteId: note.id,
    channelId: null,
    authorUserId: note.authorUserId,
    authorName: note.authorName,
    body: note.body,
    leadMentions: note.leadMentions || [],
    createdAt: note.createdAt,
    recipientUserId: note.recipientUserId,
    peerUserId: peerId,
    isMine: mine,
  }
}

export function listChannelFeed(store, user, channelId) {
  const channel = (store.chithiChannels || []).find((c) => c.id === channelId)
  if (!channel || !userCanAccessChannel(channel, user)) {
    throw new Error('Channel not found')
  }

  if (channel.type === 'public') {
    const rows = filterOrgRows(store.chithiMessages, user.organizationId)
      .filter((m) => m.channelId === channel.id)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .map((m) => mapMessageRow(m, user))

    const replyCount = {}
    for (const m of rows) {
      if (m.threadParentId) {
        replyCount[m.threadParentId] = (replyCount[m.threadParentId] || 0) + 1
      }
    }
    const messages = rows.map((m) => ({
      ...m,
      threadReplyCount: m.threadParentId ? 0 : replyCount[m.id] || 0,
    }))
    return { channel, messages }
  }

  const peerId = (channel.dmUserIds || []).find((id) => id !== user.id)
  const notes = filterOrgRows(store.teamNotes, user.organizationId)
    .filter((n) => userCanViewNote(n, user))
    .filter(
      (n) =>
        (n.authorUserId === user.id && n.recipientUserId === peerId) ||
        (n.authorUserId === peerId && n.recipientUserId === user.id)
    )
    .map((n) => noteToFeedMessage(n, user))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

  return { channel, messages: notes }
}

export function createChithiMessageRow({ user, channelId, body, leadMentions, userMentions, threadParentId }) {
  const now = new Date().toISOString()
  return {
    id: createId('cmsg'),
    organizationId: user.organizationId,
    channelId,
    authorUserId: user.id,
    authorName: user.name || user.email,
    body: String(body || '').trim().slice(0, 8000),
    leadMentions,
    userMentions,
    threadParentId: threadParentId || null,
    reactions: {},
    createdAt: now,
    updatedAt: now,
  }
}

export function toggleMessageReaction(store, user, messageId, emoji) {
  const allowed = CHITHI_REACTIONS.includes(emoji)
  if (!allowed) throw new Error('Reaction not supported')

  const message = (store.chithiMessages || []).find(
    (m) => m.id === messageId && m.organizationId === user.organizationId
  )
  if (!message) throw new Error('Message not found')

  const channel = (store.chithiChannels || []).find((c) => c.id === message.channelId)
  if (!channel || !userCanAccessChannel(channel, user)) throw new Error('Channel not found')

  message.reactions = message.reactions && typeof message.reactions === 'object' ? message.reactions : {}
  const list = Array.isArray(message.reactions[emoji]) ? [...message.reactions[emoji]] : []
  const idx = list.indexOf(user.id)
  if (idx >= 0) list.splice(idx, 1)
  else list.push(user.id)
  if (list.length) message.reactions[emoji] = list
  else delete message.reactions[emoji]
  message.updatedAt = new Date().toISOString()
  return mapMessageRow(message, user)
}

/** Persist message rows only (no email/Slack — call deliverChithiNotifications after save). */
export function postToChannel({ store, user, channelId, body, threadParentId = null }) {
  const channel = (store.chithiChannels || []).find((c) => c.id === channelId)
  if (!channel || !userCanAccessChannel(channel, user)) {
    throw new Error('Channel not found')
  }
  if (!String(body || '').trim()) throw new Error('Write a message')

  const leadMentions = parseLeadMentions(body)
  const userMentions = parseUserMentions(body)
  validateLeadMentions(store, user, leadMentions)
  validateUserMentions(store, user.organizationId, userMentions, user.id)

  if (channel.type === 'public') {
    if (threadParentId) {
      const parent = (store.chithiMessages || []).find(
        (m) => m.id === threadParentId && m.channelId === channel.id && !m.threadParentId
      )
      if (!parent) throw new Error('Thread not found')
    }

    const message = createChithiMessageRow({
      user,
      channelId: channel.id,
      body,
      leadMentions,
      userMentions,
      threadParentId,
    })
    store.chithiMessages = store.chithiMessages || []
    store.chithiMessages.push(message)
    channel.updatedAt = message.createdAt

    return {
      message: mapMessageRow(message, user),
      notify: {
        kind: 'public',
        organizationId: user.organizationId,
        channelLabel: getChannelLabel(channel, user, store),
        body,
        userMentions,
        ctaPath: `/?panel=chithi&channel=${encodeURIComponent(channel.id)}`,
        actor: user,
      },
    }
  }

  const peerId = (channel.dmUserIds || []).find((id) => id !== user.id)
  if (!peerId) throw new Error('Invalid direct message')

  const recipient = validateRecipient(store, user.organizationId, peerId)
  const note = createTeamNoteRow({ user, recipientUserId: recipient.id, body, leadMentions })
  store.teamNotes = store.teamNotes || []
  store.teamNotes.push(note)

  return {
    message: noteToFeedMessage(note, user),
    notify: {
      kind: 'dm',
      note,
      actor: user,
      userMentions: userMentions.filter((m) => m.userId !== peerId),
      channelLabel: getChannelLabel(channel, user, store),
      ctaPath: `/?panel=chithi&channel=${encodeURIComponent(channel.id)}`,
      organizationId: user.organizationId,
      body,
    },
  }
}

export async function deliverChithiNotifications(store, notify) {
  if (!notify) return { emailSent: false, slackSent: false, pushSent: 0 }

  const pushForMentions = async () => {
    const mentionIds = (notify.userMentions || []).map((m) => m.userId).filter(Boolean)
    if (!mentionIds.length) return { sent: 0, expiredIds: [] }
    const actorName = notify.actor?.name || notify.actor?.email || 'Teammate'
    const result = await notifyChithiPushRecipients({
      store,
      recipientUserIds: mentionIds,
      actorUserId: notify.actor?.id,
      title: `${actorName} mentioned you in Chithi`,
      body: notify.body,
      url: notify.ctaPath || '/?panel=chithi',
      tag: `chithi-mention-${Date.now()}`,
    })
    return result
  }

  if (notify.kind === 'public') {
    const result = await notifyChithiMessageAudience({
      store,
      organizationId: notify.organizationId,
      actor: notify.actor,
      channelLabel: notify.channelLabel,
      body: notify.body,
      userMentions: notify.userMentions || [],
      ctaPath: notify.ctaPath,
    })
    const mentionPush = await pushForMentions()
    await pruneExpiredPushSubscriptions(mentionPush.expiredIds)
    return {
      emailSent: Boolean(result.emails?.some((e) => e.sent)),
      slackSent: Boolean(result.slack?.sent),
      pushSent: mentionPush.sent,
    }
  }

  if (notify.kind === 'dm') {
    const emailResult = await notifyTeamNoteRecipient({
      store,
      note: notify.note,
      actor: notify.actor,
    })
    let slackSent = false
    if (notify.userMentions?.length) {
      const extra = await notifyChithiMessageAudience({
        store,
        organizationId: notify.organizationId,
        actor: notify.actor,
        channelLabel: notify.channelLabel,
        body: notify.body,
        userMentions: notify.userMentions,
        ctaPath: notify.ctaPath,
      })
      slackSent = Boolean(extra.slack?.sent)
    }

    const actorName = notify.actor?.name || notify.actor?.email || 'Teammate'
    const dmPush = await notifyChithiPushRecipients({
      store,
      recipientUserIds: [notify.note?.recipientUserId],
      actorUserId: notify.actor?.id,
      title: `${actorName} — ${notify.channelLabel || 'Chithi'}`,
      body: notify.body || notify.note?.body,
      url: notify.ctaPath || '/?panel=chithi',
      tag: notify.note?.id ? `chithi-dm-${notify.note.id}` : 'chithi-dm',
    })
    const mentionPush = await pushForMentions()
    await pruneExpiredPushSubscriptions([...dmPush.expiredIds, ...mentionPush.expiredIds])

    return {
      emailSent: Boolean(emailResult.sent),
      slackSent,
      pushSent: dmPush.sent + mentionPush.sent,
    }
  }

  return { emailSent: false, slackSent: false, pushSent: 0 }
}

export function startDmChannel(store, user, peerUserId) {
  validateRecipient(store, user.organizationId, peerUserId)
  return ensureDmChannel(store, user.organizationId, user.id, peerUserId).channel
}
