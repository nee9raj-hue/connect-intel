import { requireUser } from '../auth.js'
import { readStore, updateStore, createId } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import {
  canAccessMarketingAsset,
  enrichMarketingRows,
  filterMarketingRows,
  marketingScopeKey,
  requireMarketingUser,
} from '../marketingAccess.js'
import { compileTemplateContent } from '../marketingEmailDesign.js'

function buildTemplatePayload(body, user) {
  const { name, subject, body: textBody, blocks, design, previewText } = body
  if (!String(name || '').trim()) return { error: 'Template name is required' }
  if (!String(subject || '').trim()) return { error: 'Subject is required' }

  const compiled = compileTemplateContent({
    blocks,
    design,
    body: textBody,
    previewText,
  })

  if (!compiled.body && !compiled.blocks.length) {
    return { error: 'Add at least one content block or message body' }
  }

  const now = new Date().toISOString()
  return {
    template: {
      id: createId('mtpl'),
      ...marketingScopeKey(user),
      name: String(name).trim().slice(0, 120),
      subject: String(subject).trim().slice(0, 500),
      body: compiled.body.slice(0, 12000),
      blocks: compiled.blocks,
      design: compiled.design,
      htmlBody: compiled.htmlBody ? compiled.htmlBody.slice(0, 50000) : null,
      previewText: compiled.previewText,
      designVersion: compiled.designVersion,
      createdByUserId: user.id,
      createdAt: now,
      updatedAt: now,
    },
  }
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const check = requireMarketingUser(sessionUser)
  if (!check.ok) return sendJson(res, 401, { error: check.error })

  const store = await readStore()
  const user = store.users.find((u) => u.id === sessionUser.id) || sessionUser

  if (req.method === 'GET') {
    const templates = enrichMarketingRows(
      store,
      user,
      filterMarketingRows(store.marketingTemplates, user).sort(
        (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
      )
    )
    return sendJson(res, 200, { templates })
  }

  if (req.method === 'POST') {
    const payload = buildTemplatePayload(getBody(req), user)
    if (payload.error) return sendJson(res, 400, { error: payload.error })
    await updateStore((draft) => {
      draft.marketingTemplates = draft.marketingTemplates || []
      draft.marketingTemplates.push(payload.template)
      return draft
    })
    return sendJson(res, 201, { template: payload.template })
  }

  if (req.method === 'PATCH') {
    const body = getBody(req)
    const { id, name, subject, previewText } = body
    const existing = (store.marketingTemplates || []).find((t) => t.id === id)
    if (!existing || !canAccessMarketingAsset(existing, user)) {
      return sendJson(res, 404, { error: 'Template not found' })
    }

    const compiled = compileTemplateContent({
      blocks: body.blocks !== undefined ? body.blocks : existing.blocks,
      design: body.design !== undefined ? body.design : existing.design,
      body: body.body !== undefined ? body.body : existing.body,
      previewText: previewText !== undefined ? previewText : existing.previewText,
    })

    if (!compiled.body && !compiled.blocks.length) {
      return sendJson(res, 400, { error: 'Template must have content' })
    }

    await updateStore((draft) => {
      const row = draft.marketingTemplates.find((t) => t.id === id)
      if (!row) return draft
      if (name !== undefined) row.name = String(name).trim().slice(0, 120)
      if (subject !== undefined) row.subject = String(subject).trim().slice(0, 500)
      row.body = compiled.body.slice(0, 12000)
      row.blocks = compiled.blocks
      row.design = compiled.design
      row.htmlBody = compiled.htmlBody ? compiled.htmlBody.slice(0, 50000) : null
      row.previewText = compiled.previewText
      row.designVersion = compiled.designVersion
      row.updatedAt = new Date().toISOString()
      return draft
    })
    const updated = (await readStore()).marketingTemplates.find((t) => t.id === id)
    return sendJson(res, 200, { template: updated })
  }

  if (req.method === 'DELETE') {
    const id = getBody(req).id
    const existing = (store.marketingTemplates || []).find((t) => t.id === id)
    if (!existing || !canAccessMarketingAsset(existing, user)) {
      return sendJson(res, 404, { error: 'Template not found' })
    }
    await updateStore((draft) => {
      draft.marketingTemplates = (draft.marketingTemplates || []).filter((t) => t.id !== id)
      return draft
    })
    return sendJson(res, 200, { ok: true })
  }

  return methodNotAllowed(res, ['GET', 'POST', 'PATCH', 'DELETE'])
}
