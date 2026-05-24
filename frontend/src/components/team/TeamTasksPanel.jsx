import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { formatDateTime } from '../../lib/crmUiConstants'
import LeadMentionTextarea, { MentionBody } from './LeadMentionTextarea'
import LoadingExperience from '../ui/LoadingExperience'
import { LOADING_MESSAGES } from '../../lib/loadingQuotes'

export default function TeamTasksPanel({ onNavigate }) {
  const { user, teamMembers, refreshTeam, openPipelineLead } = useApp()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [assigneeUserId, setAssigneeUserId] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [dueAt, setDueAt] = useState('')

  const members = useMemo(
    () => (teamMembers || []).filter((m) => m.userId !== user?.id && m.status === 'active'),
    [teamMembers, user?.id]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.listTeamTasks()
      setTasks(data.tasks || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshTeam?.()
    load()
  }, [load, refreshTeam])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(t)
  }, [notice])

  const createTask = async () => {
    if (!assigneeUserId) return setError('Choose a team member')
    if (!title.trim()) return setError('Task title is required')
    setBusy(true)
    setError(null)
    try {
      const data = await api.createTeamTask({
        assigneeUserId,
        title: title.trim(),
        body: body.trim(),
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      })
      setTitle('')
      setBody('')
      setDueAt('')
      setNotice(data.emailSent ? 'Task assigned — teammate notified by email' : 'Task created')
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const completeTask = async (id) => {
    setBusy(true)
    try {
      await api.completeTeamTask(id)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const openLead = (leadId) => {
    openPipelineLead(leadId, 'overview')
    onNavigate?.('pipeline')
  }

  if (user?.accountType !== 'company' || !user?.organizationId) {
    return (
      <div className="p-8 text-center text-sm text-gray-500">
        Team tasks are available on company accounts with teammates.
      </div>
    )
  }

  const openTasks = tasks.filter((t) => t.status !== 'done')
  const doneTasks = tasks.filter((t) => t.status === 'done')

  return (
    <div className="panel-shell bg-[#fafafa]">
      <header className="shrink-0 px-4 sm:px-6 py-4 border-b border-gray-200 bg-white">
        <h1 className="text-lg font-semibold text-gray-900">Tasks</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Assign tasks to teammates. Use <span className="font-mono">@</span> to link a customer from pipeline.
        </p>
      </header>

      {(error || notice) && (
        <div className="shrink-0 px-4 sm:px-6 pt-3">
          {error && <p className="text-xs text-red-800 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
          {notice && (
            <p className="text-xs text-green-900 bg-green-50 border border-green-100 rounded-lg px-3 py-2 mt-2">{notice}</p>
          )}
        </div>
      )}

      <div className="panel-body-scroll px-4 sm:px-6 py-4 grid lg:grid-cols-2 gap-6 max-w-6xl">
        <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">New task</h2>
          <select
            value={assigneeUserId}
            onChange={(e) => setAssigneeUserId(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
          >
            <option value="">Assign to…</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name || m.email}
              </option>
            ))}
          </select>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
          />
          <LeadMentionTextarea
            value={body}
            onChange={setBody}
            placeholder="Details — e.g. Follow up with @Customer Name"
            rows={4}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
            disabled={busy}
          />
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
          />
          <button
            type="button"
            disabled={busy}
            onClick={createTask}
            className="text-xs font-semibold px-3 py-2 bg-gray-900 text-white rounded-lg disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Assign task'}
          </button>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Open ({openTasks.length})</h2>
            {loading ? (
              <LoadingExperience message={LOADING_MESSAGES.tasks} compact fill={false} className="rounded-xl border border-gray-200" />
            ) : !openTasks.length ? (
              <p className="text-sm text-gray-500">No open tasks.</p>
            ) : (
              openTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  user={user}
                  busy={busy}
                  onComplete={completeTask}
                  onLeadClick={openLead}
                />
              ))
            )}
          </div>
          {doneTasks.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-900 mb-2">Done</h2>
              {doneTasks.slice(0, 8).map((task) => (
                <TaskCard key={task.id} task={task} user={user} onLeadClick={openLead} done />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function TaskCard({ task, user, busy, onComplete, onLeadClick, done = false }) {
  const mine = task.assigneeUserId === user.id
  return (
    <article className="bg-white border border-gray-200 rounded-lg px-3 py-3 text-sm mb-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-gray-900">{task.title}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {mine ? 'Assigned to you' : `From ${task.authorName}`} · {formatDateTime(task.createdAt)}
            {task.dueAt && ` · Due ${formatDateTime(task.dueAt)}`}
          </p>
        </div>
        {done && (
          <span className="text-[10px] font-bold uppercase text-green-700 bg-green-50 px-2 py-0.5 rounded">Done</span>
        )}
      </div>
      {task.body && <MentionBody body={task.body} onLeadClick={onLeadClick} className="text-gray-700 mt-2 text-sm" />}
      {!done && mine && onComplete && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onComplete(task.id)}
          className="mt-2 text-xs font-semibold text-gray-900 underline disabled:opacity-50"
        >
          Mark done
        </button>
      )}
    </article>
  )
}
