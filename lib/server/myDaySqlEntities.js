import {
  listPipelineMeetingsForMyDay,
  orgHasPipelineMeetings,
} from './pipelineMeetingsTable.js'
import {
  listPipelineTasksForMyDay,
  orgHasPipelineTasks,
} from './pipelineTasksTable.js'
import { localDateKey } from '../calendarLocale.js'

function endOfLocalDayIso(tz) {
  const key = localDateKey(new Date(), tz)
  return new Date(`${key}T23:59:59.999`).toISOString()
}

/** Load indexed tasks/meetings for My Day when SQL tables are populated. */
export async function loadMyDaySqlEntities(user, { timeZone = null } = {}) {
  const orgId = user?.organizationId
  if (!orgId) return { useSql: false, tasks: [], meetings: [] }

  const [hasTasks, hasMeetings] = await Promise.all([
    orgHasPipelineTasks(orgId),
    orgHasPipelineMeetings(orgId),
  ])
  if (!hasTasks && !hasMeetings) return { useSql: false, tasks: [], meetings: [] }

  const tz = timeZone || user.timeZone || 'UTC'
  const endTodayIso = endOfLocalDayIso(tz)
  const hourAgoIso = new Date(Date.now() - 3600000).toISOString()

  const [tasks, meetings] = await Promise.all([
    hasTasks
      ? listPipelineTasksForMyDay(orgId, user.id, { dueBeforeIso: endTodayIso })
      : [],
    hasMeetings
      ? listPipelineMeetingsForMyDay(orgId, user.id, {
          startsAfterIso: hourAgoIso,
          startsBeforeIso: endTodayIso,
        })
      : [],
  ])

  return { useSql: true, tasks, meetings }
}
