import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useUsagePolicies } from '../../hooks/useUsagePolicies.js'
import { isPipelineAssignManager } from '../../lib/pipelineAssignAccess'
import { api } from '../../lib/api'
import { loadChromeExtensionDistribution } from '../../lib/chromeExtension'
import {
  leadHasCommercialEmailConsent,
  COMMERCIAL_EMAIL_CONSENT_MESSAGE,
} from '../../lib/emailUtils'
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
import {
  LwSection,
  LwDivider,
  LwField,
  LwInput,
  LwSelect,
  LwTextarea,
  LwBtn,
  LwSubmitBtn,
  LwChip,
  LwNotice,
  LwAlert,
  LwStatCard,
  LwContactGrid,
  LwInfoGrid,
  LwListItem,
  LwTimeline,
  LwTimelineCard,
  LwFormStack,
  LwLinkBtn,
  LwEmpty,
} from './leadWorkspaceUi'
import {
  CalendarIcon,
  ChevronRightIcon,
  CloseIcon,
  HomeIcon,
  LogIcon,
  MailIcon,
  MapPinIcon,
  NoteIcon,
  PencilIcon,
  PeopleIcon,
  PlusIcon,
  PipelineIcon,
  SparkIcon,
  TaskIcon,
  TeamIcon,
  WhatsAppIcon,
} from '../ui/icons'

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
  { id: 'overview', label: 'Overview', shortLabel: 'Overview', Icon: HomeIcon },
  { id: 'deals', label: 'Deals', shortLabel: 'Deals', Icon: PipelineIcon },
  { id: 'notes', label: 'Timeline', shortLabel: 'Timeline', Icon: LogIcon },
  { id: 'schedule', label: 'Tasks & meetings', shortLabel: 'Tasks', Icon: CalendarIcon },
  { id: 'email', label: 'Email', shortLabel: 'Email', Icon: MailIcon },
  { id: 'whatsapp', label: 'WhatsApp', shortLabel: 'WA', Icon: WhatsAppIcon },
]

function leadInitials(lead) {
  const first = lead.firstName?.[0] || ''
  const last = lead.lastName?.[0] || ''
  const initials = `${first}${last}`.toUpperCase()
  if (initials) return initials
  return lead.company?.[0]?.toUpperCase() || '?'
}

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
    consumePendingEmailDraft,
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
  const [savingConsent, setSavingConsent] = useState(false)
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
    emailStrategyMode: 'extension_first',
  })
  const [extensionStoreUrl, setExtensionStoreUrl] = useState(null)
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
  const [indexedActivities, setIndexedActivities] = useState([])

  const isManager = isPipelineAssignManager(user)
  const isUnassignedLead = !lead?.assignedToUserId
  const canAssignThisLead =
    isManager ||
    (user?.accountType === 'company' &&
      (isUnassignedLead || String(lead.assignedToUserId || '') === String(user?.id || '')))
  const canScheduleForTeam = isManager || canAssignThisLead
  const fieldVisitExpensesEnabled = hasWorkspaceFeature(user, 'fieldVisitExpenses')
  const crm = lead.crm || {}
  const timeline = useMemo(
    () =>
      filterTimelineItems(
        buildUnifiedTimeline(crm, { marketingEvents: marketingTimeline, indexedActivities }),
        timelineFilter
      ),
    [crm, marketingTimeline, indexedActivities, timelineFilter]
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
    const emailDraft = consumePendingEmailDraft(lead.id)
    if (emailDraft) {
      setSubject(emailDraft.subject || '')
      setBody(emailDraft.body || '')
      if (emailDraft.agenda) setEmailAgenda(emailDraft.agenda)
      setTab('email')
    } else {
      const validTab = TABS.some((t) => t.id === pendingTab) ? pendingTab : null
      setTab(validTab || 'overview')
    }
    setSenderCompany(user?.organizationName || user?.company || '')
  }, [lead.id, user?.organizationName, user?.company, consumePendingLeadTab, consumePendingEmailDraft])

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
    api
      .getCrmLeadTimeline(lead.id)
      .then((data) => {
        setMarketingTimeline(data.marketingEvents || [])
        setIndexedActivities(data.indexedActivities || [])
      })
      .catch(() => {
        setMarketingTimeline([])
        setIndexedActivities([])
      })
  }, [lead.id])

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
    loadChromeExtensionDistribution()
      .then((dist) => setExtensionStoreUrl(dist.storeUrl))
      .catch(() => {})
  }, [])

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
          emailStrategyMode: data.emailStrategy?.mode || 'extension_first',
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
          emailStrategyMode: 'extension_first',
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
          emailStrategyMode: data.emailStrategy?.mode || 'extension_first',
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

  const saveNotes = async ({ persistNoteActivity = false, showNotice = false } = {}) => {
    const saved = lead.crm?.notes || ''
    if (notes === saved) return
    await runPatch(
      { crm: { notes }, persistNoteActivity },
      showNotice ? 'Notes saved' : null,
      'notes'
    )
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
    if (!hasEmailConsent) {
      setError(COMMERCIAL_EMAIL_CONSENT_MESSAGE)
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
      await refreshPipelineLead?.(lead.id, { silent: true })
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
      await refreshPipelineLead?.(lead.id, { silent: true })
      setNotice('Reply logged — lead marked as replied')
    } catch (e) {
      setError(e.message)
    } finally {
      setThreadSyncing(false)
    }
  }

  const contactId = lead.contactId || lead.id

  const canSendEmail = Boolean(gmailStatus.connected || orgEmail?.userCanSend || user?.orgOutboundEmailReady)
  const hasEmailConsent = leadHasCommercialEmailConsent(lead)
  const busy = saving || sending || generating || connectingGmail || waGenerating || threadSyncing || savingConsent
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

  const handleEmailConsentChange = async (next) => {
    setSavingConsent(true)
    setError(null)
    try {
      await patchLead(lead.id, { emailConsent: next })
      setNotice(next ? 'Commercial email consent recorded' : 'Commercial email consent removed')
    } catch (e) {
      setError(e.message)
    } finally {
      setSavingConsent(false)
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
          ? 'crm-record-panel lw-root fixed inset-0 z-[75] md:static md:inset-auto shrink-0'
          : 'crm-drawer lw-root fixed inset-0 z-[75] md:static md:inset-auto md:w-full md:max-w-[420px] shrink-0'
      }
    >
      <TeamIntelReturnBanner onNavigate={onNavigate} onCloseLead={onClose} />
      <header className="lw-header">
        <div className="lw-header__top">
          <div className="lw-header__avatar" aria-hidden>
            {leadInitials(lead)}
          </div>
          <div className="lw-header__info">
            <h2 className="lw-header__name">
              {[lead.firstName, lead.lastName].filter(Boolean).join(' ')}
            </h2>
            <p className="lw-header__meta">
              {[lead.title, lead.company].filter(Boolean).join(' · ')}
            </p>
            <span className={`lw-header__status ${statusMeta.color || ''}`}>{statusMeta.label}</span>
          </div>
          <button type="button" onClick={onClose} className="lw-header__close" aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <nav className="lw-tabs" role="tablist" aria-label="Lead sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`lw-tab ${tab === t.id ? 'is-active' : ''}`}
            >
              <t.Icon className="lw-tab__icon" />
              <span className="lw-tab__label--long">{t.label}</span>
              <span className="lw-tab__label--short">{t.shortLabel}</span>
            </button>
          ))}
        </nav>
        {(notice || savingScope === 'general') && (
          <div className="pb-2 pt-1">
            <LwNotice type={savingScope === 'general' ? 'warn' : 'success'}>
              {savingScope === 'general' ? 'Saving…' : notice}
            </LwNotice>
          </div>
        )}
      </header>

      <div className="lw-body">
        {tab === 'overview' && (
          <>
            <LeadCallLogCard lead={lead} saving={saving} onLog={logCallActivity} onSuccess={setNotice} />

            <LwSection icon={PipelineIcon} title="Pipeline status">
              <LwField label="Status">
                <LwSelect value={status} onChange={(e) => changeStatus(e.target.value)}>
                  {statusOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </LwSelect>
              </LwField>
              {crm.leadScore != null && (
                <div className="lw-score">
                  Score <strong>{crm.leadScore}</strong>/100
                </div>
              )}
            </LwSection>

            {user?.accountType === 'company' && (
              <LwSection icon={TaskIcon} title="Tags">
                <LeadTagsEditor
                  lead={lead}
                  orgLeadTags={orgLeadTags}
                  onSave={async (tagIds) => {
                    await updateLeadCrmFromContext(lead.id, { tagIds })
                    setNotice('Tags updated')
                  }}
                />
              </LwSection>
            )}

            {lead.tradingProfile?.firstShipmentAt || lead.tradingProfile?.active ? (
              <div className="lw-trading-card">
                <h3 className="lw-trading-card__title">Active trading</h3>
                <LwInfoGrid
                  items={[
                    {
                      label: 'First shipment',
                      value: lead.tradingProfile.firstShipmentAt
                        ? new Date(lead.tradingProfile.firstShipmentAt).toLocaleDateString()
                        : '—',
                    },
                    {
                      label: 'Last shipment',
                      value: lead.tradingProfile.lastShipmentAt
                        ? new Date(lead.tradingProfile.lastShipmentAt).toLocaleDateString()
                        : '—',
                    },
                    { label: 'Shipments', value: String(lead.tradingProfile.shipmentCount ?? 0) },
                    ...(lead.tradingProfile.customerCode
                      ? [{ label: 'Customer code', value: lead.tradingProfile.customerCode }]
                      : []),
                  ]}
                />
                {onNavigate && hasWorkspaceFeature(user, 'panelActiveCustomers') && (
                  <LwBtn
                    variant="ghost"
                    className="mt-2"
                    onClick={() => onNavigate('active-customers')}
                  >
                    Active customers
                    <ChevronRightIcon className="lw-btn__icon" />
                  </LwBtn>
                )}
              </div>
            ) : null}

            <div className="lw-section lw-section--padded">
              <LwStatCard
                label="Open deals"
                value={formatDealValue(crm.dealValue)}
                sub={`${(crm.deals || []).length} total`}
                action={<LwLinkBtn onClick={() => setTab('deals')}>Manage</LwLinkBtn>}
              />
            </div>

            {user?.accountType === 'company' && (
              <LwSection icon={SparkIcon} title="Sales sequence">
                <div className="lw-btn-row">
                  <LwSelect
                    value={enrollSequenceId}
                    onChange={(e) => setEnrollSequenceId(e.target.value)}
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
                  </LwSelect>
                  <LwBtn
                    variant="brand"
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
                  >
                    Enroll
                  </LwBtn>
                </div>
              </LwSection>
            )}

            {canAssignThisLead && user?.accountType === 'company' && teamMembers.length > 0 && (
              <LwSection icon={TeamIcon} title={isUnassignedLead ? 'Claim lead' : 'Assign lead'}>
                {isUnassignedLead && !isManager && (
                  <LwBtn
                    variant="accent"
                    className="lw-btn--block mb-2"
                    onClick={async () => {
                      setError(null)
                      try {
                        await assignLead(lead.id, user.id)
                        setNotice('Lead assigned to you')
                      } catch (err) {
                        setError(err.message)
                      }
                    }}
                  >
                    Assign to me
                  </LwBtn>
                )}
                {(isManager || !isUnassignedLead) && (
                  <LwSelect
                    value={String(lead.assignedToUserId || '')}
                    onChange={async (e) => {
                      setError(null)
                      try {
                        await assignLead(lead.id, e.target.value || null)
                        setNotice(e.target.value ? 'Contact assigned' : 'Contact unassigned')
                      } catch (err) {
                        setError(err.message)
                      }
                    }}
                  >
                    <option value="">Unassigned</option>
                    {teamMembers.map((m) => (
                      <option key={m.userId} value={String(m.userId)}>
                        {m.name}
                      </option>
                    ))}
                  </LwSelect>
                )}
                <p className="lw-muted lw-muted--sm" style={{ marginTop: 8 }}>
                  Reps only see leads assigned to them in Pipeline. Managers: pick a teammate here to
                  share access, or schedule a task/meeting for them.
                </p>
              </LwSection>
            )}

            <LwSection
              icon={PeopleIcon}
              title="Contact"
              action={
                <LwBtn variant="ghost" icon={PencilIcon} onClick={() => openContact(contactId)}>
                  Edit
                </LwBtn>
              }
            >
              <LwContactGrid
                rows={[
                  {
                    label: 'Name',
                    value: [lead.firstName, lead.lastName].filter(Boolean).join(' ') || '—',
                  },
                  { label: 'Company', value: lead.company || '—' },
                  {
                    label: 'Email',
                    value: (
                      <span className="inline-flex items-center gap-1 flex-wrap">
                        <EmailValidationIcon lead={lead} />
                        {lead.email || '—'}
                      </span>
                    ),
                  },
                  {
                    label: 'Phone',
                    value: (
                      <LeadPhoneCall phone={lead.phone} leadId={lead.id} pipelineCallIcon showNumber />
                    ),
                  },
                  {
                    icon: MapPinIcon,
                    label: 'Location',
                    value: lead.location || [lead.city, lead.state].filter(Boolean).join(', ') || '—',
                  },
                ]}
              />
            </LwSection>

            <LwSection icon={LogIcon} title="Activity">
              <LwInfoGrid
                items={[
                  { label: 'Last communication', value: formatDateTime(crm.lastCommunicationAt) },
                  { label: 'Type', value: ACTIVITY_LABELS[crm.lastCommunicationType] || '—' },
                  { label: 'Next follow-up', value: formatDateTime(crm.nextFollowUpAt) },
                  { label: 'Last email', value: formatCrmDate(crm.lastEmailSentAt) },
                ]}
              />
              {crm.lastCommunicationSummary ? (
                <div className="lw-info-grid__item lw-info-grid__item--wide mt-2">
                  <span className="lw-info-grid__label">Summary</span>
                  <span className="lw-info-grid__value">{crm.lastCommunicationSummary}</span>
                </div>
              ) : null}
            </LwSection>
          </>
        )}

        {tab === 'deals' && (
          <div className="lw-deals">
            <LeadDealsSection
              lead={lead}
              user={user}
              patchLead={patchLead}
              busy={savingScope !== null && savingScope !== 'deal'}
              onNotice={setNotice}
              onError={setError}
            />
          </div>
        )}

        {tab === 'notes' && (
          <>
            <LwSection icon={NoteIcon} title="Customer notes">
              <LwTextarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => {
                  if (notesSaveTimerRef.current) clearTimeout(notesSaveTimerRef.current)
                  saveNotes({ persistNoteActivity: true, showNotice: true })
                }}
                rows={4}
                placeholder="Requirements, pricing, decision makers…"
              />
            </LwSection>

            <LwSection icon={LogIcon} title="Timeline">
              <div className="lw-chip-row mb-3">
                {TIMELINE_FILTERS.map((f) => (
                  <LwChip key={f.id} active={timelineFilter === f.id} onClick={() => setTimelineFilter(f.id)}>
                    {f.label}
                  </LwChip>
                ))}
              </div>
              {timeline.length ? (
                <LwTimeline
                  items={timeline}
                  renderItem={(item) => (
                    <LwTimelineCard
                      badge={timelineTypeLabel(item.type)}
                      title={item.title}
                      subtitle={item.subtitle}
                      at={formatDateTime(item.at)}
                    >
                      {item.meta?.answers?.length > 0 && (
                        <ul className="mt-2 pt-2 border-t border-[var(--lw-border)] space-y-1 text-xs text-[var(--lw-text-secondary)]">
                          {item.meta.answers.map((row) => (
                            <li key={row.fieldId || row.label}>
                              <span className="font-medium">{row.label}: </span>
                              {row.value}
                            </li>
                          ))}
                        </ul>
                      )}
                    </LwTimelineCard>
                  )}
                />
              ) : (
                <LwEmpty>No activity yet</LwEmpty>
              )}
            </LwSection>
          </>
        )}

        {tab === 'schedule' && (
          <>
            <LwSection icon={TaskIcon} title="Tasks">
              <LwFormStack onSubmit={addTask}>
                <LwField label="Title">
                  <LwInput value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Follow up on quote" />
                </LwField>
                <LwField label="Due">
                  <LwInput type="datetime-local" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} required />
                </LwField>
                {canScheduleForTeam && teamMembers.length > 0 && (
                  <LwField label="Assign to">
                    <LwSelect value={taskAssignee} onChange={(e) => setTaskAssignee(e.target.value)}>
                      {teamMembers.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.name}
                        </option>
                      ))}
                    </LwSelect>
                  </LwField>
                )}
                {teamMembers.length > 0 && (
                  <TeamParticipantPicker
                    members={teamMembers}
                    primaryUserId={canScheduleForTeam ? taskAssignee : user.id}
                    value={taskParticipants}
                    onChange={setTaskParticipants}
                  />
                )}
                <LwSubmitBtn variant="brand" icon={PlusIcon} disabled={busy || savingTask}>
                  {savingTask ? 'Saving…' : 'Add task'}
                </LwSubmitBtn>
                {scheduleFeedback?.form === 'task' && <LwNotice>{scheduleFeedback.message}</LwNotice>}
              </LwFormStack>
              {(crm.tasks || []).length > 0 && (
                <ul className="lw-list mt-3">
                  {(crm.tasks || []).map((t) => (
                    <LwListItem
                      key={t.id}
                      title={t.title}
                      meta={`Due ${formatDateTime(t.dueAt)}`}
                      muted={Boolean(t.completedAt)}
                      action={
                        !t.completedAt ? (
                          <LwLinkBtn onClick={() => completeTask(t.id)}>Done</LwLinkBtn>
                        ) : null
                      }
                    />
                  ))}
                </ul>
              )}
            </LwSection>

            <LwDivider label="Meetings" />

            <LwSection icon={CalendarIcon} title="Schedule meeting">
              <LwFormStack onSubmit={addMeeting}>
                <LwField label="Title">
                  <LwInput value={meetingTitle} onChange={(e) => setMeetingTitle(e.target.value)} placeholder="Discovery call" />
                </LwField>
                <LwField label="Type">
                  <LwSelect value={meetingType} onChange={(e) => setMeetingType(e.target.value)}>
                    {MEETING_TYPES.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </LwSelect>
                </LwField>
                <LwField label="When">
                  <LwInput type="datetime-local" value={meetingWhen} onChange={(e) => setMeetingWhen(e.target.value)} />
                </LwField>
                <LwField label="Location">
                  <LwInput value={meetingLocation} onChange={(e) => setMeetingLocation(e.target.value)} placeholder="Office, Zoom, or address" />
                </LwField>
                <LwField label="Agenda">
                  <LwTextarea value={meetingNotes} onChange={(e) => setMeetingNotes(e.target.value)} rows={2} placeholder="Topics to cover" />
                </LwField>
                {canScheduleForTeam && teamMembers.length > 0 && (
                  <LwField label="Owner">
                    <LwSelect value={meetingAssignee} onChange={(e) => setMeetingAssignee(e.target.value)}>
                      {teamMembers.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.name}
                        </option>
                      ))}
                    </LwSelect>
                  </LwField>
                )}
                {teamMembers.length > 0 && (
                  <TeamParticipantPicker
                    members={teamMembers}
                    primaryUserId={canScheduleForTeam ? meetingAssignee : user.id}
                    value={meetingParticipants}
                    onChange={setMeetingParticipants}
                    label="Attendees"
                  />
                )}
                <LwSubmitBtn variant="primary" icon={CalendarIcon} disabled={busy || savingMeeting}>
                  {savingMeeting ? 'Scheduling…' : 'Schedule meeting'}
                </LwSubmitBtn>
                {scheduleFeedback?.form === 'meeting' && <LwNotice>{scheduleFeedback.message}</LwNotice>}
              </LwFormStack>
            </LwSection>

            <LwDivider label="Field visits" />

            <LwSection icon={MapPinIcon} title={fieldVisitExpensesEnabled ? 'Field visit & travel' : 'Field visit'}>
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
                <LwFormStack
                  onSubmit={(e) => {
                    e.preventDefault()
                    recordVisit()
                  }}
                >
                  <LwField label="Visit">
                    <LwSelect value={visitMeetingId} onChange={(e) => setVisitMeetingId(e.target.value)}>
                      <option value="">Select scheduled visit</option>
                      {(crm.meetings || [])
                        .filter((m) => m.type === 'field_visit')
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.title} · {formatDateTime(m.scheduledAt)}
                          </option>
                        ))}
                    </LwSelect>
                  </LwField>
                  <LwField label="Outcome">
                    <LwSelect value={visitOutcome} onChange={(e) => setVisitOutcome(e.target.value)}>
                      <option value="completed">Completed</option>
                      <option value="rescheduled">Rescheduled</option>
                      <option value="no_show">No show</option>
                    </LwSelect>
                  </LwField>
                  <LwField label="Notes">
                    <LwTextarea
                      value={visitNotes}
                      onChange={(e) => setVisitNotes(e.target.value)}
                      rows={3}
                      placeholder="Outcomes and next steps"
                    />
                  </LwField>
                  <LwSubmitBtn variant="brand" disabled={busy || savingVisit}>
                    {savingVisit ? 'Saving…' : 'Save visit report'}
                  </LwSubmitBtn>
                </LwFormStack>
              )}
              {scheduleFeedback?.form === 'visit' && (
                <div className="mt-2">
                  <LwNotice>{scheduleFeedback.message}</LwNotice>
                </div>
              )}
            </LwSection>

            {fieldVisitExpensesEnabled && recordedFieldVisits.length > 0 && !editingVisitMeeting ? (
              <LwSection title="Recorded visits">
                <ul className="lw-list">
                  {recordedFieldVisits.map((m) => (
                    <LwListItem
                      key={m.id}
                      title={m.title}
                      meta={`${formatDateTime(m.actualVisitAt || m.visitRecordedAt)} · ${m.visitOutcome}${
                        m.visitTravel?.claimAmount > 0 ? ` · ₹${m.visitTravel.claimAmount}` : ''
                      }`}
                      action={
                        <LwLinkBtn onClick={() => setEditingVisitMeetingId(m.id)}>Edit</LwLinkBtn>
                      }
                    />
                  ))}
                </ul>
              </LwSection>
            ) : null}

            {(crm.meetings || []).length > 0 && (
              <LwSection icon={CalendarIcon} title="Upcoming">
                <ul className="lw-list">
                  {(crm.meetings || []).map((m) => (
                    <li key={m.id} className="lw-list-item is-highlight">
                      <div className="lw-list-item__main">
                        <p className="lw-list-item__title">{m.title}</p>
                        <p className="lw-list-item__meta">
                          {formatDateTime(m.scheduledAt)} · {m.type}
                          {m.visitRecordedAt ? ' · Visit logged' : ''}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </LwSection>
            )}
          </>
        )}

        {tab === 'email' && (
          <>
            {!canSendEmail && (
              <LwSection icon={MailIcon} title="Connect email">
                <LwBtn
                  variant="brand"
                  className="lw-btn--block"
                  icon={MailIcon}
                  onClick={connectWorkGmail}
                  disabled={busy || !gmailStatus.gmailConnectAvailable}
                >
                  {connectingGmail ? 'Connecting…' : 'Connect work email'}
                </LwBtn>
                {user?.isOrgAdmin && onNavigate && (
                  <LwBtn variant="secondary" className="lw-btn--block mt-2" onClick={() => onNavigate('team')}>
                    Team email settings
                  </LwBtn>
                )}
              </LwSection>
            )}

            {canSendEmail && gmailStatus.connected && (
              <LwNotice type="info">
                Sending via <strong>{gmailStatus.mailbox}</strong>
              </LwNotice>
            )}

            {!hasEmailConsent && (
              <LwAlert type="warn">
                <label className="lw-check-row">
                  <input
                    type="checkbox"
                    checked={hasEmailConsent}
                    disabled={busy}
                    onChange={(e) => handleEmailConsentChange(e.target.checked)}
                  />
                  <span>Contact agreed to receive commercial email</span>
                </label>
                <p className="text-xs mt-2 mb-0 opacity-90">{COMMERCIAL_EMAIL_CONSENT_MESSAGE}</p>
              </LwAlert>
            )}

            <CrmEmailThread
              lead={lead}
              emails={crm.emails || []}
              gmailConnected={gmailStatus.connected}
              gmailConnectAvailable={gmailStatus.gmailConnectAvailable}
              inboundReplySync={gmailStatus.inboundReplySync}
              replySyncEnabled={gmailStatus.replySyncEnabled}
              extensionStoreUrl={extensionStoreUrl}
              emailStrategyMode={gmailStatus.emailStrategyMode}
              busy={threadSyncing || sending}
              onSync={handleSyncEmailThread}
              onLogReply={handleLogReply}
              onConnectGmail={connectWorkGmail}
            />

            <LwSection
              icon={PencilIcon}
              title="Signature"
              action={
                <LwLinkBtn onClick={() => setShowSignatureEditor((v) => !v)}>
                  {showSignatureEditor ? 'Hide' : emailSignature ? 'Edit' : 'Add'}
                </LwLinkBtn>
              }
            >
              {!showSignatureEditor && emailSignature && (
                <p className="text-sm whitespace-pre-wrap lw-input">{emailSignature}</p>
              )}
              {showSignatureEditor && (
                <>
                  <LwTextarea
                    value={emailSignature}
                    onChange={(e) => setEmailSignature(e.target.value)}
                    rows={4}
                    placeholder={'Best regards,\nYour Name\nCompany'}
                  />
                  <LwBtn variant="secondary" className="mt-2" onClick={handleSaveSignature} disabled={savingSignature}>
                    {savingSignature ? 'Saving…' : 'Save signature'}
                  </LwBtn>
                </>
              )}
              <label className="lw-check-row mt-2">
                <input type="checkbox" checked={includeSignature} onChange={(e) => setIncludeSignature(e.target.checked)} />
                Include when sending
              </label>
            </LwSection>

            <LwSection icon={SparkIcon} title="Compose">
              <div className="lw-form-stack">
                <LwField label="Company">
                  <LwInput value={senderCompany} onChange={(e) => setSenderCompany(e.target.value)} placeholder="Your company" />
                </LwField>
                <LwField label="Agenda">
                  <LwTextarea
                    value={emailAgenda}
                    onChange={(e) => setEmailAgenda(e.target.value)}
                    rows={2}
                    placeholder="What should this email achieve?"
                  />
                </LwField>
                <LwField label="Key points">
                  <LwTextarea
                    value={emailKeyPoints}
                    onChange={(e) => setEmailKeyPoints(e.target.value)}
                    rows={2}
                    placeholder="Optional details"
                  />
                </LwField>
                <div className="lw-btn-row">
                  <LwSelect value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                    {EMAIL_PURPOSES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </LwSelect>
                  <LwBtn variant="ai" icon={SparkIcon} onClick={handleGenerate} disabled={busy || emailAgenda.trim().length < 8}>
                    {generating ? 'Drafting…' : 'AI draft'}
                  </LwBtn>
                </div>
                <LwField label="Subject">
                  <LwInput value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject line" />
                </LwField>
                <LwField label="Cc">
                  <LwInput value={emailCc} onChange={(e) => setEmailCc(e.target.value)} placeholder="Optional" />
                </LwField>
                <LwField label="Message">
                  <LwTextarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} />
                </LwField>
                <div>
                  <label className="lw-btn lw-btn--secondary cursor-pointer">
                    Attach files
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleAttachmentPick}
                      disabled={busy || emailAttachments.length >= MAX_EMAIL_ATTACHMENTS}
                    />
                  </label>
                  {emailAttachments.length > 0 && (
                    <ul className="lw-attachments mt-2">
                      {emailAttachments.map((file, index) => (
                        <li key={`${file.filename}-${index}`} className="lw-attachment">
                          <span className="lw-attachment__name">
                            {file.filename} ({formatAttachmentSize(file.sizeBytes)})
                          </span>
                          <LwLinkBtn onClick={() => removeAttachment(index)}>Remove</LwLinkBtn>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <LwBtn
                  variant="primary"
                  className="lw-btn--block"
                  icon={MailIcon}
                  onClick={handleSend}
                  disabled={busy || !canSendEmail || !hasEmailConsent}
                >
                  {sending ? 'Sending…' : 'Send & log'}
                </LwBtn>
              </div>
            </LwSection>
          </>
        )}

        {tab === 'whatsapp' && (
          <>
            {!hasLeadPhone && (
              <LwAlert type="warn">Add a valid phone number to message this lead.</LwAlert>
            )}

            <LwSection icon={WhatsAppIcon} title="Message">
              <LwField label="Template">
                <LwSelect
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
                >
                  <option value="">Choose template…</option>
                  <optgroup label="Presets">
                    {STARTER_TEMPLATES.map((s) => (
                      <option key={s.id} value={`preset:${s.id}`}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                  {waTemplates.length > 0 && (
                    <optgroup label="Saved">
                      {waTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </LwSelect>
              </LwField>
              <div className="lw-form-stack mt-2">
                <LwField label="Agenda">
                  <LwTextarea
                    value={waAgenda}
                    onChange={(e) => setWaAgenda(e.target.value)}
                    rows={2}
                    placeholder="Goal of this message"
                  />
                </LwField>
                <LwField label="Key points">
                  <LwTextarea
                    value={waKeyPoints}
                    onChange={(e) => setWaKeyPoints(e.target.value)}
                    rows={2}
                    placeholder="Optional"
                  />
                </LwField>
                <LwBtn variant="ai" icon={SparkIcon} className="lw-btn--block" onClick={handleGenerateWhatsApp} disabled={busy || waAgenda.trim().length < 8}>
                  {waGenerating ? 'Drafting…' : 'AI draft'}
                </LwBtn>
                <LwField label="Message">
                  <LwTextarea
                    value={waMessage}
                    onChange={(e) => setWaMessage(e.target.value)}
                    rows={6}
                    placeholder="WhatsApp message"
                  />
                </LwField>
                <LwBtn
                  variant="whatsapp"
                  icon={WhatsAppIcon}
                  className="lw-btn--block"
                  onClick={openWhatsApp}
                  disabled={busy || !hasLeadPhone || !waMessage.trim()}
                >
                  Open WhatsApp & log
                </LwBtn>
                {onNavigate && (
                  <LwBtn variant="secondary" className="lw-btn--block" onClick={() => onNavigate('marketing', { tab: 'audiences', audienceTab: 'inbox' })}>
                    Team WA Inbox
                  </LwBtn>
                )}
              </div>
            </LwSection>
          </>
        )}

        {error && <LwAlert>{error}</LwAlert>}
      </div>

      <footer className="lw-footer">
        <span className="lw-footer__chip">
          <MailIcon className="lw-footer__chip-icon" aria-hidden />
          <EmailValidationIcon lead={lead} />
          <span className="truncate">{lead.email || 'No email'}</span>
        </span>
        <span className="lw-footer__chip lw-footer__chip--phone">
          <LeadPhoneCall phone={lead.phone} leadId={lead.id} numberClassName="text-xs truncate" />
        </span>
      </footer>
    </aside>
  )
}
