import { CRM_ONBOARDING_STEPS, FREE_PLAN } from './crmPlanLimits'

export const LANDING_HERO = {
  badge: 'Free CRM for Indian B2B sales teams',
  headline: 'Never lose a prospect in the follow-up gap',
  subhead:
    'Connect Intel is a workspace where your team imports leads, assigns owners, tracks every conversation, and gets reminded before every call—without forcing Gmail setup on day one.',
  bullets: [
    'Start with work email and password',
    'Import CSV or add leads manually',
    'Invite teammates with roles when ready',
    'Connect work Gmail later for CRM email',
  ],
}

export const WHO_ITS_FOR = [
  {
    id: 'exporters',
    title: 'Exporters & manufacturers',
    desc: 'Run outbound from one pipeline instead of Excel tabs and personal WhatsApp threads.',
    icon: '🏭',
  },
  {
    id: 'founders',
    title: 'Founders selling directly',
    desc: 'Get a proper CRM on day one—free for your first seats and leads, no procurement cycle.',
    icon: '🚀',
  },
  {
    id: 'managers',
    title: 'Sales managers',
    desc: 'See who contacted whom, which deals stalled, and who needs a nudge before the day ends.',
    icon: '📊',
  },
  {
    id: 'teams',
    title: 'Small B2B teams (2–40)',
    desc: 'One company workspace, shared pipeline, rep-level views—built for teams that outgrew spreadsheets.',
    icon: '👥',
  },
]

export const PAIN_POINTS = [
  'Callbacks missed because nobody owns the next step',
  'Managers cannot see rep activity until weekly reviews',
  'Customer history split across Gmail, WhatsApp, and notes',
  'Pipeline numbers in sheets that nobody trusts',
]

export const CRM_WINS = [
  'Every lead has an owner, stage, and activity trail',
  'Reminders 30 minutes before meetings and calls',
  'Team admins see the full org pipeline; reps see theirs',
  'Import once—work from one record per customer',
]

export const WORKFLOW_STEPS = [
  {
    title: 'Import your list',
    desc: 'Upload a CSV from IndiaMART, trade fairs, or your existing sheet. Map columns once and land in pipeline.',
    tag: 'Day 1',
  },
  {
    title: 'Assign & stage deals',
    desc: 'Give each lead an owner and move through New → Contacted → Follow up → Won. Everyone sees the same truth.',
    tag: 'Day 2',
  },
  {
    title: 'Follow up on time',
    desc: 'Log calls, schedule tasks, and get browser alerts before meetings. WhatsApp opens with context on screen.',
    tag: 'Ongoing',
  },
  {
    title: 'Connect email when ready',
    desc: 'Optional work Gmail link—send and receive from the CRM when your team is ready. No OAuth during signup.',
    tag: 'When you need it',
  },
]

export const PILLARS = [
  {
    id: 'pipeline',
    title: 'Pipeline & deal stages',
    desc: 'Kanban-style stages, owner assignment, notes, tasks, and meetings on every lead record.',
    tag: 'CRM',
  },
  {
    id: 'team',
    title: 'Team invites & roles',
    desc: 'Org admins see everything; reps see assigned leads. Invite colleagues with pipeline roles.',
    tag: 'Team',
  },
  {
    id: 'calendar',
    title: 'Calendar & reminders',
    desc: 'Upcoming calls and tasks surface in CRM calendar. Alerts fire 30 minutes before each meeting.',
    tag: 'Calendar',
  },
  {
    id: 'import',
    title: 'CSV import',
    desc: 'Bring existing prospects from spreadsheets or export tools—no manual re-entry for hundreds of rows.',
    tag: 'Import',
  },
  {
    id: 'email',
    title: 'Work Gmail (optional)',
    desc: 'Connect later with normal Google scopes. Outreach logs to the lead timeline when enabled.',
    tag: 'Email',
  },
  {
    id: 'whatsapp',
    title: 'WhatsApp follow-ups',
    desc: 'Jump to WhatsApp from a lead with context visible—desktop or mobile. Log the touch in CRM.',
    tag: 'WhatsApp',
  },
]

export const MANAGER_BULLETS = [
  'Company-wide pipeline with role-based views',
  'Per-rep activity and assignment visibility',
  'CSV import and bulk pipeline updates',
  'Workspace settings for team capacity and upgrades',
]

export const GETTING_STARTED = CRM_ONBOARDING_STEPS.map((s) => ({
  step: s.step,
  title: s.title,
  sub: s.detail,
}))

export const FAQ_ITEMS = [
  {
    q: 'Do I need Gmail or Google sign-in to start?',
    a: 'No. Create your workspace with work email and password. Connect work Gmail later from settings when you want send/receive inside the CRM.',
  },
  {
    q: 'Is Connect Intel really free?',
    a: `Yes—for up to ${FREE_PLAN.maxSeats} team seats and ${FREE_PLAN.maxLeads} pipeline leads. No card at signup. Upgrade only when your admin confirms you need more capacity.`,
  },
  {
    q: 'How fast can we go live?',
    a: 'Most teams sign up, import a CSV, and invite one colleague within the same day. Email integration is optional and can wait.',
  },
  {
    q: 'Can multiple people from my company join?',
    a: 'Yes. Company workspaces use your email domain. Admins invite teammates; duplicate company workspaces on the same domain are blocked to keep one source of truth.',
  },
  {
    q: 'Who sees which leads?',
    a: 'Org admins see the full company pipeline. Reps see leads assigned to them (and records they created). Managers coach from shared activity data.',
  },
  {
    q: 'What happens when we outgrow the free tier?',
    a: 'Your admin sees usage meters in Team → Workspace. When you are near limits, they can confirm a Team CRM upgrade and see the monthly amount before payment is collected.',
  },
]

export const TRUST_SIGNALS = [
  { label: 'No card at signup', detail: 'Free tier to validate fit' },
  { label: 'Work email first', detail: 'Gmail connect is optional' },
  { label: 'One company workspace', detail: 'Per domain, admin-controlled' },
  { label: 'Built for India B2B', detail: 'INR pricing when you upgrade' },
]
