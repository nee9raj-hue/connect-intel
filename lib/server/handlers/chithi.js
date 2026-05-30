import { requireUser } from '../auth.js'
import { readStore, updateStorePartial } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { requireTeamWorkspace } from '../teamCollaboration.js'
import { countChithiUnread } from '../chithiUnread.js'
import {
  CHITHI_REACTIONS,
  CHITHI_READ_COLLECTIONS,
  createPublicChannel,
  deliverChithiNotifications,
  formatChannelForUser,
  listChannelFeed,
  listChannelsForUser,
  postToChannel,
  startDmChannel,
  syncChithiChannels,
  toggleMessageReaction,
} from '../chithi.js'
import { buildOrgUserResponse, getOrganization } from '../organizations.js'
import { isSlackOAuthConfigured } from '../slackOAuth.js'
import {
  getVapidPublicKey,
  isWebPushConfigured,
  listPushSubscriptionsForUser,
  removePushSubscription,
  upsertPushSubscription,
  userHasPushSubscription,
} from '../chithiPush.js'

const CHITHI_WRITE_COLLECTIONS = ['chithiChannels', 'chithiMessages', 'teamNotes']
const CHITHI_VALIDATION_COLLECTIONS = ['organizationMemberships', 'users', 'savedLeads']
const CHITHI_DM_VALIDATION_COLLECTIONS = ['organizationMemberships', 'users']

function bodyNeedsMentionValidation(body) {
  return /[@#]/.test(String(body || ''))
}

function attachChithiValidationContext(draft, ctx) {
  draft.organizationMemberships = ctx.organizationMemberships || []
  draft.users = ctx.users || []
  draft.savedLeads = ctx.savedLeads || []
}

function markChithiSeenOnUser(draft, userId) {
  const row = draft.users.find((u) => u.id === userId)
  const now = new Date().toISOString()
  if (row) {
    row.chithiLastSeenAt = now
    row.teamHubLastSeenAt = now
  }
}

function maskSlackWebhook(url) {
  const s = String(url || '').trim()
  if (!s) return ''
  if (s.length < 24) return '••••'
  return `${s.slice(0, 32)}…`
}

function clearChithiSlackOAuthFields(org) {
  if (!org) return
  org.chithiSlackAccessToken = null
  org.chithiSlackTeamId = null
  org.chithiSlackTeamName = null
  org.chithiSlackChannelId = null
  org.chithiSlackChannelName = null
  org.chithiSlackConnectedAt = null
}

function slackOAuthConnected(org) {
  return Boolean(org?.chithiSlackAccessToken && org?.chithiSlackTeamId)
}

function slackDeliveryConfigured(org) {
  return Boolean(
    (org?.chithiSlackAccessToken && org?.chithiSlackChannelId) || org?.chithiSlackWebhookUrl
  )
}

function chithiSlackSettingsPayload(org) {
  const oauth = slackOAuthConnected(org)
  return {
    slackOAuthConfigured: oauth,
    slackOAuthAvailable: isSlackOAuthConfigured(),
    slackTeamName: org?.chithiSlackTeamName || null,
    slackChannelId: org?.chithiSlackChannelId || null,
    slackChannelName: org?.chithiSlackChannelName || null,
    slackConnectedAt: org?.chithiSlackConnectedAt || null,
    slackWebhookConfigured: Boolean(org?.chithiSlackWebhookUrl),
    slackWebhookPreview: maskSlackWebhook(org?.chithiSlackWebhookUrl),
    slackConfigured: slackDeliveryConfigured(org),
    reactions: CHITHI_REACTIONS,
  }
}

async function requireChithiOrgAdmin(sessionUser, res) {
  const store = await readStore({ only: ['users', 'organizations', 'organizationMemberships'] })
  const row = store.users.find((u) => u.id === sessionUser.id) || sessionUser
  const user = buildOrgUserResponse(row, store)
  if (!user.isOrgAdmin) {
    sendJson(res, 403, { error: 'Only org admins can manage Chithi settings' })
    return null
  }
  const org = getOrganization(store, user.organizationId)
  return { store, user, org }
}

async function readChithiStore() {
  return readStore({ only: CHITHI_READ_COLLECTIONS })
}

async function persistChithiChannelsIfNeeded(store, user) {
  if (!syncChithiChannels(store, user)) return
  const channels = store.chithiChannels || []
  await updateStorePartial(['chithiChannels'], (draft) => {
    draft.chithiChannels = channels
    return draft
  })
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const check = requireTeamWorkspace(sessionUser)
  if (!check.ok) return sendJson(res, 403, { error: check.error })

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  const resource = url.searchParams.get('resource') || 'summary'

  if (resource === 'summary') {
    if (req.method === 'GET') {
      const store = await readChithiStore()
      const user = store.users.find((u) => u.id === sessionUser.id) || sessionUser
      return sendJson(res, 200, {
        unread: countChithiUnread(store, user),
        lastSeenAt: user.chithiLastSeenAt || user.teamHubLastSeenAt || null,
        reactions: CHITHI_REACTIONS,
      })
    }

    if (req.method === 'POST') {
      const { action } = getBody(req)
      if (action !== 'seen') return sendJson(res, 400, { error: 'Unknown action' })

      await updateStorePartial(['users'], (draft) => {
        markChithiSeenOnUser(draft, sessionUser.id)
        return draft
      })

      const store = await readChithiStore()
      const row = store.users.find((u) => u.id === sessionUser.id) || sessionUser
      const user = buildOrgUserResponse(row, store)
      const now = row.chithiLastSeenAt || row.teamHubLastSeenAt
      return sendJson(res, 200, {
        unread: countChithiUnread(store, row),
        lastSeenAt: now,
        user,
      })
    }

    return methodNotAllowed(res, ['GET', 'POST'])
  }

  if (resource === 'settings') {
    const store = await readStore({ only: ['users', 'organizations', 'organizationMemberships'] })
    const row = store.users.find((u) => u.id === sessionUser.id) || sessionUser
    const user = buildOrgUserResponse(row, store)
    if (!user.isOrgAdmin) return sendJson(res, 403, { error: 'Only org admins can manage Chithi settings' })

    const org = getOrganization(store, user.organizationId)

    if (req.method === 'GET') {
      return sendJson(res, 200, {
        slackWebhookConfigured: Boolean(org?.chithiSlackWebhookUrl),
        slackWebhookPreview: maskSlackWebhook(org?.chithiSlackWebhookUrl),
        reactions: CHITHI_REACTIONS,
      })
    }

    if (req.method === 'PATCH') {
      const { slackWebhookUrl } = getBody(req)
      const trimmed = String(slackWebhookUrl || '').trim()
      if (trimmed && !trimmed.startsWith('https://hooks.slack.com/')) {
        return sendJson(res, 400, { error: 'Use a Slack Incoming Webhook URL (hooks.slack.com)' })
      }

      await updateStorePartial(['organizations'], (draft) => {
        const row = draft.organizations.find((o) => o.id === user.organizationId)
        if (row) row.chithiSlackWebhookUrl = trimmed || null
        return draft
      })

      return sendJson(res, 200, {
        slackWebhookConfigured: Boolean(trimmed),
        slackWebhookPreview: maskSlackWebhook(trimmed),
      })
    }

    return methodNotAllowed(res, ['GET', 'PATCH'])
  }

  if (resource === 'channels') {
    if (req.method === 'GET') {
      const store = await readChithiStore()
      const user = store.users.find((u) => u.id === sessionUser.id) || sessionUser
      await persistChithiChannelsIfNeeded(store, user)
      const channels = listChannelsForUser(store, user)
      return sendJson(res, 200, { channels })
    }

    if (req.method === 'POST') {
      const { peerUserId, name, topic } = getBody(req)

      if (name) {
        if (!sessionUser.isOrgAdmin) {
          return sendJson(res, 403, { error: 'Only org admins can create channels' })
        }

        try {
          let channelRow = null
          await updateStorePartial(['chithiChannels'], (draft) => {
            syncChithiChannels(draft, sessionUser)
            channelRow = createPublicChannel(
              draft,
              sessionUser.organizationId,
              { name, topic },
              sessionUser.id
            )
            return draft
          })
          const row = formatChannelForUser({ users: [], organizationMemberships: [] }, sessionUser, channelRow)
          return sendJson(res, 201, { channel: row })
        } catch (error) {
          return sendJson(res, 400, { error: error.message || 'Could not create channel' })
        }
      }

      if (!peerUserId) return sendJson(res, 400, { error: 'Choose a teammate or channel name' })

      try {
        const store = await readStore({
          only: ['chithiChannels', 'organizationMemberships', 'users'],
        })
        const channel = startDmChannel(store, sessionUser, peerUserId)
        const exists = (store.chithiChannels || []).some((c) => c.id === channel.id)
        if (!exists) {
          await updateStorePartial(['chithiChannels'], (draft) => {
            draft.chithiChannels = draft.chithiChannels || []
            draft.chithiChannels.push(channel)
            return draft
          })
        }
        const row = formatChannelForUser(store, sessionUser, channel)
        return sendJson(res, 201, { channel: row })
      } catch (error) {
        return sendJson(res, 400, { error: error.message || 'Could not open chat' })
      }
    }

    return methodNotAllowed(res, ['GET', 'POST'])
  }

  if (resource === 'react') {
    if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])
    const { messageId, emoji } = getBody(req)
    if (!messageId || !emoji) return sendJson(res, 400, { error: 'messageId and emoji required' })

    try {
      let message = null
      await updateStorePartial(['chithiMessages'], (draft) => {
        const user = draft.users.find((u) => u.id === sessionUser.id) || sessionUser
        message = toggleMessageReaction(draft, user, messageId, emoji)
        return draft
      })
      return sendJson(res, 200, { message })
    } catch (error) {
      return sendJson(res, 400, { error: error.message || 'Could not react' })
    }
  }

  if (resource === 'messages') {
    const channelId = url.searchParams.get('channelId')
    if (!channelId) return sendJson(res, 400, { error: 'channelId required' })

    if (req.method === 'GET') {
      try {
        const store = await readChithiStore()
        const user = store.users.find((u) => u.id === sessionUser.id) || sessionUser
        const feed = listChannelFeed(store, user, channelId)
        return sendJson(res, 200, { ...feed, reactions: CHITHI_REACTIONS })
      } catch (error) {
        return sendJson(res, 404, { error: error.message || 'Channel not found' })
      }
    }

    if (req.method === 'POST') {
      const { body, threadParentId } = getBody(req)
      try {
        let notifyPayload = null
        let message = null
        const validationOnly = bodyNeedsMentionValidation(body)
          ? CHITHI_VALIDATION_COLLECTIONS
          : CHITHI_DM_VALIDATION_COLLECTIONS
        const validationCtx = await readStore({ only: validationOnly })

        await updateStorePartial(CHITHI_WRITE_COLLECTIONS, (draft) => {
          attachChithiValidationContext(draft, validationCtx)
          const result = postToChannel({
            store: draft,
            user: sessionUser,
            channelId,
            body,
            threadParentId: threadParentId || null,
          })
          message = result.message
          notifyPayload = result.notify
          return draft
        })

        void (async () => {
          try {
            const notifyStore = await readStore({ only: ['users', 'organizations', 'pushSubscriptions'] })
            await deliverChithiNotifications(notifyStore, notifyPayload)
          } catch {
            // Best-effort — do not block the send response.
          }
        })()

        return sendJson(res, 201, { message })
      } catch (error) {
        return sendJson(res, 400, { error: error.message || 'Could not send message' })
      }
    }

    return methodNotAllowed(res, ['GET', 'POST'])
  }

  if (resource === 'push') {
    if (req.method === 'GET') {
      const store = await readStore({ only: ['pushSubscriptions'] })
      return sendJson(res, 200, {
        configured: isWebPushConfigured(),
        vapidPublicKey: getVapidPublicKey(),
        subscribed: userHasPushSubscription(store, sessionUser.id),
        subscriptionCount: listPushSubscriptionsForUser(store, sessionUser.id).length,
      })
    }

    if (req.method === 'POST') {
      if (!isWebPushConfigured()) {
        return sendJson(res, 503, { error: 'Push notifications are not configured on this server yet.' })
      }
      const { subscription } = getBody(req)
      try {
        let saved = null
        await updateStorePartial(['pushSubscriptions'], (draft) => {
          saved = upsertPushSubscription(draft, sessionUser, {
            ...subscription,
            userAgent: req.headers['user-agent'] || '',
          })
          return draft
        })
        return sendJson(res, 201, { ok: true, subscription: { id: saved?.id } })
      } catch (error) {
        return sendJson(res, 400, { error: error.message || 'Could not save push subscription' })
      }
    }

    if (req.method === 'DELETE') {
      const { endpoint } = getBody(req)
      if (!endpoint) return sendJson(res, 400, { error: 'endpoint required' })
      await updateStorePartial(['pushSubscriptions'], (draft) => {
        removePushSubscription(draft, sessionUser.id, endpoint)
        return draft
      })
      return sendJson(res, 200, { ok: true })
    }

    return methodNotAllowed(res, ['GET', 'POST', 'DELETE'])
  }

  return sendJson(res, 400, { error: 'Unknown resource' })
}
