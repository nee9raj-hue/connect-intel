import { CRM_STATUSES, getVisiblePipelineColumns } from './crmConstants'
import { isChithiPanel } from './chithiNav'
import { hasWorkspaceFeature } from './workspaceFeatures'
import { isFreightDealOrg, FREIGHT_DEAL_STAGES } from './freightDeal'

export function countPipelineByStatus(leads = []) {
  const counts = { all: leads.length }
  for (const s of CRM_STATUSES) counts[s.id] = 0
  for (const lead of leads) {
    const st = lead.crm?.status || 'new'
    if (counts[st] !== undefined) counts[st] += 1
  }
  return counts
}

/** Full org totals from server summary (fast); falls back to loaded leads. */
export function pipelineCountsFromSummary(pipelineSummary, savedLeads = []) {
  if (Array.isArray(pipelineSummary?.byStatus) && pipelineSummary.byStatus.length) {
    const counts = { all: Number(pipelineSummary.total) || 0 }
    for (const row of pipelineSummary.byStatus) {
      if (row?.status) counts[row.status] = Number(row.count) || 0
    }
    return counts
  }
  return countPipelineByStatus(savedLeads)
}

/** Preserve deal-count fields from GET /api/saved-leads?summary=1 */
export function normalizePipelineSummary(summary = {}) {
  return {
    total: summary.total ?? 0,
    byStatus: summary.byStatus || [],
    cities: summary.cities || [],
    states: summary.states || [],
    openDealCounts: summary.openDealCounts || null,
    dealCounts: summary.dealCounts || null,
  }
}

export function countUpcomingFromLeads(leads = []) {
  const now = Date.now()
  let n = 0
  for (const lead of leads) {
    for (const m of lead.crm?.meetings || []) {
      if (m.scheduledAt && new Date(m.scheduledAt).getTime() >= now) n += 1
    }
    for (const t of lead.crm?.tasks || []) {
      if (t.status !== 'done' && t.dueAt && new Date(t.dueAt).getTime() >= now) n += 1
    }
    if (lead.crm?.nextFollowUpAt && new Date(lead.crm.nextFollowUpAt).getTime() >= now) n += 1
  }
  return n
}

export function navTargetToOptions(target = {}) {
  const options = {}
  if (target.tab) options.tab = target.tab
  if (target.status || target.filter) options.status = target.status || target.filter
  if (target.view) options.view = target.view
  if (target.dealStage) options.dealStage = target.dealStage
  if (target.upcomingOnly) options.upcomingOnly = true
  if (target.focusToday) options.focusToday = true
  if (target.activityType) options.activityType = target.activityType
  if (target.period) options.period = target.period
  if (target.userId) options.userId = target.userId
  if (target.campaignId) options.campaignId = target.campaignId
  if (target.adminTab) options.tab = target.adminTab
  if (target.overdueFollowUp) options.overdueFollowUp = true
  if (target.followUpDue) options.followUpDue = true
  if (target.closingThisWeek) options.closingThisWeek = true
  if (Array.isArray(target.smartTags) && target.smartTags.length) options.smartTags = [...target.smartTags]
  if (target.audienceTab) options.audienceTab = target.audienceTab
  if (target.returnTo) options.returnTo = target.returnTo
  if (target.leadTab) options.leadTab = target.leadTab
  if (target.teamTab) options.teamTab = target.teamTab
  if (target.scopeOwner === 'me') options.scopeOwner = 'me'
  if (target.hierarchyTeam) options.hierarchyTeam = target.hierarchyTeam
  if (target.scope === 'all') options.scope = 'all'
  if (target.stuck) options.stuck = true
  if (target.scoreMin != null && target.scoreMin !== '') options.scoreMin = Number(target.scoreMin)
  if (target.closing) options.closing = target.closing
  if (target.due) options.due = target.due
  if (target.assignedAfter) options.assignedAfter = target.assignedAfter
  if (target.lastActivity) options.lastActivity = target.lastActivity
  if (target.activityFilter) options.activityFilter = target.activityFilter
  if (target.teamId) options.teamId = target.teamId
  if (target.wonThisMonth) options.wonThisMonth = true
  if (target.tasksDueToday) options.tasksDueToday = true
  if (target.unreadOnly) options.unreadOnly = true
  if (Array.isArray(target.leadIds) && target.leadIds.length) options.leadIds = [...target.leadIds]
  if (target.campaignId) options.campaignId = target.campaignId
  if (target.campaignRecipientFilter) options.campaignRecipientFilter = target.campaignRecipientFilter
  if (target.campaignName) options.campaignName = target.campaignName
  if (target.openedCampaignId) options.openedCampaignId = target.openedCampaignId
  if (target.clickedCampaignId) options.clickedCampaignId = target.clickedCampaignId
  if (target.marketingTab) options.marketingTab = target.marketingTab
  return options
}

export function isNavTargetActive(activePanel, panelOptions, target) {
  if (!target?.panel) return false
  if (
    target.panel === 'chithi' &&
    (isChithiPanel(activePanel) ||
      (activePanel === 'team-notes' && (!target.tab || target.tab === 'notes')) ||
      (activePanel === 'team-tasks' && target.tab === 'tasks'))
  ) {
    if (target.tab && panelOptions?.tab !== target.tab) return false
    return true
  }
  if (activePanel !== target.panel) return false
  if (target.tab && panelOptions?.tab !== target.tab) return false

  if (target.panel === 'pipeline') {
    const view = panelOptions?.view || 'leads'
    const targetView = target.view || 'leads'
    if (view !== targetView) return false
    if (targetView === 'deals') {
      const stage = panelOptions?.dealStage || 'all'
      const targetStage = target.dealStage || 'all'
      return stage === targetStage
    }
    if (target.status && (panelOptions?.status || 'all') !== target.status) return false
    if (!target.status) return (panelOptions?.status || 'all') === 'all'
    return true
  }

  if (target.status && (panelOptions?.status || 'all') !== target.status) return false
  if (target.panel === 'crm-calendar') {
    const upcoming = Boolean(panelOptions?.upcomingOnly)
    return target.upcomingOnly ? upcoming : !upcoming
  }
  if (target.panel === 'team') {
    const normalize = (t) => {
      if (!t || t === 'team') return 'members'
      if (t === 'hierarchy') return 'teams'
      return t
    }
    const currentTab = normalize(panelOptions?.teamTab)
    if (target.teamTab) return currentTab === normalize(target.teamTab)
    return currentTab === 'members'
  }
  return true
}

function buildFreightPipelineChildren(columns, pipelineCounts, openDealCounts = {}, allDealCounts = {}) {
  const open = openDealCounts || {}
  const all = allDealCounts || {}
  const leadColumns = columns.filter((col) => col.id !== 'active_trading' && col.id !== 'won' && col.id !== 'lost')

  const items = [
    {
      id: 'pipeline-leads-group',
      label: 'Leads',
      children: [
        {
          id: 'pipeline-all',
          label: 'All leads',
          panel: 'pipeline',
          status: 'all',
          view: 'leads',
          badge: pipelineCounts.all,
        },
        ...leadColumns.map((col) => ({
          id: `pipeline-${col.id}-leads`,
          label: col.label,
          panel: 'pipeline',
          status: col.id,
          view: 'leads',
          badge: pipelineCounts[col.id] || 0,
        })),
      ],
    },
    {
      id: 'pipeline-deals-group',
      label: 'Deals',
      children: [
        {
          id: 'pipeline-all-deals',
          label: 'All open',
          panel: 'pipeline',
          view: 'deals',
          dealStage: 'all',
          badge: open.all || null,
        },
        ...FREIGHT_DEAL_STAGES.filter((s) => s.id !== 'won' && s.id !== 'lost').map((stage) => ({
          id: `pipeline-deal-${stage.id}`,
          label: stage.label,
          panel: 'pipeline',
          view: 'deals',
          dealStage: stage.id,
          badge: open[stage.id] || null,
        })),
        {
          id: 'pipeline-won-deals',
          label: 'Won',
          panel: 'pipeline',
          view: 'deals',
          dealStage: 'won',
          badge: all.won || null,
        },
        {
          id: 'pipeline-lost-deals',
          label: 'Lost',
          panel: 'pipeline',
          view: 'deals',
          dealStage: 'lost',
          badge: all.lost || null,
        },
      ],
    },
  ]

  return items
}

function buildStandardPipelineChildren(
  columns,
  pipelineCounts,
  openDealCounts = {},
  allDealCounts = {}
) {
  const open = openDealCounts || {}
  const all = allDealCounts || {}
  const leadColumns = columns.filter(
    (col) => col.id !== 'active_trading' && col.id !== 'won' && col.id !== 'lost'
  )

  return [
    {
      id: 'pipeline-leads-group',
      label: 'Leads',
      children: [
        {
          id: 'pipeline-all',
          label: 'All leads',
          panel: 'pipeline',
          status: 'all',
          view: 'leads',
          badge: pipelineCounts.all,
        },
        ...leadColumns.map((col) => ({
          id: `pipeline-${col.id}-leads`,
          label: col.label,
          panel: 'pipeline',
          status: col.id,
          view: 'leads',
          badge: pipelineCounts[col.id] || 0,
        })),
      ],
    },
    {
      id: 'pipeline-deals-group',
      label: 'Deals',
      children: [
        {
          id: 'pipeline-all-deals',
          label: 'All open',
          panel: 'pipeline',
          view: 'deals',
          dealStage: 'all',
          badge: open.all || null,
        },
        {
          id: 'pipeline-won-deals',
          label: 'Won',
          panel: 'pipeline',
          view: 'deals',
          dealStage: 'won',
          badge: all.won || null,
        },
        {
          id: 'pipeline-lost-deals',
          label: 'Lost',
          panel: 'pipeline',
          view: 'deals',
          dealStage: 'lost',
          badge: all.lost || null,
        },
      ],
    },
  ]
}

export function buildCustomerNavSections(
  user,
  { pipelineCounts = {}, upcomingCount = 0, dealCounts = null, allDealCounts = null } = {}
) {
  const columns = getVisiblePipelineColumns(user)
  const isCompany = user?.accountType === 'company'
  const freightOrg = isFreightDealOrg(user)

  const pipelineChildren = freightOrg
    ? buildFreightPipelineChildren(columns, pipelineCounts, dealCounts || {}, allDealCounts || {})
    : buildStandardPipelineChildren(
        columns,
        pipelineCounts,
        dealCounts || {},
        allDealCounts || {}
      )

  const marketingChildren = [
    { id: 'marketing-overview', label: 'Overview', panel: 'marketing', tab: 'overview' },
    { id: 'marketing-audiences', label: 'Audiences', panel: 'marketing', tab: 'audiences' },
    { id: 'marketing-campaigns', label: 'Campaigns', panel: 'marketing', tab: 'campaigns' },
    { id: 'marketing-automations', label: 'Automations', panel: 'marketing', tab: 'automations' },
    { id: 'marketing-forms', label: 'Forms', panel: 'marketing', tab: 'forms' },
    { id: 'marketing-landing', label: 'Landing Pages', panel: 'marketing', tab: 'landing' },
    { id: 'marketing-templates', label: 'Templates', panel: 'marketing', tab: 'templates' },
    { id: 'marketing-analytics', label: 'Analytics', panel: 'marketing', tab: 'analytics' },
    { id: 'marketing-domains', label: 'Domains', panel: 'marketing', tab: 'domains' },
    { id: 'marketing-assets', label: 'Assets', panel: 'marketing', tab: 'assets' },
  ]

  const calendarChildren = [
    { id: 'calendar-all', label: 'Full calendar', panel: 'crm-calendar' },
    {
      id: 'calendar-upcoming',
      label: 'Upcoming meetings',
      panel: 'crm-calendar',
      upcomingOnly: true,
      badge: upcomingCount || null,
    },
  ]

  const automationChildren = [
    { id: 'crm-sequences', label: 'Sequences', panel: 'crm-sequences' },
    ...(isCompany && user?.isOrgAdmin
      ? [{ id: 'crm-automation', label: 'Automation', panel: 'crm-automation' }]
      : []),
  ]

  const analyticsGroups = [
    ...(isCompany && hasWorkspaceFeature(user, 'homeTeamMetrics')
      ? [
          {
            id: 'team-intelligence',
            label: 'Team intelligence',
            icon: 'chart',
            panel: 'crm-dashboard',
          },
        ]
      : []),
    { id: 'activity-log', label: 'Activity log', icon: 'log', panel: 'crm-log' },
  ]

  const sections = [
    {
      title: 'Home',
      groups: [{ id: 'home-dashboard', label: 'Dashboard', icon: 'home', panel: 'overview' }],
    },
    {
      title: 'CRM / Sales',
      groups: [
        { id: 'pipeline', label: 'Pipeline', icon: 'pipeline', children: pipelineChildren },
        ...(isCompany
          ? [{ id: 'active-customers', label: 'Active customers', icon: 'chart', panel: 'active-customers' }]
          : []),
        { id: 'contacts', label: 'Contacts', icon: 'people', panel: 'contacts' },
        ...(isCompany
          ? [{ id: 'companies', label: 'Companies', icon: 'chart', panel: 'companies' }]
          : []),
        { id: 'marketing', label: 'Marketing', icon: 'mail', children: marketingChildren },
        { id: 'calendar', label: 'Calendar', icon: 'calendar', children: calendarChildren },
        ...(automationChildren.length
          ? [{ id: 'automation', label: 'Automation', icon: 'bolt', children: automationChildren }]
          : []),
        ...(isCompany && hasWorkspaceFeature(user, 'fieldVisitExpenses')
          ? [{ id: 'field-expenses', label: 'Field expenses', icon: 'route', panel: 'field-expenses' }]
          : []),
      ],
    },
    {
      title: 'Analytics & reports',
      groups: analyticsGroups,
    },
    {
      title: 'Collaboration',
      groups: [
        ...(isCompany
          ? [
              {
                id: 'chithi',
                label: 'Chithi',
                icon: 'chithi',
                panel: 'chithi',
                badgeKey: 'chithi',
              },
            ]
          : []),
      ],
    },
    {
      title: 'AI prospecting',
      groups: [
        { id: 'search', label: 'AI prospect search', icon: 'spark', panel: 'search' },
        {
          id: 'saved',
          label: 'Saved leads',
          icon: 'list',
          panel: 'saved',
          badgeKey: 'saved',
        },
      ],
    },
  ]

  if (user?.isOrgAdmin && isCompany) {
    sections.push({
      title: 'Workspace',
      groups: [
        {
          id: 'team',
          label: 'Team & email',
          icon: 'team',
          children: [
            { id: 'team-members', label: 'Team members', panel: 'team', teamTab: 'members' },
            { id: 'team-hierarchy', label: 'Teams & departments', panel: 'team', teamTab: 'teams' },
            { id: 'team-permissions', label: 'Permissions', panel: 'team', teamTab: 'permissions' },
          ],
        },
        { id: 'whatsapp-settings', label: 'WhatsApp API', icon: 'whatsapp', panel: 'whatsapp-settings' },
      ],
    })
  } else if (isCompany) {
    sections.push({
      title: 'Workspace',
      groups: [{ id: 'my-email', label: 'Work email', icon: 'mail', panel: 'my-email' }],
    })
  } else if (user?.accountType === 'individual') {
    sections.push({
      title: 'Workspace',
      groups: [{ id: 'whatsapp-settings', label: 'WhatsApp API', icon: 'whatsapp', panel: 'whatsapp-settings' }],
    })
  }

  sections.push({
    title: 'Settings',
    groups: [{ id: 'app-settings', label: 'Display & layout', icon: 'settings', panel: 'app-settings' }],
  })

  return sections.filter((s) => s.groups.length > 0)
}

export function buildOperatorNavSections() {
  return [
    {
      title: 'Platform backend',
      groups: [
        { id: 'admin-home', label: 'Overview', icon: 'home', panel: 'admin-home' },
        {
          id: 'admin-customers',
          label: 'Customers & tickets',
          icon: 'support',
          panel: 'admin-customers',
        },
        { id: 'admin', label: 'Data & imports', icon: 'database', panel: 'admin' },
        { id: 'integrations', label: 'System status', icon: 'bolt', panel: 'integrations' },
      ],
    },
    {
      title: 'Preview as customer',
      groups: [
        { id: 'overview', label: 'Home', icon: 'home', panel: 'overview' },
        { id: 'pipeline', label: 'Pipeline', icon: 'pipeline', panel: 'pipeline', muted: true },
        { id: 'marketing', label: 'Marketing', icon: 'mail', panel: 'marketing', muted: true },
        { id: 'search', label: 'AI search', icon: 'spark', panel: 'search', muted: true },
      ],
    },
    {
      title: 'Settings',
      groups: [{ id: 'app-settings', label: 'Display & layout', icon: 'settings', panel: 'app-settings' }],
    },
  ]
}

/** Submenu targets for a desktop floating pill item (pipeline stages, marketing tabs, etc.). */
export function getDesktopPillSubmenuTargets(pillItem, sections = []) {
  if (!pillItem?.panel) return []

  const groupChildren = (pred) => {
    for (const section of sections) {
      for (const group of section.groups || []) {
        if (group.children?.length && pred(group)) return group.children
      }
    }
    return []
  }

  if (pillItem.panel === 'pipeline') {
    return groupChildren((g) => g.id === 'pipeline')
  }
  if (pillItem.panel === 'marketing') {
    const kids = groupChildren((g) => g.id === 'marketing')
    if (pillItem.tab) return kids.filter((c) => !c.tab || c.tab === pillItem.tab)
    return kids
  }
  if (pillItem.panel === 'crm-calendar') {
    return groupChildren((g) => g.id === 'calendar')
  }
  if (pillItem.panel === 'overview') {
    return []
  }
  if (pillItem.panel === 'crm-dashboard' || pillItem.panel === 'crm-log') {
    return []
  }
  if (pillItem.panel === 'chithi' || pillItem.panel === 'team-tasks' || pillItem.panel === 'team-notes') {
    return [
      { id: 'chithi-chat', label: 'Messages', panel: 'chithi' },
      { id: 'chithi-tasks', label: 'Tasks', panel: 'chithi', tab: 'tasks' },
    ]
  }
  return []
}

/** Always-visible mobile nav shortcuts (fit on screen without scrolling). */
export const MOBILE_NAV_PILL_PRIMARY_ITEMS = [
  { id: 'home', label: 'Home', panel: 'overview', icon: 'home' },
  { id: 'pipeline', label: 'Leads', panel: 'pipeline', icon: 'pipeline', matchPanelOnly: true },
  { id: 'contacts', label: 'Contacts', panel: 'contacts', icon: 'people' },
  { id: 'search', label: 'Search', panel: 'search', icon: 'spark' },
]

/** Secondary mobile nav shortcuts — horizontal scroll beside primary row. */
export const MOBILE_NAV_PILL_MORE_ITEMS = [
  { id: 'marketing', label: 'Mail', panel: 'marketing', tab: 'overview', icon: 'mail' },
  { id: 'whatsapp', label: 'WA', panel: 'marketing', tab: 'inbox', icon: 'whatsapp' },
  { id: 'calendar', label: 'Meetings', panel: 'crm-calendar', upcomingOnly: true, icon: 'calendar' },
  { id: 'tasks', label: 'Tasks', panel: 'team-tasks', icon: 'task' },
  { id: 'app-settings', label: 'Display', panel: 'app-settings', icon: 'settings' },
]

/** Primary destinations for the mobile floating nav pill (shortcuts + More drawer). */
export const MOBILE_NAV_PILL_ITEMS = [
  ...MOBILE_NAV_PILL_PRIMARY_ITEMS,
  ...MOBILE_NAV_PILL_MORE_ITEMS,
]

export const QUICK_NAV_TILES = [
  { id: 'pipeline', label: 'Pipeline', panel: 'pipeline', icon: 'pipeline', desc: 'Manage leads' },
  { id: 'search', label: 'AI search', panel: 'search', icon: 'spark', desc: 'Find prospects' },
  { id: 'marketing', label: 'Marketing', panel: 'marketing', tab: 'overview', icon: 'mail', desc: 'Marketing Hub' },
  { id: 'contacts', label: 'Contacts', panel: 'contacts', icon: 'people', desc: 'Master records' },
  {
    id: 'calendar-upcoming',
    label: 'Meetings',
    panel: 'crm-calendar',
    upcomingOnly: true,
    icon: 'calendar',
    desc: 'Upcoming',
  },
  { id: 'crm-log', label: 'Activity', panel: 'crm-log', icon: 'log', desc: 'Recent actions' },
  { id: 'team-notes', label: 'Notes', panel: 'team-notes', icon: 'note', desc: 'Team inbox' },
  { id: 'team-tasks', label: 'Tasks', panel: 'team-tasks', icon: 'task', desc: 'Assignments' },
]
