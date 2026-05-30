/** Where to navigate in the app for a CRM notification item. */
export function getNotificationTarget(item) {
  if (!item) return { panel: 'overview' }

  const leadId = item.leadId || null

  switch (item.type) {
    case 'reply':
      return { panel: 'pipeline', leadId, leadTab: 'email' }
    case 'assignment':
      return { panel: 'pipeline', leadId, leadTab: 'overview' }
    case 'meeting':
      return {
        panel: 'crm-calendar',
        leadId,
        leadTab: 'schedule',
        calendarEventId: item.meetingId ? `meeting-${item.meetingId}` : null,
        scheduledAt: item.scheduledAt || item.createdAt,
      }
    case 'task':
      return {
        panel: 'crm-calendar',
        leadId,
        leadTab: 'schedule',
        calendarEventId: item.taskId ? `task-${item.taskId}` : null,
        scheduledAt: item.scheduledAt || item.createdAt,
      }
    case 'follow_up':
      return { panel: 'pipeline', leadId, leadTab: 'schedule' }
    case 'team_note':
      return { panel: 'chithi', leadId, noteId: item.noteId || null }
    case 'team_task':
      return { panel: 'chithi', tab: 'tasks', leadId, taskId: item.taskId || null }
    default:
      if (leadId) return { panel: 'pipeline', leadId, leadTab: 'overview' }
      return { panel: 'overview' }
  }
}
