import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { formatDateTime } from '../../lib/crmUiConstants'
import LeadMentionTextarea, { MentionBody } from './LeadMentionTextarea'
import LoadingExperience from '../ui/LoadingExperience'
import { LOADING_MESSAGES } from '../../lib/loadingQuotes'

export default function TeamNotesPanel({ onNavigate }) {
  const { user, teamMembers, refreshTeam, openPipelineLead } = useApp()
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [recipientUserId, setRecipientUserId] = useState('')
  const [body, setBody] = useState('')

  const members = useMemo(
    () => (teamMembers || []).filter((m) => m.userId !== user?.id && m.status === 'active'),
    [teamMembers, user?.id]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.listTeamNotes()
      setNotes(data.notes || [])
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

  const sendNote = async () => {
    if (!recipientUserId) return setError('Choose a team member')
    if (!body.trim()) return setError('Write a note')
    setBusy(true)
    setError(null)
    try {
      const data = await api.createTeamNote({ recipientUserId, body: body.trim() })
      setBody('')
      setNotice(data.emailSent ? 'Note sent — teammate notified by email' : 'Note saved')
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
        Team notes are available on company accounts with teammates.
      </div>
    )
  }

  return (
    <div className="panel-shell bg-[#fafafa]">
      <header className="shrink-0 px-4 sm:px-6 py-4 border-b border-gray-200 bg-white">
        <h1 className="text-lg font-semibold text-gray-900">Notes</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Share notes with teammates. Type <span className="font-mono">@</span> to mention a customer from your pipeline.
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
          <h2 className="text-sm font-semibold text-gray-900">New note</h2>
          <select
            value={recipientUserId}
            onChange={(e) => setRecipientUserId(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
          >
            <option value="">Send to teammate…</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name || m.email}
              </option>
            ))}
          </select>
          <LeadMentionTextarea
            value={body}
            onChange={setBody}
            placeholder="Example: Please connect with @Customer Name this week"
            rows={5}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
            disabled={busy}
          />
          <button
            type="button"
            disabled={busy}
            onClick={sendNote}
            className="text-xs font-semibold px-3 py-2 bg-gray-900 text-white rounded-lg disabled:opacity-50"
          >
            {busy ? 'Sending…' : 'Send note'}
          </button>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-900">Inbox & sent</h2>
          {loading ? (
            <LoadingExperience message={LOADING_MESSAGES.notes} compact fill={false} className="rounded-xl border border-gray-200" />
          ) : !notes.length ? (
            <p className="text-sm text-gray-500">No notes yet.</p>
          ) : (
            notes.map((note) => {
              const mine = note.authorUserId === user.id
              return (
                <article key={note.id} className="bg-white border border-gray-200 rounded-lg px-3 py-3 text-sm">
                  <p className="text-xs text-gray-500">
                    {mine ? 'To teammate' : `From ${note.authorName}`} · {formatDateTime(note.createdAt)}
                  </p>
                  <MentionBody body={note.body} onLeadClick={openLead} className="text-gray-800 mt-1 text-sm" />
                </article>
              )
            })
          )}
        </section>
      </div>
    </div>
  )
}
