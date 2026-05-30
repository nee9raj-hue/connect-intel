import { stripMentionTokensForPreview } from './chithiMentions.js'
import { postSlackChatMessage } from './slackOAuth.js'

export async function postChithiSlackWebhook({ webhookUrl, text, blocks }) {
  const url = String(webhookUrl || '').trim()
  if (!url || !url.startsWith('https://hooks.slack.com/')) {
    return { sent: false, skipped: 'no_webhook' }
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8_000)
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: String(text || '').slice(0, 3000),
        blocks: blocks || undefined,
      }),
      signal: controller.signal,
    })
    clearTimeout(timer)
    return { sent: res.ok, status: res.status, via: 'webhook' }
  } catch (error) {
    return { sent: false, error: error.message, via: 'webhook' }
  }
}

function buildChithiSlackBlocks({ actorName, channelLabel, preview, link }) {
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${actorName}* posted in *${channelLabel}*\n>${preview.replace(/\n/g, '\n>')}`,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Open Chithi' },
          url: link,
        },
      ],
    },
  ]
}

export async function postChithiSlackNotification({ organization, text, blocks }) {
  const token = String(organization?.chithiSlackAccessToken || '').trim()
  const channelId = String(organization?.chithiSlackChannelId || '').trim()

  if (token && channelId) {
    const oauthResult = await postSlackChatMessage({ token, channel: channelId, text, blocks })
    if (oauthResult.sent) return { ...oauthResult, via: 'oauth' }
    const webhookUrl = organization?.chithiSlackWebhookUrl
    if (!webhookUrl) return oauthResult
    const webhookResult = await postChithiSlackWebhook({ webhookUrl, text, blocks })
    return { ...webhookResult, oauthError: oauthResult.error }
  }

  return postChithiSlackWebhook({
    webhookUrl: organization?.chithiSlackWebhookUrl,
    text,
    blocks,
  })
}

export async function notifyChithiSlackChannel({
  organization,
  channelLabel,
  actorName,
  body,
  appUrl,
  channelPath,
}) {
  const preview = stripMentionTokensForPreview(body).slice(0, 280)
  const link = `${appUrl}${channelPath || '/?panel=chithi'}`
  const text = `${actorName} in ${channelLabel}: ${preview}`
  const blocks = buildChithiSlackBlocks({ actorName, channelLabel, preview, link })

  return postChithiSlackNotification({ organization, text, blocks })
}

export async function sendChithiSlackTestNotification({ organization, appUrl }) {
  const team = organization?.chithiSlackTeamName || 'your workspace'
  const channel = organization?.chithiSlackChannelName
    ? `#${organization.chithiSlackChannelName}`
    : 'the selected channel'

  return postChithiSlackNotification({
    organization,
    text: `Connect Intel Chithi test — notifications will post to ${channel} in ${team}.`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Chithi Slack test*\nNotifications are configured for *${channel}* in *${team}*.`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Open Chithi' },
            url: `${appUrl}/?panel=chithi`,
          },
        ],
      },
    ],
  })
}
