import { useEffect, useMemo, useRef, useState } from 'react'
import { useUsagePolicies } from '../../hooks/useUsagePolicies.js'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { leadHasCallablePhone, openWhatsAppChat } from '../../lib/phoneUtils'
import LeadCallLogCard from './LeadCallLogCard'
import LeadPhoneCall from './LeadPhoneCall'
import EmailValidationIcon from './EmailValidationIcon'
import { STARTER_TEMPLATES, blocksToPlainText } from '../../lib/marketingEmailDesign'
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
import LeadTagsEditor from './LeadTagsEditor'
import CrmEmailThread from './CrmEmailThread'
import {
  buildUnifiedTimeline,
  filterTimelineItems,
  formatDealValue,
  timelineTypeLabel,
  TIMELINE_FILTERS,
} from '../../lib/crmTimeline'
import { hasWorkspaceFeature } from '../../lib/workspaceFeatures'
import FieldVisitRecordForm from './FieldVisitRecordForm'
import LeadDealsSection from './LeadDealsSection'
import TeamIntelReturnBanner from './TeamIntelReturnBanner'
import { DEFAULT_FIELD_VISIT_EXPENSE_SETTINGS } from '../../lib/fieldVisitExpenses'

const MAX_EMAIL_ATTACHMENTS = 5
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      resolve(result.includes(',') ? result.split(',')[1] : result)
    }
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`))
    reader.readAsDataURL(file)
  })
}

function formatAttachmentSize(bytes) {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'deals', label: 'Deals' },
  { id: 'notes', label: 'Timeline' },
  { id: 'schedule', label: 'Tasks & meetings' },
  { id: 'email', label: 'Email' },
  { id: 'whatsapp', label: 'WhatsApp' },
]

export default function LeadWorkspace({
  lead,
  onClose,
  onNavigate,
  statusOptions = CRM_STATUSES,
  recordPanel = false,
}) {
  const {
    user,
    teamMembers,
    assignLead,
    updateSavedLeadCrm: updateLeadCrmFromContext,
    patchLead,
    generateEmailDraft,
    logCrmEmailSend,
    syncEmailThread,
    logEmailReply,
    generateWhatsAppDraft,
    refreshTeam,
    consumePendingLeadTab,
    openContact,
    saveEmailSignature,
    orgLeadTags,
    refreshPipelineLead,
  } = useApp()
  const policies = useUsagePolicies()
  const notesSaveTimerRef = useRef(null)
  const [tab, setTab] = useState('overview')
  const [notes, setNotes] = useState(lead.crm?.notes || '')
  const [status, setStatus] = useState(lead.crm?.status || 'new')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [purpose, setPurpose] = useState('introduction')
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [savingScope, setSavingScope] = useState(null)
  const [scheduleFeedback, setScheduleFeedback] = useState(null)
  const [visitFormKey, setVisitFormKey] = useState(0)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [orgEmail, setOrgEmail] = useState(null)
  const [gmailStatus, setGmailStatus] = useState({
    connected: false,
    mailbox: null,
    replySyncEnabled: false,
    inboundReplySync: false,
    gmailConnectAvailable: false,
    googleVerificationPending: true,
  })
  const [threadSyncing, setThreadSyncing] = useState(false)
  const [connectingGmail, setConnectingGmail] = useState(false)
  const [emailAgenda, setEmailAgenda] = useState('')
  const [emailKeyPoints, setEmailKeyPoints] = useState('')
  const [senderCompany, setSenderCompany] = useState(user?.organizationName || user?.company || '')
  const [draftAi, setDraftAi] = useState(false)
  const [emailCc, setEmailCc] = useState('')
  const [emailSignature, setEmailSignature] = useState(user?.emailSignature || '')
  const [includeSignature, setIncludeSignature] = useState(user?.includeEmailSignature !== false)
  const [showSignatureEditor, setShowSignatureEditor] = useState(false)
  const [savingSignature, setSavingSignature] = useState(false)
  const [emailAttachments, setEmailAttachments] = useState([])
  const [waMessage, setWaMessage] = useState('')
  const [waAgenda, setWaAgenda] = useState('')
  const [waKeyPoints, setWaKeyPoints] = useState('')
  const [waGenerating, setWaGenerating] = useState(false)
  const [waTemplates, setWaTemplates] = useState([])
  const [waTemplatePick, setWaTemplatePick] = useState('')
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
  const [visitMeetingId, setVisitMeetingId] = useState('')
  const [visitNotes, setVisitNotes] = useState('')
  const [visitOutcome, setVisitOutcome] = useState('completed')
  const [sequences, setSequences] = useState([])
  const [enrollSequenceId, setEnrollSequenceId] = useState('')
  const [fieldVisitSettings, setFieldVisitSettings] = useState(DEFAULT_FIELD_VISIT_EXPENSE_SETTINGS)
  const [editingVisitMeetingId, setEditingVisitMeetingId] = useState(null)
  const [timelineFilter, setTimelineFilter] = useState('all')
  const [marketingTimeline, setMarketingTimeline] = useState([])

  const isManager = user?.isOrgAdmin || user?.orgRole === 'org_admin'
  const canAssignThisLead =
    isManager ||
    (user?.accountType === 'company' && String(lead.assignedToUserId || '') === String(user?.id || ''))
  const canScheduleForTeam = isManager || canAssignThisLead
  const fieldVisitExpensesEnabled = hasWorkspaceFeature(user, 'fieldVisitExpenses')
  const crm = lead.crm || {}
  const timeline = useMemo(
    () => filterTimelineItems(buildUnifiedTimeline(crm, { marketingEvents: marketingTimeline }), timelineFilter),
    [crm, marketingTimeline, timelineFilter]
  )
  const statusMeta = getStatusMeta(status)
  const saving = savingScope !== null
  const savingTask = savingScope === 'task'
  const savingMeeting = savingScope === 'meeting'
  const savingVisit = savingScope === 'visit'

  useEffect(() => {
    setNotes(lead.crm?.notes || '')
    setStatus(lead.crm?.status || 'new')
    setError(null)
    setNotice(null)
    const pendingTab = consumePendingLeadTab(lead.id)
    setTab(pendingTab || 'overview')
    setSenderCompany(user?.organizationName || user?.company || '')
  }, [lead.id, user?.organizationName, user?.company, consumePendingLeadTab])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 5000)
    return () => clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (!scheduleFeedback) return
    const timer = setTimeout(() => setScheduleFeedback(null), 6000)
    return () => clearTimeout(timer)
  }, [scheduleFeedback])

  useEffect(() => {
    setEmailSignature(user?.emailSignature || '')
    setIncludeSignature(user?.includeEmailSignature !== false)
  }, [user?.emailSignature, user?.includeEmailSignature])

  useEffect(() => {
    if (tab === 'schedule' && user?.accountType === 'company') {
      refreshTeam()
    }
  }, [tab, user?.accountType, refreshTeam])

  useEffect(() => {
    if (tab !== 'schedule' || !fieldVisitExpensesEnabled) return
    api
      .getFieldVisitExpenses('', { silent: true })
      .then((data) => setFieldVisitSettings({ ...DEFAULT_FIELD_VISIT_EXPENSE_SETTINGS, ...(data.settings || {}) }))
      .catch(() => {})
  }, [tab, fieldVisitExpensesEnabled])

  useEffect(() => {
    if (tab !== 'whatsapp') return
    api
      .listMarketingTemplates()
      .then((data) => setWaTemplates(data.templates || []))
      .catch(() => setWaTemplates([]))
  }, [tab])

  useEffect(() => {
    if (tab !== 'notes') return
    api
      .getCrmLeadTimeline(lead.id)
      .then((data) => setMarketingTimeline(data.marketingEvents || []))
      .catch(() => setMarketingTimeline([]))
  }, [tab, lead.id])

  useEffect(() => {
    if (tab !== 'email') return undefined
    if (!gmailStatus.inboundReplySync) return undefined
    const poll = () => {
      void refreshPipelineLead?.(lead.id, { silent: true })
    }
    poll()
    const id = setInterval(poll, 30_000)
    return () => clearInterval(id)
  }, [tab, lead.id, gmailStatus.inboundReplySync, refreshPipelineLead])

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
          inboundReplySync: Boolean(data.inboundReplySync),
          gmailConnectAvailable: Boolean(data.gmailConnectAvailable),
          googleVerificationPending: Boolean(data.googleVerificationPending),
        })
      )
      .catch(() =>
        setGmailStatus({
          connected: false,
          mailbox: null,
          replySyncEnabled: false,
          inboundReplySync: false,
          gmailConnectAvailable: false,
          googleVerificationPending: true,
        })
      )
  }, [tab, lead.id, user?.orgOutboundEmailReady])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('crm_gmail') !== 'connected') return
    const mailbox = params.get('mailbox')
    setNotice(mailbox ? `Work email connected (${mailbox})` : 'Work email connected')
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
          inboundReplySync: Boolean(data.inboundReplySync),
          gmailConnectAvailable: Boolean(data.gmailConnectAvailable),
          googleVerificationPending: Boolean(data.googleVerificationPending),
        })
      )
      .catch(() => {})
    setTab('email')
  }, [])

  const resetTaskForm = () => {
    setTaskTitle('')
    setTaskDue('')
    setTaskParticipants([])
    setTaskAssignee(user?.id || '')
  }

  const resetMeetingForm = () => {
    setMeetingTitle('')
    setMeetingWhen('')
    setMeetingType('call')
    setMeetingLocation('')
    setMeetingNotes('')
    setMeetingParticipants([])
    setMeetingAssignee(user?.id || '')
  }

  const runPatch = async (body, okMsg, scope = 'general') => {
    if (savingScope) return false
    setSavingScope(scope)
    setError(null)
    try {
      await patchLead(lead.id, body)
      if (okMsg) {
        setNotice(okMsg)
        if (scope === 'task' || scope === 'meeting' || scope === 'visit') {
          setScheduleFeedback({ form: scope, message: okMsg })
        }
      }
      return true
    } catch (e) {
      setError(e.message)
      return false
    } finally {
      setSavingScope(null)
    }
  }

  const saveNotes = async () => {
    await runPatch({ crm: { notes } }, 'Notes saved')
  }

  useEffect(() => {
    if (tab !== 'notes') return undefined
    const saved = lead.crm?.notes || ''
    if (notes === saved) return undefined
    if (notesSaveTimerRef.current) clearTimeout(notesSaveTimerRef.current)
    notesSaveTimerRef.current = setTimeout(() => {
      saveNotes()
    }, policies.notesAutosaveMs ?? 3000)
    return () => {
      if (notesSaveTimerRef.current) clearTimeout(notesSaveTimerRef.current)
    }
  }, [notes, tab, lead.crm?.notes, policies.notesAutosaveMs])

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

  const logCallActivity = async (body) => {
    await runPatch(body, 'Call logged', 'activity')
  }

  const addTask = async (e) => {
    e.preventDefault()
    if (!taskTitle.trim() || savingScope) return
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
          assignedToUserId: canScheduleForTeam ? taskAssignee : user.id,
          participantUserIds: taskParticipants.filter((id) => id !== (canScheduleForTeam ? taskAssignee : user.id)),
        },
      },
      'Task saved — add another below',
      'task'
    )
    if (ok) resetTaskForm()
  }

  const addMeeting = async (e) => {
    e.preventDefault()
    if (savingScope) return
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
          assignedToUserId: canScheduleForTeam ? meetingAssignee : user.id,
          participantUserIds: meetingParticipants.filter(
            (id) => id !== (canScheduleForTeam ? meetingAssignee : user.id)
          ),
        },
      },
      'Meeting scheduled — reminder 30 min before',
      'meeting'
    )
    if (ok) resetMeetingForm()
  }

  const recordVisit = async (payload) => {
    if (savingScope) return
    const isUpdate = payload?.action === 'update'
    const mid =
      payload?.meetingId ||
      visitMeetingId ||
      crm.meetings?.find((m) => m.type === 'field_visit' && !m.visitRecordedAt)?.id
    if (!fieldVisitExpensesEnabled && !mid) {
      setError('Select a field visit meeting')
      return
    }
    const ok = await runPatch(
      {
        fieldVisit: fieldVisitExpensesEnabled
          ? {
              ...payload,
              meetingId: isUpdate ? payload.meetingId : payload?.quickLog ? undefined : mid,
            }
          : {
              meetingId: mid,
              outcome: visitOutcome,
              notes: visitNotes,
              location: meetingLocation,
            },
      },
      fieldVisitExpensesEnabled
        ? isUpdate
          ? 'Field visit updated'
          : 'Field visit saved — ready to log another'
        : 'Field visit recorded',
      'visit'
    )
    if (ok) {
      if (!fieldVisitExpensesEnabled) {
        setVisitNotes('')
        setVisitMeetingId('')
      }
      if (fieldVisitExpensesEnabled && !isUpdate) setVisitFormKey((k) => k + 1)
      if (isUpdate) setEditingVisitMeetingId(null)
    }
  }

  const editingVisitMeeting = useMemo(() => {
    if (!editingVisitMeetingId) return null
    return (crm.meetings || []).find((m) => m.id === editingVisitMeetingId) || null
  }, [editingVisitMeetingId, crm.meetings])

  const recordedFieldVisits = useMemo(
    () =>
      (crm.meetings || []).filter((m) => m.type === 'field_visit' && m.visitRecordedAt),
    [crm.meetings]
  )

  const completeTask = async (taskId) => {
    if (savingScope) return
    await runPatch({ task: { action: 'complete', taskId } }, 'Task marked complete', 'task')
  }

  const connectWorkGmail = async () => {
    setConnectingGmail(true)
    setError(null)
    try {
      const data = await api.startCrmGmailOAuth()
      if (data.url) window.location.href = data.url
      else setError('Could not start email connection')
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

  const handleSaveSignature = async () => {
    if (savingSignature) return
    setSavingSignature(true)
    setError(null)
    try {
      await saveEmailSignature({
        emailSignature: emailSignature.trim(),
        includeEmailSignature: includeSignature,
      })
      setNotice('Email signature saved for all future emails')
    } catch (e) {
      setError(e.message)
    } finally {
      setSavingSignature(false)
    }
  }

  const handleAttachmentPick = async (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return

    setError(null)
    const next = [...emailAttachments]

    for (const file of files) {
      if (next.length >= MAX_EMAIL_ATTACHMENTS) {
        setError(`Maximum ${MAX_EMAIL_ATTACHMENTS} attachments per email`)
        break
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setError(`${file.name} exceeds 5MB limit`)
        continue
      }
      try {
        const contentBase64 = await readFileAsBase64(file)
        next.push({
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          contentBase64,
          sizeBytes: file.size,
        })
      } catch (e) {
        setError(e.message)
      }
    }

    setEmailAttachments(next)
  }

  const removeAttachment = (index) => {
    setEmailAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      setError('Add subject and message')
      return
    }
    const canSend = gmailStatus.connected || orgEmail?.userCanSend || user?.orgOutboundEmailReady
    if (!canSend) {
      const guidance = user?.isOrgAdmin
        ? 'Connect work email above (Team → CRM email) to send from CRM.'
        : 'Connect work email above (Work email in sidebar) to send from CRM.'
      setError(guidance)
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
        includeSignature,
        attachments: emailAttachments.map(({ filename, mimeType, contentBase64 }) => ({
          filename,
          mimeType,
          contentBase64,
        })),
      })
      setSubject('')
      setBody('')
      setDraftAi(false)
      setEmailAttachments([])
      const from = data.mailbox || user?.email
      const via = data.provider === 'org_resend' ? 'company email' : 'work email'
      const attachmentNote =
        data.attachmentCount > 0 ? ` with ${data.attachmentCount} attachment(s)` : ''
      setNotice(
        from
          ? `Email sent from ${from} (${via})${attachmentNote} and logged in CRM`
          : `Email sent${attachmentNote} and logged in CRM`
      )
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
        data.bounceDetected
          ? 'Delivery failure detected — lead email marked as bounced'
          : data.importedCount > 0
            ? `Synced ${data.importedCount} trail message(s) for this lead`
            : 'No new trail messages in the last 90 days'
      )
      const status = await api.getCrmGmailStatus()
      setGmailStatus({
        connected: status.connected,
        mailbox: status.mailbox,
        replySyncEnabled: Boolean(status.replySyncEnabled),
        inboundReplySync: Boolean(status.inboundReplySync),
        gmailConnectAvailable: Boolean(status.gmailConnectAvailable),
        googleVerificationPending: Boolean(status.googleVerificationPending),
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

  const contactId = lead.contactId || lead.id

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

  const openWhatsApp = () => {
    if (!waMessage.trim()) {
      setError('Write or generate a message first')
      return
    }
    if (!openWhatsAppChat(lead.phone, waMessage.trim())) {
      setError('Lead has no valid phone number for WhatsApp')
      return
    }
    setNotice('WhatsApp opened — send from your app')
    void patchLead(lead.id, {
      activity: {
        type: 'whatsapp',
        summary: `WhatsApp: ${waMessage.trim().slice(0, 120)}`,
        meta: { message: waMessage.trim() },
      },
    }).catch(() => {})
  }

  return (
    <aside
      className={
        recordPanel
          ? 'crm-record-panel fixed inset-0 z-[75] md:static md:inset-auto shrink-0'
          : 'crm-drawer fixed inset-0 z-[75] md:static md:inset-auto md:w-full md:max-w-[420px] shrink-0'
      }
    >
      <TeamIntelReturnBanner onNavigate={onNavigate} onCloseLead={onClose} />
      <div className={recordPanel ? 'crm-record-panel__header' : 'crm-drawer-header'}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h2
              className={
                recordPanel
                  ? 'crm-record-panel__title truncate'
                  : 'text-sm font-semibold tracking-[-0.02em] text-gray-900 truncate'
              }
            >
              {[lead.firstName, lead.lastName].filter(Boolean).join(' ')}
            </h2>
            <p
              className={
                recordPanel
                  ? 'crm-record-panel__subtitle truncate'
                  : 'text-xs text-gray-500 truncate'
              }
            >
              {lead.title} · {lead.company}
            </p>
            <span
              className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded border ${
                recordPanel ? 'crm-record-panel__status' : statusMeta.color
              }`}
            >
              {statusMeta.label}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={
              recordPanel
                ? 'crm-record-panel__close'
                : 'text-gray-400 hover:text-gray-800 text-2xl leading-none px-1'
            }
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div
          className={
            recordPanel
              ? 'crm-record-panel__tabs'
              : 'flex gap-0.5 mt-2 md:mt-3 overflow-x-auto no-scrollbar pb-0.5'
          }
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={
                recordPanel
                  ? `crm-record-panel__tab ${tab === t.id ? 'is-active' : ''}`
                  : `shrink-0 text-xs font-semibold px-2 py-0.5 md:px-2.5 md:py-1 rounded-md ${
                      tab === t.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                    }`
              }
            >
              {t.label}
            </button>
          ))}
        </div>
        {(notice || savingScope === 'general') && (
          <div
            className={`mt-2 text-xs font-medium rounded-lg px-2.5 py-1.5 border ${
              savingScope === 'general'
                ? 'bg-amber-50 text-amber-900 border-amber-200'
                : 'bg-green-50 text-green-900 border-green-200'
            }`}
            role="status"
          >
            {savingScope === 'general' ? 'Saving…' : notice}
          </div>
        )}
      </div>

      <div
        className={
          recordPanel
            ? 'crm-record-panel__body space-y-3 md:space-y-4'
            : 'crm-drawer-body space-y-3 md:space-y-4'
        }
      >
        {tab === 'overview' && (
          <>
            <LeadCallLogCard lead={lead} saving={saving} onLog={logCallActivity} onSuccess={setNotice} />

            <section>
              <h3 className="text-xs font-semibold uppercase text-gray-400 mb-2">Pipeline status</h3>
              <select value={status} onChange={(e) => changeStatus(e.target.value)} className="w-full text-xs border rounded-lg px-2.5 py-1.5">
                {statusOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              {crm.leadScore != null && (
                <p className="text-xs text-gray-500 mt-2">
                  Lead score: <strong className="text-gray-900">{crm.leadScore}</strong>/100
                </p>
              )}
            </section>

            {user?.accountType === 'company' && (
              <section>
                <h3 className="text-xs font-semibold uppercase text-gray-400 mb-2">Tags</h3>
                <LeadTagsEditor
                  lead={lead}
                  orgLeadTags={orgLeadTags}
                  onSave={async (tagIds) => {
                    await updateLeadCrmFromContext(lead.id, { tagIds })
                    setNotice('Tags updated')
                  }}
                />
              </section>
            )}

            {lead.tradingProfile?.firstShipmentAt || lead.tradingProfile?.active ? (
              <section className="rounded-xl border border-teal-100 bg-teal-50/50 p-3 space-y-2">
                <h3 className="text-xs font-semibold uppercase text-teal-800">Active trading</h3>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
                  <div>
                    <span className="text-gray-500 block">First shipment</span>
                    <strong>
                      {lead.tradingProfile.firstShipmentAt
                        ? new Date(lead.tradingProfile.firstShipmentAt).toLocaleDateString()
                        : '—'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Last shipment</span>
                    <strong>
                      {lead.tradingProfile.lastShipmentAt
                        ? new Date(lead.tradingProfile.lastShipmentAt).toLocaleDateString()
                        : '—'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Shipments</span>
                    <strong>{lead.tradingProfile.shipmentCount ?? 0}</strong>
                  </div>
                  {lead.tradingProfile.customerCode && (
                    <div>
                      <span className="text-gray-500 block">Customer code</span>
                      <strong className="font-mono text-xs">{lead.tradingProfile.customerCode}</strong>
                    </div>
                  )}
                </div>
                {(lead.tradingProfile.shipments?.length ?? 0) > 0 && (
                  <p className="text-xs text-gray-600">
                    Dates:{' '}
                    {lead.tradingProfile.shipments
                      .map((s) =>
                        s.date ? new Date(s.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' }) : ''
                      )
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
                {lead.tradingProfile.notes && (
                  <p className="text-xs text-gray-600 whitespace-pre-wrap">{lead.tradingProfile.notes}</p>
                )}
                {onNavigate && hasWorkspaceFeature(user, 'panelActiveCustomers') && (
                  <button
                    type="button"
                    onClick={() => onNavigate('active-customers')}
                    className="text-xs font-semibold text-teal-800 underline"
                  >
                    Active customers dashboard
                  </button>
                )}
              </section>
            ) : null}

            <section className="border rounded-lg p-2.5 bg-gray-50">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase text-gray-400">Deals</p>
                  <p className="text-sm font-bold text-gray-900">
                    {formatDealValue(crm.dealValue)}
                    <span className="text-xs font-normal text-gray-500 ml-1">
                      open · {(crm.deals || []).length} total
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTab('deals')}
                  className="text-xs font-semibold text-[#FF773D] underline shrink-0"
                >
                  Manage deals
                </button>
              </div>
            </section>

            {user?.accountType === 'company' && (
              <section>
                <h3 className="text-xs font-semibold uppercase text-gray-400 mb-2">Sales sequence</h3>
                <div className="flex gap-2">
                  <select
                    value={enrollSequenceId}
                    onChange={(e) => setEnrollSequenceId(e.target.value)}
                    className="flex-1 text-xs border rounded-lg px-2 py-1.5"
                    onFocus={async () => {
                      try {
                        const data = await api.listCrmSequences()
                        setSequences(data.sequences || [])
                      } catch {
                        setSequences([])
                      }
                    }}
                  >
                    <option value="">Select sequence…</option>
                    {sequences.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!enrollSequenceId}
                    onClick={async () => {
                      try {
                        await api.enrollCrmSequence({ sequenceId: enrollSequenceId, leadId: lead.id })
                        setNotice('Enrolled in sequence')
                        setEnrollSequenceId('')
                      } catch (err) {
                        setError(err.message)
                      }
                    }}
                    className="text-xs font-semibold px-3 py-2 rounded-lg bg-[#FF773D] text-[#242424] disabled:opacity-40"
                  >
                    Enroll
                  </button>
                </div>
              </section>
            )}

            {canAssignThisLead && user?.accountType === 'company' && teamMembers.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold uppercase text-gray-400 mb-2">Transfer / assign lead</h3>
                <select
                  value={String(lead.assignedToUserId || '')}
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
                  className="w-full text-xs border rounded-lg px-2.5 py-1.5"
                >
                  <option value="">Unassigned</option>
                  {teamMembers.map((m) => (
                    <option key={m.userId} value={String(m.userId)}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </section>
            )}

            <section>
              <h3 className="text-xs font-semibold uppercase text-gray-400 mb-2">Contact record</h3>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-1.5 text-xs text-gray-700">
                <p>
                  <span className="text-gray-500">Name · </span>
                  {[lead.firstName, lead.lastName].filter(Boolean).join(' ') || '—'}
                </p>
                <p>
                  <span className="text-gray-500">Company · </span>
                  {lead.company || '—'}
                </p>
                <p className="flex flex-wrap items-center gap-1">
                  <span className="text-gray-500">Email · </span>
                  <EmailValidationIcon lead={lead} />
                  <span>{lead.email || '—'}</span>
                </p>
                <p className="flex flex-wrap items-center gap-1">
                  <span className="text-gray-500">Phone · </span>
                  <LeadPhoneCall phone={lead.phone} leadId={lead.id} pipelineCallIcon showNumber />
                </p>
                <p>
                  <span className="text-gray-500">Location · </span>
                  {lead.location || [lead.city, lead.state].filter(Boolean).join(', ') || '—'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => openContact(contactId)}
                className="mt-2 w-full py-2 text-xs font-semibold border border-gray-300 rounded-lg text-gray-800 hover:bg-white"
              >
                Edit contact details →
              </button>
              <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                Pipeline tracks deal activity. Contact info is edited on the Contacts page.
              </p>
            </section>

            <section className="grid grid-cols-1 gap-2 text-xs">
              <Info label="Last communication" value={formatDateTime(crm.lastCommunicationAt)} />
              <Info label="Type" value={ACTIVITY_LABELS[crm.lastCommunicationType] || '—'} />
              <Info label="Summary" value={crm.lastCommunicationSummary || '—'} />
              <Info label="Next follow-up" value={formatDateTime(crm.nextFollowUpAt)} />
              <Info label="Last email" value={formatCrmDate(crm.lastEmailSentAt)} />
            </section>
          </>
        )}

        {tab === 'deals' && (
          <LeadDealsSection
            lead={lead}
            user={user}
            patchLead={patchLead}
            busy={savingScope !== null && savingScope !== 'deal'}
            onNotice={setNotice}
            onError={setError}
          />
        )}

        {tab === 'notes' && (
          <>
            <section>
              <h3 className="text-xs font-semibold uppercase text-gray-400 mb-2">Customer notes</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => {
                  if (notesSaveTimerRef.current) clearTimeout(notesSaveTimerRef.current)
                  saveNotes()
                }}
                rows={5}
                placeholder="Requirements, pricing, decision makers…"
                className="w-full text-xs border rounded-lg px-2.5 py-1.5"
              />
            </section>
            <section>
              <h3 className="text-xs font-semibold uppercase text-gray-400 mb-2">Unified timeline</h3>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {TIMELINE_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setTimelineFilter(f.id)}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                      timelineFilter === f.id
                        ? 'bg-[#fff4ee] border-[#ffd4b8] text-[#FF773D]'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <ul className="space-y-2 max-h-[50vh] overflow-y-auto">
                {timeline.map((item) => (
                  <li key={item.id} className="text-xs border rounded-lg p-2.5 bg-gray-50">
                    <span className="font-bold text-[#8a6600]">{timelineTypeLabel(item.type)}</span>
                    <p className="text-gray-800 mt-1">{item.title}</p>
                    {item.subtitle && <p className="text-gray-500">{item.subtitle}</p>}
                    {item.meta?.answers?.length > 0 && (
                      <ul className="mt-2 space-y-1 text-gray-700 border-t border-gray-200 pt-2">
                        {item.meta.answers.map((row) => (
                          <li key={row.fieldId || row.label}>
                            <span className="font-medium text-gray-600">{row.label}: </span>
                            {row.value}
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-gray-400 mt-1">{formatDateTime(item.at)}</p>
                  </li>
                ))}
                {!timeline.length && <p className="text-xs text-gray-400">No activity yet</p>}
              </ul>
            </section>
          </>
        )}

        {tab === 'schedule' && (
          <>
            <section>
              <h3 className="text-xs font-semibold uppercase text-gray-400 mb-2">Tasks</h3>
              <form onSubmit={addTask} className="space-y-2 mb-3">
                <input
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Task title"
                  className="w-full text-xs border rounded-lg px-2.5 py-1.5"
                />
                <input
                  type="datetime-local"
                  value={taskDue}
                  onChange={(e) => setTaskDue(e.target.value)}
                  required
                  className="w-full text-xs border rounded-lg px-2.5 py-1.5"
                />
                <p className="text-xs text-gray-400">Due date appears on team calendar</p>
                {canScheduleForTeam && teamMembers.length > 0 && (
                  <select value={taskAssignee} onChange={(e) => setTaskAssignee(e.target.value)} className="w-full text-xs border rounded-lg px-2.5 py-1.5">
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
                    primaryUserId={canScheduleForTeam ? taskAssignee : user.id}
                    value={taskParticipants}
                    onChange={setTaskParticipants}
                  />
                )}
                <button type="submit" disabled={busy || savingTask} className="w-full py-2 text-xs font-semibold bg-[#FF773D] rounded-lg disabled:opacity-50">
                  {savingTask ? 'Saving task…' : 'Add task'}
                </button>
                {scheduleFeedback?.form === 'task' && (
                  <p className="text-xs font-semibold text-green-800 bg-green-50 border border-green-200 rounded-lg px-2.5 py-2" role="status">
                    ✓ {scheduleFeedback.message}
                  </p>
                )}
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
                      <button type="button" onClick={() => completeTask(t.id)} className="mt-1 text-[#FF773D] font-semibold underline">
                        Mark done
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="text-xs font-semibold uppercase text-gray-400 mb-2">Schedule meeting</h3>
              <form onSubmit={addMeeting} className="space-y-2">
                <input value={meetingTitle} onChange={(e) => setMeetingTitle(e.target.value)} placeholder="Title" className="w-full text-xs border rounded-lg px-2.5 py-1.5" />
                <select value={meetingType} onChange={(e) => setMeetingType(e.target.value)} className="w-full text-xs border rounded-lg px-2.5 py-1.5">
                  {MEETING_TYPES.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <input type="datetime-local" value={meetingWhen} onChange={(e) => setMeetingWhen(e.target.value)} className="w-full text-xs border rounded-lg px-2.5 py-1.5" />
                <input value={meetingLocation} onChange={(e) => setMeetingLocation(e.target.value)} placeholder="Location" className="w-full text-xs border rounded-lg px-2.5 py-1.5" />
                <textarea value={meetingNotes} onChange={(e) => setMeetingNotes(e.target.value)} rows={2} placeholder="Agenda" className="w-full text-xs border rounded-lg px-2.5 py-1.5" />
                {canScheduleForTeam && teamMembers.length > 0 && (
                  <select value={meetingAssignee} onChange={(e) => setMeetingAssignee(e.target.value)} className="w-full text-xs border rounded-lg px-2.5 py-1.5">
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
                    primaryUserId={canScheduleForTeam ? meetingAssignee : user.id}
                    value={meetingParticipants}
                    onChange={setMeetingParticipants}
                    label="Also attending (team)"
                  />
                )}
                <button type="submit" disabled={busy || savingMeeting} className="w-full py-2 text-xs font-semibold bg-gray-900 text-white rounded-lg disabled:opacity-50">
                  {savingMeeting ? 'Scheduling…' : 'Schedule meeting'}
                </button>
                {scheduleFeedback?.form === 'meeting' && (
                  <p className="text-xs font-semibold text-green-800 bg-green-50 border border-green-200 rounded-lg px-2.5 py-2" role="status">
                    ✓ {scheduleFeedback.message}
                  </p>
                )}
              </form>
            </section>

            <section>
              <h3 className="text-xs font-semibold uppercase text-gray-400 mb-2">
                {fieldVisitExpensesEnabled ? 'Record field visit & travel' : 'Record field visit'}
              </h3>
              {fieldVisitExpensesEnabled && editingVisitMeeting ? (
                <FieldVisitRecordForm
                  key={`visit-edit-${editingVisitMeetingId}`}
                  lead={lead}
                  meetings={crm.meetings || []}
                  settings={fieldVisitSettings}
                  busy={busy || savingVisit}
                  editMeeting={editingVisitMeeting}
                  onCancel={() => setEditingVisitMeetingId(null)}
                  onSubmit={recordVisit}
                />
              ) : fieldVisitExpensesEnabled ? (
                <FieldVisitRecordForm
                  key={`visit-new-${visitFormKey}`}
                  lead={lead}
                  meetings={crm.meetings || []}
                  settings={fieldVisitSettings}
                  busy={busy || savingVisit}
                  onSubmit={recordVisit}
                />
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    recordVisit()
                  }}
                  className="space-y-2"
                >
                  <select
                    value={visitMeetingId}
                    onChange={(e) => setVisitMeetingId(e.target.value)}
                    className="w-full text-xs border rounded-lg px-2.5 py-1.5"
                  >
                    <option value="">Select scheduled visit</option>
                    {(crm.meetings || [])
                      .filter((m) => m.type === 'field_visit')
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.title} · {formatDateTime(m.scheduledAt)}
                        </option>
                      ))}
                  </select>
                  <select
                    value={visitOutcome}
                    onChange={(e) => setVisitOutcome(e.target.value)}
                    className="w-full text-xs border rounded-lg px-2.5 py-1.5"
                  >
                    <option value="completed">Completed</option>
                    <option value="rescheduled">Rescheduled</option>
                    <option value="no_show">No show</option>
                  </select>
                  <textarea
                    value={visitNotes}
                    onChange={(e) => setVisitNotes(e.target.value)}
                    rows={3}
                    placeholder="Visit notes, outcomes, next steps…"
                    className="w-full text-xs border rounded-lg px-2.5 py-1.5"
                  />
                  <button
                    type="submit"
                    disabled={busy || savingVisit}
                    className="w-full py-2 text-xs font-semibold border-2 border-[#FF773D] rounded-lg disabled:opacity-50"
                  >
                    {savingVisit ? 'Saving visit…' : 'Save field visit report'}
                  </button>
                </form>
              )}
              {scheduleFeedback?.form === 'visit' && (
                <p className="mt-2 text-xs font-semibold text-green-800 bg-green-50 border border-green-200 rounded-lg px-2.5 py-2" role="status">
                  ✓ {scheduleFeedback.message}
                </p>
              )}
            </section>

            {fieldVisitExpensesEnabled && recordedFieldVisits.length > 0 && !editingVisitMeeting ? (
              <section>
                <h3 className="text-xs font-semibold uppercase text-gray-400 mb-2">Recorded visits</h3>
                <ul className="space-y-2">
                  {recordedFieldVisits.map((m) => (
                    <li key={m.id} className="text-xs border rounded-lg p-2 bg-white">
                      <p className="font-medium">{m.title}</p>
                      <p className="text-[#516f90]">
                        {formatDateTime(m.actualVisitAt || m.visitRecordedAt)} · {m.visitOutcome}
                      </p>
                      {m.visitTravel ? (
                        <p className="text-[#516f90] mt-0.5">
                          {m.visitTravel.startLabel ? `${m.visitTravel.startLabel} → ` : ''}
                          {m.visitTravel.endLabel || m.location}
                          {m.visitTravel.claimAmount > 0
                            ? ` · ₹${m.visitTravel.claimAmount}`
                            : ''}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setEditingVisitMeetingId(m.id)}
                        className="mt-1 text-[#0091ae] font-semibold hover:underline"
                      >
                        Edit visit & travel
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <ul className="space-y-2">
              <h3 className="text-xs font-semibold uppercase text-gray-400">Upcoming</h3>
              {(crm.meetings || []).map((m) => (
                <li key={m.id} className="text-xs border rounded-lg p-2 bg-[#fff4ee]">
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
                <h3 className="text-xs font-semibold uppercase text-amber-900">Connect email to send</h3>
                <p className="text-xs text-amber-900 leading-relaxed">
                  Sign in once with your work email account. No DNS or domain setup needed.
                </p>
                <button
                  type="button"
                  onClick={connectWorkGmail}
                  disabled={busy || !gmailStatus.gmailConnectAvailable}
                  className="w-full py-2 text-xs font-semibold bg-[#FF773D] text-[#242424] rounded-lg disabled:opacity-50"
                >
                  {connectingGmail ? 'Connecting…' : 'Connect work email'}
                </button>
                {user?.isOrgAdmin && onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate('team')}
                    className="w-full py-2 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg"
                  >
                    Open Team email settings
                  </button>
                )}
              </section>
            )}

            {canSendEmail && gmailStatus.connected && (
              <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1.5">
                Sending via <strong>{gmailStatus.mailbox}</strong>
                {gmailStatus.inboundReplySync
                  ? ' · lead replies sync to CRM and forward to your inbox automatically'
                  : ' · use Sync trail below to pull inbound mail (legacy)'}
              </p>
            )}

            <section className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase text-gray-500">Email signature</h3>
                <button
                  type="button"
                  onClick={() => setShowSignatureEditor((v) => !v)}
                  className="text-xs font-semibold text-gray-600 underline"
                >
                  {showSignatureEditor ? 'Hide' : emailSignature ? 'Edit signature' : 'Add signature'}
                </button>
              </div>
              {!showSignatureEditor && emailSignature && (
                <p className="text-xs text-gray-600 whitespace-pre-wrap border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
                  {emailSignature}
                </p>
              )}
              {showSignatureEditor && (
                <>
                  <textarea
                    value={emailSignature}
                    onChange={(e) => setEmailSignature(e.target.value)}
                    rows={4}
                    placeholder={'Best regards,\nYour Name\nCompany · Phone · Website'}
                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 font-mono bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleSaveSignature}
                    disabled={savingSignature}
                    className="text-xs font-semibold px-3 py-1.5 bg-white border border-gray-300 rounded-lg disabled:opacity-50"
                  >
                    {savingSignature ? 'Saving…' : 'Save signature for all emails'}
                  </button>
                </>
              )}
              <label className="flex items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={includeSignature}
                  onChange={(e) => setIncludeSignature(e.target.checked)}
                />
                Include signature when sending
              </label>
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase text-gray-400">What should this email say?</h3>
              <input
                value={senderCompany}
                onChange={(e) => setSenderCompany(e.target.value)}
                placeholder="Your company name"
                className="w-full text-xs border rounded-lg px-2.5 py-1.5"
              />
              <textarea
                value={emailAgenda}
                onChange={(e) => setEmailAgenda(e.target.value)}
                rows={3}
                placeholder="Agenda (required): e.g. Introduce Alvar Fresh organic snacks to US boutique buyers; ask for 15-min call next week"
                className="w-full text-xs border rounded-lg px-2.5 py-1.5"
              />
              <textarea
                value={emailKeyPoints}
                onChange={(e) => setEmailKeyPoints(e.target.value)}
                rows={2}
                placeholder="Key points (optional): pricing, certifications, trade show, etc."
                className="w-full text-xs border rounded-lg px-2.5 py-1.5"
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
                className="text-xs font-semibold px-3 py-1.5 bg-[#fff4ee] border border-[#ffd4b8] rounded-lg disabled:opacity-50"
              >
                {generating ? 'Drafting…' : '✨ AI draft'}
              </button>
            </div>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="w-full text-xs border rounded-lg px-2.5 py-1.5" />
            <input
              value={emailCc}
              onChange={(e) => setEmailCc(e.target.value)}
              placeholder="Cc (optional): name@company.com, teammate@company.com"
              className="w-full text-xs border rounded-lg px-2.5 py-1.5"
            />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} className="w-full text-xs border rounded-lg px-2.5 py-1.5 font-mono text-xs" />
            {includeSignature && emailSignature.trim() && (
              <p className="text-xs text-gray-500">
                Your saved signature will be appended automatically when you send.
              </p>
            )}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs font-semibold px-3 py-1.5 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                  📎 Attach files
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleAttachmentPick}
                    disabled={busy || emailAttachments.length >= MAX_EMAIL_ATTACHMENTS}
                  />
                </label>
                <span className="text-xs text-gray-500">
                  Up to {MAX_EMAIL_ATTACHMENTS} files, 5MB each
                </span>
              </div>
              {emailAttachments.length > 0 && (
                <ul className="space-y-1">
                  {emailAttachments.map((file, index) => (
                    <li
                      key={`${file.filename}-${index}`}
                      className="flex items-center justify-between gap-2 text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1"
                    >
                      <span className="truncate">
                        📎 {file.filename} ({formatAttachmentSize(file.sizeBytes)})
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(index)}
                        className="shrink-0 text-red-600 text-xs font-semibold"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              type="button"
              onClick={handleSend}
              disabled={busy || !canSendEmail}
              className="w-full py-2 text-xs font-semibold bg-gray-900 text-white rounded-lg disabled:opacity-50"
            >
              {sending ? 'Sending…' : 'Send email & log in CRM'}
            </button>

            <CrmEmailThread
              lead={lead}
              emails={crm.emails || []}
              gmailConnected={gmailStatus.connected}
              inboundReplySync={gmailStatus.inboundReplySync}
              replySyncEnabled={gmailStatus.replySyncEnabled}
              busy={threadSyncing || sending}
              onSync={handleSyncEmailThread}
              onLogReply={handleLogReply}
            />
          </>
        )}

        {tab === 'whatsapp' && (
          <>
            <p className="text-xs text-gray-600">
              Opens <strong>your WhatsApp app</strong> (wa.me) — not the business API. Use a marketing template or AI
              draft, then send from your phone to <strong>{lead.phone || 'no phone'}</strong>.
            </p>
            <label className="block text-xs font-semibold text-gray-700">
              Load template
              <select
                value={waTemplatePick}
                onChange={(e) => {
                  const v = e.target.value
                  setWaTemplatePick(v)
                  if (!v) return
                  if (v.startsWith('preset:')) {
                    const preset = STARTER_TEMPLATES.find((s) => s.id === v.slice(7))
                    if (preset) {
                      setWaMessage(blocksToPlainText(preset.blocks, lead))
                      setNotice(`Preset loaded: ${preset.name}`)
                    }
                  } else {
                    const t = waTemplates.find((x) => x.id === v)
                    if (t?.blocks?.length) {
                      setWaMessage(blocksToPlainText(t.blocks, lead))
                      setNotice(`Template loaded: ${t.name}`)
                    } else if (t?.body) {
                      setWaMessage(t.body)
                      setNotice(`Template loaded: ${t.name}`)
                    }
                  }
                  setWaTemplatePick('')
                }}
                className="mt-1 w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5"
              >
                <option value="">Choose preset or saved template…</option>
                <optgroup label="Built-in presets">
                  {STARTER_TEMPLATES.map((s) => (
                    <option key={s.id} value={`preset:${s.id}`}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
                {waTemplates.length > 0 && (
                  <optgroup label="Your saved templates">
                    {waTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </label>
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
              className="w-full text-xs border rounded-lg px-2.5 py-1.5"
            />
            <textarea
              value={waKeyPoints}
              onChange={(e) => setWaKeyPoints(e.target.value)}
              rows={2}
              placeholder="Key points (optional)"
              className="w-full text-xs border rounded-lg px-2.5 py-1.5"
            />
            <button
              type="button"
              onClick={handleGenerateWhatsApp}
              disabled={busy || waAgenda.trim().length < 8}
              className="w-full py-2 text-xs font-semibold bg-[#fff4ee] border border-[#ffd4b8] rounded-lg disabled:opacity-50"
            >
              {waGenerating ? 'Drafting…' : '✨ AI WhatsApp draft'}
            </button>
            <textarea
              value={waMessage}
              onChange={(e) => setWaMessage(e.target.value)}
              rows={8}
              placeholder="Message to send on WhatsApp"
              className="w-full text-xs border rounded-lg px-2.5 py-1.5"
            />
            <button
              type="button"
              onClick={openWhatsApp}
              disabled={busy || !hasLeadPhone || !waMessage.trim()}
              className="w-full py-2 text-xs font-semibold bg-[#25D366] text-white rounded-lg disabled:opacity-50"
            >
              Open in WhatsApp & log
            </button>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('marketing', { tab: 'inbox' })}
                className="w-full py-2 text-xs font-semibold border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Open team WA Inbox (Cloud API)
              </button>
            )}
          </>
        )}

        {error && <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-2 py-1.5">{error}</p>}
      </div>

      <div className="shrink-0 px-4 py-2 border-t text-xs text-gray-500 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="inline-flex items-center gap-1">
          <EmailValidationIcon lead={lead} />
          {lead.email || 'No email'}
        </span>
        <span className="text-gray-300" aria-hidden>
          ·
        </span>
        <LeadPhoneCall phone={lead.phone} leadId={lead.id} numberClassName="text-xs" />
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
