import { LEAD_MENTION_RE, LEGACY_LEAD_MENTION_RE } from '../mentionTokens.js'
import { getAppBaseUrl } from './appUrl.js'
import { getOrganization } from './organizations.js'
import { sendOrgNotificationEmail } from './email.js'

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function linkLeadMentions(raw, replacer) {
  let out = String(raw || '')
  for (const mentionRe of [LEAD_MENTION_RE, LEGACY_LEAD_MENTION_RE]) {
    out = out.replace(mentionRe, replacer)
  }
  return out
}

function bodyForEmail(body, appUrl) {
  const html = linkLeadMentions(escapeHtml(String(body || '')), (_, label, leadId) => {
    const url = `${appUrl}/?panel=pipeline&lead=${encodeURIComponent(leadId)}`
    return `<a href="${url}" style="color:#111;font-weight:600">#${escapeHtml(label)}</a>`
  }).replace(/\n/g, '<br>')
  const text = linkLeadMentions(String(body || ''), (_, label) => `#${label}`)
  return { html, text }
}

function formatWhen(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata',
    })
  } catch {
    return iso
  }
}

async function sendCollaborationEmail({ store, organizationId, toUser, actor, subject, intro, body, ctaLabel, ctaPath }) {
  if (!toUser?.email || toUser.id === actor?.id) {
    return { sent: false, skipped: 'self_or_no_email' }
  }

  const org = getOrganization(store, organizationId)
  const appUrl = getAppBaseUrl()
  const formatted = bodyForEmail(body, appUrl)
  const ctaUrl = `${appUrl}${ctaPath}`

  const html = [
    '<div style="font-family:system-ui,sans-serif;max-width:560px;color:#242424;line-height:1.5">',
    `<p style="font-size:15px">Hi ${escapeHtml(toUser.name || toUser.email)},</p>`,
    `<p style="font-size:14px;color:#444">${escapeHtml(intro)}</p>`,
    `<div style="margin:16px 0;padding:14px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;font-size:14px">${formatted.html}</div>`,
    `<p style="margin-top:20px"><a href="${ctaUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;font-size:14px">${escapeHtml(ctaLabel)}</a></p>`,
    `<p style="font-size:12px;color:#888;margin-top:24px">${escapeHtml(org?.name || 'Connect Intel')} · Connect Intel</p>`,
    '</div>',
  ].join('')

  const text = `${intro}\n\n${formatted.text}\n\nOpen: ${ctaUrl}`

  return sendOrgNotificationEmail({
    to: toUser.email,
    subject,
    html,
    text,
    replyTo: actor?.email,
    organizationId,
    senderName: actor?.name,
    organizationName: org?.name,
  })
}

export async function notifyTeamNoteRecipient({ store, note, actor }) {
  const recipient = store.users.find((u) => u.id === note.recipientUserId)
  return sendCollaborationEmail({
    store,
    organizationId: note.organizationId,
    toUser: recipient,
    actor,
    subject: `Team message from ${actor?.name || 'teammate'}`,
    intro: `${actor?.name || 'A teammate'} sent you a message in Chithi:`,
    body: note.body,
    ctaLabel: 'Open Chithi',
    ctaPath: '/?panel=chithi',
  })
}

export async function notifyTeamTaskAssignee({ store, task, actor }) {
  const assignee = store.users.find((u) => u.id === task.assigneeUserId)
  const due = task.dueAt ? ` Due ${formatWhen(task.dueAt)}.` : ''
  const body = task.body?.trim() ? `${task.title}\n\n${task.body}` : task.title
  return sendCollaborationEmail({
    store,
    organizationId: task.organizationId,
    toUser: assignee,
    actor,
    subject: `Task assigned: ${task.title}`,
    intro: `${actor?.name || 'A teammate'} assigned you a task.${due}`,
    body,
    ctaLabel: 'Open Chithi',
    ctaPath: '/?panel=chithi&tab=tasks',
  })
}
