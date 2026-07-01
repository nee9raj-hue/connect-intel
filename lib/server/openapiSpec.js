import { listApiRouteKeys } from './apiRouteRegistry.js'

function routeTag(path) {
  if (path.startsWith('crm/') || path.startsWith('pipeline/') || path === 'saved-leads') return 'CRM'
  if (path.startsWith('marketing/')) return 'Marketing'
  if (path.startsWith('org/') || path.startsWith('team/')) return 'Organization'
  if (path.startsWith('admin/')) return 'Admin'
  if (path.startsWith('dashboard/')) return 'Dashboard'
  if (path.startsWith('infra/') || path === 'workers/cron') return 'Infrastructure'
  if (path.startsWith('auth/') || path.startsWith('invite/')) return 'Auth'
  if (path.startsWith('webhooks/') || path.includes('webhook')) return 'Webhooks'
  return 'Platform'
}

function guessMethods(path) {
  if (path.includes('cron') || path.includes('webhook') || path === 'marketing/open' || path === 'marketing/click') {
    return ['GET', 'POST']
  }
  if (path === 'health' || path === 'metrics' || path === 'openapi' || path === 'public-config') {
    return ['GET']
  }
  if (path === 'workflow/catalog') return ['GET']
  if (path === 'org/audit-log') return ['GET']
  if (path.includes('bootstrap') || path.includes('accept') || path.includes('complete')) {
    return ['GET', 'POST']
  }
  return ['GET', 'POST', 'PATCH', 'DELETE']
}

export function buildOpenApiSpec({ baseUrl = 'https://connectintel.net' } = {}) {
  const paths = {}
  for (const route of listApiRouteKeys()) {
    const path = `/api/${route}`
    const methods = {}
    for (const method of guessMethods(route)) {
      methods[method.toLowerCase()] = {
        summary: route,
        tags: [routeTag(route)],
        responses: {
          200: { description: 'OK' },
          401: { description: 'Unauthorized' },
          403: { description: 'Forbidden' },
        },
      }
    }
    paths[path] = methods
  }

  return {
    openapi: '3.0.3',
    info: {
      title: 'Connect Intel API',
      version: '2026-06',
      description: 'Machine-readable route inventory. Handlers are Vercel serverless functions.',
    },
    servers: [{ url: baseUrl }],
    paths,
    'x-route-count': listApiRouteKeys().length,
  }
}
