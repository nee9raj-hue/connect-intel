import { getAppBaseUrl } from './appUrl.js'
import { CRM_STATUSES } from './crm.js'

const STATUS_LABELS = Object.fromEntries(
  CRM_STATUSES.map((id) => [
    id,
    id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  ])
)

function leadDisplayName(lead) {
  const name = [lead?.firstName, lead?.lastName].filter(Boolean).join(' ').trim()
  return name || lead?.company || 'Lead'
}

function formatWhen(iso) {
  if (!iso) return '—'
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

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildAssignmentEmailContent({
  to,
  assigneeName,
  actorName,
  actorEmail,
  organizationName,
  lead,
  crm,
  aiSuggestion,
  aiGenerated = false,
}) {
  const normalizedTo = String(to || '').trim().toLowerCase()
  const name = leadDisplayName(lead)
  const company = lead?.company || '—'
  const title = lead?.title || '—'
  const email = lead?.email || '—'
  const phone = lead?.phone || '—'
  const status = STATUS_LABELS[crm?.status || 'new'] || crm?.status || 'New'
  const notes = String(crm?.notes || '').trim() || 'No notes yet.'
  const appUrl = getAppBaseUrl()

  const meetings = (crm?.meetings || [])
    .filter((m) => m?.scheduledAt)
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
    .slice(0, 8)

  const meetingsHtml = meetings.length
    ? `<ul style="margin:8px 0;padding-left:18px;color:#444">${meetings
        .map(
          (m) =>
            `<li style="margin-bottom:6px"><strong>${escapeHtml(m.title || 'Meeting')}</strong> · ${escapeHtml(formatWhen(m.scheduledAt))}${m.type ? ` · ${escapeHtml(m.type)}` : ''}${m.location ? `<br/><span style="color:#666">${escapeHtml(m.location)}</span>` : ''}</li>`
        )
        .join('')}</ul>`
    : '<p style="color:#666;margin:8px 0">No meetings scheduled yet.</p>'

  const meetingsText = meetings.length
    ? meetings
        .map(
          (m) =>
            `- ${m.title || 'Meeting'} · ${formatWhen(m.scheduledAt)}${m.type ? ` (${m.type})` : ''}`
        )
        .join('\n')
    : 'No meetings scheduled yet.'

  const subject = `${actorName || 'Your team'} assigned you a lead: ${name}${company !== '—' ? ` @ ${company}` : ''}`

  const suggestionLabel = aiGenerated ? 'AI suggested next steps' : 'Suggested next steps'

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <h2 style="color:#242424;margin:0 0 8px">New lead assigned to you</h2>
      <p style="color:#444;line-height:1.5;margin:0 0 16px">
        Hi ${escapeHtml(assigneeName || 'there')}, <strong>${escapeHtml(actorName || 'A teammate')}</strong>
        assigned a pipeline lead to you on <strong>${escapeHtml(organizationName || 'Connect Intel')}</strong>.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 16px;font-size:14px">
        <tr><td style="padding:6px 0;color:#666;width:120px">Lead</td><td style="padding:6px 0;color:#111;font-weight:600">${escapeHtml(name)}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Company</td><td style="padding:6px 0">${escapeHtml(company)}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Title</td><td style="padding:6px 0">${escapeHtml(title)}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Email</td><td style="padding:6px 0">${escapeHtml(email)}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Phone</td><td style="padding:6px 0">${escapeHtml(phone)}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Status</td><td style="padding:6px 0"><span style="background:#fff6d6;padding:2px 8px;border-radius:4px;font-weight:600">${escapeHtml(status)}</span></td></tr>
      </table>
      <h3 style="font-size:13px;color:#242424;margin:16px 0 6px;text-transform:uppercase;letter-spacing:0.04em">Notes</h3>
      <p style="color:#444;line-height:1.5;margin:0 0 16px;white-space:pre-wrap;background:#f6f7f9;padding:12px;border-radius:8px">${escapeHtml(notes)}</p>
      <h3 style="font-size:13px;color:#242424;margin:16px 0 6px;text-transform:uppercase;letter-spacing:0.04em">Meetings</h3>
      ${meetingsHtml}
      <h3 style="font-size:13px;color:#242424;margin:20px 0 6px;text-transform:uppercase;letter-spacing:0.04em">${suggestionLabel}</h3>
      <p style="color:#444;line-height:1.5;margin:0 0 20px;white-space:pre-wrap;background:#fffbeb;border:1px solid #fde68a;padding:12px;border-radius:8px">${escapeHtml(aiSuggestion)}</p>
      <p style="margin:24px 0">
        <a href="${appUrl}" style="background:#ffcb2b;color:#242424;padding:12px 20px;border-radius:8px;font-weight:600;text-decoration:none;display:inline-block">
          Open Connect Intel → Pipeline
        </a>
      </p>
      <p style="color:#888;font-size:12px">Reply to reach ${escapeHtml(actorName || 'your admin')}${actorEmail ? ` (${escapeHtml(actorEmail)})` : ''}.</p>
    </div>
  `

  const text = `New lead assigned to you

Hi ${assigneeName || 'there'},

${actorName || 'A teammate'} assigned you a lead on ${organizationName || 'Connect Intel'}.

Lead: ${name}
Company: ${company}
Title: ${title}
Email: ${email}
Phone: ${phone}
Status: ${status}

Notes:
${notes}

Meetings:
${meetingsText}

${suggestionLabel}:
${aiSuggestion}

Open pipeline: ${appUrl}

Reply to ${actorEmail || actorName || 'your admin'}.`

  return { normalizedTo, subject, html, text }
}
