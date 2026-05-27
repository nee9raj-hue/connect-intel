import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { DEFAULT_THEME } from '../../lib/marketingEmailDesign'
import MarketingTemplateBuilder, { FOLLOW_UP_STARTER } from './MarketingTemplateBuilder'
import MarketingFormBuilder from './MarketingFormBuilder'
import { DEFAULT_FORM_FIELDS, DEFAULT_FORM_THEME } from '../../../../lib/marketingFormSchema.js'
import LoadingExperience from '../ui/LoadingExperience'
import CampaignReportsView, { campaignToForm } from './CampaignReportsView'
import MarketingListBuilder from './MarketingListBuilder'
import MarketingListDetail from './MarketingListDetail'
import WhatsAppInboxPanel from './WhatsAppInboxPanel'
import MarketingCreatorBadge, { marketingOptionLabel } from './MarketingCreatorBadge'
import WorkEmailOptions from '../team/WorkEmailOptions'
import { LOADING_MESSAGES } from '../../lib/loadingQuotes'
import { withTimeout } from '../../lib/fetchWithTimeout'
import { leadHasCallablePhone } from '../../lib/phoneUtils'

const TABS = [
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'inbox', label: 'WA Inbox' },
  { id: 'lists', label: 'Lists' },
  { id: 'reports', label: 'Reports' },
  { id: 'templates', label: 'Templates' },
  { id: 'forms', label: 'Forms' },
]

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

export default function MarketingPanel({ onNavigate, panelOptions }) {
  const { savedLeads, refreshSavedLeads, user, teamMembers, refreshTeam } = useApp()
  const [tab, setTab] = useState(panelOptions?.tab || 'campaigns')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  const [lists, setLists] = useState([])
  const [templates, setTemplates] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [forms, setForms] = useState([])
  const [selectedListId, setSelectedListId] = useState(null)
  const [marketingTipsOpen, setMarketingTipsOpen] = useState(false)
  const [campaignSetupOpen, setCampaignSetupOpen] = useState(false)

  const isBuilderTab = tab === 'campaigns' || tab === 'templates'
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
    setError(null)
  }, [])
  const pipelineLeadsWithPhone = useMemo(
    () => (savedLeads || []).filter(leadHasCallablePhone),
    [savedLeads]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await withTimeout(api.getMarketingOverview(), 25_000)
      setLists(data.lists || [])
      setTemplates(data.templates || [])
      setCampaigns(data.campaigns || [])
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
        setNotice('Draft copy ready — review the message and list, then Start campaign to resend.')
      }
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const drainCampaignSends = async (campaignId, totalEnrolled = 0, onProgress) => {
    let pending = totalEnrolled
    let totalSent = 0
    let totalFailed = 0
    let lastError = null
    let rounds = 0
    const maxRounds = Math.ceil(Math.max(totalEnrolled, 50) / 2) + 5
    while (pending > 0 && rounds < maxRounds) {
      rounds += 1
      const chunk = await api.processMarketingCampaignSends(campaignId, {
        limit: 2,
        silent: rounds > 1,
      })
      totalSent += chunk.sendResult?.sent || 0
      totalFailed += chunk.sendResult?.failed || 0
      pending = chunk.pendingSends ?? 0
      lastError = chunk.firstError || chunk.sendResult?.firstError || lastError
      onProgress?.({ sent: totalSent, failed: totalFailed, pending, enrolled: totalEnrolled, lastError })

      if (lastError && totalSent === 0 && totalFailed >= 2) {
        throw new Error(lastError)
      }
      if (chunk.sendResult?.processed === 0 && pending > 0) {
        throw new Error(lastError || 'Could not process sends. Connect Work email in the sidebar, then retry.')
      }
      if (!(chunk.sendResult?.sent || chunk.sendResult?.failed)) break
    }
    return { totalSent, totalFailed, pending, lastError }
  }

  const startCampaign = async (id) => {
    setBusy(true)
    setError(null)
    try {
      const data = await api.startMarketingCampaign(id, { timeoutMs: 45_000 })
      const isWa = data.campaign?.channel === 'whatsapp'
      const enrolled = data.enrolled || 0
      if (!isWa && enrolled > 0) {
        setNotice(`Queued ${enrolled} recipients — sending now…`)
        const drained = await drainCampaignSends(id, data.pendingSends ?? enrolled, (p) => {
          const parts = [`${p.sent} sent`]
          if (p.failed) parts.push(`${p.failed} failed`)
          parts.push(`${p.pending} remaining`)
          setNotice(`Sending… ${parts.join(' · ')}`)
        })
        if (drained.pending > 0 && drained.totalSent === 0) {
          setError(
            drained.lastError ||
              'No emails were sent. Open Work email in the sidebar, connect Gmail, then start a new campaign.'
          )
        } else if (drained.pending > 0) {
          setNotice(
            `Campaign started — ${enrolled} enrolled, ${drained.totalSent} sent, ${drained.totalFailed} failed. ${drained.pending} still queued.`
          )
        } else {
          setNotice(
            `Campaign started — ${enrolled} enrolled, ${drained.totalSent} sent${
              drained.totalFailed ? `, ${drained.totalFailed} failed` : ''
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
      await load()
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

  return (
    <div
      className={`panel-shell ${
        tab === 'campaigns' || tab === 'templates' ? 'marketing-campaigns-shell' : 'bg-[#f0f4f8]'
      }`}
    >
      <header
        className={`marketing-page-header shrink-0 ${
          isBuilderTab ? 'px-3 sm:px-4 py-2.5' : 'px-4 sm:px-6 py-4'
        }`}
      >
        <div className="marketing-brand-stripe" aria-hidden />
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <h1 className={`font-semibold text-gray-900 ${isBuilderTab ? 'text-base' : 'text-lg'}`}>
              Marketing
            </h1>
            {summary && isBuilderTab && (
              <span className="text-[10px] text-gray-400 hidden md:inline">
                {summary.campaigns} campaigns · {summary.sent} sent
              </span>
            )}
            {needsWorkEmail && isBuilderTab && (
              <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded">
                Connect work email to send
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {(needsWorkEmail ||
              (user?.accountType === 'company' && !isBuilderTab) ||
              (user?.isOrgAdmin && user?.accountType === 'company')) && (
              <button
                type="button"
                onClick={() => setMarketingTipsOpen((o) => !o)}
                className="text-[10px] font-semibold px-2 py-1 border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50"
              >
                {marketingTipsOpen ? 'Hide tips' : 'Tips'}
              </button>
            )}
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                  tab === t.id
                    ? 'marketing-tab-active'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-white hover:border-slate-300 shadow-sm'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {!isBuilderTab && (
          <p className="text-sm text-gray-500 mt-2">
            Lists, templates, campaigns, and lead capture forms — logged on each lead in Pipeline.
          </p>
        )}

        {marketingTipsOpen && (
          <div className="mt-2 space-y-2 max-h-[28vh] overflow-y-auto">
            {(user?.isOrgAdmin || user?.orgRole === 'org_admin') && user?.accountType === 'company' ? (
              <p className="text-[11px] text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5">
                Admins see all team campaigns. Reps only see their own assets.
              </p>
            ) : user?.accountType === 'company' ? (
              <p className="text-[11px] text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5">
                Connect work Gmail under{' '}
                <button
                  type="button"
                  onClick={() => onNavigate?.('my-email')}
                  className="font-semibold underline text-[#5b4a00]"
                >
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
              <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5">
                WhatsApp API:{' '}
                <button
                  type="button"
                  onClick={() => onNavigate?.('whatsapp-settings')}
                  className="font-semibold underline text-[#5b4a00]"
                >
                  Workspace → WhatsApp API
                </button>
              </p>
            )}
            {summary && !isBuilderTab && (
              <p className="text-[11px] text-gray-500">
                {summary.campaigns} campaigns · {summary.enrolled} enrolled · {summary.sent} sent ·{' '}
                {summary.opens} opens · {summary.clicks} clicks
              </p>
            )}
          </div>
        )}
      </header>

      {(error || notice) && (
        <div className={`shrink-0 ${isBuilderTab ? 'px-3 sm:px-4 pt-1.5' : 'px-4 sm:px-6 pt-3'}`}>
          {error && (
            <p className="text-xs text-red-800 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          {notice && (
            <p className="text-xs text-green-900 bg-green-50 border border-green-100 rounded-lg px-3 py-2 mt-2">
              {notice}
            </p>
          )}
        </div>
      )}

      <div
        className={
          tab === 'campaigns' || tab === 'templates'
            ? 'panel-body-scroll flex flex-col min-h-0 px-2 sm:px-3 py-1.5'
            : 'panel-body-scroll px-4 sm:px-6 py-4'
        }
      >
        {loading ? (
          <LoadingExperience message={LOADING_MESSAGES.marketing} />
        ) : tab === 'campaigns' ? (
          <div className="marketing-workspace">
            <details
              open={campaignSetupOpen}
              onToggle={(e) => setCampaignSetupOpen(e.target.open)}
              className="marketing-setup-bar ci-card overflow-hidden group"
            >
              <summary className="cursor-pointer list-none px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-[#ecfdf5]/50 bg-gradient-to-r from-[#ecfdf5]/80 to-white">
                <span className="text-sm font-semibold text-slate-900">Campaign setup</span>
                <span className="text-[10px] text-slate-500 group-open:hidden">
                  Name, list, optional template — then design below
                </span>
                <span className="text-[10px] text-slate-500 hidden group-open:inline">Collapse ↑</span>
              </summary>
              <div className="px-4 pb-4 pt-0 space-y-3 border-t border-slate-100">
              <div className="flex flex-wrap gap-2 pt-3">
                {[
                  { id: 'email', label: 'Email campaign' },
                  { id: 'whatsapp', label: 'WhatsApp campaign' },
                ].map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() =>
                      setCampaignForm((p) => ({
                        ...p,
                        channel: ch.id,
                        listId: '',
                        useSequence: ch.id === 'whatsapp' ? p.useSequence : p.useSequence,
                      }))
                    }
                    className={`ci-btn !text-xs ${
                      campaignForm.channel === ch.id ? 'ci-btn-accent' : 'ci-btn-secondary'
                    }`}
                  >
                    {ch.label}
                  </button>
                ))}
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <input
                  value={campaignForm.name}
                  onChange={(e) => setCampaignForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Campaign name"
                  className="ci-input"
                />
                <select
                  value={campaignForm.listId}
                  onChange={(e) => setCampaignForm((p) => ({ ...p, listId: e.target.value }))}
                  className="ci-input"
                >
                  <option value="">Choose list…</option>
                  {lists
                    .filter((l) => (l.channel || 'email') === campaignForm.channel)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {marketingOptionLabel(l)} ({l.leadIds?.length || 0})
                        {l.channel === 'whatsapp' ? ' · WA' : ''}
                      </option>
                    ))}
                </select>
                {!lists.some((l) => (l.channel || 'email') === campaignForm.channel) && (
                  <p className="text-[11px] text-amber-800 mt-1">
                    No {campaignForm.channel === 'whatsapp' ? 'WhatsApp' : 'email'} lists yet — create one
                    under Lists and pick Email or WhatsApp first.
                  </p>
                )}
                <select
                  value={campaignForm.templateId}
                  onChange={(e) => applyTemplate(e.target.value)}
                  className="ci-input"
                >
                  <option value="">
                    {campaignForm.channel === 'whatsapp'
                      ? 'Start fresh (no template)'
                      : 'Start fresh — build below'}
                  </option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {marketingOptionLabel(t)}
                      {t.blocks?.length ? ' (designed)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                {campaignForm.channel === 'email' && (
                <label className="flex items-center gap-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={campaignForm.useSequence}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setCampaignForm((p) => ({
                        ...p,
                        useSequence: checked,
                        step2Blocks:
                          checked && !p.step2Blocks?.length
                            ? FOLLOW_UP_STARTER.blocks.map((b) => ({
                                ...b,
                                id: `blk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                              }))
                            : p.step2Blocks,
                        step2Subject: checked && !p.step2Subject ? FOLLOW_UP_STARTER.subject : p.step2Subject,
                      }))
                      if (checked) setCampaignEmailStep(2)
                    }}
                  />
                  Add follow-up email (visual builder)
                </label>
                )}
                {campaignForm.channel === 'whatsapp' && (
                <label className="flex items-center gap-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={campaignForm.useSequence}
                    onChange={(e) => setCampaignForm((p) => ({ ...p, useSequence: e.target.checked }))}
                  />
                  Add follow-up WhatsApp (after delay)
                </label>
                )}
                {campaignForm.useSequence && (
                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    Send after
                    <input
                      value={campaignForm.step2Delay}
                      onChange={(e) => setCampaignForm((p) => ({ ...p, step2Delay: e.target.value }))}
                      type="number"
                      min={1}
                      max={30}
                      className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-1"
                    />
                    days
                  </label>
                )}
              </div>
              {campaignForm.useSequence && (
                <div className="flex gap-1">
                  {[
                    { id: 1, label: 'Email 1' },
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
              {campaignForm.channel === 'whatsapp' && !user?.whatsappAutoSendReady && user?.isOrgAdmin && (
                <div className="rounded-lg border border-amber-100 bg-amber-50/80 p-3 space-y-2">
                  <p className="text-[11px] text-amber-950 leading-relaxed">
                    Connect WhatsApp Business API to send campaigns automatically.{' '}
                    <button
                      type="button"
                      onClick={() => onNavigate?.('whatsapp-settings')}
                      className="font-semibold underline text-[#5b4a00]"
                    >
                      Open WhatsApp API settings
                    </button>
                  </p>
                </div>
              )}
              </div>
            </details>

            <div className="marketing-builder-slot">
            {(!campaignForm.useSequence || campaignEmailStep === 1) && (
              <MarketingTemplateBuilder
                embedded
                fillHeight
                showNameField={false}
                showSavedTemplates={false}
                title={campaignForm.channel === 'whatsapp' ? 'WhatsApp message 1' : 'Email 1'}
                subtitle={
                  campaignForm.channel === 'whatsapp'
                    ? 'Designed templates are converted to text for WhatsApp. Use {{firstName}}, {{companyName}}, etc.'
                    : 'First message in your campaign — drag blocks to reorder or duplicate.'
                }
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
                marketingForms={forms}
              />
            )}

            {campaignForm.useSequence && campaignEmailStep === 2 && (
              <MarketingTemplateBuilder
                embedded
                fillHeight
                showNameField={false}
                showSavedTemplates={false}
                title="Follow-up email"
                subtitle={`Sent ${campaignForm.step2Delay || 3} days after email 1 — fully designed like Mailchimp.`}
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
                marketingForms={forms}
              />
            )}
            </div>

            <div className="marketing-setup-bar shrink-0 ci-card flex flex-wrap items-center gap-3 px-4 py-2.5">
              <button type="button" onClick={resetCampaignForm} className="ci-btn ci-btn-secondary">
                New campaign
              </button>
              <p className="text-xs text-slate-600 flex-1 min-w-[140px] leading-snug">
                {!campaignForm.listId
                  ? 'Pick a list in setup above to save a draft'
                  : !campaignForm.name.trim()
                    ? 'Add a campaign name'
                    : canSaveCampaignDraft
                      ? 'Ready — save draft or start sending'
                      : 'Add message blocks or body text'}
              </p>
              <button
                type="button"
                disabled={busy || !canSaveCampaignDraft}
                title={
                  !campaignForm.listId
                    ? 'Choose a list first'
                    : !campaignForm.name.trim()
                      ? 'Enter a campaign name'
                      : undefined
                }
                onClick={createCampaign}
                className="ci-btn ci-btn-secondary"
              >
                Save draft
              </button>
              <button
                type="button"
                disabled={busy || !canSaveCampaignDraft}
                onClick={createAndStart}
                className="ci-btn ci-btn-primary"
              >
                {busy
                  ? 'Working…'
                  : campaignForm.channel === 'whatsapp'
                    ? 'Start WhatsApp'
                    : 'Start campaign'}
              </button>
            </div>

            <details className="marketing-setup-bar shrink-0 ci-card">
              <summary className="cursor-pointer list-none px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50/80">
                All campaigns ({campaigns.length}) — click to expand
              </summary>
              <div className="px-4 pb-3 border-t border-slate-100 max-h-[200px] overflow-y-auto">
              {!campaigns.length ? (
                <p className="text-xs text-gray-500 py-2">No campaigns yet.</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-2 pt-2">
                  {campaigns.map((c) => (
                    <CampaignCard
                      key={c.id}
                      campaign={c}
                      busy={busy}
                      onStart={startCampaign}
                      onNavigate={onNavigate}
                      showCreator={Boolean(user?.isOrgAdmin && user?.accountType === 'company')}
                    />
                  ))}
                </div>
              )}
              </div>
            </details>
          </div>
        ) : tab === 'lists' ? (
          <div className="flex flex-col gap-4 max-w-6xl min-h-[min(720px,calc(100vh-11rem))]">
            <section className="shrink-0 bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <h2 className="text-sm font-semibold text-gray-900">New list</h2>
              <MarketingListBuilder
                user={user}
                teamMembers={teamMembers}
                refreshTeam={refreshTeam}
                savedLeads={savedLeads}
                busy={busy}
                setBusy={setBusy}
                setError={setError}
                setNotice={setNotice}
                onListsCreated={async (result) => {
                  await load()
                  const pickId = result?.list?.id || result?.lists?.[0]?.id
                  if (pickId) setSelectedListId(pickId)
                }}
              />
            </section>

            <div className="flex flex-1 min-h-[400px] border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
              <div className="w-[min(100%,280px)] sm:w-72 shrink-0 flex flex-col border-r border-gray-200 bg-gray-50/80">
                <div className="shrink-0 px-3 py-3 border-b border-gray-200 bg-white">
                  <h2 className="text-sm font-semibold text-gray-900">Saved lists</h2>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                    Click a list — contacts open on the right
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0">
                  {!lists.length && (
                    <p className="text-xs text-gray-400 text-center py-8 px-2">No lists yet. Create one above.</p>
                  )}
                  {lists.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setSelectedListId(l.id)}
                      className={`w-full text-left rounded-lg px-3 py-2.5 text-sm transition-all ${
                        selectedListId === l.id
                          ? 'bg-white border-2 border-gray-900 shadow-sm'
                          : 'bg-white/60 border border-gray-200 hover:bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-gray-900 leading-snug">{l.name}</p>
                        <MarketingCreatorBadge name={l.createdByName} isOwn={l.isOwn} />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {(l.channel || 'email') === 'whatsapp' ? 'WhatsApp' : 'Email'} ·{' '}
                        {l.leadIds?.length || 0} contacts
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-white">
                {selectedListId ? (
                  <MarketingListDetail
                    list={lists.find((l) => l.id === selectedListId)}
                    savedLeads={savedLeads}
                    busy={busy}
                    setBusy={setBusy}
                    setError={setError}
                    setNotice={setNotice}
                    onClose={() => setSelectedListId(null)}
                    onUpdated={(list) => {
                      setLists((prev) => prev.map((x) => (x.id === list.id ? { ...x, ...list } : x)))
                    }}
                    onDeleted={() => {
                      setSelectedListId(null)
                      load()
                    }}
                  />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                    <p className="text-sm font-medium text-gray-700">No list selected</p>
                    <p className="text-xs text-gray-500 mt-2 max-w-xs leading-relaxed">
                      Choose a list on the left to add or remove contacts. Both panels scroll independently.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : tab === 'inbox' ? (
          <WhatsAppInboxPanel onNavigate={onNavigate} />
        ) : tab === 'reports' ? (
          <CampaignReportsView
            campaigns={campaigns}
            summary={summary}
            onNavigate={onNavigate}
            onDuplicate={duplicateCampaignForResend}
            busy={busy}
            initialCampaignId={panelOptions?.campaignId}
            showCreator={Boolean(user?.isOrgAdmin && user?.accountType === 'company')}
          />
        ) : tab === 'templates' ? (
          <div className="marketing-workspace">
          <div className="marketing-builder-slot">
          <MarketingTemplateBuilder
            fillHeight
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
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-6 max-w-6xl">
            <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-gray-900">
                  {formForm.id ? 'Edit form' : 'New capture form'}
                </h2>
                {formForm.id && (
                  <button
                    type="button"
                    onClick={() => setFormForm({ ...EMPTY_FORM })}
                    className="text-[10px] text-gray-500 underline"
                  >
                    Cancel edit
                  </button>
                )}
              </div>
              <input
                value={formForm.name}
                onChange={(e) => setFormForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Internal name"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
              />
              <input
                value={formForm.title}
                onChange={(e) => setFormForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Public title (optional)"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
              />
              <textarea
                value={formForm.description}
                onChange={(e) => setFormForm((p) => ({ ...p, description: e.target.value }))}
                rows={2}
                placeholder="Short description on the form page"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
              />
              <input
                value={formForm.submitLabel}
                onChange={(e) => setFormForm((p) => ({ ...p, submitLabel: e.target.value }))}
                placeholder="Submit button label"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
              />
              <MarketingFormBuilder value={formForm} onChange={setFormForm} />
              <button
                type="button"
                disabled={busy}
                onClick={saveForm}
                className="text-xs font-semibold px-3 py-2 bg-gray-900 text-white rounded-lg disabled:opacity-50"
              >
                {formForm.id ? 'Save form' : 'Create form'}
              </button>
              <p className="text-[10px] text-gray-400 leading-relaxed">
                Build flexible questions like Google Forms. In campaigns, add a <strong>Form</strong> block to email.
                Responses appear on the lead in <strong>Pipeline → open lead → Notes &amp; log</strong> (activity +
                customer notes). Existing contacts can submit again without errors — new emails create new leads.
              </p>
            </section>
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-gray-900">Your forms</h2>
              {!forms.length ? (
                <p className="text-sm text-gray-500">No forms yet.</p>
              ) : (
                forms.map((f) => (
                  <div key={f.id} className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <p className="font-medium text-gray-900">{f.name}</p>
                    <p className="text-xs text-gray-500">
                      {f.submissions || 0} submissions · slug {f.slug}
                    </p>
                    {(f.responses || []).slice(0, 2).map((r) => (
                      <p key={r.id} className="text-[10px] text-gray-600 mt-1 line-clamp-2">
                        {r.email || 'Anonymous'} ·{' '}
                        {r.answers?.slice(0, 2).map((a) => `${a.label}: ${a.value}`).join(' · ') || 'Submitted'}
                      </p>
                    ))}
                    <div className="mt-2 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => editForm(f)}
                        className="text-xs font-semibold text-gray-900 underline"
                      >
                        Edit fields
                      </button>
                      <button
                        type="button"
                        onClick={() => copyFormLink(f.slug)}
                        className="text-xs font-semibold text-gray-900 underline"
                      >
                        Copy public link
                      </button>
                    </div>
                  </div>
                ))
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

function CampaignCard({ campaign, busy, onStart, onNavigate, showCreator }) {
  const statusColors = {
    draft: 'bg-gray-100 text-gray-700',
    active: 'bg-green-100 text-green-800',
    paused: 'bg-amber-100 text-amber-900',
    completed: 'bg-blue-100 text-blue-800',
  }
  const stats = campaign.stats || {}
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-gray-900">{campaign.name}</p>
            {showCreator && (
              <MarketingCreatorBadge name={campaign.createdByName} isOwn={campaign.isOwn} />
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {campaign.type === 'sequence' ? 'Sequence' : 'One-shot'} · {stats.enrolled || 0} enrolled ·{' '}
            {stats.sent || 0} sent
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
          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${statusColors[campaign.status] || statusColors.draft}`}
        >
          {campaign.status}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-3">
        {(stats.sent > 0 || campaign.status === 'completed' || campaign.status === 'active') && (
          <button
            type="button"
            onClick={() => onNavigate?.('marketing', { tab: 'reports', campaignId: campaign.id })}
            className="text-xs font-semibold text-[#5b4a00] hover:underline"
          >
            View report
          </button>
        )}
        {campaign.status === 'draft' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onStart(campaign.id)}
            className="text-xs font-semibold text-gray-900 underline disabled:opacity-50"
          >
            Start
          </button>
        )}
      </div>
    </div>
  )
}
