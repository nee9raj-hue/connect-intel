import { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import {
  CRM_STATUSES,
  EMAIL_PURPOSES,
  formatCrmDate,
  getStatusMeta,
} from '../../lib/crmConstants'
import {
  ACTIVITY_LABELS,
  MEETING_TYPES,
  formatDateTime,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from '../../lib/crmUiConstants'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'notes', label: 'Notes & log' },
  { id: 'schedule', label: 'Tasks & meetings' },
  { id: 'email', label: 'Email' },
]

export default function LeadWorkspace({ lead, onClose, statusOptions = CRM_STATUSES }) {
  const { user, teamMembers, assignLead, updateSavedLeadCrm, patchLead, generateEmailDraft, logCrmEmailSend } =
    useApp()
  const [tab, setTab] = useState('overview')
  const [notes, setNotes] = useState(lead.crm?.notes || '')
  const [status, setStatus] = useState(lead.crm?.status || 'new')
  const [nextFollowUp, setNextFollowUp] = useState(toDatetimeLocalValue(lead.crm?.nextFollowUpAt))
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [purpose, setPurpose] = useState('introduction')
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [orgEmail, setOrgEmail] = useState(null)
  const [gmailStatus, setGmailStatus] = useState({ connected: false, mailbox: null })
  const [connectingGmail, setConnectingGmail] = useState(false)
  const [showGmailOptional, setShowGmailOptional] = useState(false)
  const [emailAgenda, setEmailAgenda] = useState('')
  const [emailKeyPoints, setEmailKeyPoints] = useState('')
  const [senderCompany, setSenderCompany] = useState(user?.organizationName || user?.company || '')
  const [draftAi, setDraftAi] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDue, setTaskDue] = useState('')
  const [taskAssignee, setTaskAssignee] = useState(user?.id || '')
  const [meetingTitle, setMeetingTitle] = useState('')
  const [meetingWhen, setMeetingWhen] = useState('')
  const [meetingType, setMeetingType] = useState('call')
  const [meetingLocation, setMeetingLocation] = useState('')
  const [meetingNotes, setMeetingNotes] = useState('')
  const [meetingAssignee, setMeetingAssignee] = useState(user?.id || '')
  const [logCallNote, setLogCallNote] = useState('')
  const [visitMeetingId, setVisitMeetingId] = useState('')
  const [visitNotes, setVisitNotes] = useState('')
  const [visitOutcome, setVisitOutcome] = useState('completed')

  const isManager = user?.isOrgAdmin || user?.orgRole === 'org_admin'
  const crm = lead.crm || {}
  const statusMeta = getStatusMeta(status)

  useEffect(() => {
    setNotes(lead.crm?.notes || '')
    setStatus(lead.crm?.status || 'new')
    setNextFollowUp(toDatetimeLocalValue(lead.crm?.nextFollowUpAt))
    setError(null)
    setNotice(null)
    setTab('overview')
    setSenderCompany(user?.organizationName || user?.company || '')
  }, [lead.id, user?.organizationName, user?.company])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 5000)
    return () => clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (tab !== 'email') return
    api
      .getOrgEmailDomain()
      .then((data) => setOrgEmail(data))
      .catch(() => setOrgEmail(null))
    api
      .getCrmGmailStatus()
      .then((data) => setGmailStatus({ connected: data.connected, mailbox: data.mailbox }))
      .catch(() => setGmailStatus({ connected: false, mailbox: null }))
  }, [tab, lead.id, user?.orgOutboundEmailReady])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('crm_gmail') !== 'connected') return
    const mailbox = params.get('mailbox')
    setNotice(mailbox ? `Work Gmail connected (${mailbox})` : 'Work Gmail connected')
    params.delete('crm_gmail')
    params.delete('mailbox')
    const qs = params.toString()
    window.history.replaceState({}, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname)
    api
      .getCrmGmailStatus()
      .then((data) => setGmailStatus({ connected: data.connected, mailbox: data.mailbox }))
      .catch(() => {})
    setTab('email')
  }, [])

  const runPatch = async (body, okMsg) => {
    if (saving) return false
    setSaving(true)
    setError(null)
    try {
      await patchLead(lead.id, body)
      if (okMsg) setNotice(okMsg)
      return true
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setSaving(false)
    }
  }

  const saveNotes = async () => {
    await runPatch({ crm: { notes } }, 'Notes saved')
  }

  const saveNextFollowUp = async () => {
    await runPatch(
      { crm: { nextFollowUpAt: fromDatetimeLocalValue(nextFollowUp) } },
      'Follow-up date saved'
    )
  }

  const changeStatus = async (next) => {
    setStatus(next)
    try {
      await updateSavedLeadCrm(lead.id, { status: next })
    } catch (e) {
      setError(e.message)
      setStatus(lead.crm?.status || 'new')
    }
  }

  const logCall = async () => {
    if (!logCallNote.trim() || saving) return
    const ok = await runPatch(
      { activity: { type: 'call', summary: logCallNote.trim() } },
      'Call logged'
    )
    if (ok) setLogCallNote('')
  }

  const addTask = async (e) => {
    e.preventDefault()
    if (!taskTitle.trim() || saving) return
    const ok = await runPatch(
      {
        task: {
          action: 'add',
          title: taskTitle.trim(),
          dueAt: fromDatetimeLocalValue(taskDue),
          assignedToUserId: isManager ? taskAssignee : user.id,
        },
      },
      'Task saved'
    )
    if (ok) {
      setTaskTitle('')
      setTaskDue('')
    }
  }

  const addMeeting = async (e) => {
    e.preventDefault()
    if (saving) return
    if (!meetingWhen) {
      setError('Pick date and time')
      return
    }
    const ok = await runPatch(
      {
        meeting: {
          action: 'add',
          title: meetingTitle.trim() || 'Meeting',
          scheduledAt: fromDatetimeLocalValue(meetingWhen),
          type: meetingType,
          location: meetingLocation,
          notes: meetingNotes,
          assignedToUserId: isManager ? meetingAssignee : user.id,
        },
      },
      'Meeting scheduled — reminder 30 min before'
    )
    if (ok) {
      setMeetingTitle('')
      setMeetingWhen('')
      setMeetingLocation('')
      setMeetingNotes('')
    }
  }

  const recordVisit = async (e) => {
    e.preventDefault()
    if (saving) return
    const mid = visitMeetingId || crm.meetings?.find((m) => m.type === 'field_visit' && !m.visitRecordedAt)?.id
    if (!mid) {
      setError('Select a field visit meeting')
      return
    }
    const ok = await runPatch(
      {
        fieldVisit: {
          meetingId: mid,
          outcome: visitOutcome,
          notes: visitNotes,
          location: meetingLocation,
        },
      },
      'Field visit recorded'
    )
    if (ok) setVisitNotes('')
  }

  const completeTask = async (taskId) => {
    if (saving) return
    await runPatch({ task: { action: 'complete', taskId } }, 'Task completed')
  }

  const connectWorkGmail = async () => {
    setConnectingGmail(true)
    setError(null)
    try {
      const data = await api.startCrmGmailOAuth()
      if (data.url) window.location.href = data.url
      else setError('Could not start Gmail connection')
    } catch (e) {
      setError(e.message)
    } finally {
      setConnectingGmail(false)
    }
  }

  const handleGenerate = async () => {
    if (emailAgenda.trim().length < 8) {
      setError('Describe your email goal (agenda) in a few words before generating a draft')
      return
    }
    setGenerating(true)
    setError(null)
    try {
      const data = await generateEmailDraft(lead.id, {
        purpose,
        tone: 'professional',
        agenda: emailAgenda.trim(),
        keyPoints: emailKeyPoints.trim(),
        senderCompany: senderCompany.trim(),
        senderName: user?.name,
      })
      setSubject(data.draft.subject || '')
      setBody(data.draft.body || '')
      setDraftAi(Boolean(data.draft.aiGenerated))
      if (data.draft.notice) setNotice(data.draft.notice)
      else setNotice('Email draft ready — review and edit before sending')
      setTab('email')
    } catch (e) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      setError('Add subject and message')
      return
    }
    const canSend = orgEmail?.userCanSend || user?.orgOutboundEmailReady || gmailStatus.connected
    if (!canSend) {
      setError(
        orgEmail?.hint ||
          'Company email is not ready. Ask your admin to open Team → Outbound email (DNS setup is automatic).'
      )
      return
    }
    if (sending) return
    setSending(true)
    setError(null)
    try {
      const data = await logCrmEmailSend(lead.id, {
        subject: subject.trim(),
        body: body.trim(),
        aiGenerated: draftAi,
      })
      setSubject('')
      setBody('')
      setDraftAi(false)
      const from = data.mailbox || user?.email
      const via = data.provider === 'org_resend' ? 'company email' : 'Gmail'
      setNotice(from ? `Email sent from ${from} (${via}) and logged in CRM` : 'Email sent and logged in CRM')
      api.getOrgEmailDomain().then((d) => setOrgEmail(d)).catch(() => {})
    } catch (e) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  const canSendEmail = Boolean(orgEmail?.userCanSend || user?.orgOutboundEmailReady || gmailStatus.connected)
  const busy = saving || sending || generating || connectingGmail

  return (
    <aside className="fixed inset-0 z-40 md:static md:inset-auto md:w-full md:max-w-[420px] shrink-0 bg-white flex flex-col h-full shadow-xl md:shadow-none border-l border-gray-200">
      <div className="shrink-0 px-4 py-3 border-b border-gray-100">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-semibold text-gray-900 truncate">
              {[lead.firstName, lead.lastName].filter(Boolean).join(' ')}
            </h2>
            <p className="text-xs text-gray-500 truncate">
              {lead.title} · {lead.company}
            </p>
            <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded border ${statusMeta.color}`}>
              {statusMeta.label}
            </span>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-800 text-2xl leading-none px-1" aria-label="Close">
            ×
          </button>
        </div>
        <div className="flex gap-1 mt-3 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-md ${
                tab === t.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {(notice || saving) && (
          <div
            className={`mt-2 text-xs font-medium rounded-lg px-2.5 py-1.5 border ${
              saving
                ? 'bg-amber-50 text-amber-900 border-amber-200'
                : 'bg-green-50 text-green-900 border-green-200'
            }`}
            role="status"
          >
            {saving ? 'Saving…' : notice}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {tab === 'overview' && (
          <>
            <section>
              <h3 className="text-[11px] font-semibold uppercase text-gray-400 mb-2">Pipeline status</h3>
              <select value={status} onChange={(e) => changeStatus(e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2">
                {statusOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </section>

            {isManager && user?.accountType === 'company' && teamMembers.length > 0 && (
              <section>
                <h3 className="text-[11px] font-semibold uppercase text-gray-400 mb-2">Transfer / assign lead</h3>
                <select
                  value={lead.assignedToUserId || ''}
                  onChange={async (e) => {
                    try {
                      await assignLead(lead.id, e.target.value || null)
                      setNotice('Lead assigned')
                    } catch (err) {
                      setError(err.message)
                    }
                  }}
                  className="w-full text-sm border rounded-lg px-3 py-2"
                >
                  <option value="">Unassigned</option>
                  {teamMembers.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </section>
            )}

            <section className="grid grid-cols-1 gap-2 text-xs">
              <Info label="Last communication" value={formatDateTime(crm.lastCommunicationAt)} />
              <Info label="Type" value={ACTIVITY_LABELS[crm.lastCommunicationType] || '—'} />
              <Info label="Summary" value={crm.lastCommunicationSummary || '—'} />
              <Info label="Next follow-up" value={formatDateTime(crm.nextFollowUpAt)} />
              <Info label="Last email" value={formatCrmDate(crm.lastEmailSentAt)} />
            </section>

            <section>
              <h3 className="text-[11px] font-semibold uppercase text-gray-400 mb-2">Next call / follow-up time</h3>
              <input
                type="datetime-local"
                value={nextFollowUp}
                onChange={(e) => setNextFollowUp(e.target.value)}
                onBlur={saveNextFollowUp}
                className="w-full text-sm border rounded-lg px-3 py-2"
              />
            </section>

            <section>
              <h3 className="text-[11px] font-semibold uppercase text-gray-400 mb-2">Log a call</h3>
              <textarea
                value={logCallNote}
                onChange={(e) => setLogCallNote(e.target.value)}
                rows={2}
                placeholder="Call summary…"
                className="w-full text-sm border rounded-lg px-3 py-2"
              />
              <button
                type="button"
                onClick={logCall}
                disabled={busy}
                className="mt-2 text-xs font-semibold px-3 py-1.5 bg-gray-900 text-white rounded-lg disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save call to log'}
              </button>
            </section>
          </>
        )}

        {tab === 'notes' && (
          <>
            <section>
              <h3 className="text-[11px] font-semibold uppercase text-gray-400 mb-2">Customer notes</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={saveNotes}
                rows={5}
                placeholder="Requirements, pricing, decision makers…"
                className="w-full text-sm border rounded-lg px-3 py-2"
              />
            </section>
            <section>
              <h3 className="text-[11px] font-semibold uppercase text-gray-400 mb-2">Activity log</h3>
              <ul className="space-y-2 max-h-[50vh] overflow-y-auto">
                {(crm.activities || []).map((act) => (
                  <li key={act.id} className="text-xs border rounded-lg p-2.5 bg-gray-50">
                    <span className="font-bold text-[#8a6600]">{ACTIVITY_LABELS[act.type] || act.type}</span>
                    <p className="text-gray-800 mt-1">{act.summary}</p>
                    <p className="text-gray-400 mt-1">
                      {act.createdByName} · {formatDateTime(act.createdAt)}
                    </p>
                  </li>
                ))}
                {!crm.activities?.length && <p className="text-xs text-gray-400">No activity yet</p>}
              </ul>
            </section>
          </>
        )}

        {tab === 'schedule' && (
          <>
            <section>
              <h3 className="text-[11px] font-semibold uppercase text-gray-400 mb-2">Tasks</h3>
              <form onSubmit={addTask} className="space-y-2 mb-3">
                <input
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Task title"
                  className="w-full text-sm border rounded-lg px-3 py-2"
                />
                <input
                  type="datetime-local"
                  value={taskDue}
                  onChange={(e) => setTaskDue(e.target.value)}
                  className="w-full text-sm border rounded-lg px-3 py-2"
                />
                {isManager && (
                  <select value={taskAssignee} onChange={(e) => setTaskAssignee(e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2">
                    {teamMembers.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                )}
                <button type="submit" disabled={busy} className="w-full py-2 text-xs font-semibold bg-[#ffcb2b] rounded-lg disabled:opacity-50">
                  {saving ? 'Saving…' : 'Add task'}
                </button>
              </form>
              <ul className="space-y-2">
                {(crm.tasks || []).map((t) => (
                  <li key={t.id} className={`text-xs border rounded-lg p-2 ${t.completedAt ? 'opacity-60' : ''}`}>
                    <p className="font-medium">{t.title}</p>
                    <p className="text-gray-500">Due {formatDateTime(t.dueAt)}</p>
                    {!t.completedAt && (
                      <button type="button" onClick={() => completeTask(t.id)} className="mt-1 text-[#5b4a00] font-semibold underline">
                        Mark done
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="text-[11px] font-semibold uppercase text-gray-400 mb-2">Schedule meeting</h3>
              <form onSubmit={addMeeting} className="space-y-2">
                <input value={meetingTitle} onChange={(e) => setMeetingTitle(e.target.value)} placeholder="Title" className="w-full text-sm border rounded-lg px-3 py-2" />
                <select value={meetingType} onChange={(e) => setMeetingType(e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2">
                  {MEETING_TYPES.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <input type="datetime-local" value={meetingWhen} onChange={(e) => setMeetingWhen(e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2" />
                <input value={meetingLocation} onChange={(e) => setMeetingLocation(e.target.value)} placeholder="Location" className="w-full text-sm border rounded-lg px-3 py-2" />
                <textarea value={meetingNotes} onChange={(e) => setMeetingNotes(e.target.value)} rows={2} placeholder="Agenda" className="w-full text-sm border rounded-lg px-3 py-2" />
                {isManager && (
                  <select value={meetingAssignee} onChange={(e) => setMeetingAssignee(e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2">
                    {teamMembers.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                )}
                <button type="submit" disabled={busy} className="w-full py-2 text-xs font-semibold bg-gray-900 text-white rounded-lg disabled:opacity-50">
                  {saving ? 'Scheduling…' : 'Schedule'}
                </button>
              </form>
            </section>

            <section>
              <h3 className="text-[11px] font-semibold uppercase text-gray-400 mb-2">Record field visit</h3>
              <form onSubmit={recordVisit} className="space-y-2">
                <select value={visitMeetingId} onChange={(e) => setVisitMeetingId(e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2">
                  <option value="">Select scheduled visit</option>
                  {(crm.meetings || [])
                    .filter((m) => m.type === 'field_visit')
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title} · {formatDateTime(m.scheduledAt)}
                      </option>
                    ))}
                </select>
                <select value={visitOutcome} onChange={(e) => setVisitOutcome(e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2">
                  <option value="completed">Completed</option>
                  <option value="rescheduled">Rescheduled</option>
                  <option value="no_show">No show</option>
                </select>
                <textarea value={visitNotes} onChange={(e) => setVisitNotes(e.target.value)} rows={3} placeholder="Visit notes, outcomes, next steps…" className="w-full text-sm border rounded-lg px-3 py-2" />
                <button type="submit" disabled={busy} className="w-full py-2 text-xs font-semibold border-2 border-[#ffcb2b] rounded-lg disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save field visit report'}
                </button>
              </form>
            </section>

            <ul className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase text-gray-400">Upcoming</h3>
              {(crm.meetings || []).map((m) => (
                <li key={m.id} className="text-xs border rounded-lg p-2 bg-[#fffbeb]">
                  <p className="font-medium">{m.title}</p>
                  <p>{formatDateTime(m.scheduledAt)} · {m.type}</p>
                  {m.visitRecordedAt && <p className="text-green-700">Visit logged</p>}
                </li>
              ))}
            </ul>
          </>
        )}

        {tab === 'email' && (
          <>
            <section className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
              <h3 className="text-[11px] font-semibold uppercase text-gray-500">Sending from your company</h3>
              {canSendEmail ? (
                <p className="text-xs text-green-800">
                  Ready — emails send as <span className="font-semibold">{user?.email}</span> from your company domain (unlimited teammates, no Google test-user list).
                </p>
              ) : (
                <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 leading-relaxed">
                  {orgEmail?.hint ||
                    (isManager
                      ? 'Open Team → Outbound email — we register your domain and show DNS records automatically.'
                      : 'Ask your company admin to complete Team → Outbound email (one-time DNS).')}
                </p>
              )}
              <button
                type="button"
                onClick={() => setShowGmailOptional((v) => !v)}
                className="text-[11px] text-gray-500 underline"
              >
                {showGmailOptional ? 'Hide' : 'Optional: also use personal Gmail OAuth'}
              </button>
              {showGmailOptional && (
                <div className="pt-1 space-y-2 border-t border-gray-200">
                  {gmailStatus.connected ? (
                    <p className="text-xs text-gray-600">Gmail connected ({gmailStatus.mailbox}) — used if domain sending is unavailable.</p>
                  ) : (
                    <>
                      <p className="text-[11px] text-gray-500">
                        Requires Google to verify Connect Intel for all users (platform one-time). Prefer company domain sending above.
                      </p>
                      <button
                        type="button"
                        onClick={connectWorkGmail}
                        disabled={busy}
                        className="w-full py-2 text-xs font-semibold bg-white border border-gray-300 rounded-lg disabled:opacity-50"
                      >
                        {connectingGmail ? 'Opening Google…' : 'Connect Gmail (optional)'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-[11px] font-semibold uppercase text-gray-400">What should this email say?</h3>
              <input
                value={senderCompany}
                onChange={(e) => setSenderCompany(e.target.value)}
                placeholder="Your company name"
                className="w-full text-sm border rounded-lg px-3 py-2"
              />
              <textarea
                value={emailAgenda}
                onChange={(e) => setEmailAgenda(e.target.value)}
                rows={3}
                placeholder="Agenda (required): e.g. Introduce Alvar Fresh organic snacks to US boutique buyers; ask for 15-min call next week"
                className="w-full text-sm border rounded-lg px-3 py-2"
              />
              <textarea
                value={emailKeyPoints}
                onChange={(e) => setEmailKeyPoints(e.target.value)}
                rows={2}
                placeholder="Key points (optional): pricing, certifications, trade show, etc."
                className="w-full text-sm border rounded-lg px-3 py-2"
              />
            </section>

            <div className="flex gap-2">
              <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className="flex-1 text-xs border rounded-lg px-2 py-1.5">
                {EMAIL_PURPOSES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={busy || emailAgenda.trim().length < 8}
                className="text-xs font-semibold px-3 py-1.5 bg-[#fff6d6] border border-[#ffe48a] rounded-lg disabled:opacity-50"
              >
                {generating ? 'Drafting…' : '✨ AI draft'}
              </button>
            </div>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="w-full text-sm border rounded-lg px-3 py-2" />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} className="w-full text-sm border rounded-lg px-3 py-2 font-mono text-[12px]" />
            <button
              type="button"
              onClick={handleSend}
              disabled={busy || !canSendEmail}
              className="w-full py-2.5 text-sm font-semibold bg-gray-900 text-white rounded-lg disabled:opacity-50"
            >
              {sending ? 'Sending…' : 'Send email & log in CRM'}
            </button>
            {crm.emails?.length > 0 && (
              <ul className="space-y-2 pt-2">
                {crm.emails.slice(0, 6).map((email) => (
                  <li key={email.id} className="text-xs border rounded-lg p-2 bg-gray-50">
                    <div className="font-medium truncate">{email.subject}</div>
                    <div className="text-gray-500">{formatCrmDate(email.sentAt)}</div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {error && <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-2 py-1.5">{error}</p>}
      </div>

      <div className="shrink-0 px-4 py-2 border-t text-[10px] text-gray-400">
        {lead.email || 'No email'} · {lead.phone || 'No phone'}
      </div>
    </aside>
  )
}

function Info({ label, value }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-2">
      <div className="text-gray-400">{label}</div>
      <div className="font-medium text-gray-800 mt-0.5 break-words">{value}</div>
    </div>
  )
}
