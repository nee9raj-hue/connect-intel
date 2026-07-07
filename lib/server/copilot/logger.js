import { createId } from '../store.js'

const MAX_LOG = 30

export function appendCopilotLog(thread, entry) {
  if (!thread) return
  thread.copilotLog = thread.copilotLog || []
  thread.copilotLog.push({
    id: createId('clog'),
    at: new Date().toISOString(),
    ...entry,
  })
  if (thread.copilotLog.length > MAX_LOG) {
    thread.copilotLog = thread.copilotLog.slice(-MAX_LOG)
  }
}
