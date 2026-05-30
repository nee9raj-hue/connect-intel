import { userCanViewNote, userCanViewTask } from './teamCollaboration.js'

export function getTeamHubLastSeenMs(user) {
  if (!user?.teamHubLastSeenAt) return 0
  const ms = new Date(user.teamHubLastSeenAt).getTime()
  return Number.isFinite(ms) ? ms : 0
}

/** Unread team messages and open assignments since last Team hub visit. */
export function countTeamHubUnread(store, user) {
  if (!user?.organizationId || user.accountType !== 'company') {
    return { messages: 0, tasks: 0, total: 0 }
  }

  const since = getTeamHubLastSeenMs(user)
  let messages = 0
  let tasks = 0

  for (const note of store.teamNotes || []) {
    if (!userCanViewNote(note, user)) continue
    if (note.recipientUserId !== user.id) continue
    if (new Date(note.createdAt).getTime() > since) messages += 1
  }

  for (const task of store.teamTasks || []) {
    if (!userCanViewTask(task, user)) continue
    if (task.assigneeUserId !== user.id) continue
    if (task.status === 'done') continue
    const at = Math.max(
      new Date(task.createdAt).getTime(),
      task.updatedAt ? new Date(task.updatedAt).getTime() : 0
    )
    if (at > since) tasks += 1
  }

  return { messages, tasks, total: messages + tasks }
}
