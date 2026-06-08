import { createId } from './store.js'
import { listTeamMembers } from './organizations.js'
import { filterOrgRows } from './teamCollaboration.js'
import { visiblePipelineEntries } from './pipelineQuery.js'
import { getChithiLastSeenMs, CHITHI_REACTIONS, mapMessageRow, listChannelFeed } from './chithi.js'
import { countChithiUnread } from './chithiUnread.js'

export const CHITHI_ROOM_TYPES = ['public', 'dm', 'customer', 'deal', 'campaign', 'team']

const TEAM_ALIASES = ['sales', 'marketing', 'management', 'support', 'everyone']

function slugify(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function leadLabel(entry) {
  return entry?.lead?.company || entry?.company || entry?.lead?.name || 'Customer'
}

function findEntityChannel(store, organizationId, roomType, entityId) {
  return (store.chithiChannels || []).find(
    (c) =>
      c.organizationId === organizationId &&
      c.type === 'public' &&
      c.roomType === roomType &&
      c.entityId === entityId
  )
}

export function ensureEntityChannel(store, organizationId, { roomType, entityId, label, topic, parentLeadId }) {
  const existing = findEntityChannel(store, organizationId, roomType, entityId)
  if (existing) return { channel: existing, created: false }

  const slugBase = slugify(label || entityId)
  const slug = `${roomType}-${slugBase}`.slice(0, 48)
  const now = new Date().toISOString()
  const channel = {
    id: createId('chch'),
    organizationId,
    type: 'public',
    roomType,
    entityId,
    parentLeadId: parentLeadId || null,
    slug,
    name: slugBase || roomType,
    topic: topic || null,
    memberUserIds: null,
    dmUserIds: null,
    createdAt: now,
    updatedAt: now,
  }
  store.chithiChannels = store.chithiChannels || []
  store.chithiChannels.push(channel)
  return { channel, created: true }
}

export function formatChannelV2(store, user, channel) {
  if (!channel) return null
  if (channel.type === 'dm') {
    const members = listTeamMembers(store, user.organizationId).filter((m) => m.status === 'active')
    const memberById = new Map(members.map((m) => [m.userId, m]))
    const otherId = (channel.dmUserIds || []).find((id) => id !== user.id)
    const other = memberById.get(otherId)
    const u = store.users.find((x) => x.id === otherId)
    const label = other?.name || u?.name || u?.email || 'Teammate'
    return {
      id: channel.id,
      type: 'dm',
      roomType: 'dm',
      slug: null,
      name: label,
      label,
      peerUserId: otherId || null,
      entityId: null,
    }
  }

  const roomType = channel.roomType || 'team'
  let label = `#${channel.name || channel.slug}`
  if (roomType === 'customer') label = `#${slugify(channel.topic || channel.name)}`
  if (roomType === 'deal') label = `deal · ${channel.topic || channel.name}`
  if (roomType === 'campaign') label = `campaign · ${channel.topic || channel.name}`

  return {
    id: channel.id,
    type: 'public',
    roomType,
    slug: channel.slug,
    name: channel.name,
    label,
    topic: channel.topic || '',
    entityId: channel.entityId || null,
    parentLeadId: channel.parentLeadId || null,
  }
}

export function listChannelsV2(store, user) {
  const channels = filterOrgRows(store.chithiChannels, user.organizationId).filter((c) => {
    if (c.type === 'dm') return (c.dmUserIds || []).includes(user.id)
    return c.type === 'public'
  })

  const formatted = channels.map((c) => formatChannelV2(store, user, c))
  const order = { customer: 0, deal: 1, campaign: 2, team: 3, public: 4, dm: 5 }
  return formatted.sort((a, b) => {
    const ra = order[a.roomType] ?? 9
    const rb = order[b.roomType] ?? 9
    if (ra !== rb) return ra - rb
    return a.label.localeCompare(b.label)
  })
}

function mapFeedMessage(m, user) {
  const base = mapMessageRow(m, user)
  return {
    ...base,
    messageType: m.messageType || 'user',
    activityKind: m.activityKind || null,
    activityMeta: m.activityMeta || null,
  }
}

export function listChannelFeedV2(store, user, channelId) {
  const channel = (store.chithiChannels || []).find((c) => c.id === channelId)
  if (!channel) throw new Error('Channel not found')
  if (channel.type === 'dm') return listChannelFeed(store, user, channelId)

  const rows = filterOrgRows(store.chithiMessages, user.organizationId)
    .filter((m) => m.channelId === channel.id)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map((m) => mapFeedMessage(m, user))

  const replyCount = {}
  for (const m of rows) {
    if (m.threadParentId) replyCount[m.threadParentId] = (replyCount[m.threadParentId] || 0) + 1
  }
  const messages = rows.map((m) => ({
    ...m,
    threadReplyCount: m.threadParentId ? 0 : replyCount[m.id] || 0,
  }))
  return { channel, messages }
}

export function postChithiActivity(store, {
  organizationId,
  roomType,
  entityId,
  parentLeadId,
  label,
  activityKind,
  summary,
  actorUserId,
  actorName,
  meta = {},
}) {
  if (!organizationId || !summary) return null

  const { channel, created } = ensureEntityChannel(store, organizationId, {
    roomType,
    entityId,
    label,
    topic: label,
    parentLeadId,
  })

  const now = new Date().toISOString()
  const message = {
    id: createId('cmsg'),
    organizationId,
    channelId: channel.id,
    authorUserId: actorUserId || 'system',
    authorName: actorName || 'CRM Activity',
    body: summary,
    leadMentions: parentLeadId ? [{ leadId: parentLeadId, label: label || 'Customer' }] : [],
    userMentions: [],
    threadParentId: null,
    reactions: {},
    messageType: 'activity',
    activityKind,
    activityMeta: meta,
    createdAt: now,
    updatedAt: now,
  }
  store.chithiMessages = store.chithiMessages || []
  store.chithiMessages.push(message)
  channel.updatedAt = now
  return { channel, message, created }
}

function pipelineForUser(store, user) {
  const entries = visiblePipelineEntries(store, user, store.savedLeads || [])
  return entries
}

function openDealsForLead(entry) {
  const deals = entry?.crm?.deals || []
  return deals.filter((d) => d.status !== 'won' && d.status !== 'lost')
}

export function buildChannelContext(store, user, channelId) {
  const channel = (store.chithiChannels || []).find((c) => c.id === channelId)
  if (!channel) return { kind: 'none' }

  const roomType = channel.roomType || (channel.type === 'dm' ? 'dm' : 'team')

  if (roomType === 'dm') {
    const peerId = (channel.dmUserIds || []).find((id) => id !== user.id)
    const peer = store.users.find((u) => u.id === peerId)
    return {
      kind: 'dm',
      title: peer?.name || peer?.email || 'Teammate',
      subtitle: 'Direct message',
      sections: [],
    }
  }

  if (roomType === 'customer' && channel.entityId) {
    const entry = pipelineForUser(store, user).find((e) => e.id === channel.entityId)
    const deals = openDealsForLead(entry)
    const tasks = filterOrgRows(store.teamTasks, user.organizationId)
      .filter((t) => t.status === 'open' && (t.leadMentions || []).some((m) => m.leadId === channel.entityId))
      .slice(0, 8)
    const meetings = (entry?.crm?.meetings || []).slice(-5).reverse()
    return {
      kind: 'customer',
      title: leadLabel(entry),
      subtitle: 'Customer channel',
      leadId: channel.entityId,
      customer: entry
        ? {
            company: leadLabel(entry),
            owner: entry.ownerName || entry.assignedTo,
            stage: entry.stage,
            value: deals.reduce((n, d) => n + (Number(d.amount) || 0), 0),
            email: entry.lead?.email,
            phone: entry.lead?.phone,
          }
        : null,
      deals,
      tasks,
      meetings,
      notes: entry?.crm?.notes?.slice(-5).reverse() || [],
      recentActivity: filterOrgRows(store.chithiMessages, user.organizationId)
        .filter((m) => m.channelId === channel.id && m.messageType === 'activity')
        .slice(-6)
        .reverse()
        .map((m) => ({ id: m.id, body: m.body, createdAt: m.createdAt })),
    }
  }

  if (roomType === 'deal' && channel.entityId) {
    const leadId = channel.parentLeadId
    const entry = leadId ? pipelineForUser(store, user).find((e) => e.id === leadId) : null
    const deal = entry?.crm?.deals?.find((d) => d.id === channel.entityId)
    return {
      kind: 'deal',
      title: deal?.name || channel.topic || 'Deal room',
      subtitle: deal?.stage || 'Pipeline',
      leadId,
      dealId: channel.entityId,
      deal: deal || null,
      tasks: filterOrgRows(store.teamTasks, user.organizationId)
        .filter((t) => t.status === 'open' && (t.leadMentions || []).some((m) => m.leadId === leadId))
        .slice(0, 6),
      timeline: (entry?.crm?.activity || []).slice(-8).reverse(),
      recentActivity: filterOrgRows(store.chithiMessages, user.organizationId)
        .filter((m) => m.channelId === channel.id)
        .slice(-8)
        .reverse()
        .map((m) => ({ id: m.id, body: m.body, createdAt: m.createdAt, messageType: m.messageType })),
    }
  }

  if (roomType === 'campaign') {
    return {
      kind: 'campaign',
      title: channel.topic || channel.name,
      subtitle: 'Campaign room',
      campaignId: channel.entityId,
      sections: [],
    }
  }

  const members = listTeamMembers(store, user.organizationId).filter((m) => m.status === 'active')
  return {
    kind: 'team',
    title: channel.name || channel.slug,
    subtitle: channel.topic || 'Team channel',
    metrics: {
      members: members.length,
      openTasks: filterOrgRows(store.teamTasks, user.organizationId).filter((t) => t.status === 'open').length,
    },
    sections: [],
  }
}

export function buildChithiWorkspace(store, user) {
  const lastSeen = getChithiLastSeenMs(user)
  const unread = countChithiUnread(store, user)
  const channels = listChannelsV2(store, user)
  const entries = pipelineForUser(store, user)

  const customerChannels = channels.filter((c) => c.roomType === 'customer')
  const dealRooms = channels.filter((c) => c.roomType === 'deal')
  const teamChannels = channels.filter((c) => c.roomType === 'team' || (!c.roomType && c.type === 'public'))
  const dms = channels.filter((c) => c.type === 'dm')

  const recentMessages = filterOrgRows(store.chithiMessages, user.organizationId)
    .filter((m) => new Date(m.createdAt).getTime() > lastSeen)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 12)

  const mentions = recentMessages.filter((m) =>
    (m.userMentions || []).some((um) => um.userId === user.id)
  )

  const activityFeed = filterOrgRows(store.chithiMessages, user.organizationId)
    .filter((m) => m.messageType === 'activity')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 15)
    .map((m) => {
      const ch = (store.chithiChannels || []).find((c) => c.id === m.channelId)
      return {
        id: m.id,
        body: m.body,
        activityKind: m.activityKind,
        channelId: m.channelId,
        channelLabel: ch ? formatChannelV2(store, user, ch)?.label : null,
        createdAt: m.createdAt,
      }
    })

  const pendingTasks = filterOrgRows(store.teamTasks, user.organizationId)
    .filter((t) => t.status === 'open' && t.assigneeUserId === user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8)

  const upcomingMeetings = []
  for (const entry of entries.slice(0, 40)) {
    for (const mt of entry?.crm?.meetings || []) {
      if (mt.scheduledAt && new Date(mt.scheduledAt) > new Date()) {
        upcomingMeetings.push({
          id: mt.id,
          title: mt.title || leadLabel(entry),
          leadId: entry.id,
          scheduledAt: mt.scheduledAt,
        })
      }
    }
  }
  upcomingMeetings.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))

  const suggestedCustomers = entries
    .filter((e) => !customerChannels.some((c) => c.entityId === e.id))
    .slice(0, 12)
    .map((e) => ({
      leadId: e.id,
      label: leadLabel(e),
      dealCount: openDealsForLead(e).length,
      stage: e.stage,
    }))

  return {
    unread,
    reactions: CHITHI_REACTIONS,
    teamAliases: TEAM_ALIASES,
    channels: { customer: customerChannels, deal: dealRooms, team: teamChannels, dm: dms },
    mentions: mentions.map((m) => ({
      id: m.id,
      body: m.body,
      authorName: m.authorName,
      channelId: m.channelId,
      createdAt: m.createdAt,
    })),
    activityFeed,
    pendingTasks,
    upcomingMeetings: upcomingMeetings.slice(0, 6),
    suggestedCustomers,
    quickActions: [
      { id: 'new-dm', label: 'New message' },
      { id: 'customer-channel', label: 'Customer channel' },
      { id: 'tasks', label: 'View tasks' },
    ],
  }
}

export function searchChithiV2(store, user, query) {
  const q = String(query || '').trim().toLowerCase()
  if (!q || q.length < 2) return { messages: [], customers: [], deals: [], tasks: [], channels: [] }

  const channels = listChannelsV2(store, user).filter(
    (c) => c.label?.toLowerCase().includes(q) || c.topic?.toLowerCase().includes(q)
  )

  const messages = filterOrgRows(store.chithiMessages, user.organizationId)
    .filter((m) => m.body?.toLowerCase().includes(q))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 20)
    .map((m) => ({
      id: m.id,
      body: m.body.slice(0, 200),
      channelId: m.channelId,
      createdAt: m.createdAt,
    }))

  const entries = pipelineForUser(store, user)
  const customers = entries
    .filter((e) => leadLabel(e).toLowerCase().includes(q))
    .slice(0, 10)
    .map((e) => ({ leadId: e.id, label: leadLabel(e) }))

  const deals = []
  for (const e of entries) {
    for (const d of e?.crm?.deals || []) {
      if (String(d.name || '').toLowerCase().includes(q)) {
        deals.push({ dealId: d.id, leadId: e.id, name: d.name, stage: d.stage })
      }
    }
    if (deals.length >= 10) break
  }

  const tasks = filterOrgRows(store.teamTasks, user.organizationId)
    .filter((t) => String(t.title || '').toLowerCase().includes(q) || String(t.body || '').toLowerCase().includes(q))
    .slice(0, 10)
    .map((t) => ({ id: t.id, title: t.title, status: t.status }))

  return { messages, customers, deals, tasks, channels }
}

export function openEntityChannel(store, user, { roomType, leadId, dealId, label }) {
  if (roomType === 'customer' && leadId) {
    const entry = pipelineForUser(store, user).find((e) => e.id === leadId)
    const lbl = label || leadLabel(entry)
    return ensureEntityChannel(store, user.organizationId, {
      roomType: 'customer',
      entityId: leadId,
      label: lbl,
      topic: lbl,
    })
  }
  if (roomType === 'deal' && dealId && leadId) {
    const entry = pipelineForUser(store, user).find((e) => e.id === leadId)
    const deal = entry?.crm?.deals?.find((d) => d.id === dealId)
    const lbl = deal?.name || label || 'Deal'
    return ensureEntityChannel(store, user.organizationId, {
      roomType: 'deal',
      entityId: dealId,
      parentLeadId: leadId,
      label: lbl,
      topic: lbl,
    })
  }
  throw new Error('Invalid entity channel request')
}
