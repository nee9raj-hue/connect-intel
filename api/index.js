import { applyCors, handleOptions, sendJson } from '../lib/server/http.js'
import { captureException } from '../lib/server/infra/sentry.js'
import { observeHistogram } from '../lib/server/infra/metrics.js'
import {
  isMarketingSqlQueueEnabled,
  isPipelineHierarchyRbacEnabled,
  isPipelineLeadsTableEnabled,
} from '../lib/server/infra/config.js'

let prodSqlFlagsWarned = false

function warnProductionSqlFlags() {
  if (prodSqlFlagsWarned) return
  if (process.env.VERCEL_ENV !== 'production') return

  const disabled = []
  if (!isPipelineLeadsTableEnabled()) disabled.push('USE_PIPELINE_LEADS_TABLE')
  if (!isPipelineHierarchyRbacEnabled()) disabled.push('USE_PIPELINE_HIERARCHY_RBAC')
  if (!isMarketingSqlQueueEnabled()) disabled.push('USE_MARKETING_SQL_QUEUE')

  if (disabled.length) {
    console.warn(
      '[Connect Intel] Production SQL flags disabled — pipeline/marketing may load JSON shards:',
      disabled.join(', ')
    )
  }
  prodSqlFlagsWarned = true
}

/** Marketing/bulk sends may process several Gmail API calls per request. */
export const config = {
  maxDuration: 300,
}

const ROUTES = {
  health: () => import('../lib/server/handlers/health.js'),
  metrics: () => import('../lib/server/handlers/metrics.js'),
  'infra/capacity': () => import('../lib/server/handlers/infra-capacity.js'),
  'infra/queue': () => import('../lib/server/handlers/infra-queue.js'),
  'infra/bootstrap': () => import('../lib/server/handlers/infra-bootstrap.js'),
  'client-error': () => import('../lib/server/handlers/client-error.js'),
  'workers/cron': () => import('../lib/server/handlers/workers-cron.js'),
  'campaign-send/status': () => import('../lib/server/handlers/campaign-send-status.js'),
  'supabase-diag': () => import('../lib/server/handlers/supabase-diag.js'),
  'google/risc': () => import('../lib/server/handlers/google-risc.js'),
  'integrations/status': () => import('../lib/server/handlers/integrations-status.js'),
  'search-leads': () => import('../lib/server/handlers/search-leads.js'),
  'saved-leads': () => import('../lib/server/handlers/saved-leads.js'),
  'pipeline/leads': () => import('../lib/server/handlers/saved-leads.js'),
  'pipeline/leads/bulk-update': () => import('../lib/server/handlers/crm-bulk-update.js'),
  'pipeline/leads/bulk-delete': () => import('../lib/server/handlers/crm-bulk-delete.js'),
  'pipeline/leads/quick-summary': () => import('../lib/server/handlers/pipeline-lead-quick-summary.js'),
  'pipeline/bootstrap': () => import('../lib/server/handlers/pipeline-bootstrap.js'),
  'search-history': () => import('../lib/server/handlers/search-history.js'),
  'lead-unlocks': () => import('../lib/server/handlers/lead-unlocks.js'),
  'admin/imports': () => import('../lib/server/handlers/admin-imports.js'),
  'admin/research-leads': () => import('../lib/server/handlers/admin-research-leads.js'),
  'admin/support-overview': () => import('../lib/server/handlers/admin-support-overview.js'),
  'admin/support-tickets': () => import('../lib/server/handlers/admin-support-tickets.js'),
  'admin/customers': () => import('../lib/server/handlers/admin-customers.js'),
  'admin/tenant-audit': () => import('../lib/server/handlers/admin-tenant-audit.js'),
  'admin/whatsapp-cloud': () => import('../lib/server/handlers/admin-whatsapp-cloud.js'),
  'crm-generate-email': () => import('../lib/server/handlers/crm-generate-email.js'),
  'crm-send-email': () => import('../lib/server/handlers/crm-send-email.js'),
  'crm/email-oauth/start': () => import('../lib/server/handlers/crm-email-oauth-start.js'),
  'crm/email-gmail-status': () => import('../lib/server/handlers/crm-email-gmail-status.js'),
  'org/email-domain': () => import('../lib/server/handlers/org-email-domain.js'),
  'org/whatsapp-cloud': () => import('../lib/server/handlers/org-whatsapp-cloud.js'),
  'my/imports': () => import('../lib/server/handlers/my-imports.js'),
  'user/profile': () => import('../lib/server/handlers/user-profile.js'),
  'crm/bulk-email': () => import('../lib/server/handlers/crm-bulk-email.js'),
  'crm/bulk-whatsapp': () => import('../lib/server/handlers/crm-bulk-whatsapp.js'),
  'crm/whatsapp-inbox': () => import('../lib/server/handlers/crm-whatsapp-inbox.js'),
  'whatsapp/webhook': () => import('../lib/server/handlers/whatsapp-cloud-webhook.js'),
  'crm/bulk-update': () => import('../lib/server/handlers/crm-bulk-update.js'),
  'crm/bulk-delete': () => import('../lib/server/handlers/crm-bulk-delete.js'),
  'crm/sync-email-thread': () => import('../lib/server/handlers/crm-sync-email-thread.js'),
  'crm/email-inbound': () => import('../lib/server/handlers/crm-email-inbound-webhook.js'),
  'crm/log-email-reply': () => import('../lib/server/handlers/crm-log-email-reply.js'),
  'crm/notifications': () => import('../lib/server/handlers/crm-notifications.js'),
  'crm/generate-whatsapp': () => import('../lib/server/handlers/crm-generate-whatsapp.js'),
  'crm/calendar': () => import('../lib/server/handlers/crm-calendar.js'),
  'crm/calendar/google': () => import('../lib/server/handlers/crm-calendar-google.js'),
  'crm/activity-log': () => import('../lib/server/handlers/crm-activity-log.js'),
  'crm/team-dashboard': () => import('../lib/server/handlers/crm-team-dashboard.js'),
  'crm/dashboard-kpi': () => import('../lib/server/handlers/crm-dashboard-kpi.js'),
  'crm/team-metrics': () => import('../lib/server/handlers/crm-team-metrics.js'),
  'crm/rep-summary': () => import('../lib/server/handlers/crm-rep-summary.js'),
  'crm/rep-review': () => import('../lib/server/handlers/crm-rep-review.js'),
  'crm/activity-timeline': () => import('../lib/server/handlers/crm-activity-timeline.js'),
  'crm/my-day': () => import('../lib/server/handlers/crm-my-day.js'),
  'dashboard/bootstrap': () => import('../lib/server/handlers/dashboard-bootstrap.js'),
  'crm/workspace-pulse': () => import('../lib/server/handlers/crm-workspace-pulse.js'),
  'crm/saved-views': () => import('../lib/server/handlers/crm-saved-views.js'),
  'crm/sequences': () => import('../lib/server/handlers/crm-sequences.js'),
  'crm/settings': () => import('../lib/server/handlers/crm-settings.js'),
  'crm/lead-timeline': () => import('../lib/server/handlers/crm-lead-timeline.js'),
  'companies/hub': () => import('../lib/server/handlers/companies-hub.js'),
  'crm/field-expenses': () => import('../lib/server/handlers/crm-field-expenses.js'),
  'crm/field-visit/distance': () => import('../lib/server/handlers/crm-field-visit-distance.js'),
  'crm/pincode-lookup': () => import('../lib/server/handlers/crm-pincode-lookup.js'),
  'crm/reminders-ack': () => import('../lib/server/handlers/crm-reminders-ack.js'),
  'crm/reminders-cron': () => import('../lib/server/handlers/crm-reminders-cron.js'),
  'onboarding/complete': () => import('../lib/server/handlers/onboarding-complete.js'),
  'team/members': () => import('../lib/server/handlers/team-members.js'),
  'team/invite': () => import('../lib/server/handlers/team-invite.js'),
  'team/invite-email': () => import('../lib/server/handlers/team-invite-email.js'),
  'team/email-oauth/start': () => import('../lib/server/handlers/team-email-oauth-start.js'),
  'team/email-oauth/callback': () => import('../lib/server/handlers/team-email-oauth-callback.js'),
  'setup/resend-dns': () => import('../lib/server/handlers/resend-dns-setup.js'),
  'team/branding': () => import('../lib/server/handlers/team-branding.js'),
  'team/permissions': () => import('../lib/server/handlers/team-permissions.js'),
  'team/notes': () => import('../lib/server/handlers/team-notes.js'),
  'team/tasks': () => import('../lib/server/handlers/team-tasks.js'),
  'team/hub': () => import('../lib/server/handlers/team-hub.js'),
  chithi: () => import('../lib/server/handlers/chithi.js'),
  'team/mention-leads': () => import('../lib/server/handlers/team-mention-leads.js'),
  'org/imports': () => import('../lib/server/handlers/org-imports.js'),
  'org/import-status': () => import('../lib/server/handlers/org-import-status.js'),
  'org/departments': () => import('../lib/server/handlers/org-departments.js'),
  'org/teams': () => import('../lib/server/handlers/org-teams.js'),
  'org/permissions': () => import('../lib/server/handlers/org-permissions.js'),
  'org/member-hierarchy': () => import('../lib/server/handlers/org-member-hierarchy.js'),
  'org/lead-tags': () => import('../lib/server/handlers/org-lead-tags.js'),
  'org/active-trading': () => import('../lib/server/handlers/org-active-trading.js'),
  'org/workspace': () => import('../lib/server/handlers/org-workspace.js'),
  'org/company-workspace': () => import('../lib/server/handlers/org-company-workspace.js'),
  'invite/preview': () => import('../lib/server/handlers/invite-preview.js'),
  'invite/accept': () => import('../lib/server/handlers/invite-accept.js'),
  'auth/session': () => import('../lib/server/handlers/auth-session.js'),
  'marketing/lists': () => import('../lib/server/handlers/marketing-lists.js'),
  'marketing/audiences': () => import('../lib/server/handlers/marketing-audiences.js'),
  'marketing/audiences-preview': () => import('../lib/server/handlers/marketing-audiences-preview.js'),
  'marketing/templates': () => import('../lib/server/handlers/marketing-templates.js'),
  'marketing/campaigns': () => import('../lib/server/handlers/marketing-campaigns.js'),
  'marketing/unsubscribe': () => import('../lib/server/handlers/marketing-unsubscribe.js'),
  'marketing/cron': () => import('../lib/server/handlers/marketing-cron.js'),
  'marketing/queue-worker': () => import('../lib/server/handlers/marketing-queue-worker.js'),
  'v1/webhooks/marketing': () => import('../lib/server/handlers/marketing-webhooks.js'),
  'marketing/open': () => import('../lib/server/handlers/marketing-open.js'),
  'marketing/click': () => import('../lib/server/handlers/marketing-click.js'),
  'marketing/forms': () => import('../lib/server/handlers/marketing-forms.js'),
  'marketing/form': () => import('../lib/server/handlers/marketing-form.js'),
  'marketing/dashboard': () => import('../lib/server/handlers/marketing-dashboard.js'),
  'marketing/overview': () => import('../lib/server/handlers/marketing-overview.js'),
  'marketing/analytics': () => import('../lib/server/handlers/marketing-analytics.js'),
  'marketing/domains': () => import('../lib/server/handlers/marketing-domains.js'),
  'marketing/bulk-sends': () => import('../lib/server/handlers/marketing-bulk-sends.js'),
  'marketing/segments': () => import('../lib/server/handlers/marketing-segments.js'),
  'marketing/suppressions': () => import('../lib/server/handlers/marketing-suppressions.js'),
  'marketing/automations': () => import('../lib/server/handlers/marketing-automations.js'),
  'marketing/landing-pages': () => import('../lib/server/handlers/marketing-landing-pages.js'),
  'marketing/landing': () => import('../lib/server/handlers/marketing-landing.js'),
  'marketing/feeds': () => import('../lib/server/handlers/marketing-feeds.js'),
  'webhooks/resend': () => import('../lib/server/handlers/resend-webhook.js'),
  'platform/search': () => import('../lib/server/handlers/platform-search.js'),
  contacts: () => import('../lib/server/handlers/contacts.js'),
  'contacts/linkedin-search': () => import('../lib/server/handlers/contacts-linkedin-search.js'),
  'public-config': () => import('../lib/server/handlers/public-config.js'),
  'assistant/chat': () => import('../lib/server/handlers/assistant-chat.js'),
  'support/tickets': () => import('../lib/server/handlers/support-tickets.js'),
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
  warnProductionSqlFlags()

  const pathKey = resolvePath(req)
  const started = performance.now()

  try {
    const load = ROUTES[pathKey]

    if (!load) {
      return sendJson(res, 404, { error: `Unknown API route: ${pathKey || '(empty)'}` })
    }

    const mod = await load()
    return await mod.default(req, res)
  } catch (error) {
    console.error(`API ${pathKey || '(empty)'} failed:`, error)
    void captureException(error, { route: pathKey || '(empty)' })
    return sendJson(res, 500, {
      error: error?.message || 'Server error',
      route: pathKey || null,
    })
  } finally {
    observeHistogram(
      'connectintel_api_request_duration_seconds',
      (performance.now() - started) / 1000,
      { route: pathKey || 'unknown' }
    )
  }
}
