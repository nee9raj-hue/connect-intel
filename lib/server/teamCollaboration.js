import { createId } from './store.js'
import { getMembership, listPipelineEntries, listTeamMembers } from './organizations.js'
import {
  formatLeadMentionLabel,
  LEAD_MENTION_RE,
  LEGACY_LEAD_MENTION_RE,
  parseLeadMentions,
} from '../mentionTokens.js'

export { formatLeadMentionLabel, LEAD_MENTION_RE, LEGACY_LEAD_MENTION_RE, parseLeadMentions }

export function requireTeamWorkspace(user) {
  if (!user?.organizationId || user.accountType !== 'company') {
    return { ok: false, error: 'Team notes and tasks are available on company accounts.' }
  }
  return { ok: true }
}

export function filterOrgRows(rows, organizationId) {
  return (rows || []).filter((r) => r.organizationId === organizationId)
}

export function userCanViewNote(note, user) {
  if (!note || note.organizationId !== user.organizationId) return false
  if (user.isOrgAdmin) return true
  return note.authorUserId === user.id || note.recipientUserId === user.id
}

export function userCanViewTask(task, user) {
  if (!task || task.organizationId !== user.organizationId) return false
  if (user.isOrgAdmin) return true
  return task.authorUserId === user.id || task.assigneeUserId === user.id
}

export function validateRecipient(store, organizationId, recipientUserId) {
  const member = getMembership(store, recipientUserId, organizationId)
  if (!member || member.status !== 'active') {
    throw new Error('Choose a team member from your organization')
  }
  const user = store.users.find((u) => u.id === recipientUserId)
  return user
}

export function validateLeadMentions(store, user, leadMentions = []) {
  const visible = new Set(listPipelineEntries(store, user).map((l) => l.id))
  for (const mention of leadMentions) {
    if (!visible.has(mention.leadId)) {
      throw new Error(`Customer not in your pipeline: ${mention.label || mention.leadId}`)
    }
  }
}

export function searchMentionLeads(store, user, query = '', limit = 15) {
  const q = String(query || '').trim().toLowerCase()
  const leads = listPipelineEntries(store, user)
  const scored = leads
    .map((lead) => {
      const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim()
      const hay = [name, lead.company, lead.email, lead.title, lead.phone, lead.mobile]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!q) return { lead, score: 1 }
      if (!hay.includes(q)) return null
      const score = (name.toLowerCase().startsWith(q) ? 3 : 0) + (lead.company?.toLowerCase().startsWith(q) ? 2 : 0) + 1
      return { lead, score }
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  return scored.map(({ lead }) => ({
    id: lead.id,
    label: formatLeadMentionLabel(lead),
    name: [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim(),
    company: lead.company || '',
    email: lead.email || '',
    phone: String(lead.phone || lead.mobile || '').trim(),
  }))
}

export function createTeamNoteRow({ user, recipientUserId, body, leadMentions }) {
  const now = new Date().toISOString()
  return {
    id: createId('tnote'),
    organizationId: user.organizationId,
    authorUserId: user.id,
    authorName: user.name || user.email,
    recipientUserId,
    body: String(body || '').trim().slice(0, 8000),
    leadMentions,
    createdAt: now,
    updatedAt: now,
  }
}

export function createTeamTaskRow({ user, assigneeUserId, title, body, dueAt, leadMentions }) {
  const now = new Date().toISOString()
  return {
    id: createId('ttask'),
    organizationId: user.organizationId,
    authorUserId: user.id,
    authorName: user.name || user.email,
    assigneeUserId,
    title: String(title || '').trim().slice(0, 200),
    body: String(body || '').trim().slice(0, 8000),
    leadMentions,
    dueAt: dueAt || null,
    status: 'open',
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  }
}

export function listTeamMembersForPicker(store, organizationId, currentUserId) {
  return listTeamMembers(store, organizationId).filter((m) => m.status === 'active' && m.userId !== currentUserId)
}
