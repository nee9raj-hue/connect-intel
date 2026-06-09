/** Marketing Experience — goals, wizard, marketplace metadata */

export const CAMPAIGN_GOALS = [
  { id: 'newsletter', label: 'Newsletter', emoji: '📬', desc: 'Regular updates & nurture', color: '#6366f1' },
  { id: 'launch', label: 'Product launch', emoji: '🚀', desc: 'Announce something new', color: '#ff773d' },
  { id: 'promotion', label: 'Promotion', emoji: '🏷️', desc: 'Offers & limited deals', color: '#ec4899' },
  { id: 'announcement', label: 'Announcement', emoji: '📣', desc: 'Company news', color: '#0ea5e9' },
  { id: 'welcome', label: 'Welcome series', emoji: '👋', desc: 'Onboard new contacts', color: '#10b981' },
  { id: 'reengagement', label: 'Re-engagement', emoji: '💫', desc: 'Win back inactive leads', color: '#8b5cf6' },
  { id: 'custom', label: 'Custom', emoji: '✨', desc: 'Start from scratch', color: '#64748b' },
]

export const WIZARD_STEPS = [
  { id: 'audience', label: 'Audience' },
  { id: 'goal', label: 'Goal' },
  { id: 'template', label: 'Template' },
  { id: 'design', label: 'Design' },
  { id: 'review', label: 'Review' },
  { id: 'schedule', label: 'Schedule' },
]

export const TEMPLATE_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'popular', label: 'Popular' },
  { id: 'welcome', label: 'Welcome' },
  { id: 'newsletter', label: 'Newsletter' },
  { id: 'promo', label: 'Promotions' },
  { id: 'announcement', label: 'Announcements' },
  { id: 'event', label: 'Events' },
  { id: 'saved', label: 'Saved' },
  { id: 'recent', label: 'Recent' },
]

export const BLOCK_STUDIO_PALETTE = [
  { type: 'hero', label: 'Hero', group: 'layout' },
  { type: 'text', label: 'Text', group: 'content' },
  { type: 'image', label: 'Image', group: 'content' },
  { type: 'button', label: 'Button', group: 'content' },
  { type: 'divider', label: 'Divider', group: 'layout' },
  { type: 'social', label: 'Social', group: 'content' },
  { type: 'form', label: 'Form', group: 'content' },
  { type: 'footer', label: 'Footer', group: 'layout' },
]

export function estimateAudienceReach(list, segment, lists, segments) {
  if (segment) {
    const s = segments.find((x) => x.id === segment)
    return s?.memberCount ?? s?.count ?? 0
  }
  if (list) {
    const l = lists.find((x) => x.id === list)
    return l?.memberCount ?? l?.count ?? 0
  }
  return 0
}

export function estimatePerformance(kpis = {}, reach = 0) {
  const openRate = kpis.openRate || 22
  const clickRate = kpis.clickRate || 3.2
  return {
    deliveries: reach,
    estimatedOpens: Math.round(reach * (openRate / 100)),
    estimatedClicks: Math.round(reach * (clickRate / 100)),
    openRate,
    clickRate,
    spamScore: reach > 5000 ? 'Good' : 'Excellent',
  }
}

export function goalToStarterTemplate(goalId) {
  const map = {
    newsletter: 'newsletter',
    launch: 'case-study',
    promotion: 'pricing',
    announcement: 'webinar',
    welcome: 'welcome',
    reengagement: 'follow-up',
    custom: null,
  }
  return map[goalId] || null
}

export function campaignThumbnailStyle(campaign) {
  const status = campaign?.status || 'draft'
  const colors = {
    draft: 'linear-gradient(135deg, #e0e7ff 0%, #f8fafc 100%)',
    scheduled: 'linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)',
    active: 'linear-gradient(135deg, #ffedd5 0%, #fff7ed 100%)',
    completed: 'linear-gradient(135deg, #d1fae5 0%, #ecfdf5 100%)',
    paused: 'linear-gradient(135deg, #f1f5f9 0%, #f8fafc 100%)',
  }
  return colors[status] || colors.draft
}
