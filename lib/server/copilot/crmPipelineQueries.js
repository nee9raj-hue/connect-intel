/**
 * Structured CRM queries — not generic Meilisearch for sales workflows.
 */

import { listPipelineSavedEntries } from '../organizations.js'
import { normalizeExtendedCrm } from '../crmWorkflow.js'
import { normalizeCrmLeadStatus } from '../../crmLeadStatuses.js'

const CLOSED_STATUSES = new Set(['lost', 'churned'])

function leadName(entry) {
  const lead = entry.lead || {}
  return [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.company || 'Lead'
}

function isAssignedToUser(entry, userId) {
  const uid = String(userId)
  if (entry.assignedToUserId) return String(entry.assignedToUserId) === uid
  return [entry.savedByUserId, entry.userId].some((v) => v && String(v) === uid)
}

function followUpDueAt(crm) {
  return crm.nextFollowUpAt || crm.followUpAt || null
}

function entryToResult(entry, extra = {}) {
  const lead = entry.lead || {}
  const crm = normalizeExtendedCrm(entry.crm)
  const status = normalizeCrmLeadStatus(crm.status)
  const leadId = lead.id || entry.id
  const company = lead.company || ''
  const name = leadName(entry)
  return {
    type: 'lead',
    id: leadId,
    leadId,
    title: company ? `${company} · ${name}` : name,
    subtitle: `Status: ${status}${extra.dueLabel ? ` · ${extra.dueLabel}` : ''}`,
    panel: 'pipeline',
    company,
    contactName: name,
    status,
    email: lead.email || '',
    phone: lead.phone || '',
    dueAt: extra.dueAt || followUpDueAt(crm),
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
    const status = normalizeCrmLeadStatus(crm.status)
    if (CLOSED_STATUSES.has(status)) continue

    const dueRaw = followUpDueAt(crm)
    const dueAt = dueRaw ? new Date(dueRaw).getTime() : null
    if (dueAt == null || Number.isNaN(dueAt)) continue

    const overdue = dueAt < now
    const dueToday = dueAt <= endToday.getTime() && dueAt >= now - 86400000
    if (!overdue && !dueToday) continue

    results.push(
      entryToResult(entry, {
        dueLabel: overdue ? 'Overdue' : 'Due today',
        dueAt: dueRaw,
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
    const status = normalizeCrmLeadStatus(crm.status)
    if (CLOSED_STATUSES.has(status)) continue

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

export function retrieveAtRiskAccounts(store, user) {
  const entries = listPipelineSavedEntries(store, user)
  const results = []

  for (const entry of entries) {
    if (!isAssignedToUser(entry, user.id)) continue
    const crm = normalizeExtendedCrm(entry.crm)
    const status = normalizeCrmLeadStatus(crm.status)
    if (status !== 'at_risk' && status !== 'churned') continue
    results.push(
      entryToResult(entry, {
        dueLabel: status === 'churned' ? 'Churned' : 'At risk',
      })
    )
  }

  return {
    query: 'at-risk accounts',
    kind: 'at_risk',
    results: results.slice(0, 20),
    total: results.length,
  }
}

function formatListReply(searchResult, { empty, nonempty, nextHit, suggestions }) {
  const { results = [], total = 0 } = searchResult || {}
  if (!results.length) {
    return {
      reply: empty,
      source: 'crm',
      sources: [{ type: 'crm', label: 'CRM pipeline' }],
      confidence: 'high',
      suggestions,
      actions: [{ type: 'navigate', panel: 'pipeline', label: 'Open Pipeline' }],
    }
  }

  const lines = results.slice(0, 12).map((r) => {
    const flag = r.overdue ? '**Overdue**' : r.subtitle?.includes('today') ? 'Today' : r.subtitle || ''
    return `**${r.company || r.title}** — ${r.contactName}${flag ? ` · ${flag}` : ''}`
  })

  return {
    reply: `${nonempty(total)}\n\n**CRM findings:**\n${lines.map((l) => `- ${l}`).join('\n')}\n\n**Next step:** ${nextHit}`,
    source: 'crm',
    sources: [{ type: 'crm', label: 'CRM pipeline' }],
    confidence: 'high',
    suggestions,
    actions: results.slice(0, 4).map((r) => ({
      type: 'navigate',
      panel: 'pipeline',
      leadId: r.leadId,
      label: r.overdue ? `Open ${r.company || 'lead'}` : `Open ${r.company || 'lead'}`,
    })),
    crmResults: results,
  }
}

export function formatFollowUpReply(searchResult) {
  return formatListReply(searchResult, {
    empty:
      '**Answer:** No follow-ups due on your assigned leads right now.\n\n**CRM findings:**\n- Nothing due today\n\n**Next step:** Check at-risk accounts or open Pipeline.',
    nonempty: (total) =>
      `**Answer:** **${total}** follow-up${total === 1 ? '' : 's'} need action on your leads.`,
    nextHit: 'Open a lead to call, email, or mark the follow-up done.',
    suggestions: ['Draft follow-up email', 'Show at-risk and churned accounts'],
  })
}

export function formatAtRiskReply(searchResult) {
  return formatListReply(searchResult, {
    empty:
      '**Answer:** No at-risk or churned accounts on your assigned book.\n\n**Next step:** Review stalled deals or today’s follow-ups.',
    nonempty: (total) =>
      `**Answer:** **${total}** account${total === 1 ? '' : 's'} marked at risk or churned.`,
    nextHit: 'Open the account and log a save call or move stage if volume recovered.',
    suggestions: ['Who needs follow-up today?', 'Highlight stalled deals'],
  })
}
