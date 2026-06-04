import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { DEFAULT_THEME } from '../../lib/marketingEmailDesign'
import MarketingTemplateBuilder, { FOLLOW_UP_STARTER } from './MarketingTemplateBuilder'
import MarketingFormBuilder from './MarketingFormBuilder'
import { DEFAULT_FORM_FIELDS, DEFAULT_FORM_THEME } from '../../../../lib/marketingFormSchema.js'
import LoadingExperience from '../ui/LoadingExperience'
import CampaignReportsView, { campaignToForm } from './CampaignReportsView'
import MarketingListsPanel from './MarketingListsPanel'
import WhatsAppInboxPanel from './WhatsAppInboxPanel'
import MarketingCreatorBadge, { marketingOptionLabel } from './MarketingCreatorBadge'
import WorkEmailOptions from '../team/WorkEmailOptions'
import { LOADING_MESSAGES } from '../../lib/loadingQuotes'
import { leadHasCallablePhone } from '../../lib/phoneUtils'
import useIsMobile from '../../hooks/useIsMobile'
import MarketingCampaignSetupFields from './MarketingCampaignSetupFields'
import MarketingCampaignWizardModal from './MarketingCampaignWizardModal'

const TABS = [
  { id: 'campaigns', label: 'Campaigns', short: 'Camp' },
  { id: 'inbox', label: 'WA Inbox', short: 'WA' },
  { id: 'lists', label: 'Lists', short: 'List' },
  { id: 'reports', label: 'Reports', short: 'Rpt' },
  { id: 'templates', label: 'Templates', short: 'Tpl' },
  { id: 'forms', label: 'Forms', short: 'Form' },
]

const MOBILE_TABS = TABS.filter((t) => !['templates', 'forms'].includes(t.id))

const EMPTY_TEMPLATE = {
  name: '',
  subject: '',
  body: '',
  blocks: [],
  design: { ...DEFAULT_THEME },
  previewText: '',
}
const EMPTY_FORM = {
  name: '',
  title: '',
  description: '',
  submitLabel: 'Submit',
  fields: DEFAULT_FORM_FIELDS,
  theme: { ...DEFAULT_FORM_THEME },
}

const EMPTY_CAMPAIGN = {
  name: '',
  channel: 'email',
  listId: '',
  templateId: '',
  subject: '',
  body: '',
  blocks: [],
  design: { ...DEFAULT_THEME },
  previewText: '',
  step2Subject: '',
  step2Body: '',
  step2Blocks: [],
  step2Design: { ...DEFAULT_THEME },
  step2PreviewText: '',
  step2Delay: 3,
  useSequence: false,
}

export default function MarketingPanel({ onNavigate, panelOptions, isActive = true }) {
  const { savedLeads, refreshSavedLeads, user, teamMembers, refreshTeam } = useApp()
  const [tab, setTab] = useState(panelOptions?.tab || 'campaigns')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  const [lists, setLists] = useState([])
  const [templates, setTemplates] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [reportCampaigns, setReportCampaigns] = useState([])
  const [forms, setForms] = useState([])
  const [marketingTipsOpen, setMarketingTipsOpen] = useState(false)
  const [campaignSetupOpen, setCampaignSetupOpen] = useState(true)
  const [campaignWizardOpen, setCampaignWizardOpen] = useState(false)
  const [campaignDesktopPhase, setCampaignDesktopPhase] = useState('setup')
  const isMobile = useIsMobile()

  const isBuilderTab = tab === 'campaigns' || tab === 'templates'
  const hideMarketingKpis = isBuilderTab || tab === 'reports' || tab === 'lists'
  const hideMarketingHeader =
    !isMobile &&
    (tab === 'templates' || (tab === 'campaigns' && campaignDesktopPhase === 'editor'))
  const visibleTabs = isMobile ? MOBILE_TABS : TABS
  const [summary, setSummary] = useState(null)
  const [gmailStatus, setGmailStatus] = useState(null)
  const [orgCanSend, setOrgCanSend] = useState(false)

  const needsWorkEmail =
    user?.accountType === 'company' &&
    !orgCanSend &&
    gmailStatus &&
    !gmailStatus.connected &&
    gmailStatus.gmailConnectAvailable

  const [templateForm, setTemplateForm] = useState({ ...EMPTY_TEMPLATE })
  const [formForm, setFormForm] = useState({ ...EMPTY_FORM })
  const [campaignForm, setCampaignForm] = useState({
    ...EMPTY_CAMPAIGN,
    design: { ...DEFAULT_THEME },
    step2Design: { ...DEFAULT_THEME },
  })
  const canEnterCampaignEditor =
    Boolean(campaignForm.listId) &&
    Boolean(campaignForm.name.trim()) &&
    (campaignForm.channel !== 'email' || Boolean(campaignForm.subject.trim()))
  const [campaignEmailStep, setCampaignEmailStep] = useState(1)
  const prevTabRef = useRef(tab)
  const skipNextCampaignResetRef = useRef(false)

  const resetCampaignForm = useCallback(() => {
    setCampaignForm({
      ...EMPTY_CAMPAIGN,
      design: { ...DEFAULT_THEME },
      step2Design: { ...DEFAULT_THEME },
    })
    setCampaignEmailStep(1)
    setCampaignSetupOpen(false)
    setCampaignWizardOpen(false)
    setCampaignDesktopPhase('setup')
    setError(null)
  }, [])

  useEffect(() => {
    if (isMobile || tab !== 'campaigns') return
    setCampaignDesktopPhase('setup')
  }, [tab, isMobile])

  useEffect(() => {
    if (isMobile && (tab === 'templates' || tab === 'forms')) {
      setTab('campaigns')
    }
  }, [isMobile, tab])
  const pipelineLeadsWithPhone = useMemo(
    () => (savedLeads || []).filter(leadHasCallablePhone),
    [savedLeads]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getMarketingOverview({ light: true, timeoutMs: 60_000 })
      setLists(data.lists || [])
      setTemplates(data.templates || [])
      const all = data.campaigns || []
      setReportCampaigns(all)
      setCampaigns(all.filter((c) => c.status !== 'archived'))
      setForms(data.forms || [])
      setSummary(data.summary || null)
    } catch (e) {
      setError(e.message || 'Could not load marketing')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (panelOptions?.tab) setTab(panelOptions.tab)
  }, [panelOptions?.tab])

  useEffect(() => {
    if (user?.accountType !== 'company') return
    api
      .getCrmGmailStatus()
      .then(setGmailStatus)
      .catch(() => setGmailStatus(null))
    api
      .getOrgEmailDomain()
      .then((d) => setOrgCanSend(Boolean(d?.userCanSend)))
      .catch(() => setOrgCanSend(false))
  }, [user?.accountType, user?.id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 5000)
    return () => clearTimeout(t)
  }, [notice])

  useEffect(() => {
    if (tab !== 'campaigns') {
      prevTabRef.current = tab
      return
    }
    if (skipNextCampaignResetRef.current) {
      skipNextCampaignResetRef.current = false
      prevTabRef.current = tab
      return
    }
    if (prevTabRef.current !== 'campaigns') {
      resetCampaignForm()
    }
    prevTabRef.current = tab
  }, [tab, resetCampaignForm])

  const saveTemplate = async () => {
    if (!templateForm.name.trim() || !templateForm.subject.trim()) {
      return setError('Template name and subject are required')
    }
    if (!templateForm.blocks?.length && !templateForm.body?.trim()) {
      return setError('Add at least one block or message body')
    }
    setBusy(true)
    setError(null)
    try {
      if (templateForm.id) {
        await api.updateMarketingTemplate(templateForm)
        setNotice('Template updated')
      } else {
        await api.createMarketingTemplate(templateForm)
        setNotice('Template saved')
      }
      setTemplateForm({ ...EMPTY_TEMPLATE, design: { ...DEFAULT_THEME } })
      await load()
      setTab('templates')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const editTemplate = (tpl) => {
    setTemplateForm({
      id: tpl.id,
      name: tpl.name || '',
      subject: tpl.subject || '',
      body: tpl.body || '',
      blocks: tpl.blocks || [],
      design: tpl.design || { ...DEFAULT_THEME },
      previewText: tpl.previewText || '',
    })
    setTab('templates')
  }

  const deleteTemplate = async (id) => {
    if (!window.confirm('Delete this template?')) return
    setBusy(true)
    setError(null)
    try {
      await api.deleteMarketingTemplate(id)
      if (templateForm.id === id) {
        setTemplateForm({ ...EMPTY_TEMPLATE, design: { ...DEFAULT_THEME } })
      }
      setNotice('Template deleted')
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const saveForm = async () => {
    if (!formForm.name.trim()) return setError('Form name is required')
    setBusy(true)
    setError(null)
    try {
      const payload = {
        name: formForm.name.trim(),
        title: formForm.title.trim() || formForm.name.trim(),
        description: formForm.description.trim(),
        submitLabel: formForm.submitLabel.trim() || 'Submit',
        fields: formForm.fields,
        theme: formForm.theme,
      }
      const data = formForm.id
        ? await api.updateMarketingForm({ id: formForm.id, ...payload })
        : await api.createMarketingForm(payload)
      setFormForm({ ...EMPTY_FORM })
      setNotice(formForm.id ? 'Form updated' : 'Form created — copy the public link below')
      await load()
      setTab('forms')
      if (!formForm.id && data.form?.publicUrl) {
        try {
          await navigator.clipboard.writeText(data.form.publicUrl)
          setNotice('Form created — link copied to clipboard')
        } catch {
          // ignore clipboard errors
        }
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const editForm = (f) => {
    setFormForm({
      id: f.id,
      name: f.name,
      title: f.title || '',
      description: f.description || '',
      submitLabel: f.submitLabel || 'Submit',
      fields: f.fields?.length ? f.fields : DEFAULT_FORM_FIELDS,
      theme: f.theme || { ...DEFAULT_FORM_THEME },
    })
  }

  const copyFormLink = async (slug) => {
    const base = window.location.origin
    const url = `${base}/api/marketing/form?slug=${encodeURIComponent(slug)}`
    try {
      await navigator.clipboard.writeText(url)
      setNotice('Form link copied')
    } catch {
      setNotice(url)
    }
  }

  const applyTemplate = (templateId) => {
    if (!templateId) {
      setCampaignForm((prev) => ({ ...prev, templateId: '' }))
      return
    }
    const tpl = templates.find((t) => t.id === templateId)
    if (!tpl) return
    setCampaignForm((prev) => ({
      ...prev,
      templateId,
      subject: tpl.subject,
      body: tpl.body,
      blocks: tpl.blocks || [],
      design: tpl.design || { ...DEFAULT_THEME },
      previewText: tpl.previewText || '',
    }))
  }

  const canSaveCampaignDraft =
    Boolean(campaignForm.listId) &&
    Boolean(campaignForm.name.trim()) &&
    (Boolean(campaignForm.body.trim()) || Boolean(campaignForm.blocks?.length))

  const canOpenCampaignWizard =
    Boolean(campaignForm.listId) && Boolean(campaignForm.name.trim())

  const campaignSaveHint = useMemo(() => {
    if (!campaignForm.listId) return 'Choose a list before saving.'
    if (!campaignForm.name.trim()) return 'Enter a campaign name before saving.'
    if (!campaignForm.body.trim() && !campaignForm.blocks?.length) {
      return 'Go to Design and add at least one block.'
    }
    if (campaignForm.channel === 'email' && !campaignForm.subject.trim()) {
      return 'Enter a subject line on the Design step.'
    }
    return null
  }, [campaignForm])

  const saveCampaignAsTemplate = async () => {
    const isWa = campaignForm.channel === 'whatsapp'
    if (!isWa && !campaignForm.subject.trim()) {
      return setError('Email subject is required to save a template')
    }
    if (!campaignForm.body.trim() && !campaignForm.blocks?.length) {
      return setError('Add message content before saving as template')
    }
    setBusy(true)
    setError(null)
    try {
      await api.createMarketingTemplate({
        name: `${campaignForm.name.trim() || 'Campaign'} template`,
        subject: campaignForm.subject.trim() || campaignForm.name.trim(),
        body: campaignForm.body.trim(),
        blocks: campaignForm.blocks?.length ? campaignForm.blocks : undefined,
        design: campaignForm.design,
        previewText: campaignForm.previewText || undefined,
      })
      setNotice('Saved as template — choose it under “Start fresh” on your next campaign')
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const createCampaign = async () => {
    if (!campaignForm.name.trim()) return setError('Campaign name is required')
    if (!campaignForm.listId) return setError('Choose a list')
    const isWa = campaignForm.channel === 'whatsapp'
    if (!campaignForm.body.trim() && !campaignForm.blocks?.length) {
      return setError('Message content is required')
    }
    if (!isWa && !campaignForm.subject.trim()) {
      return setError('Email subject is required')
    }

    const steps = [
      {
        subject: campaignForm.subject.trim() || campaignForm.name.trim(),
        body: campaignForm.body.trim(),
        blocks: campaignForm.blocks?.length ? campaignForm.blocks : undefined,
        design: campaignForm.design,
        previewText: campaignForm.previewText || undefined,
        delayDays: 0,
      },
    ]
    if (campaignForm.useSequence && (campaignForm.step2Body.trim() || campaignForm.step2Blocks?.length)) {
      steps.push({
        subject: campaignForm.step2Subject.trim() || campaignForm.subject.trim(),
        body: campaignForm.step2Body.trim(),
        blocks: campaignForm.step2Blocks?.length ? campaignForm.step2Blocks : undefined,
        design: campaignForm.step2Design,
        previewText: campaignForm.step2PreviewText || undefined,
        delayDays: Number(campaignForm.step2Delay) || 3,
      })
    }

    setBusy(true)
    setError(null)
    try {
      const data = await api.createMarketingCampaign({
        name: campaignForm.name.trim(),
        channel: campaignForm.channel,
        listId: campaignForm.listId,
        templateId: campaignForm.templateId || undefined,
        type: steps.length > 1 ? 'sequence' : 'one_shot',
        subject: campaignForm.subject.trim(),
        body: campaignForm.body.trim(),
        blocks: campaignForm.blocks?.length ? campaignForm.blocks : undefined,
        design: campaignForm.design,
        previewText: campaignForm.previewText || undefined,
        steps,
      })
      setNotice('Campaign created as draft')
      resetCampaignForm()
      await load()
      return data.campaign?.id
    } catch (e) {
      setError(e.message)
      return null
    } finally {
      setBusy(false)
    }
  }

  const duplicateCampaignForResend = async (campaignId) => {
    setBusy(true)
    setError(null)
    try {
      const data = await api.duplicateMarketingCampaign(campaignId)
      if (data.campaign) {
        skipNextCampaignResetRef.current = true
        setCampaignForm(campaignToForm(data.campaign))
        setCampaignEmailStep(1)
        setCampaignSetupOpen(true)
        setTab('campaigns')
        if (isMobile) setCampaignWizardOpen(true)
        else setCampaignDesktopPhase('editor')
        setNotice('Draft copy ready — review the message and list, then Start campaign to resend.')
      }
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const sendPollRef = useRef(null)
  const sendStateRef = useRef(null)

  const stopCampaignSendPoll = useCallback(() => {
    if (sendPollRef.current) {
      clearTimeout(sendPollRef.current)
      sendPollRef.current = null
    }
    sendStateRef.current = null
  }, [])

  useEffect(() => () => stopCampaignSendPoll(), [stopCampaignSendPoll])

  useEffect(() => {
    if (!isActive) stopCampaignSendPoll()
  }, [isActive, stopCampaignSendPoll])

  const processSendBurst = async (campaignId) => {
    let lastError = null
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await api.processMarketingCampaignSends(campaignId, {
          limit: 8,
          burst: true,
          timeoutMs: 120_000,
          silent: true,
        })
      } catch (e) {
        lastError = e
        const timedOut = /timed out/i.test(e?.message || '')
        if (!timedOut || attempt === 1) throw e
        await new Promise((r) => setTimeout(r, 2000))
      }
    }
    throw lastError
  }

  const drainCampaignQueue = useCallback(
    async (campaignId, enrolled, initial = {}) => {
      if (!isActive) return
      stopCampaignSendPoll()
      const state = {
        campaignId,
        enrolled,
        totalSent: initial.sent || 0,
        totalFailed: initial.failed || 0,
        pending: initial.pending ?? enrolled,
        queued: initial.queued ?? initial.pending ?? enrolled,
        lastError: initial.lastError || null,
      }
      sendStateRef.current = state
      sendPollRef.current = 'draining'

      try {
        let guard = 0
        while (guard < 40 && state.pending > 0) {
          guard += 1
          const chunk = await processSendBurst(campaignId)
          const sent = chunk.sendResult?.sent ?? chunk.sent ?? 0
          const failed = chunk.sendResult?.failed ?? chunk.failed ?? 0
          state.totalSent += sent
          state.totalFailed += failed
          state.pending = chunk.pendingSends ?? 0
          state.queued = chunk.queuedSends ?? state.queued
          state.lastError = chunk.firstError || chunk.sendResult?.firstError || state.lastError

          const parts = [`${state.totalSent} sent`]
          if (state.totalFailed) parts.push(`${state.totalFailed} failed`)
          if (state.pending > 0) parts.push(`${state.pending} due now`)
          if (state.queued > state.pending) parts.push(`${state.queued} in queue`)
          setNotice(`Sending… ${parts.join(' · ')}`)

          if (sent === 0 && failed === 0) break
        }

        if (state.lastError && state.totalSent === 0 && state.totalFailed >= 3) {
          setError(state.lastError)
        } else if (state.pending > 0 && state.totalSent === 0) {
          setError(
            state.lastError ||
              'No emails were sent. Connect Work email in the sidebar, then use Continue sending.'
          )
        } else if (state.pending > 0) {
          setNotice(
            `Sent ${state.totalSent} of ${state.enrolled} — ${state.pending} still due. Click Continue sending or Resume.`
          )
        } else {
          setNotice(
            `Campaign finished — ${state.enrolled} enrolled, ${state.totalSent} sent${
              state.totalFailed ? `, ${state.totalFailed} failed` : ''
            }`
          )
        }
        void load().catch(() => {})
        refreshSavedLeads?.()
      } catch (e) {
        if (state.totalSent > 0) {
          setNotice(
            `Sent ${state.totalSent} so far — ${state.pending || state.queued} still queued. Use Continue sending.`
          )
        } else {
          setError(e.message)
        }
        void load().catch(() => {})
      } finally {
        sendPollRef.current = null
        sendStateRef.current = null
      }
    },
    [isActive, load, refreshSavedLeads, stopCampaignSendPoll]
  )

  const continueCampaignSending = useCallback(
    async (id) => {
      setBusy(true)
      setError(null)
      try {
        const data = await api.resumeMarketingCampaign(id, { timeoutMs: 120_000, silent: true })
        const enrolled = data.campaign?.stats?.enrolled || 0
        await drainCampaignQueue(id, enrolled, {
          sent: data.sendResult?.sent || 0,
          failed: data.sendResult?.failed || 0,
          pending: data.pendingSends ?? 0,
          queued: data.queuedSends ?? 0,
          lastError: data.firstError,
        })
      } catch (e) {
        setError(e.message)
      } finally {
        setBusy(false)
      }
    },
    [drainCampaignQueue]
  )

  const pauseCampaign = async (id) => {
    setBusy(true)
    setError(null)
    try {
      await api.pauseMarketingCampaign(id)
      stopCampaignSendPoll()
      setNotice('Campaign paused — no more emails will send until you resume.')
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const stopCampaign = async (id, name) => {
    const label = name
      ? `Stop “${name}”? Unsent emails will be cancelled.`
      : 'Stop this campaign? Unsent emails will be cancelled.'
    if (!window.confirm(label)) return
    setBusy(true)
    setError(null)
    try {
      await api.stopMarketingCampaign(id)
      stopCampaignSendPoll()
      setError(null)
      setNotice('Campaign stopped — remaining recipients will not receive this email.')
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const startCampaign = async (id) => {
    stopCampaignSendPoll()
    setBusy(true)
    setError(null)
    try {
      const data = await api.startMarketingCampaign(id, { timeoutMs: 300_000 })
      const isWa = data.campaign?.channel === 'whatsapp'
      const enrolled = data.enrolled || 0
      const initialSent = data.sendResult?.sent || 0
      const initialFailed = data.sendResult?.failed || 0
      const pending = data.pendingSends ?? 0

      if (!isWa && enrolled > 0) {
        if (pending > 0) {
          setNotice(
            initialSent || initialFailed
              ? `Campaign started — ${initialSent} sent, sending remaining recipients…`
              : `Sending to ${enrolled} recipients…`
          )
          setBusy(false)
          void drainCampaignQueue(id, enrolled, {
            sent: initialSent,
            failed: initialFailed,
            pending,
            queued: data.queuedSends ?? pending,
            lastError: data.sendResult?.firstError || data.firstError,
          })
          return
        } else if (initialSent === 0 && initialFailed > 0) {
          setError(
            data.sendResult?.firstError ||
              data.firstError ||
              'No emails were sent. Connect Work email in the sidebar, then try again.'
          )
        } else {
          setNotice(
            `Campaign finished — ${enrolled} enrolled, ${initialSent} sent${
              initialFailed ? `, ${initialFailed} failed` : ''
            }`
          )
        }
      } else {
        setNotice(
          isWa
            ? `WhatsApp campaign ready — ${enrolled} contacts. Open Reports to send from your phone.`
            : `Campaign started — ${enrolled} enrolled`
        )
      }
      if (isWa) setTab('reports')
      void load().catch(() => {})
      refreshSavedLeads?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const createAndStart = async () => {
    const id = await createCampaign()
    if (id) await startCampaign(id)
  }

  const handleWizardSaveDraft = async () => {
    setError(null)
    const id = await createCampaign()
    if (id) setCampaignWizardOpen(false)
  }

  const handleWizardSend = async () => {
    setError(null)
    const id = await createCampaign()
    if (id) await startCampaign(id)
  }

  return (
    <div
      className={`crm-workspace flex h-full min-h-0 w-full overflow-hidden ${
        isBuilderTab ? 'marketing-campaigns-shell' : ''
      } ${hideMarketingHeader ? 'marketing-immersive-shell' : ''}`}
    >
      {!hideMarketingHeader && (
      <header className="crm-page-header shrink-0">
        <div className="crm-page-header-top">
          <div className="min-w-0 flex-1">
            <h1 className="crm-page-title">Marketing</h1>
            <p className="crm-page-subtitle">
              {hideMarketingKpis ? (
                <>
                  {tab === 'campaigns'
                    ? 'Build and send campaigns — view stats under Reports.'
                    : tab === 'lists'
                      ? 'Build audience lists from your pipeline for email and WhatsApp.'
                      : tab === 'inbox'
                        ? 'WhatsApp replies from campaigns and pipeline outreach.'
                        : 'Design reusable email templates for your team.'}
                  {needsWorkEmail && tab === 'campaigns' && (
                    <>
                      {' '}
                      <span className="text-amber-800 font-semibold">
                        Connect work email to send.
                      </span>
                    </>
                  )}
                </>
              ) : summary ? (
                <span className="crm-marketing-kpis">
                  <span>
                    <strong>{summary.campaigns}</strong> campaigns
                  </span>
                  <span>
                    <strong>{summary.enrolled}</strong> enrolled
                  </span>
                  <span>
                    <strong>{summary.sent}</strong> sent
                  </span>
                  <span>
                    <strong>{summary.opens}</strong> opens
                  </span>
                  <span>
                    <strong>{summary.clicks}</strong> clicks
                  </span>
                </span>
              ) : (
                'Lists, templates, campaigns, and lead capture forms — logged on each lead in Pipeline.'
              )}
            </p>
          </div>
          <div className="crm-page-actions flex-wrap">
            {(needsWorkEmail ||
              (user?.accountType === 'company' && !isBuilderTab) ||
              (user?.isOrgAdmin && user?.accountType === 'company')) && (
              <button
                type="button"
                onClick={() => setMarketingTipsOpen((o) => !o)}
                className="crm-btn crm-btn-ghost"
              >
                {marketingTipsOpen ? 'Hide tips' : 'Tips'}
              </button>
            )}
            <div
              className={`crm-view-tabs crm-view-tabs--mobile-scroll ${
                isMobile ? 'marketing-mobile-tabs' : ''
              }`}
            >
              {visibleTabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`crm-view-tab crm-view-tab--short ${tab === t.id ? 'is-active' : ''}`}
                >
                  <span className="crm-view-tab-long">{t.label}</span>
                  <span className="crm-view-tab-short">{t.short || t.label.slice(0, 3)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {summary && !hideMarketingKpis && (
          <div className="marketing-summary-strip">
            <span className="marketing-summary-pill">
              <strong>{summary.campaigns || 0}</strong> campaigns
            </span>
            <span className="marketing-summary-pill">
              <strong>{summary.sent || 0}</strong> sent
            </span>
            <span className="marketing-summary-pill">
              <strong>{summary.opens || 0}</strong> opens
            </span>
            <span className="marketing-summary-pill">
              <strong>{summary.clicks || 0}</strong> clicks
            </span>
            <span className="marketing-summary-pill">
              <strong>{lists.length || 0}</strong> lists
            </span>
            <span className="marketing-summary-pill">
              <strong>{templates.length || 0}</strong> templates
            </span>
          </div>
        )}

        {marketingTipsOpen && (
          <div className="pb-3 space-y-2 max-h-[28vh] overflow-y-auto">
            {(user?.isOrgAdmin || user?.orgRole === 'org_admin') && user?.accountType === 'company' ? (
              <p className="crm-alert text-[#516f90] bg-[#f5f8fa] border-[#dfe3eb] mb-0">
                Admins see all team campaigns. Reps only see their own assets.
              </p>
            ) : user?.accountType === 'company' ? (
              <p className="crm-alert text-[#516f90] bg-[#f5f8fa] border-[#dfe3eb] mb-0">
                Connect work Gmail under{' '}
                <button type="button" onClick={() => onNavigate?.('my-email')} className="crm-link-btn p-0">
                  Work email
                </button>{' '}
                before sending email campaigns.
              </p>
            ) : null}
            {needsWorkEmail && (
              <div className="max-w-xl">
                <WorkEmailOptions onNavigate={onNavigate} compact />
              </div>
            )}
            {user?.isOrgAdmin && user?.accountType === 'company' && !user?.whatsappAutoSendReady && (
              <p className="crm-alert crm-alert-error mb-0">
                WhatsApp API:{' '}
                <button
                  type="button"
                  onClick={() => onNavigate?.('whatsapp-settings')}
                  className="crm-link-btn p-0"
                >
                  Workspace → WhatsApp API
                </button>
              </p>
            )}
          </div>
        )}
      </header>
      )}

      {(error || notice) && !hideMarketingHeader && (
        <div className={`shrink-0 px-4 sm:px-6 ${isBuilderTab ? 'pt-1.5' : 'pt-2'}`}>
          {error && <p className="crm-alert crm-alert-error">{error}</p>}
          {notice && <p className="crm-alert crm-alert-success mt-2">{notice}</p>}
        </div>
      )}

      {(error || notice) && hideMarketingHeader && (
        <div className="shrink-0 px-3 py-2 bg-white border-b border-[#e8ecf1]">
          {error && <p className="crm-alert crm-alert-error mb-0">{error}</p>}
          {notice && <p className="crm-alert crm-alert-success mt-2 mb-0">{notice}</p>}
        </div>
      )}

      <div
        className={
          hideMarketingHeader
            ? 'marketing-immersive-body flex-1 min-h-0 flex flex-col bg-white'
            : isBuilderTab
              ? 'panel-body-scroll px-2 sm:px-3 py-1.5 pb-8 flex-1 min-h-0 bg-white'
              : 'crm-page-body'
        }
      >
        {loading ? (
          <div className={isBuilderTab ? '' : 'crm-content-card crm-content-scroll'}>
            <LoadingExperience message={LOADING_MESSAGES.marketing} />
          </div>
        ) : tab === 'campaigns' ? (
          isMobile ? (
            <div className="marketing-mobile-home">
              <div className="marketing-mobile-setup ci-card">
                <h2 className="marketing-mobile-setup-title">New campaign</h2>
                <p className="marketing-mobile-setup-copy">
                  Pick channel, name, list, and an optional template. Continue opens the design wizard.
                </p>
                <MarketingCampaignSetupFields
                  campaignForm={campaignForm}
                  setCampaignForm={setCampaignForm}
                  lists={lists}
                  templates={templates}
                  applyTemplate={applyTemplate}
                  user={user}
                  onNavigate={onNavigate}
                />
                <div className="marketing-mobile-setup-actions">
                  <button
                    type="button"
                    onClick={resetCampaignForm}
                    className="crm-btn crm-btn-secondary"
                  >
                    Start fresh
                  </button>
                  <button
                    type="button"
                    disabled={!canOpenCampaignWizard}
                    onClick={() => {
                      setCampaignEmailStep(1)
                      setCampaignWizardOpen(true)
                    }}
                    className="crm-btn crm-btn-primary flex-1"
                  >
                    Continue
                  </button>
                </div>
                {!canOpenCampaignWizard && (
                  <p className="text-sm text-slate-500 mt-2">
                    Enter a campaign name and choose a list to continue.
                  </p>
                )}
              </div>

              {needsWorkEmail && (
                <div className="px-1">
                  <WorkEmailOptions onNavigate={onNavigate} compact />
                </div>
              )}

              <details className="marketing-mobile-campaigns ci-card">
                <summary className="marketing-mobile-campaigns-summary">
                  Your campaigns ({campaigns.length})
                </summary>
                <div className="px-3 pb-3 space-y-2">
                  {!campaigns.length ? (
                    <p className="text-xs text-gray-500 py-2">No campaigns yet.</p>
                  ) : (
                    campaigns.map((c) => (
                      <CampaignCard
                        key={c.id}
                        campaign={c}
                        busy={busy}
                        onStart={startCampaign}
                        onPause={pauseCampaign}
                        onResume={continueCampaignSending}
                        onStop={stopCampaign}
                        onContinue={continueCampaignSending}
                        onNavigate={onNavigate}
                        showCreator={Boolean(user?.isOrgAdmin && user?.accountType === 'company')}
                      />
                    ))
                  )}
                </div>
              </details>

              {campaignWizardOpen && (
                <MarketingCampaignWizardModal
                  open
                  onClose={() => setCampaignWizardOpen(false)}
                  campaignForm={campaignForm}
                  setCampaignForm={setCampaignForm}
                  setCampaignEmailStep={setCampaignEmailStep}
                  forms={forms}
                  lists={lists}
                  templates={templates}
                  busy={busy}
                  canSaveCampaignDraft={canSaveCampaignDraft}
                  saveHint={campaignSaveHint}
                  error={error}
                  notice={notice}
                  onSaveDraft={handleWizardSaveDraft}
                  onSend={handleWizardSend}
                  onSaveAsTemplate={saveCampaignAsTemplate}
                />
              )}
            </div>
          ) : campaignDesktopPhase === 'setup' ? (
            <div className="marketing-campaign-setup-page flex-1 flex flex-col items-center justify-center p-6 sm:p-10 bg-white">
              <div className="w-full max-w-lg">
                <h2 className="text-xl font-bold text-[#17191c] tracking-tight">New campaign</h2>
                <div className="mt-6">
                <MarketingCampaignSetupFields
                  campaignForm={campaignForm}
                  setCampaignForm={setCampaignForm}
                  lists={lists}
                  templates={templates}
                  applyTemplate={applyTemplate}
                  user={user}
                  onNavigate={onNavigate}
                />
                </div>
                {campaignForm.useSequence && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {[
                      { id: 1, label: 'Message 1' },
                      { id: 2, label: 'Follow-up' },
                    ].map((step) => (
                      <button
                        key={step.id}
                        type="button"
                        onClick={() => setCampaignEmailStep(step.id)}
                        className={`ci-btn !text-xs ${
                          campaignEmailStep === step.id ? 'ci-btn-accent' : 'ci-btn-secondary'
                        }`}
                      >
                        {step.label}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  disabled={!canEnterCampaignEditor}
                  onClick={() => setCampaignDesktopPhase('editor')}
                  className="crm-btn crm-btn-primary w-full mt-6"
                >
                  Continue to design
                </button>
                {!canEnterCampaignEditor && (
                  <p className="text-xs text-[#7c98b6] mt-2 text-center">
                    Enter name, list{campaignForm.channel === 'email' ? ', and subject' : ''} to continue.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="marketing-immersive-editor flex-1 min-h-0 flex flex-col bg-white">
              {campaignForm.useSequence && (
                <div className="shrink-0 flex gap-2 px-3 py-2 border-b border-[#e8ecf1] bg-white">
                  {[
                    { id: 1, label: 'Message 1' },
                    { id: 2, label: 'Follow-up' },
                  ].map((step) => (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => setCampaignEmailStep(step.id)}
                      className={`ci-btn !text-xs ${
                        campaignEmailStep === step.id ? 'ci-btn-accent' : 'ci-btn-secondary'
                      }`}
                    >
                      {step.label}
                    </button>
                  ))}
                </div>
              )}
              {(!campaignForm.useSequence || campaignEmailStep === 1) && (
                <MarketingTemplateBuilder
                  embedded
                  studioMode
                  immersive
                  historyResetKey={`campaign-${campaignForm.channel}-1`}
                  showNameField={false}
                  showSavedTemplates={false}
                  value={{
                    subject: campaignForm.subject,
                    blocks: campaignForm.blocks,
                    design: campaignForm.design,
                    previewText: campaignForm.previewText,
                    body: campaignForm.body,
                  }}
                  onChange={(next) =>
                    setCampaignForm((p) => ({
                      ...p,
                      subject: next.subject ?? p.subject,
                      blocks: next.blocks ?? p.blocks,
                      design: next.design ?? p.design,
                      previewText: next.previewText ?? p.previewText,
                      body: next.body ?? p.body,
                    }))
                  }
                  onBack={() => setCampaignDesktopPhase('setup')}
                  onSaveDraft={async () => {
                    setError(null)
                    await createCampaign()
                  }}
                  onSaveAsTemplate={saveCampaignAsTemplate}
                  onSend={createAndStart}
                  sendDisabled={busy || !canSaveCampaignDraft}
                  draftDisabled={busy || !canSaveCampaignDraft}
                  busy={busy}
                  marketingForms={forms}
                />
              )}
              {campaignForm.useSequence && campaignEmailStep === 2 && (
                <MarketingTemplateBuilder
                  embedded
                  studioMode
                  immersive
                  historyResetKey={`campaign-${campaignForm.channel}-2`}
                  showNameField={false}
                  showSavedTemplates={false}
                  starterOptions={[{ id: 'followup', name: 'Follow-up check-in', ...FOLLOW_UP_STARTER }]}
                  value={{
                    subject: campaignForm.step2Subject,
                    blocks: campaignForm.step2Blocks,
                    design: campaignForm.step2Design,
                    previewText: campaignForm.step2PreviewText,
                    body: campaignForm.step2Body,
                  }}
                  onChange={(next) =>
                    setCampaignForm((p) => ({
                      ...p,
                      step2Subject: next.subject ?? p.step2Subject,
                      step2Blocks: next.blocks ?? p.step2Blocks,
                      step2Design: next.design ?? p.step2Design,
                      step2PreviewText: next.previewText ?? p.step2PreviewText,
                      step2Body: next.body ?? p.step2Body,
                    }))
                  }
                  onBack={() => setCampaignDesktopPhase('setup')}
                  onSaveDraft={async () => {
                    setError(null)
                    await createCampaign()
                  }}
                  onSaveAsTemplate={saveCampaignAsTemplate}
                  onSend={createAndStart}
                  sendDisabled={busy || !canSaveCampaignDraft}
                  draftDisabled={busy || !canSaveCampaignDraft}
                  busy={busy}
                  marketingForms={forms}
                />
              )}
            </div>
          )
        ) : tab === 'lists' ? (
          <MarketingListsPanel
            user={user}
            teamMembers={teamMembers}
            refreshTeam={refreshTeam}
            savedLeads={savedLeads}
            lists={lists}
            setLists={setLists}
            busy={busy}
            setBusy={setBusy}
            setError={setError}
            setNotice={setNotice}
            onListsReload={load}
          />
        ) : tab === 'inbox' ? (
          <div className="crm-content-card crm-content-scroll flex-1 min-h-0">
            <WhatsAppInboxPanel onNavigate={onNavigate} />
          </div>
        ) : tab === 'reports' ? (
          <div className="crm-content-card crm-content-scroll flex-1 min-h-0">
          <CampaignReportsView
            campaigns={reportCampaigns}
            onNavigate={onNavigate}
            onDuplicate={duplicateCampaignForResend}
            onReload={load}
            onPause={pauseCampaign}
            onResume={continueCampaignSending}
            onStop={stopCampaign}
            onContinue={continueCampaignSending}
            busy={busy}
            initialCampaignId={panelOptions?.campaignId}
            showCreator={Boolean(user?.accountType === 'company')}
          />
          </div>
        ) : tab === 'templates' ? (
          <div className="marketing-immersive-editor flex-1 min-h-0 flex flex-col bg-white">
            <MarketingTemplateBuilder
              studioMode
              immersive
              historyResetKey={templateForm.id || 'template-new'}
              value={templateForm}
              onChange={setTemplateForm}
              onSave={saveTemplate}
              onCancel={() =>
                setTemplateForm({ ...EMPTY_TEMPLATE, design: { ...DEFAULT_THEME } })
              }
              busy={busy}
              templates={templates}
              onEdit={editTemplate}
              onDelete={deleteTemplate}
              marketingForms={forms}
            />
          </div>
        ) : (
          <div className="crm-content-card crm-content-scroll">
            <div className="grid lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="crm-section-title mb-0">
                    {formForm.id ? 'Edit form' : 'New capture form'}
                  </h2>
                  {formForm.id && (
                    <button
                      type="button"
                      onClick={() => setFormForm({ ...EMPTY_FORM })}
                      className="crm-link-btn"
                    >
                      Cancel edit
                    </button>
                  )}
                </div>
                <div className="crm-form-grid">
                  <input
                    value={formForm.name}
                    onChange={(e) => setFormForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Internal name"
                    className="crm-input"
                  />
                  <input
                    value={formForm.title}
                    onChange={(e) => setFormForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder="Public title (optional)"
                    className="crm-input"
                  />
                  <textarea
                    value={formForm.description}
                    onChange={(e) => setFormForm((p) => ({ ...p, description: e.target.value }))}
                    rows={2}
                    placeholder="Short description on the form page"
                    className="crm-input"
                  />
                  <input
                    value={formForm.submitLabel}
                    onChange={(e) => setFormForm((p) => ({ ...p, submitLabel: e.target.value }))}
                    placeholder="Submit button label"
                    className="crm-input"
                  />
                </div>
                <MarketingFormBuilder value={formForm} onChange={setFormForm} />
                <button
                  type="button"
                  disabled={busy}
                  onClick={saveForm}
                  className="crm-btn crm-btn-primary"
                >
                  {formForm.id ? 'Save form' : 'Create form'}
                </button>
                <p className="text-xs text-[#7c98b6] leading-relaxed">
                  Build flexible questions like Google Forms. In campaigns, add a <strong>Form</strong> block to
                  email. Responses appear on the lead in{' '}
                  <strong>Pipeline → open lead → Notes &amp; log</strong>.
                </p>
              </section>
              <section>
                <h2 className="crm-section-title">Your forms</h2>
                {!forms.length ? (
                  <p className="text-sm text-[#516f90]">No forms yet.</p>
                ) : (
                  <div className="space-y-2">
                    {forms.map((f) => (
                      <div key={f.id} className="crm-campaign-card text-sm">
                        <p className="font-semibold text-[#33475b]">{f.name}</p>
                        <p className="text-xs text-[#516f90] mt-0.5">
                          {f.submissions || 0} submissions · slug {f.slug}
                        </p>
                        {(f.responses || []).slice(0, 2).map((r) => (
                          <p key={r.id} className="text-sm text-[#7c98b6] mt-1 line-clamp-2">
                            {r.email || 'Anonymous'} ·{' '}
                            {r.answers?.slice(0, 2).map((a) => `${a.label}: ${a.value}`).join(' · ') ||
                              'Submitted'}
                          </p>
                        ))}
                        <div className="mt-2 flex flex-wrap gap-3">
                          <button type="button" onClick={() => editForm(f)} className="crm-link-btn p-0">
                            Edit fields
                          </button>
                          <button
                            type="button"
                            onClick={() => copyFormLink(f.slug)}
                            className="crm-link-btn p-0"
                          >
                            Copy public link
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CampaignCard({
  campaign,
  busy,
  onStart,
  onPause,
  onResume,
  onStop,
  onContinue,
  onNavigate,
  showCreator,
}) {
  const statusClass = {
    draft: 'crm-status-draft',
    active: 'crm-status-active',
    paused: 'crm-status-paused',
    completed: 'crm-status-completed',
    stopped: 'crm-status-paused',
    archived: 'crm-status-paused',
  }
  const stats = campaign.stats || {}
  const enrolled = stats.enrolled || 0
  const sent = stats.recipientsSent ?? stats.sent ?? 0
  const stillQueued = enrolled > sent && ['active', 'paused'].includes(campaign.status)

  return (
    <div className="crm-campaign-card text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-[#33475b]">{campaign.name}</p>
            {showCreator && (
              <MarketingCreatorBadge name={campaign.createdByName} isOwn={campaign.isOwn} />
            )}
          </div>
          <p className="text-xs text-[#516f90] mt-0.5">
            {campaign.type === 'sequence' ? 'Sequence' : 'One-shot'} · {enrolled} enrolled · {sent}{' '}
            sent
            {stillQueued ? ` · ${enrolled - sent} queued` : ''}
            {(stats.opens > 0 || stats.clicks > 0) && (
              <>
                {' '}
                · {stats.opens || 0} opens ({stats.openRate || 0}%) · {stats.clicks || 0} clicks (
                {stats.clickRate || 0}%)
              </>
            )}
            {(stats.unsubscribed > 0) && <> · {stats.unsubscribed} unsubscribed</>}
            {(stats.bounced > 0) && <> · {stats.bounced} bounced</>}
          </p>
        </div>
        <span
          className={`crm-status-pill ${statusClass[campaign.status] || statusClass.draft}`}
        >
          {campaign.status}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-3">
        {(sent > 0 ||
          campaign.status === 'completed' ||
          campaign.status === 'active' ||
          campaign.status === 'stopped') && (
          <button
            type="button"
            onClick={() => onNavigate?.('marketing', { tab: 'reports', campaignId: campaign.id })}
            className="crm-link-btn p-0"
          >
            View report
          </button>
        )}
        {campaign.status === 'draft' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onStart(campaign.id)}
            className="crm-link-btn p-0 disabled:opacity-50"
          >
            Start
          </button>
        )}
        {campaign.status === 'active' && (
          <>
            {stillQueued && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onContinue?.(campaign.id)}
                className="crm-link-btn p-0 disabled:opacity-50"
              >
                Continue sending
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => onPause?.(campaign.id)}
              className="crm-link-btn p-0 disabled:opacity-50"
            >
              Pause
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onStop?.(campaign.id, campaign.name)}
              className="crm-link-btn p-0 text-red-800 disabled:opacity-50"
            >
              Stop
            </button>
          </>
        )}
        {campaign.status === 'paused' && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => onResume?.(campaign.id)}
              className="crm-link-btn p-0 disabled:opacity-50"
            >
              Resume
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onStop?.(campaign.id, campaign.name)}
              className="crm-link-btn p-0 text-red-800 disabled:opacity-50"
            >
              Stop
            </button>
          </>
        )}
      </div>
    </div>
  )
}
