/** In-app Marketing guide — admin + team (no external uploads required). */

export const MARKETING_GUIDE_VERSION = 'v1'

export const MARKETING_GUIDE_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Marketing',
    audience: 'all',
    body: 'Send email campaigns to pipeline leads, track opens and clicks, and manage lists and templates in one place.',
    scene: 'overview',
    highlights: ['Campaigns', 'Lists', 'Reports'],
  },
  {
    id: 'roles',
    title: 'Admin vs team member',
    audience: 'admin',
    body: 'Company admins see every team campaign and report. Reps see only what they created (lists, templates, campaigns). Use Reports to review team sends.',
    scene: 'roles',
    highlights: ['All campaigns', 'Team badge'],
  },
  {
    id: 'email',
    title: 'Connect work email first',
    audience: 'all',
    body: 'Before your first email campaign, connect Gmail under Work email in the sidebar (or use your company domain if your admin set it up). Without this, sends will not go out.',
    scene: 'work-email',
    highlights: ['Work email', 'Gmail'],
  },
  {
    id: 'lists',
    title: 'Build a list',
    audience: 'all',
    body: 'Go to Lists → pick Email or WhatsApp → add leads from Pipeline with filters, or import. A list is the audience for a campaign.',
    scene: 'lists',
    highlights: ['Lists tab', 'Add leads'],
  },
  {
    id: 'templates',
    title: 'Design a template',
    audience: 'all',
    body: 'Templates hold your subject, body, and design blocks. Reuse them across campaigns. Use the editor canvas — scroll with trackpad in the center area.',
    scene: 'templates',
    highlights: ['Templates', 'Canvas'],
  },
  {
    id: 'campaign',
    title: 'Create & send a campaign',
    audience: 'all',
    body: 'Campaigns → name, list, template → Continue to design → Start campaign. Sending runs in the background (usually minutes for ~50 recipients). Keep the tab open for fastest delivery.',
    scene: 'campaign',
    highlights: ['Start', 'Continue'],
  },
  {
    id: 'control',
    title: 'Pause, Stop, or Continue',
    audience: 'all',
    body: 'Active campaign stuck or test send? In Campaign reports use Pause (temporary), Stop (cancel unsent mail), or Continue sending. Archive removes it from the main list.',
    scene: 'controls',
    highlights: ['Pause', 'Stop', 'Archive'],
  },
  {
    id: 'reports',
    title: 'Campaign reports',
    audience: 'all',
    body: 'Reports shows open rate, clicks, unsubscribes, and bounces per campaign. Click View report for each recipient. Filter by date range at the top.',
    scene: 'reports',
    highlights: ['Open rate', 'View report'],
  },
  {
    id: 'archive',
    title: 'Archive & delete',
    audience: 'all',
    body: 'Remove → Move to Archive. Open the Archive tab to delete permanently. Use this for test campaigns you no longer need.',
    scene: 'archive',
    highlights: ['Archive tab', 'Delete'],
  },
]

export function marketingGuideStepsForUser(user) {
  const isAdmin =
    user?.isOrgAdmin ||
    user?.orgRole === 'org_admin' ||
    user?.isPlatformAdmin
  return MARKETING_GUIDE_STEPS.filter(
    (s) => s.audience === 'all' || (s.audience === 'admin' && isAdmin)
  )
}

export function marketingGuideStorageKey(userId) {
  return `connect_intel_marketing_guide_seen_${MARKETING_GUIDE_VERSION}_${userId || 'anon'}`
}
