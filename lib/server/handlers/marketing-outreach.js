import { requireUser } from '../auth.js'
import { createId, readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { loadMarketingGateContext, marketingScopeKey, requireMarketingHubAccess, rowInMarketingScope } from '../marketingAccess.js'
import { addManualPipelineLead } from '../manualPipelineLead.js'

const READ = ['users', 'organizations', 'organizationMemberships', 'outreachProspects', 'outreachMailboxes', 'savedLeads', 'contacts', 'companies', 'crmPipelines', 'marketingEvents']

function clean(value, max = 160) {
  return String(value || '').trim().slice(0, max)
}

function normalizedEmail(value) {
  return clean(value, 254).toLowerCase()
}

function listForUser(store, user) {
  return (store.outreachProspects || []).filter((row) => rowInMarketingScope(row, user))
}

function defaultAdminId(store, user) {
  const org = (store.organizations || []).find((row) => row.id === user.organizationId)
  if (org?.ownerUserId) return org.ownerUserId
  return (store.organizationMemberships || []).find(
    (row) => row.organizationId === user.organizationId && ['admin', 'org_admin'].includes(row.role)
  )?.userId || user.id
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return
  const { user, store: gateStore } = await loadMarketingGateContext(sessionUser)
  const access = await requireMarketingHubAccess(user, gateStore)
  if (!access.ok) return sendJson(res, access.status || 403, { error: access.error })

  if (req.method === 'GET') {
    const store = await readStore({ only: READ })
    return sendJson(res, 200, {
      prospects: listForUser(store, user).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
      mailboxes: (store.outreachMailboxes || []).filter((row) => rowInMarketingScope(row, user)),
      defaultAdminUserId: defaultAdminId(store, user),
    })
  }

  const body = getBody(req)
  if (req.method === 'POST' && body.action === 'import') {
    const rows = Array.isArray(body.prospects) ? body.prospects.slice(0, 2000) : []
    if (!rows.length) return sendJson(res, 400, { error: 'Add at least one prospect' })
    let created = 0
    let skipped = 0
    await updateStore((draft) => {
      draft.outreachProspects = draft.outreachProspects || []
      const scope = marketingScopeKey(user)
      const known = new Set(listForUser(draft, user).map((row) => normalizedEmail(row.email)))
      for (const row of rows) {
        const email = normalizedEmail(row.email)
        if (!email.includes('@') || known.has(email)) { skipped += 1; continue }
        known.add(email)
        draft.outreachProspects.push({
          id: createId('outreach'), ...scope, firstName: clean(row.firstName || row.name?.split(/\s+/)[0]),
          lastName: clean(row.lastName || row.name?.split(/\s+/).slice(1).join(' ')),
          email, company: clean(row.company), title: clean(row.title), phone: clean(row.phone, 40),
          status: 'new', source: 'outreach_import', createdAt: new Date().toISOString(), createdByUserId: user.id,
        })
        created += 1
      }
      return draft
    })
    return sendJson(res, 200, { created, skipped })
  }

  if (req.method === 'POST' && body.action === 'add_mailbox') {
    const email = normalizedEmail(body.email)
    if (!email.includes('@')) return sendJson(res, 400, { error: 'Enter a valid outreach mailbox address' })
    const dailyCap = Math.min(200, Math.max(1, Number(body.dailyCap) || 40))
    const store = await updateStore((draft) => {
      draft.outreachMailboxes = draft.outreachMailboxes || []
      if ((draft.outreachMailboxes || []).some((row) => rowInMarketingScope(row, user) && row.email === email)) {
        throw new Error('This mailbox is already in the sender pool')
      }
      draft.outreachMailboxes.push({ id: createId('outbox'), ...marketingScopeKey(user), email, domain: email.split('@')[1], dailyCap, status: 'awaiting_connection', createdAt: new Date().toISOString(), createdByUserId: user.id })
      return draft
    })
    return sendJson(res, 200, { mailboxes: (store.outreachMailboxes || []).filter((row) => rowInMarketingScope(row, user)) })
  }

  if (req.method === 'POST' && body.action === 'transfer') {
    let transferred = null
    await updateStore((draft) => {
      const prospect = (draft.outreachProspects || []).find((row) => row.id === body.id && rowInMarketingScope(row, user))
      if (!prospect) throw new Error('Outreach prospect not found')
      if (prospect.status === 'transferred') throw new Error('This prospect is already in CRM')
      const lead = addManualPipelineLead(draft, { user, organizationId: user.organizationId, fields: {
        firstName: prospect.firstName, lastName: prospect.lastName, email: prospect.email, phone: prospect.phone,
        company: prospect.company, title: prospect.title, source: 'outreach_qualified', status: 'unqualified',
      } })
      const entry = (draft.savedLeads || []).find((row) => row.contactId === lead.id)
      if (entry) entry.assignedToUserId = defaultAdminId(draft, user)
      prospect.status = 'transferred'; prospect.transferredAt = new Date().toISOString(); prospect.transferredByUserId = user.id; prospect.pipelineLeadId = lead.id
      transferred = lead
      return draft
    })
    return sendJson(res, 200, { lead: transferred, message: 'Moved to CRM and assigned to the workspace admin' })
  }

  if (req.method === 'PATCH') {
    const allowed = new Set(['new', 'contacted', 'replying', 'qualified', 'not_a_fit'])
    const status = clean(body.status, 32)
    if (!allowed.has(status)) return sendJson(res, 400, { error: 'Invalid outreach status' })
    await updateStore((draft) => {
      const row = (draft.outreachProspects || []).find((item) => item.id === body.id && rowInMarketingScope(item, user))
      if (!row) throw new Error('Outreach prospect not found')
      row.status = status; row.updatedAt = new Date().toISOString()
      return draft
    })
    return sendJson(res, 200, { ok: true })
  }
  return methodNotAllowed(res, ['GET', 'POST', 'PATCH'])
}
