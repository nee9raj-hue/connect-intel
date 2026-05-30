const SLACK_API = 'https://slack.com/api'

function slackClientId() {
  return String(process.env.SLACK_CLIENT_ID || '').trim()
}

function slackClientSecret() {
  return String(process.env.SLACK_CLIENT_SECRET || '').trim()
}

export function isSlackOAuthConfigured() {
  return Boolean(slackClientId() && slackClientSecret())
}

async function slackApiPost(method, token, body = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
  try {
    const res = await fetch(`${SLACK_API}/${method}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
      },
      body: new URLSearchParams(body).toString(),
      signal: controller.signal,
    })
    clearTimeout(timer)
    return await res.json().catch(() => ({}))
  } catch (error) {
    clearTimeout(timer)
    throw error
  }
}

export async function postSlackChatMessage({ token, channel, text, blocks }) {
  const accessToken = String(token || '').trim()
  const channelId = String(channel || '').trim()
  if (!accessToken || !channelId) {
    return { sent: false, error: 'missing_token_or_channel' }
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)
    const res = await fetch(`${SLACK_API}/chat.postMessage`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        channel: channelId,
        text: String(text || '').slice(0, 3000),
        ...(blocks ? { blocks } : {}),
      }),
      signal: controller.signal,
    })
    clearTimeout(timer)
    const data = await res.json().catch(() => ({}))
    if (data.ok) return { sent: true, ts: data.ts, channel: data.channel }
    return { sent: false, error: data.error || `http_${res.status}` }
  } catch (error) {
    return { sent: false, error: error.message || 'slack_request_failed' }
  }
}

export async function listSlackChannels(token) {
  const accessToken = String(token || '').trim()
  if (!accessToken) return []

  try {
    const channels = []
    let cursor = ''

    for (let page = 0; page < 10; page += 1) {
      const data = await slackApiPost('conversations.list', accessToken, {
        types: 'public_channel,private_channel',
        exclude_archived: 'true',
        limit: '200',
        cursor,
      })
      if (!data.ok) break

      for (const channel of data.channels || []) {
        channels.push({
          id: channel.id,
          name: channel.name,
          isPrivate: Boolean(channel.is_private),
          isMember: Boolean(channel.is_member),
        })
      }

      cursor = data.response_metadata?.next_cursor || ''
      if (!cursor) break
    }

    return channels.sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    return []
  }
}

export async function resolveSlackChannelName(token, channelId) {
  const accessToken = String(token || '').trim()
  const id = String(channelId || '').trim()
  if (!accessToken || !id) return null

  try {
    const data = await slackApiPost('conversations.info', accessToken, { channel: id })
    if (!data.ok || !data.channel) return null
    return data.channel.name || null
  } catch {
    return null
  }
}
