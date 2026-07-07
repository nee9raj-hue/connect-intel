/**
 * Structured CRM queries — not generic Meilisearch for sales workflows.
 */

import { listPipelineSavedEntries } from '../organizations.js'
import { normalizeExtendedCrm } from '../crmWorkflow.js'

function leadName(entry) {
  const lead = entry.lead || {}
  return [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.company || 'Lead'
}

function isAssignedToUser(entry, userId) {
  const uid = String(userId)
  if (entry.assignedToUserId) return String(entry.assignedToUserId) === uid
  return [entry.savedByUserId, entry.userId].some((v) => v && String(v) === uid)
}

function entryToResult(entry, extra = {}) {
  const lead = entry.lead || {}
  const crm = normalizeExtendedCrm(entry.crm)
  const leadId = lead.id || entry.id
  const company = lead.company || ''
  const name = leadName(entry)
  return {
    type: 'lead',
    id: leadId,
    leadId,
    title: company ? `${company} · ${name}` : name,
    subtitle: `Status: ${crm.status || 'new'}${extra.dueLabel ? ` · ${extra.dueLabel}` : ''}`,
    panel: 'pipeline',
    company,
    contactName: name,
    status: crm.status || 'new',
    email: lead.email || '',
    phone: lead.phone || '',
    dueAt: extra.dueAt || crm.nextFollowUpAt || null,
    overdue: Boolean(extra.overdue),
  }
}

export function retrieveCrmFollowUps(store, user, { mineOnly = true } = {}) {
  const entries = listPipelineSavedEntries(store, user)
  const now = Date.now()
  const endToday = new Date()
  endToday.setHours(23, 59, 59, 999)

  const results = []

  for (const entry of entries) {
    if (mineOnly && !isAssignedToUser(entry, user.id)) continue
    const crm = normalizeExtendedCrm(entry.crm)
    const status = crm.status || 'new'

    const dueAt = crm.nextFollowUpAt ? new Date(crm.nextFollowUpAt).getTime() : null
    const overdue = dueAt != null && dueAt < now
    const dueToday = dueAt != null && dueAt <= endToday.getTime() && dueAt >= now - 86400000

    const needsFollowUp =
      status === 'follow_up' ||
      overdue ||
      (status === 'contacted' && dueAt && dueAt <= endToday.getTime())

    if (!needsFollowUp) continue

    let dueLabel = 'Follow-up'
    if (overdue) dueLabel = 'Overdue'
    else if (dueToday) dueLabel = 'Due today'

    results.push(
      entryToResult(entry, {
        dueLabel,
        dueAt: crm.nextFollowUpAt,
        overdue,
      })
    )
  }

  results.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
    const atA = a.dueAt ? new Date(a.dueAt).getTime() : Infinity
    const atB = b.dueAt ? new Date(b.dueAt).getTime() : Infinity
    return atA - atB
  })

  return {
    query: 'follow-ups due',
    kind: 'follow_up',
    results: results.slice(0, 20),
    total: results.length,
  }
}

export function retrieveStalledDeals(store, user) {
  const entries = listPipelineSavedEntries(store, user)
  const cutoff = Date.now() - 7 * 86400000
  const results = []

  for (const entry of entries) {
    if (!isAssignedToUser(entry, user.id)) continue
    const crm = normalizeExtendedCrm(entry.crm)
    const status = crm.status || 'new'
    if (['won', 'lost'].includes(status)) continue

    const last =
      crm.lastCommunicationAt ||
      crm.lastEmailSentAt ||
      crm.lastCallAt ||
      entry.savedAt ||
      null
    const stale = !last || new Date(last).getTime() < cutoff
    if (!stale) continue

    results.push(entryToResult(entry, { dueLabel: 'No activity 7+ days' }))
  }

  return {
    query: 'stalled deals',
    kind: 'stalled',
    results: results.slice(0, 20),
    total: results.length,
  }
}

export function formatFollowUpReply(searchResult) {
  const { results = [], total = 0 } = searchResult || {}
  if (!results.length) {
    return {
      reply:
        '**Answer:** No follow-ups due on your assigned leads right now.\n\n**CRM findings:**\n- Pipeline is clear for today\n\n**Next step:** Run a market search or review hot leads.',
      source: 'crm',
      sources: [{ type: 'crm', label: 'CRM pipeline' }],
      confidence: 'high',
      suggestions: ['Brief me', 'Find exporters in my region', 'Open Pipeline'],
      actions: [{ type: 'navigate', panel: 'pipeline', label: 'Open Pipeline' }],
    }
  }

  const lines = results.slice(0, 12).map((r) => {
    const flag = r.overdue ? '**Overdue**' : r.subtitle?.includes('today') ? 'Today' : 'Due'
    return `**${r.company || r.title}** — ${r.contactName} · ${flag}`
  })

  return {
    reply: `**Answer:** **${total}** follow-up${total === 1 ? '' : 's'} need action on your leads.\n\n**CRM findings:**\n${lines.map((l) => `- ${l}`).join('\n')}\n\n**Next step:** Open a lead to call, email, or mark done.`,
    source: 'crm',
    sources: [{ type: 'crm', label: 'CRM pipeline' }],
    confidence: 'high',
    suggestions: ['Draft follow-up email', 'Schedule calls for today'],
    actions: results.slice(0, 4).map((r) => ({
      type: 'navigate',
      panel: 'pipeline',
      leadId: r.leadId,
      label: r.overdue ? `Call ${r.company || 'lead'}` : `Open ${r.company || 'lead'}`,
    })),
    crmResults: results,
  }
}
