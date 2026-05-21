import { applyCors, handleOptions, sendJson } from '../lib/server/http.js'

const ROUTES = {
  health: () => import('../lib/server/handlers/health.js'),
  'integrations/status': () => import('../lib/server/handlers/integrations-status.js'),
  'search-leads': () => import('../lib/server/handlers/search-leads.js'),
  'saved-leads': () => import('../lib/server/handlers/saved-leads.js'),
  'search-history': () => import('../lib/server/handlers/search-history.js'),
  'lead-unlocks': () => import('../lib/server/handlers/lead-unlocks.js'),
  'admin/imports': () => import('../lib/server/handlers/admin-imports.js'),
  'admin/research-leads': () => import('../lib/server/handlers/admin-research-leads.js'),
  'crm-generate-email': () => import('../lib/server/handlers/crm-generate-email.js'),
  'crm-send-email': () => import('../lib/server/handlers/crm-send-email.js'),
  'onboarding/complete': () => import('../lib/server/handlers/onboarding-complete.js'),
  'team/members': () => import('../lib/server/handlers/team-members.js'),
  'team/invite': () => import('../lib/server/handlers/team-invite.js'),
  'team/branding': () => import('../lib/server/handlers/team-branding.js'),
  'team/permissions': () => import('../lib/server/handlers/team-permissions.js'),
  'org/imports': () => import('../lib/server/handlers/org-imports.js'),
  'invite/preview': () => import('../lib/server/handlers/invite-preview.js'),
  'invite/accept': () => import('../lib/server/handlers/invite-accept.js'),
  'auth/session': () => import('../lib/server/handlers/auth-session.js'),
}

function resolvePath(req) {
  const fromQuery = req.query.path
  if (typeof fromQuery === 'string' && fromQuery) return fromQuery
  if (Array.isArray(fromQuery) && fromQuery.length) return fromQuery.join('/')

  const rawUrl = req.url || ''
  const pathname = rawUrl.split('?')[0]
  return pathname.replace(/^\/api\/?/, '').replace(/\/$/, '')
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const pathKey = resolvePath(req)
  const load = ROUTES[pathKey]

  if (!load) {
    return sendJson(res, 404, { error: `Unknown API route: ${pathKey || '(empty)'}` })
  }

  const mod = await load()
  return mod.default(req, res)
}
