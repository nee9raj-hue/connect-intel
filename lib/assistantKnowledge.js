/**
 * Product help knowledge for Connect Intel Assistant (Tier 1).
 * Customer-facing only — no internal provider names.
 */

export const ASSISTANT_QUICK_PROMPTS = [
  'How do I connect work Gmail?',
  'Bulk email from Pipeline',
  'Import leads from CSV',
  'Marketing forms in campaigns',
  'Filter pipeline by city',
  'Invite a teammate',
]

export const ASSISTANT_NAV_PANELS = new Set([
  'overview',
  'search',
  'saved',
  'pipeline',
  'contacts',
  'team-notes',
  'team-tasks',
  'crm-dashboard',
  'crm-log',
  'crm-calendar',
  'marketing',
  'team',
  'integrations',
  'admin',
  'admin-customers',
])

/** @type {{ id: string, tags: string[], title: string, body: string, navigate?: object }[]} */
export const ASSISTANT_FAQ = [
  {
    id: 'gmail-connect',
    tags: ['gmail', 'email', 'oauth', 'connect', 'work email', 'send'],
    title: 'Connect work Gmail',
    body:
      'Open a lead in Pipeline → Email tab → Connect work Gmail (one-time). Use your company work address, not a personal Gmail if possible. If Google shows a warning, choose Advanced → continue. Your company admin may need to add test users in Google Cloud until app verification is complete. Replies can sync when read access is granted.',
    navigate: { panel: 'pipeline', tab: 'email' },
  },
  {
    id: 'bulk-email',
    tags: ['bulk', 'email', 'selected', 'pipeline', 'list', '50'],
    title: 'Bulk email from Pipeline',
    body:
      'Switch Pipeline to List view, use filters if needed, select leads, then Email selected. You can send up to 50 leads per batch. Connect work Gmail first. AI can draft per lead or use one subject/body for all.',
    navigate: { panel: 'pipeline', tab: 'list' },
  },
  {
    id: 'pipeline-filters',
    tags: ['filter', 'search', 'city', 'state', 'phone', 'pipeline'],
    title: 'Search and filter Pipeline',
    body:
      'On Pipeline, use the search box for name, email, or phone. Tap Filters to expand city, state, stage, and contact filters (has email, no phone, etc.). Collapse filters to give more room to your lead list or board.',
    navigate: { panel: 'pipeline' },
  },
  {
    id: 'import-csv',
    tags: ['import', 'csv', 'excel', 'upload', 'pipeline'],
    title: 'Import CSV',
    body:
      'Pipeline → Import CSV. Use the import template for column names. Company admins can assign imported rows to teammates. Duplicates by email are handled when the same person already exists.',
    navigate: { panel: 'pipeline' },
  },
  {
    id: 'add-lead',
    tags: ['add', 'manual', 'lead', 'contact'],
    title: 'Add a lead manually',
    body: 'Pipeline → + Add lead. Fill name, company, email, phone, and stage. Admins can assign to a teammate on save.',
    navigate: { panel: 'pipeline' },
  },
  {
    id: 'whatsapp',
    tags: ['whatsapp', 'message', 'mobile'],
    title: 'WhatsApp outreach',
    body:
      'Open a lead → WhatsApp tab. Generate a draft, then Open in WhatsApp on your phone. Add your mobile in profile if prompted.',
    navigate: { panel: 'pipeline' },
  },
  {
    id: 'calendar-reminders',
    tags: ['calendar', 'meeting', 'reminder', 'notification', 'follow'],
    title: 'Calendar and reminders',
    body:
      'Calendar shows meetings and tasks across leads. Browser notifications fire ~30 minutes before a meeting if you allow notifications and keep Connect Intel open in a tab.',
    navigate: { panel: 'crm-calendar' },
  },
  {
    id: 'marketing-campaigns',
    tags: ['marketing', 'campaign', 'email', 'sequence'],
    title: 'Marketing campaigns',
    body:
      'Marketing → Campaigns to create sequences. Build templates with blocks (text, image, button, form CTA). Forms are linked from email — they are not embedded inside the message body.',
    navigate: { panel: 'marketing', tab: 'campaigns' },
  },
  {
    id: 'marketing-forms',
    tags: ['form', 'marketing', 'landing', 'google form'],
    title: 'Marketing forms',
    body:
      'Marketing → Forms to build hosted pages or link Google Forms. In a template, add a Form block and pick your form. Submissions create or update CRM activity on matching email addresses.',
    navigate: { panel: 'marketing', tab: 'forms' },
  },
  {
    id: 'marketing-reports',
    tags: ['report', 'open', 'click', 'campaign', 'analytics'],
    title: 'Campaign reports',
    body:
      'Marketing → Campaign reports for sent, delivered, opens, and clicks. Open a recipient to jump to their Pipeline lead when linked.',
    navigate: { panel: 'marketing', tab: 'reports' },
  },
  {
    id: 'ai-search',
    tags: ['search', 'prospect', 'ai', 'find', 'leads', 'credits'],
    title: 'AI prospect search',
    body:
      'AI prospect search finds companies and contacts from your criteria. Some results show preview contact info; revealing email or phone uses prospect credits. Save good fits to your list or pipeline.',
    navigate: { panel: 'search' },
  },
  {
    id: 'team-invite',
    tags: ['invite', 'team', 'member', 'admin'],
    title: 'Invite teammates',
    body:
      'Company admins: Team & email → invite by work email. Teammates accept the link and join your workspace. Set permissions for who can search and manage pipeline.',
    navigate: { panel: 'team' },
  },
  {
    id: 'team-notes-tasks',
    tags: ['notes', 'tasks', 'team', 'mention'],
    title: 'Team notes and tasks',
    body:
      'Notes and Tasks in the sidebar for company accounts. @mention leads in notes. Tasks can be assigned with due dates and appear on Calendar.',
    navigate: { panel: 'team-notes' },
  },
  {
    id: 'contacts',
    tags: ['contacts', 'master', 'database'],
    title: 'Contacts',
    body:
      'Contacts holds shared company records separate from your Pipeline stages. Search and open a contact to view details or LinkedIn assist.',
    navigate: { panel: 'contacts' },
  },
  {
    id: 'credits',
    tags: ['credit', 'balance', 'rupee', 'unlock', 'prospect'],
    title: 'Prospect credits',
    body:
      'Credits pay for revealing emails/phones after free AI search allowances. Check your balance in the header or profile. Low balance limits unlocks — contact support if you need a top-up.',
  },
  {
    id: 'assign-transfer',
    tags: ['assign', 'transfer', 'owner', 'manager'],
    title: 'Assign or transfer leads',
    body:
      'Managers: open a lead → Overview → assign or transfer to a teammate. List view supports bulk actions where enabled.',
    navigate: { panel: 'pipeline' },
  },
]

export function scoreFaqMatch(message, entry) {
  const text = String(message || '').toLowerCase()
  if (!text.trim()) return 0
  let score = 0
  for (const tag of entry.tags) {
    if (text.includes(tag.toLowerCase())) score += 2
  }
  if (text.includes(entry.title.toLowerCase())) score += 3
  return score
}

export function findBestFaqEntries(message, limit = 3) {
  return ASSISTANT_FAQ.map((entry) => ({ entry, score: scoreFaqMatch(message, entry) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.entry)
}
