import { navTargetToOptions } from './navConfig'

/**
 * Flatten sidebar nav into command-palette navigation targets.
 */
export function flattenNavSections(sections = []) {
  const items = []

  for (const section of sections) {
    for (const group of section.groups || []) {
      if (group.panel && !group.children?.length) {
        items.push({
          id: group.id,
          label: group.label,
          group: section.title,
          panel: group.panel,
          options: navTargetToOptions(group),
        })
        continue
      }

      for (const child of group.children || []) {
        items.push({
          id: child.id,
          label: child.label,
          group: `${section.title} · ${group.label}`,
          panel: child.panel,
          options: navTargetToOptions(child),
        })
      }
    }
  }

  return items
}

export function filterNavItems(items, query) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return items.slice(0, 12)
  return items
    .filter((item) => {
      const hay = `${item.label} ${item.group || ''}`.toLowerCase()
      return hay.includes(q)
    })
    .slice(0, 12)
}

export const QUICK_ACTIONS = [
  {
    id: 'qa-new-lead',
    label: 'Go to pipeline — all leads',
    group: 'Quick actions',
    panel: 'pipeline',
    options: { status: 'all' },
  },
  {
    id: 'qa-marketing-campaign',
    label: 'Create marketing campaign',
    group: 'Quick actions',
    panel: 'marketing',
    options: { tab: 'campaigns' },
  },
  {
    id: 'qa-activity',
    label: 'Open activity log',
    group: 'Quick actions',
    panel: 'crm-log',
    options: {},
  },
  {
    id: 'qa-calendar',
    label: 'Open calendar',
    group: 'Quick actions',
    panel: 'crm-calendar',
    options: {},
  },
]
