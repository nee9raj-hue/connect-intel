import { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { buildWhatsAppUrl, leadHasCallablePhone } from '../../lib/phoneUtils'
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
import TeamParticipantPicker from './TeamParticipantPicker'
import CrmEmailThread from './CrmEmailThread'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'notes', label: 'Notes & log' },
  { id: 'schedule', label: 'Tasks & meetings' },
  { id: 'email', label: 'Email' },
  { id: 'whatsapp', label: 'WhatsApp' },
]

export default function LeadWorkspace({ lead, onClose, statusOptions = CRM_STATUSES }) {
  const {
    user,
    teamMembers,
    assignLead,
    updateSavedLeadCrm,
    patchLead,
    generateEmailDraft,
    logCrmEmailSend,
    syncEmailThread,
    logEmailReply,
    generateWhatsAppDraft,
    refreshTeam,
  } = useApp()
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
  const [gmailStatus, setGmailStatus] = useState({
    connected: false,
    mailbox: null,
    replySyncEnabled: false,
  })
  const [threadSyncing, setThreadSyncing] = useState(false)
  const [connectingGmail, setConnectingGmail] = useState(false)
  const [emailAgenda, setEmailAgenda] = useState('')
  const [emailKeyPoints, setEmailKeyPoints] = useState('')
  const [senderCompany, setSenderCompany] = useState(user?.organizationName || user?.company || '')
  const [draftAi, setDraftAi] = useState(false)
  const [emailCc, setEmailCc] = useState('')
  const [waMessage, setWaMessage] = useState('')
  const [waAgenda, setWaAgenda] = useState('')
  const [waKeyPoints, setWaKeyPoints] = useState('')
  const [waGenerating, setWaGenerating] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDue, setTaskDue] = useState('')
  const [taskAssignee, setTaskAssignee] = useState(user?.id || '')
  const [meetingTitle, setMeetingTitle] = useState('')
  const [meetingWhen, setMeetingWhen] = useState('')
  const [meetingType, setMeetingType] = useState('call')
  const [meetingLocation, setMeetingLocation] = useState('')
  const [meetingNotes, setMeetingNotes] = useState('')
  const [meetingAssignee, setMeetingAssignee] = useState(user?.id || '')
  const [taskParticipants, setTaskParticipants] = useState([])
  const [meetingParticipants, setMeetingParticipants] = useState([])
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
    if (tab === 'schedule' && user?.accountType === 'company') {
      refreshTeam()
    }
  }, [tab, user?.accountType, refreshTeam])

  useEffect(() => {
    if (tab !== 'email') return
    api
      .getOrgEmailDomain()
      .then((data) => setOrgEmail(data))
      .catch(() => setOrgEmail(null))
    api
      .getCrmGmailStatus()
      .then((data) =>
        setGmailStatus({
          connected: data.connected,
          mailbox: data.mailbox,
          replySyncEnabled: Boolean(data.replySyncEnabled),
        })
      )
      .catch(() => setGmailStatus({ connected: false, mailbox: null, replySyncEnabled: false }))
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
      .then((data) =>
        setGmailStatus({
          connected: data.connected,
          mailbox: data.mailbox,
          replySyncEnabled: Boolean(data.replySyncEnabled),
        })
      )
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
    setError(null)
    try {
      await updateSavedLeadCrm(lead.id, { status: next })
      setNotice('Contact updated successfully.')
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
    if (!taskDue) {
      setError('Pick a due date so the task appears on the calendar')
      return
    }
    const ok = await runPatch(
      {
        task: {
          action: 'add',
          title: taskTitle.trim(),
          dueAt: fromDatetimeLocalValue(taskDue),
          assignedToUserId: isManager ? taskAssignee : user.id,
          participantUserIds: taskParticipants.filter((id) => id !== (isManager ? taskAssignee : user.id)),
        },
      },
      'Task saved'
    )
    if (ok) {
      setTaskTitle('')
      setTaskDue('')
      setTaskParticipants([])
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
          participantUserIds: meetingParticipants.filter(
            (id) => id !== (isManager ? meetingAssignee : user.id)
          ),
        },
      },
      'Meeting scheduled — reminder 30 min before'
    )
    if (ok) {
      setMeetingTitle('')
      setMeetingWhen('')
      setMeetingLocation('')
      setMeetingNotes('')
      setMeetingParticipants([])
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
    const canSend = gmailStatus.connected || orgEmail?.userCanSend || user?.orgOutboundEmailReady
    if (!canSend) {
      setError('Connect work Gmail above, or ask admin to complete optional DNS sending in Team.')
      return
    }
    if (sending) return
    setSending(true)
    setError(null)
    try {
      const data = await logCrmEmailSend(lead.id, {
        subject: subject.trim(),
        body: body.trim(),
        cc: emailCc.trim(),
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

  const handleSyncEmailThread = async () => {
    setThreadSyncing(true)
    setError(null)
    try {
      const data = await syncEmailThread(lead.id)
      setNotice(
        data.importedCount > 0
          ? `Synced ${data.importedCount} message(s) from Gmail`
          : 'No new messages found in the last 90 days'
      )
      const status = await api.getCrmGmailStatus()
      setGmailStatus({
        connected: status.connected,
        mailbox: status.mailbox,
        replySyncEnabled: Boolean(status.replySyncEnabled),
      })
    } catch (e) {
      setError(e.message)
    } finally {
      setThreadSyncing(false)
    }
  }

  const handleLogReply = async ({ subject: replySubj, body: replyBody }) => {
    setThreadSyncing(true)
    setError(null)
    try {
      await logEmailReply(lead.id, { subject: replySubj, body: replyBody })
      setNotice('Reply logged — lead marked as replied')
    } catch (e) {
      setError(e.message)
    } finally {
      setThreadSyncing(false)
    }
  }

  const canSendEmail = Boolean(gmailStatus.connected || orgEmail?.userCanSend || user?.orgOutboundEmailReady)
  const busy = saving || sending || generating || connectingGmail || waGenerating || threadSyncing
  const hasLeadPhone = leadHasCallablePhone(lead)

  const handleGenerateWhatsApp = async () => {
    if (waAgenda.trim().length < 8) {
      setError('Describe your WhatsApp goal (agenda) in a few words')
      return
    }
    setWaGenerating(true)
    setError(null)
    try {
      const data = await generateWhatsAppDraft(lead.id, {
        agenda: waAgenda.trim(),
        keyPoints: waKeyPoints.trim(),
        senderCompany: senderCompany.trim(),
        senderName: user?.name,
        purpose,
        tone: 'professional',
      })
      setWaMessage(data.draft?.message || '')
      setTab('whatsapp')
      setNotice('WhatsApp draft ready')
    } catch (e) {
      setError(e.message)
    } finally {
      setWaGenerating(false)
    }
  }

  const openWhatsApp = async () => {
    if (!waMessage.trim()) {
      setError('Write or generate a message first')
      return
    }
    const url = buildWhatsAppUrl(lead.phone, waMessage.trim())
    if (!url) {
      setError('Lead has no valid phone number for WhatsApp')
      return
    }
    try {
      await patchLead(lead.id, {
        activity: { type: 'whatsapp', summary: `WhatsApp: ${waMessage.trim().slice(0, 120)}` },
      })
      setNotice('WhatsApp opened — send from your app')
    } catch {
      // still open wa
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

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
                    setError(null)
                    try {
                      await assignLead(lead.id, e.target.value || null)
                      setNotice(
                        e.target.value ? 'Contact assigned successfully.' : 'Contact unassigned.'
                      )
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
                  required
                  className="w-full text-sm border rounded-lg px-3 py-2"
                />
                <p className="text-[10px] text-gray-400">Due date appears on team calendar</p>
                {isManager && teamMembers.length > 0 && (
                  <select value={taskAssignee} onChange={(e) => setTaskAssignee(e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2">
                    {teamMembers.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                )}
                {teamMembers.length > 0 && (
                  <TeamParticipantPicker
                    members={teamMembers}
                    primaryUserId={isManager ? taskAssignee : user.id}
                    value={taskParticipants}
                    onChange={setTaskParticipants}
                  />
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
                    {(t.participantUserIds?.length > 1 || (t.participantUserIds?.length === 1 && t.participantUserIds[0] !== t.assignedToUserId)) && (
                      <p className="text-gray-400 mt-0.5">
                        With{' '}
                        {t.participantUserIds
                          .filter((id) => id !== t.assignedToUserId)
                          .map((id) => teamMembers.find((m) => m.userId === id)?.name || 'teammate')
                          .join(', ') || 'team'}
                      </p>
                    )}
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
                {isManager && teamMembers.length > 0 && (
                  <select value={meetingAssignee} onChange={(e) => setMeetingAssignee(e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2">
                    {teamMembers.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                )}
                {teamMembers.length > 0 && (
                  <TeamParticipantPicker
                    members={teamMembers}
                    primaryUserId={isManager ? meetingAssignee : user.id}
                    value={meetingParticipants}
                    onChange={setMeetingParticipants}
                    label="Also attending (team)"
                  />
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
                  {(m.participantUserIds?.length > 1 ||
                    (m.participantUserIds?.length === 1 && m.participantUserIds[0] !== m.assignedToUserId)) && (
                    <p className="text-gray-500 mt-0.5">
                      With{' '}
                      {m.participantUserIds
                        .filter((id) => id !== m.assignedToUserId)
                        .map((id) => teamMembers.find((tm) => tm.userId === id)?.name || 'teammate')
                        .join(', ')}
                    </p>
                  )}
                  {m.visitRecordedAt && <p className="text-green-700">Visit logged</p>}
                </li>
              ))}
            </ul>
          </>
        )}

        {tab === 'email' && (
          <>
            {!canSendEmail && (
              <section className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                <h3 className="text-[11px] font-semibold uppercase text-amber-900">Connect email to send</h3>
                <p className="text-xs text-amber-900 leading-relaxed">
                  Connect work Gmail (recommended, no DNS), or ask your admin for Team → DNS setup.
                </p>
                <button
                  type="button"
                  onClick={connectWorkGmail}
                  disabled={busy}
                  className="w-full py-2 text-xs font-semibold bg-[#ffcb2b] text-[#242424] rounded-lg disabled:opacity-50"
                >
                  {connectingGmail ? 'Opening Google…' : 'Connect work Gmail'}
                </button>
                {(orgEmail?.userCanSend || user?.orgOutboundEmailReady) && (
                  <p className="text-[10px] text-gray-600">DNS domain sending is also available for your company.</p>
                )}
              </section>
            )}

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
            <input
              value={emailCc}
              onChange={(e) => setEmailCc(e.target.value)}
              placeholder="Cc (optional): name@company.com, teammate@company.com"
              className="w-full text-sm border rounded-lg px-3 py-2"
            />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} className="w-full text-sm border rounded-lg px-3 py-2 font-mono text-[12px]" />
            <button
              type="button"
              onClick={handleSend}
              disabled={busy || !canSendEmail}
              className="w-full py-2.5 text-sm font-semibold bg-gray-900 text-white rounded-lg disabled:opacity-50"
            >
              {sending ? 'Sending…' : 'Send email & log in CRM'}
            </button>

            <CrmEmailThread
              lead={lead}
              emails={crm.emails || []}
              gmailConnected={gmailStatus.connected}
              replySyncEnabled={gmailStatus.replySyncEnabled}
              busy={threadSyncing || sending}
              enableReplySyncBusy={connectingGmail}
              onEnableReplySync={connectWorkGmail}
              onSync={handleSyncEmailThread}
              onLogReply={handleLogReply}
            />
          </>
        )}

        {tab === 'whatsapp' && (
          <>
            <p className="text-xs text-gray-600">
              Sends from <strong>your WhatsApp</strong> ({user?.mobile || 'add mobile in profile'}) to{' '}
              <strong>{lead.phone || 'no phone on lead'}</strong>.
            </p>
            {!hasLeadPhone && (
              <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
                This lead needs a valid phone number on the record.
              </p>
            )}
            <textarea
              value={waAgenda}
              onChange={(e) => setWaAgenda(e.target.value)}
              rows={2}
              placeholder="Agenda (required for AI): e.g. follow up on export quote"
              className="w-full text-sm border rounded-lg px-3 py-2"
            />
            <textarea
              value={waKeyPoints}
              onChange={(e) => setWaKeyPoints(e.target.value)}
              rows={2}
              placeholder="Key points (optional)"
              className="w-full text-sm border rounded-lg px-3 py-2"
            />
            <button
              type="button"
              onClick={handleGenerateWhatsApp}
              disabled={busy || waAgenda.trim().length < 8}
              className="w-full py-2 text-xs font-semibold bg-[#fff6d6] border border-[#ffe48a] rounded-lg disabled:opacity-50"
            >
              {waGenerating ? 'Drafting…' : '✨ AI WhatsApp draft'}
            </button>
            <textarea
              value={waMessage}
              onChange={(e) => setWaMessage(e.target.value)}
              rows={8}
              placeholder="Message to send on WhatsApp"
              className="w-full text-sm border rounded-lg px-3 py-2"
            />
            <button
              type="button"
              onClick={openWhatsApp}
              disabled={busy || !hasLeadPhone || !waMessage.trim()}
              className="w-full py-2.5 text-sm font-semibold bg-[#25D366] text-white rounded-lg disabled:opacity-50"
            >
              Open in WhatsApp & log
            </button>
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
