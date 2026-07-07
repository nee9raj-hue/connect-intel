/**
 * Product help knowledge for Connect Intel AI (constitution-aligned).
 * Customer-facing only — no internal provider names.
 */

/** Keep in sync with frontend/src/lib/crmProductFlags.js */
const AI_PROSPECTING_IN_CRM_ENABLED = false

export const ASSISTANT_QUICK_PROMPTS = [
  'CRM vs Marketing email?',
  'How do I connect work Gmail?',
  'Bulk email from Pipeline',
  'Create a marketing campaign',
  'Signup forms → Pipeline',
  'Invite a teammate',
]

export const ASSISTANT_NAV_PANELS = new Set([
  'overview',
  ...(AI_PROSPECTING_IN_CRM_ENABLED ? ['search', 'saved'] : []),
  'pipeline',
  'contacts',
  'companies',
  'crm-dashboard',
  'crm-log',
  'crm-calendar',
  'crm-sequences',
  'crm-automation',
  'marketing',
  'team',
  'my-email',
  'integrations',
  'chithi',
  'admin',
  'admin-customers',
  'app-settings',
])

/** @type {{ id: string, tags: string[], title: string, body: string, navigate?: object }[]} */
export const ASSISTANT_FAQ = [
  {
    id: 'constitution-email-split',
    tags: [
      'crm',
      'marketing',
      'bulk',
      'email',
      'difference',
      'constitution',
      'broadcast',
      'pipeline',
      'campaign',
    ],
    title: 'CRM vs Marketing email',
    body:
      '**Pipeline bulk email** is for sales: select leads in Pipeline → compose → sends via work Gmail with full thread on each lead (up to 200 leads per request, processed in chunks). **Marketing campaigns** are for broadcasts to lists/segments with templates, opens/clicks, and consent preview — not the same path. There is no separate Marketing bulk-email tab; use Pipeline for rep-driven bulk.',
    navigate: { panel: 'pipeline', tab: 'list' },
  },
  {
    id: 'gmail-connect',
    tags: ['gmail', 'email', 'oauth', 'connect', 'work email', 'send'],
    title: 'Connect work Gmail',
    body:
      'Work Gmail powers CRM send/receive. Open **Work email** in the sidebar or a lead → **Email** tab → Connect. Google sign-up uses basic profile only; Gmail scopes are requested at connect time. Required before Pipeline bulk or 1:1 CRM email.',
    navigate: { panel: 'my-email' },
  },
  {
    id: 'bulk-email',
    tags: ['bulk', 'email', 'selected', 'pipeline', 'list', '200', 'crm'],
    title: 'Bulk email from Pipeline',
    body:
      'Pipeline → **List** view → filter → select leads → **Email selected**. Up to **200** leads per send (server processes **50** per chunk; AI-personalized drafts use smaller chunks). Connect work Gmail first. Goal → generate (optional AI per lead) → send. Logged on each lead timeline as CRM email.',
    navigate: { panel: 'pipeline', tab: 'list' },
  },
  {
    id: 'email-consent',
    tags: ['consent', 'opt in', 'commercial', 'unsubscribe', 'suppression', 'gdpr'],
    title: 'Commercial email consent',
    body:
      'Outbound commercial email requires recorded opt-in on the lead (commercialEmailOptIn). Marketing sends skip leads without consent or on the suppression list. Signup forms include a consent checkbox; submissions only grant opt-in when checked. Record consent manually on the lead before cold outreach.',
    navigate: { panel: 'pipeline' },
  },
  {
    id: 'pipeline-filters',
    tags: ['filter', 'search', 'city', 'state', 'phone', 'pipeline'],
    title: 'Search and filter Pipeline',
    body:
      'Use the search box for name, email, or phone. **Filters** expand city, state, stage, owner, and contact filters. Kanban, list, and deals views share the same lead pool. Press **/** on Pipeline to focus search.',
    navigate: { panel: 'pipeline' },
  },
  {
    id: 'lead-workspace',
    tags: ['lead', 'workspace', 'record', 'timeline', 'deal', 'task', 'note'],
    title: 'Lead workspace',
    body:
      'Click any lead to open the workspace: Overview, Email, WhatsApp, Deals, Tasks, and unified **timeline** (activities, emails, marketing events, form submissions). No full page reload — use the shell back control or sidebar.',
    navigate: { panel: 'pipeline' },
  },
  {
    id: 'import-csv',
    tags: ['import', 'csv', 'excel', 'upload', 'pipeline'],
    title: 'Import CSV',
    body:
      'Pipeline → **Import CSV**. Use the template for column names. Admins can assign imported rows to teammates. Duplicates by email merge when the same person exists.',
    navigate: { panel: 'pipeline' },
  },
  {
    id: 'add-lead',
    tags: ['add', 'manual', 'lead', 'contact'],
    title: 'Add a lead manually',
    body: 'Pipeline → **+ Add lead**. Fill name, company, email, phone, stage, and consent when applicable. Admins can assign on save.',
    navigate: { panel: 'pipeline' },
  },
  {
    id: 'whatsapp',
    tags: ['whatsapp', 'message', 'mobile'],
    title: 'WhatsApp outreach',
    body:
      'Open a lead → **WhatsApp** tab. Generate a draft, then **Open in WhatsApp** on your phone. Add mobile in profile if prompted.',
    navigate: { panel: 'pipeline' },
  },
  {
    id: 'calendar-reminders',
    tags: ['calendar', 'meeting', 'reminder', 'notification', 'follow'],
    title: 'Calendar and reminders',
    body:
      '**Calendar** shows meetings and tasks across leads. Browser notifications fire ~30 minutes before a meeting if allowed and the tab is open.',
    navigate: { panel: 'crm-calendar' },
  },
  {
    id: 'crm-sequences',
    tags: ['sequence', 'drip', 'automation', 'crm'],
    title: 'CRM sequences',
    body:
      '**Automation → Sequences** for sales drip emails from Pipeline context. Completing a sequence can trigger Marketing automations when configured.',
    navigate: { panel: 'crm-sequences' },
  },
  {
    id: 'marketing-campaigns',
    tags: ['marketing', 'campaign', 'broadcast', 'audience', 'list', 'segment'],
    title: 'Marketing campaigns',
    body:
      'Marketing → **Campaigns** → checklist: audience (list/segment + consent preview) → from → subject → content → send. Large sends (>10) queue in background. Reports show opens/clicks.',
    navigate: { panel: 'marketing', tab: 'campaigns' },
  },
  {
    id: 'marketing-audiences',
    tags: ['audience', 'list', 'segment', 'contacts', 'marketing'],
    title: 'Audiences (lists & segments)',
    body:
      'Marketing → **Audience**: **Contacts** lists (static lead sets), **Segments** (dynamic rules), **Tags**, and **Inbox** for marketing replies. Lists feed campaigns; max ~2000 per list.',
    navigate: { panel: 'marketing', tab: 'audiences' },
  },
  {
    id: 'marketing-forms',
    tags: ['form', 'signup', 'landing', 'embed', 'pipeline'],
    title: 'Signup forms',
    body:
      'Marketing → **Forms**: build hosted signup pages with email consent, live preview, and Pipeline routing. Publish → share link or iframe embed. Submissions create/update leads with a **form_response** timeline event — not a marketing broadcast.',
    navigate: { panel: 'marketing', tab: 'forms' },
  },
  {
    id: 'marketing-templates',
    tags: ['template', 'email design', 'blocks', 'marketing'],
    title: 'Email templates',
    body:
      'Marketing → **Email templates** for reusable designs (blocks: text, image, button, form CTA). Attach templates to campaigns; form blocks link to your hosted forms.',
    navigate: { panel: 'marketing', tab: 'templates' },
  },
  {
    id: 'marketing-automations',
    tags: ['automation', 'journey', 'trigger', 'marketing'],
    title: 'Marketing automations',
    body:
      'Marketing → **Automations** for graph-based journeys (triggers like form submit, sequence completed, tag added). Shares patterns with CRM workflow rules.',
    navigate: { panel: 'marketing', tab: 'automations' },
  },
  {
    id: 'marketing-domains',
    tags: ['domain', 'resend', 'sender', 'dns', 'marketing'],
    title: 'Domains & send infrastructure',
    body:
      'Marketing → **Domains**: verify sending domain (Resend), suppression list, and view send infrastructure mode (SQL queue vs inline for large campaigns).',
    navigate: { panel: 'marketing', tab: 'domains' },
  },
  {
    id: 'marketing-reports',
    tags: ['report', 'open', 'click', 'campaign', 'analytics'],
    title: 'Campaign analytics',
    body:
      'Marketing → **Analytics** and per-campaign reports for sent, delivered, opens, and clicks. Open a recipient to jump to their Pipeline lead when linked.',
    navigate: { panel: 'marketing', tab: 'analytics' },
  },
  {
    id: 'command-palette',
    tags: ['command', 'search', 'keyboard', 'shortcut', 'navigate'],
    title: 'Command palette',
    body:
      'Press **⌘K** (Mac) or **Ctrl+K** (Windows) to search leads, companies, and jump anywhere in the CRM. Fastest way to open a record without clicking through nav.',
  },
  {
    id: 'team-invite',
    tags: ['invite', 'team', 'member', 'admin'],
    title: 'Invite teammates',
    body:
      'Company admins: **Team & email** → invite by work email. Teammates accept the link and join your workspace. Set permissions for pipeline and settings access.',
    navigate: { panel: 'team' },
  },
  {
    id: 'contacts',
    tags: ['contacts', 'master', 'database'],
    title: 'Contacts',
    body:
      '**Contacts** holds shared company records separate from Pipeline stages. Search and open a contact for details or LinkedIn assist.',
    navigate: { panel: 'contacts' },
  },
  {
    id: 'assign-transfer',
    tags: ['assign', 'transfer', 'owner', 'manager'],
    title: 'Assign or transfer leads',
    body:
      'Managers: open a lead → Overview → assign or transfer. List view supports bulk assign where enabled.',
    navigate: { panel: 'pipeline' },
  },
  {
    id: 'chithi',
    tags: ['chithi', 'team', 'notes', 'tasks', 'chat', 'collaboration'],
    title: 'Chithi collaboration',
    body:
      '**Chithi** is team messaging, notes, and tasks — separate from this AI assistant. Use the sidebar Chithi entry for internal collaboration.',
    navigate: { panel: 'chithi' },
  },
  {
    id: 'ai-search',
    tags: ['search', 'prospect', 'ai', 'find', 'leads', 'credits'],
    title: 'AI prospect search',
    body:
      'AI prospect search finds companies and contacts from criteria. Revealing email or phone may use prospect credits. Save fits to pipeline.',
    navigate: { panel: 'search' },
  },
  {
    id: 'credits',
    tags: ['credit', 'balance', 'rupee', 'unlock', 'prospect'],
    title: 'Prospect credits',
    body:
      'Credits pay for revealing emails/phones after free AI search allowances. Check balance in profile. Contact support for top-ups.',
  },
]

const HIDDEN_FAQ_IDS = AI_PROSPECTING_IN_CRM_ENABLED ? [] : ['ai-search', 'credits']

export const ASSISTANT_FAQ_VISIBLE = ASSISTANT_FAQ.filter((e) => !HIDDEN_FAQ_IDS.includes(e.id))

export function scoreFaqMatch(message, entry) {
  const text = String(message || '').toLowerCase()
  if (!text.trim()) return 0
  let score = 0
  for (const tag of entry.tags) {
    if (text.includes(tag.toLowerCase())) score += 2
  }
  if (text.includes(entry.title.toLowerCase())) score += 3
  const words = entry.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
  for (const w of words) {
    if (text.includes(w)) score += 1
  }
  return score
}

export function findBestFaqEntries(message, limit = 3) {
  return ASSISTANT_FAQ_VISIBLE.map((entry) => ({ entry, score: scoreFaqMatch(message, entry) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.entry)
}

export function buildFaqDigestForPrompt(limit = 40) {
  return ASSISTANT_FAQ_VISIBLE.slice(0, limit)
    .map((f) => `[${f.id}] ${f.title}: ${f.body}`)
    .join('\n\n')
}
