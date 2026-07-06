#!/usr/bin/env node
/**
 * List mutation handlers missing assertOrgPermission / marketing access helpers.
 *
 *   npm run rbac:audit
 *   npm run rbac:audit -- --strict   # exit 1 if any gaps
 */

import { readdir, readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const HANDLERS = join(ROOT, 'lib/server/handlers')
const strict = process.argv.includes('--strict')

const MUTATION_RE = /\b(req\.method\s*===\s*['"](?:POST|PATCH|PUT|DELETE)['"]|methodNotAllowed\([^)]*POST)/
const PERM_RE =
  /assertOrgPermission|loadMetaUserAndAssertEditLeads|requireMarketingHubAccess|requireMarketingSendAccess|assertEditLeadsForPipelinePatch|requireOrgAdmin|requireAdmin|requireTeamWorkspace|consumeSearchQuota|userCanAccessContact|\bauthorize\(/
const SELF_SERVICE_OK = new Set([
  'assistant-chat.js',
  'crm-calendar-google.js',
  'crm-email-oauth-start.js',
  'crm-saved-views.js',
  'crm-workspace-pulse.js',
  'dashboard-layout.js',
  'lead-unlocks.js',
  'onboarding-complete.js',
  'search-history.js',
  'support-tickets.js',
  'user-profile.js',
])
const PUBLIC_OK = new Set([
  'auth-session.js',
  'health.js',
  'invite-accept.js',
  'invite-preview.js',
  'marketing-open.js',
  'marketing-click.js',
  'marketing-form.js',
  'marketing-unsubscribe.js',
  'marketing-webhooks.js',
  'resend-webhook.js',
  'crm-email-inbound-webhook.js',
  'whatsapp-cloud-webhook.js',
  'google-risc.js',
  'public-config.js',
  'crm-reminders-cron.js',
  'crm-dashboard-warm-cron.js',
  'crm-meili-sync-cron.js',
  'marketing-cron.js',
  'grafana-metrics-cron.js',
  'marketing-site-hit.js',
  'workers-cron.js',
  'marketing-queue-worker.js',
  'supabase-diag.js',
  'client-error.js',
])

const files = (await readdir(HANDLERS)).filter((f) => f.endsWith('.js')).sort()
const gaps = []

for (const file of files) {
  if (PUBLIC_OK.has(file) || SELF_SERVICE_OK.has(file)) continue
  const src = await readFile(join(HANDLERS, file), 'utf8')
  if (!MUTATION_RE.test(src)) continue
  if (!PERM_RE.test(src)) gaps.push(file)
}

console.log(`RBAC handler audit — ${files.length} handlers, ${gaps.length} mutation gap(s)\n`)

if (!gaps.length) {
  console.log('OK — all mutation handlers reference a permission or admin gate.')
} else {
  for (const g of gaps) console.log(`  • ${g}`)
  console.log('\nWire assertOrgPermission, requireMarketingHubAccess, or requireOrgAdmin before mutations.')
}

if (strict && gaps.length) process.exit(1)
