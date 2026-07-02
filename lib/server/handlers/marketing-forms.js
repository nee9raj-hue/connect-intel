import { requireUser } from '../auth.js'
import { readStore, updateStore, createId } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import {
  canAccessMarketingAsset,
  enrichMarketingRows,
  filterMarketingRows,
  loadMarketingGateContext,
  marketingScopeKey,
  requireMarketingHubAccess,
  requireMarketingUser,
} from '../marketingAccess.js'
import {
  normalizeFields,
  normalizeFormTheme,
  publicFormUrl,
} from '../../marketingFormSchema.js'

function slugify(text) {
  const base = String(text || 'form')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `${base || 'form'}-${Math.random().toString(36).slice(2, 8)}`
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const { user: gateUser, store: gateStore } = await loadMarketingGateContext(sessionUser)
  const hubCheck = await requireMarketingHubAccess(gateUser, gateStore)
  if (!hubCheck.ok) return sendJson(res, hubCheck.status || 403, { error: hubCheck.error, code: hubCheck.code })

  const store = await readStore()
  const user = store.users.find((u) => u.id === sessionUser.id) || sessionUser

  if (req.method === 'GET') {
    const forms = enrichMarketingRows(
      store,
      user,
      filterMarketingRows(store.marketingForms, user).sort(
        (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
      )
    ).map((f) => ({ ...f, publicUrl: publicFormUrl(f.slug) }))
    return sendJson(res, 200, { forms })
  }

  if (req.method === 'POST') {
    const body = getBody(req)
    const { name, title, description, submitLabel, fields, theme } = body
    if (!String(name || '').trim()) {
      return sendJson(res, 400, { error: 'Form name is required' })
    }
    const now = new Date().toISOString()
    const slug = slugify(name)
    const form = {
      id: createId('mform'),
      ...marketingScopeKey(user),
      name: String(name).trim().slice(0, 120),
      slug,
      title: String(title || name).trim().slice(0, 120),
      description: String(description || '').trim().slice(0, 400),
      submitLabel: String(submitLabel || 'Submit').trim().slice(0, 40),
      fields: normalizeFields(fields),
      theme: normalizeFormTheme(theme),
      submissions: 0,
      status: 'draft',
      pipelineStage: 'new',
      assignMode: 'round_robin',
      thankYouMessage: 'Thank you! We will be in touch.',
      createdByUserId: user.id,
      createdAt: now,
      updatedAt: now,
    }
    await updateStore((draft) => {
      draft.marketingForms = draft.marketingForms || []
      draft.marketingForms.push(form)
      return draft
    })
    return sendJson(res, 201, { form: { ...form, publicUrl: publicFormUrl(slug) } })
  }

  if (req.method === 'PATCH') {
    const body = getBody(req)
    const { id, name, title, description, submitLabel, fields, theme, status, pipelineStage, assignMode, thankYouMessage, redirectUrl } = body
    const existing = (store.marketingForms || []).find((f) => f.id === id)
    if (!existing || !canAccessMarketingAsset(existing, user)) {
      return sendJson(res, 404, { error: 'Form not found' })
    }
    const now = new Date().toISOString()
    await updateStore((draft) => {
      const row = draft.marketingForms.find((f) => f.id === id)
      if (!row) return draft
      if (name !== undefined) row.name = String(name).trim().slice(0, 120)
      if (title !== undefined) row.title = String(title).trim().slice(0, 120)
      if (description !== undefined) row.description = String(description || '').trim().slice(0, 400)
      if (submitLabel !== undefined) row.submitLabel = String(submitLabel || 'Submit').trim().slice(0, 40)
      if (fields !== undefined) row.fields = normalizeFields(fields)
      if (theme !== undefined) row.theme = normalizeFormTheme(theme)
      if (status !== undefined) row.status = ['draft', 'live', 'paused'].includes(status) ? status : row.status
      if (pipelineStage !== undefined) row.pipelineStage = pipelineStage
      if (assignMode !== undefined) row.assignMode = assignMode
      if (thankYouMessage !== undefined) row.thankYouMessage = thankYouMessage
      if (redirectUrl !== undefined) row.redirectUrl = redirectUrl
      row.updatedAt = now
      return draft
    })
    const updated = (await readStore()).marketingForms.find((f) => f.id === id)
    return sendJson(res, 200, { form: { ...updated, publicUrl: publicFormUrl(updated.slug) } })
  }

  if (req.method === 'DELETE') {
    const id = getBody(req).id || req.query?.id
    const existing = (store.marketingForms || []).find((f) => f.id === id)
    if (!existing || !canAccessMarketingAsset(existing, user)) {
      return sendJson(res, 404, { error: 'Form not found' })
    }
    await updateStore((draft) => {
      draft.marketingForms = (draft.marketingForms || []).filter((f) => f.id !== id)
      return draft
    })
    return sendJson(res, 200, { ok: true })
  }

  return methodNotAllowed(res, ['GET', 'POST', 'PATCH', 'DELETE'])
}
