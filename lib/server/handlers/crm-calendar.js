import { requireUser } from '../auth.js'
import { collectUpcomingReminders } from '../crmWorkflow.js'
import { listPipelineEntries } from '../organizations.js'
import { readStore } from '../store.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  const store = await readStore()
  const entries = store.savedLeads.filter((e) => {
    const leads = listPipelineEntries(store, user)
    return leads.some((l) => l.id === e.lead?.id)
  })

  const reminders = collectUpcomingReminders(entries, user, { withinHours: 168 })
  const meetings = reminders.filter((r) => r.kind === 'meeting')

  return sendJson(res, 200, { reminders, meetings, count: reminders.length })
}
