import { getChithiLastSeenMs, userCanAccessChannel } from './chithi.js'
import { filterOrgRows, userCanViewNote, userCanViewTask } from './teamCollaboration.js'

/** Unread Chithi feed items since last visit (general channel + DMs + assigned tasks). */
export function countChithiUnread(store, user) {
  if (!user?.organizationId || user.accountType !== 'company') {
    return { messages: 0, channelMessages: 0, directMessages: 0, tasks: 0, total: 0 }
  }

  const since = getChithiLastSeenMs(user)
  let channelMessages = 0
  let directMessages = 0

  for (const msg of store.chithiMessages || []) {
    if (msg.organizationId !== user.organizationId) continue
    if (msg.authorUserId === user.id) continue
    if (new Date(msg.createdAt).getTime() <= since) continue
    const channel = (store.chithiChannels || []).find((c) => c.id === msg.channelId)
    if (!channel || !userCanAccessChannel(channel, user)) continue
    const mentioned = (msg.userMentions || []).some((m) => m.userId === user.id)
    if (channel.type === 'public' || mentioned) channelMessages += 1
  }

  for (const note of store.teamNotes || []) {
    if (!userCanViewNote(note, user)) continue
    if (note.recipientUserId !== user.id) continue
    if (new Date(note.createdAt).getTime() > since) directMessages += 1
  }

  let tasks = 0
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

  const messages = channelMessages + directMessages
  return {
    messages,
    channelMessages,
    directMessages,
    tasks,
    total: messages + tasks,
  }
}
