import { applyCors, handleOptions, sendJson } from '../lib/server/http.js'

/** Marketing/bulk sends may process several Gmail API calls per request. */
export const config = {
  maxDuration: 120,
}

const ROUTES = {
  health: () => import('../lib/server/handlers/health.js'),
  'integrations/status': () => import('../lib/server/handlers/integrations-status.js'),
  'search-leads': () => import('../lib/server/handlers/search-leads.js'),
  'saved-leads': () => import('../lib/server/handlers/saved-leads.js'),
  'search-history': () => import('../lib/server/handlers/search-history.js'),
  'lead-unlocks': () => import('../lib/server/handlers/lead-unlocks.js'),
  'admin/imports': () => import('../lib/server/handlers/admin-imports.js'),
  'admin/research-leads': () => import('../lib/server/handlers/admin-research-leads.js'),
  'admin/support-overview': () => import('../lib/server/handlers/admin-support-overview.js'),
  'admin/support-tickets': () => import('../lib/server/handlers/admin-support-tickets.js'),
  'admin/customers': () => import('../lib/server/handlers/admin-customers.js'),
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
  'crm/sync-email-thread': () => import('../lib/server/handlers/crm-sync-email-thread.js'),
  'crm/log-email-reply': () => import('../lib/server/handlers/crm-log-email-reply.js'),
  'crm/notifications': () => import('../lib/server/handlers/crm-notifications.js'),
  'crm/generate-whatsapp': () => import('../lib/server/handlers/crm-generate-whatsapp.js'),
  'crm/calendar': () => import('../lib/server/handlers/crm-calendar.js'),
  'crm/calendar/google': () => import('../lib/server/handlers/crm-calendar-google.js'),
  'crm/activity-log': () => import('../lib/server/handlers/crm-activity-log.js'),
  'crm/team-dashboard': () => import('../lib/server/handlers/crm-team-dashboard.js'),
  'crm/saved-views': () => import('../lib/server/handlers/crm-saved-views.js'),
  'crm/sequences': () => import('../lib/server/handlers/crm-sequences.js'),
  'crm/settings': () => import('../lib/server/handlers/crm-settings.js'),
  'crm/reminders-ack': () => import('../lib/server/handlers/crm-reminders-ack.js'),
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
  'team/mention-leads': () => import('../lib/server/handlers/team-mention-leads.js'),
  'org/imports': () => import('../lib/server/handlers/org-imports.js'),
  'org/lead-tags': () => import('../lib/server/handlers/org-lead-tags.js'),
  'org/active-trading': () => import('../lib/server/handlers/org-active-trading.js'),
  'invite/preview': () => import('../lib/server/handlers/invite-preview.js'),
  'invite/accept': () => import('../lib/server/handlers/invite-accept.js'),
  'auth/session': () => import('../lib/server/handlers/auth-session.js'),
  'marketing/lists': () => import('../lib/server/handlers/marketing-lists.js'),
  'marketing/templates': () => import('../lib/server/handlers/marketing-templates.js'),
  'marketing/campaigns': () => import('../lib/server/handlers/marketing-campaigns.js'),
  'marketing/unsubscribe': () => import('../lib/server/handlers/marketing-unsubscribe.js'),
  'marketing/cron': () => import('../lib/server/handlers/marketing-cron.js'),
  'marketing/open': () => import('../lib/server/handlers/marketing-open.js'),
  'marketing/click': () => import('../lib/server/handlers/marketing-click.js'),
  'marketing/forms': () => import('../lib/server/handlers/marketing-forms.js'),
  'marketing/form': () => import('../lib/server/handlers/marketing-form.js'),
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

  const pathKey = resolvePath(req)

  try {
    const load = ROUTES[pathKey]

    if (!load) {
      return sendJson(res, 404, { error: `Unknown API route: ${pathKey || '(empty)'}` })
    }

    const mod = await load()
    return await mod.default(req, res)
  } catch (error) {
    console.error(`API ${pathKey || '(empty)'} failed:`, error)
    return sendJson(res, 500, {
      error: error?.message || 'Server error',
      route: pathKey || null,
    })
  }
}
