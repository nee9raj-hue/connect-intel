/**
 * One-click smart list presets — shared by Marketing segments and list batch builder.
 * filterJson matches marketingSegmentFilters schema.
 */

export const SMART_LIST_PRESETS = [
  {
    id: 'hot_leads',
    label: 'Hot leads',
    description: 'Lead score 70+ with sendable email',
    filters: { contact: 'has_email', minLeadScore: 70 },
  },
  {
    id: 'new_leads',
    label: 'New leads',
    description: 'New stage contacts with email',
    filters: { status: 'new', contact: 'has_email' },
  },
  {
    id: 'new_uncontacted',
    label: 'New & uncontacted',
    description: 'New stage, no touch in 7+ days',
    filters: { status: 'new', smartTags: ['not_touched'], contact: 'has_email' },
  },
  {
    id: 'follow_up_due',
    label: 'Follow-up due',
    description: 'Follow-up stage, due today or overdue',
    filters: { followUpDue: true, contact: 'has_email' },
  },
  {
    id: 'overdue_follow_up',
    label: 'Overdue follow-ups',
    description: 'Past-due follow-up date',
    filters: { overdueFollowUp: true, contact: 'has_email' },
  },
  {
    id: 'not_touched',
    label: 'Not touched (7d)',
    description: 'No email or call logged in 7+ days',
    filters: { smartTags: ['not_touched'], contact: 'has_email' },
  },
  {
    id: 'stale_30',
    label: 'Stale 30+ days',
    description: 'No activity in the last 30 days',
    filters: { staleDays: 30, contact: 'has_email' },
  },
  {
    id: 'replied',
    label: 'Replied',
    description: 'Replied stage with email',
    filters: { status: 'replied', contact: 'has_email' },
  },
]

export function presetById(id) {
  return SMART_LIST_PRESETS.find((p) => p.id === id) || null
}

export function mergePresetFilters(presetId, extra = {}) {
  const preset = presetById(presetId)
  if (!preset) return { ...extra }
  return { ...preset.filters, ...extra }
}
