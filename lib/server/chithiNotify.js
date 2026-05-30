import { getAppBaseUrl } from './appUrl.js'
import { getOrganization } from './organizations.js'
import { sendOrgNotificationEmail } from './email.js'
import { stripMentionTokensForPreview } from './chithiMentions.js'
import { notifyChithiSlackChannel } from './chithiSlack.js'

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export async function notifyChithiUserMentioned({ store, organizationId, toUserId, actor, channelLabel, body, ctaPath }) {
  const toUser = store.users.find((u) => u.id === toUserId)
  if (!toUser?.email || toUser.id === actor?.id) return { sent: false }

  const org = getOrganization(store, organizationId)
  const appUrl = getAppBaseUrl()
  const preview = stripMentionTokensForPreview(body)
  const ctaUrl = `${appUrl}${ctaPath || '/?panel=chithi'}`

  const html = [
    '<div style="font-family:system-ui,sans-serif;max-width:560px;color:#242424;line-height:1.5">',
    `<p style="font-size:15px">Hi ${escapeHtml(toUser.name || toUser.email)},</p>`,
    `<p style="font-size:14px;color:#444">${escapeHtml(actor?.name || 'A teammate')} mentioned you in <strong>${escapeHtml(channelLabel)}</strong> on Chithi:</p>`,
    `<div style="margin:16px 0;padding:14px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;font-size:14px">${escapeHtml(preview).replace(/\n/g, '<br>')}</div>`,
    `<p><a href="${ctaUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600">Open Chithi</a></p>`,
    '</div>',
  ].join('')

  return sendOrgNotificationEmail({
    to: toUser.email,
    subject: `${actor?.name || 'Teammate'} mentioned you in Chithi`,
    html,
    text: `${actor?.name} mentioned you in ${channelLabel}\n\n${preview}\n\n${ctaUrl}`,
    organizationId,
    senderName: actor?.name,
    organizationName: org?.name,
  })
}

export async function notifyChithiMessageAudience({
  store,
  organizationId,
  actor,
  channelLabel,
  body,
  userMentions = [],
  ctaPath,
}) {
  const org = getOrganization(store, organizationId)
  const appUrl = getAppBaseUrl()
  const path = ctaPath || '/?panel=chithi'

  const slackResult = await notifyChithiSlackChannel({
    organization: org,
    channelLabel,
    actorName: actor?.name || actor?.email || 'Teammate',
    body,
    appUrl,
    channelPath: path,
  })

  const emailResults = []
  for (const mention of userMentions) {
    if (mention.userId === actor?.id) continue
    const r = await notifyChithiUserMentioned({
      store,
      organizationId,
      toUserId: mention.userId,
      actor,
      channelLabel,
      body,
      ctaPath: path,
    })
    emailResults.push({ userId: mention.userId, ...r })
  }

  return { slack: slackResult, emails: emailResults }
}
