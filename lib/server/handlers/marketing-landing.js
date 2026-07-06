import { readStore, updateStorePartial } from '../store.js'
import { applyCors, handleOptions, sendJson } from '../http.js'
import {
  getMarketingLandingPageBySlug,
  renderLandingPageHtml,
} from '../marketingLandingPages.js'
import { buildSitePixelSnippet } from '../marketingSiteTracking.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const slug = String(req.query?.slug || req.query?.path || '').trim().toLowerCase()
  if (!slug) return sendJson(res, 400, { error: 'slug required' })

  const store = await readStore({ only: ['marketingLandingPages', 'marketingForms'] })
  const page = getMarketingLandingPageBySlug(store, slug)
  if (!page) return sendJson(res, 404, { error: 'Page not found' })

  if (req.method === 'GET') {
    const base = process.env.APP_URL || 'https://connectintel.net'
    const formEmbedUrl = page.formId ? `${base}/api/marketing/form?slug=${page.formId}` : null
    const trackingSnippet = page.organizationId ? buildSitePixelSnippet(page.organizationId) : ''
    const html = renderLandingPageHtml(page, { formEmbedUrl, trackingSnippet })

    await updateStorePartial(['marketingLandingPages'], (draft) => {
      const row = (draft.marketingLandingPages || []).find((p) => p.id === page.id)
      if (row) row.views = (row.views || 0) + 1
      return draft
    })

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.statusCode = 200
    res.end(html)
    return
  }

  return sendJson(res, 405, { error: 'Method not allowed' })
}
