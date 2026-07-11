import { CRM_ONBOARDING_STEPS, FREE_PLAN } from './crmPlanLimits'

/** Enterprise landing copy — CRM core + AI intelligence platform (no Chithi / chat modules). */

export const LANDING_HERO = {
  badge: 'Enterprise AI Sales Intelligence',
  headline: 'Enterprise AI CRM built for modern sales teams',
  subhead:
    'One workspace for pipeline, deals, team intelligence, and AI-assisted follow-up—built for exporters, manufacturers, and B2B teams that need discipline at scale.',
  bullets: [
    'Multi-tenant workspaces with role-based access',
    'Pipeline, deals, and activity in one record',
    'AI copilot for drafts, search, and coaching',
    'Chrome extension for Gmail trail sync',
  ],
}

export const HERO_OUTCOMES = [
  'Reduce manual follow-up work',
  'Close more deals with full visibility',
  'Automate stage-based workflows',
  'Coach reps from real CRM activity',
]

export const PRODUCT_METRICS = [
  { value: '<500ms', label: 'Dashboard load (production gate)' },
  { value: 'RBAC', label: 'API-enforced workspace isolation' },
  { value: '342+', label: 'Automated quality checks' },
  { value: 'Free', label: 'Start with 5 seats · 500 leads' },
]

export const PRODUCT_SHOWCASE = [
  {
    id: 'pipeline',
    title: 'Pipeline & lead workspace',
    benefit: 'Every prospect has an owner, stage, and complete activity trail.',
    visual: 'pipeline',
  },
  {
    id: 'deals',
    title: 'Deal management',
    benefit: 'Track amount, stage, and won/lost triggers from the lead record or opportunities view.',
    visual: 'deals',
  },
  {
    id: 'dashboard',
    title: 'Team intelligence',
    benefit: 'Managers see rep activity, pipeline health, and last CRM touch—not login time alone.',
    visual: 'dashboard',
  },
  {
    id: 'copilot',
    title: 'AI sales copilot',
    benefit: 'Draft follow-ups, search workspace records, and get grounded answers inside CRM.',
    visual: 'copilot',
  },
  {
    id: 'automation',
    title: 'Workflow automation',
    benefit: 'Rules on lead created, stage entered, inactivity, and deal won—audited in SQL.',
    visual: 'automation',
  },
  {
    id: 'email',
    title: 'Email & extension',
    benefit: 'Gmail trail sync and send-and-log via Chrome extension; inbound reply routing to CRM.',
    visual: 'email',
  },
]

export const AI_COPILOT_CAPABILITIES = [
  { title: 'CRM-aware answers', desc: 'Grounded on your pipeline, assignments, and workspace settings.' },
  { title: 'Email drafting', desc: 'Generate follow-up copy on leads with consent and context.' },
  { title: 'Command palette search', desc: 'Find leads, deals, and tasks across the workspace instantly.' },
  { title: 'Pipeline insights', desc: 'Surface next steps, overdue tasks, and team activity patterns.' },
  { title: 'Follow-up recommendations', desc: 'Coaching prompts tied to real CRM events—not generic scripts.' },
  { title: 'Company context', desc: 'Lead and account data unified on one timeline per customer.' },
]

export const ENTERPRISE_FEATURES = [
  { title: 'Multi-tenant architecture', desc: 'Isolated org workspaces with server-enforced scoping.' },
  { title: 'Role-based access', desc: 'Org admin, manager, and rep views on pipeline data.' },
  { title: 'Audit logs', desc: 'Sensitive actions recorded for compliance and coaching.' },
  { title: 'Scalable infrastructure', desc: 'Vercel serverless API, Postgres pipeline reads, background workers.' },
  { title: 'Data isolation', desc: 'Tenant filters on every mutation and list endpoint.' },
  { title: 'Security-first auth', desc: 'Session JWT, HTTPS, rate-limited login, CSRF-safe cookies.' },
  { title: 'Organization management', desc: 'Invites, hierarchy, departments, and team settings.' },
  { title: 'API-ready platform', desc: 'Unified handler layer designed for ERP and integration expansion.' },
]

export const INDUSTRIES = [
  'Exporters',
  'Manufacturers',
  'D2C brands',
  'Amazon sellers',
  'B2B distributors',
  'Trading companies',
  'Logistics & freight',
  'Importers',
  'Retail sales',
  'Enterprise field sales',
]

export const WHO_ITS_FOR = [
  {
    id: 'exporters',
    title: 'Exporters & manufacturers',
    desc: 'Run international outbound from one pipeline with assignable owners and audit-ready activity.',
  },
  {
    id: 'managers',
    title: 'Sales leadership',
    desc: 'Team review, rep metrics, and pipeline truth without weekly spreadsheet reconciliation.',
  },
  {
    id: 'founders',
    title: 'Founder-led sales',
    desc: 'Enterprise-grade workspace on day one—free tier, no procurement cycle.',
  },
  {
    id: 'teams',
    title: 'Growing B2B teams',
    desc: '2–40 seats, shared pipeline, hierarchy RBAC, and scalable SQL-backed lists.',
  },
]

export const PAIN_POINTS = [
  'Revenue stalls when follow-ups live in personal inboxes',
  'Managers lack per-rep CRM activity until manual reviews',
  'Customer history fragmented across email, WhatsApp, and notes',
  'Pipeline numbers in spreadsheets nobody trusts',
]

export const CRM_WINS = [
  'Unified timeline on every lead record',
  'Sub-second dashboard paths for daily manager review',
  'Workflow rules and sequences with versioned audit',
  'Workspace isolation enforced at the API layer',
]

export const WORKFLOW_STEPS = [
  {
    title: 'Create organization',
    desc: 'Work email and password—secure session, no forced Gmail OAuth at signup.',
    tag: 'Step 1',
  },
  {
    title: 'Import pipeline',
    desc: 'CSV or manual entry with duplicate detection and custom stages.',
    tag: 'Step 2',
  },
  {
    title: 'Invite team',
    desc: 'Roles, departments, and permission matrix for admins.',
    tag: 'Step 3',
  },
  {
    title: 'Scale with intelligence',
    desc: 'AI copilot, automations, extension email sync, and team dashboards.',
    tag: 'Step 4',
  },
]

export const PILLARS = [
  {
    id: 'pipeline',
    title: 'Pipeline & kanban',
    desc: 'Custom stages, bulk actions, saved views, and lead scoring.',
    tag: 'CRM',
  },
  {
    id: 'deals',
    title: 'Deals & opportunities',
    desc: 'Nested deals per lead with won/lost automation hooks.',
    tag: 'Sales',
  },
  {
    id: 'team',
    title: 'Team & permissions',
    desc: 'Hierarchy RBAC, audit log, and rep-scoped visibility.',
    tag: 'Enterprise',
  },
  {
    id: 'calendar',
    title: 'Calendar & tasks',
    desc: 'Meetings, reminders, and optional Google Calendar sync.',
    tag: 'Productivity',
  },
  {
    id: 'automation',
    title: 'Workflow engine',
    desc: 'CRM rules, sequences, and visual automation builder.',
    tag: 'Automation',
  },
  {
    id: 'extension',
    title: 'Chrome extension',
    desc: 'Gmail lead match, trail sync, and send-and-log from the inbox.',
    tag: 'Email',
  },
]

export const MANAGER_BULLETS = [
  'Company-wide pipeline with role-based views',
  'Rep review with CRM last-active and period filters',
  'SQL-backed list performance at scale',
  'Audit trail for sensitive workspace actions',
]

export const GETTING_STARTED = CRM_ONBOARDING_STEPS.map((s) => ({
  step: s.step,
  title: s.title,
  sub: s.detail,
}))

export const FAQ_ITEMS = [
  {
    q: 'Is Connect Intel only a CRM?',
    a: 'CRM is the core: pipeline, deals, team intelligence, and automation. AI copilot and workspace search extend the same platform—without separate chat or prospecting modules in the product shell.',
  },
  {
    q: 'How do we sign in?',
    a: 'Create a workspace with work email and password. Google Sign-In is available for identity on returning accounts. Active sessions persist securely—no repeated logins on the same device.',
  },
  {
    q: 'How does email work?',
    a: 'Install the Connect Intel Chrome extension for Gmail trail sync and send-and-log. Inbound reply routing logs responses to CRM without reading your entire inbox.',
  },
  {
    q: 'Is the platform enterprise-ready?',
    a: 'Multi-tenant isolation, RBAC, audit events, Postgres pipeline reads, and production performance gates are live. SSO and org subdomains are on the roadmap.',
  },
  {
    q: 'What does the free tier include?',
    a: `Up to ${FREE_PLAN.maxSeats} seats and ${FREE_PLAN.maxLeads} pipeline leads. No card at signup. Upgrade when your admin confirms capacity needs.`,
  },
  {
    q: 'Who sees which leads?',
    a: 'Org admins see the full company pipeline. Reps see assigned leads. Managers see their team subtree. Enforced server-side—not UI-only filters.',
  },
]

export const TRUST_SIGNALS = PRODUCT_METRICS

export const DEMO_MAILTO =
  'mailto:invite@connectintel.net?subject=Connect%20Intel%20demo%20request&body=Company%20name%3A%0ATeam%20size%3A%0AUse%20case%3A'
