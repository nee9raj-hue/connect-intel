import { createId, readStore, updateStore } from './store.js'
import {
  canAccessMarketingAsset,
  filterMarketingRows,
  marketingScopeKey,
} from './marketingAccess.js'
import { compileTemplateContent } from './marketingEmailDesign.js'

export function getMarketingLandingPage(store, user, pageId) {
  const row = (store.marketingLandingPages || []).find((p) => p.id === pageId)
  if (!row || !canAccessMarketingAsset(row, user)) return null
  return row
}

export function getMarketingLandingPageBySlug(store, slug) {
  const s = String(slug || '').trim().toLowerCase()
  return (store.marketingLandingPages || []).find((p) => p.slug === s && p.status === 'published') || null
}

export function listMarketingLandingPages(store, user) {
  return filterMarketingRows(store.marketingLandingPages || [], user).sort(
    (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
  )
}

export async function createMarketingLandingPage(user, payload) {
  const now = new Date().toISOString()
  const slug = String(payload.slug || payload.name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)

  const page = {
    id: createId('mlpg'),
    ...marketingScopeKey(user),
    name: String(payload.name || '').trim().slice(0, 120),
    slug,
    title: String(payload.title || payload.name || '').trim().slice(0, 200),
    description: String(payload.description || '').trim().slice(0, 500) || null,
    blocks: Array.isArray(payload.blocks) ? payload.blocks : [],
    design: payload.design || {},
    formId: payload.formId || null,
    seoTitle: payload.seoTitle || null,
    seoDescription: payload.seoDescription || null,
    status: payload.status === 'published' ? 'published' : 'draft',
    views: 0,
    createdByUserId: user.id,
    createdAt: now,
    updatedAt: now,
  }

  if (!page.name) throw new Error('Page name is required')
  if (!page.slug) throw new Error('Page slug is required')

  const store = await readStore({ only: ['marketingLandingPages'] })
  if ((store.marketingLandingPages || []).some((p) => p.slug === page.slug)) {
    throw new Error('Slug already in use')
  }

  await updateStore((draft) => {
    draft.marketingLandingPages = draft.marketingLandingPages || []
    draft.marketingLandingPages.push(page)
    return draft
  })

  return page
}

export async function updateMarketingLandingPage(user, pageId, patch) {
  const store = await readStore({ only: ['marketingLandingPages'] })
  const existing = getMarketingLandingPage(store, user, pageId)
  if (!existing) throw new Error('Landing page not found')

  const now = new Date().toISOString()
  await updateStore((draft) => {
    const row = (draft.marketingLandingPages || []).find((p) => p.id === pageId)
    if (!row) return draft
    if (patch.name !== undefined) row.name = String(patch.name).trim().slice(0, 120)
    if (patch.title !== undefined) row.title = String(patch.title).trim().slice(0, 200)
    if (patch.description !== undefined) row.description = String(patch.description || '').slice(0, 500) || null
    if (patch.blocks !== undefined) row.blocks = patch.blocks
    if (patch.design !== undefined) row.design = patch.design
    if (patch.formId !== undefined) row.formId = patch.formId || null
    if (patch.seoTitle !== undefined) row.seoTitle = patch.seoTitle
    if (patch.seoDescription !== undefined) row.seoDescription = patch.seoDescription
    if (patch.status !== undefined) row.status = patch.status === 'published' ? 'published' : 'draft'
    row.updatedAt = now
    return draft
  })

  const updatedStore = await readStore({ only: ['marketingLandingPages'] })
  return getMarketingLandingPage(updatedStore, user, pageId)
}

export function renderLandingPageHtml(page, { formEmbedUrl, trackingSnippet = '' } = {}) {
  const compiled = compileTemplateContent({
    subject: page.title,
    body: '',
    blocks: page.blocks || [],
    design: page.design || {},
  })

  const cta = formEmbedUrl
    ? `<p style="text-align:center;margin:24px 0"><a href="${formEmbedUrl}" style="background:#F97316;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Get started</a></p>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${page.seoTitle || page.title || page.name}</title>
  ${page.seoDescription ? `<meta name="description" content="${page.seoDescription}"/>` : ''}
  ${trackingSnippet || ''}
  <style>body{margin:0;font-family:system-ui,sans-serif;background:#f8fafc}</style>
</head>
<body>
  <div style="max-width:720px;margin:0 auto;padding:24px 16px">
    ${compiled.htmlBody || `<h1>${page.title}</h1><p>${page.description || ''}</p>`}
    ${cta}
  </div>
</body>
</html>`
}
