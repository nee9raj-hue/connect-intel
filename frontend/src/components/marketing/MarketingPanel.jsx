import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { DEFAULT_THEME } from '../../lib/marketingEmailDesign'
import MarketingTemplateBuilder, { FOLLOW_UP_STARTER } from './MarketingTemplateBuilder'
import MarketingFormBuilder from './MarketingFormBuilder'
import { DEFAULT_FORM_FIELDS, DEFAULT_FORM_THEME } from '../../../../lib/marketingFormSchema.js'
import LoadingExperience from '../ui/LoadingExperience'
import CampaignReportsView, { campaignToForm } from './CampaignReportsView'
import MarketingListBuilder from './MarketingListBuilder'
import MarketingCreatorBadge, { marketingOptionLabel } from './MarketingCreatorBadge'
import WorkEmailOptions from '../team/WorkEmailOptions'
import { LOADING_MESSAGES } from '../../lib/loadingQuotes'
import { withTimeout } from '../../lib/fetchWithTimeout'
import { leadHasCallablePhone } from '../../lib/phoneUtils'

const TABS = [
  { id: 'campaigns', label: 'Campaigns' },
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
  })
  const [campaignEmailStep, setCampaignEmailStep] = useState(1)
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
      setCampaignForm({
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
      })
      setCampaignEmailStep(1)
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
        setCampaignForm(campaignToForm(data.campaign))
        setCampaignEmailStep(1)
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
    <div className="panel-shell bg-[#fafafa]">
      <header className="shrink-0 px-4 sm:px-6 py-4 border-b border-gray-200 bg-white">
        <h1 className="text-lg font-semibold text-gray-900">Marketing</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Lists, templates, campaigns, and lead capture forms — logged on each lead in Pipeline.
        </p>
        {(user?.isOrgAdmin || user?.orgRole === 'org_admin') && user?.accountType === 'company' ? (
          <p className="text-[11px] text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-2 mt-2 max-w-xl">
            You see all team campaigns and templates (labeled by creator). Sales reps only see their own marketing
            assets and send stats for their pipeline leads.
          </p>
        ) : user?.accountType === 'company' ? (
          <p className="text-[11px] text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-2 mt-2 max-w-xl">
            Your campaigns and templates are private to you. Connect work Gmail under{' '}
            <button
              type="button"
              onClick={() => onNavigate?.('my-email')}
              className="font-semibold underline text-[#5b4a00]"
            >
              Work email
            </button>{' '}
            in the sidebar before sending. Lists support stage filters and batches of 50 per send for your leads.
          </p>
        ) : null}
        {needsWorkEmail && (
          <div className="mt-3 max-w-xl">
            <WorkEmailOptions onNavigate={onNavigate} compact />
          </div>
        )}
        {user?.isOrgAdmin && user?.accountType === 'company' && !user?.whatsappAutoSendReady && (
          <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2 mt-2 max-w-xl">
            WhatsApp auto-send: connect API under{' '}
            <button
              type="button"
              onClick={() => onNavigate?.('whatsapp-settings')}
              className="font-semibold underline text-[#5b4a00]"
            >
              Workspace → WhatsApp API
            </button>
          </p>
        )}
        {summary && (
          <p className="text-[11px] text-gray-500 mt-1">
            {summary.campaigns} campaigns · {summary.enrolled} enrolled · {summary.sent} sent ·{' '}
            {summary.opens} opens · {summary.clicks} clicks
          </p>
        )}
        <div className="flex gap-1 mt-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${
                tab === t.id
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {(error || notice) && (
        <div className="shrink-0 px-4 sm:px-6 pt-3">
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

      <div className="panel-body-scroll px-4 sm:px-6 py-4">
        {loading ? (
          <LoadingExperience message={LOADING_MESSAGES.marketing} />
        ) : tab === 'campaigns' ? (
          <div className="space-y-6 max-w-[1400px]">
            <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <h2 className="text-sm font-semibold text-gray-900">New campaign</h2>
              <div className="flex flex-wrap gap-2 mb-1">
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
                        useSequence: ch.id === 'whatsapp' ? p.useSequence : p.useSequence,
                      }))
                    }
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${
                      campaignForm.channel === ch.id
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
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
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                />
                <select
                  value={campaignForm.listId}
                  onChange={(e) => setCampaignForm((p) => ({ ...p, listId: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                >
                  <option value="">Choose list…</option>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {marketingOptionLabel(l)} ({l.leadIds?.length || 0})
                    </option>
                  ))}
                </select>
                <select
                  value={campaignForm.templateId}
                  onChange={(e) => applyTemplate(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                >
                  <option value="">
                    {campaignForm.channel === 'whatsapp'
                      ? 'Use saved template…'
                      : 'Optional template for email 1…'}
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
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${
                        campaignEmailStep === step.id
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {step.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={createCampaign}
                  className="text-xs font-semibold px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50"
                >
                  Save draft
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={createAndStart}
                  className="text-xs font-semibold px-3 py-2 bg-gray-900 text-white rounded-lg disabled:opacity-50"
                >
                  {busy
                    ? 'Working…'
                    : campaignForm.channel === 'whatsapp'
                      ? 'Start WhatsApp campaign'
                      : 'Start campaign'}
                </button>
              </div>
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
              <p className="text-[10px] text-gray-400">
                {campaignForm.channel === 'whatsapp'
                  ? user?.whatsappAutoSendReady
                    ? `Auto-send is on. ${pipelineLeadsWithPhone.length} contacts with phone — messages go out via your business number when you start the campaign.`
                    : `Uses saved templates as plain-text WhatsApp. ${pipelineLeadsWithPhone.length} contacts have a phone. Connect API above for automatic send.`
                  : 'Includes unsubscribe link. Connect work email under Workspace → Work email first.'}
              </p>
            </section>

            {(!campaignForm.useSequence || campaignEmailStep === 1) && (
              <MarketingTemplateBuilder
                embedded
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

            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-gray-900">Your campaigns</h2>
              {!campaigns.length ? (
                <p className="text-sm text-gray-500">No campaigns yet.</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-2">
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
            </section>
          </div>
        ) : tab === 'lists' ? (
          <div className="grid lg:grid-cols-2 gap-6 max-w-6xl">
            <section className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
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
                onListsCreated={load}
              />
            </section>
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-gray-900">Saved lists</h2>
              {lists.map((l) => (
                <div key={l.id} className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-gray-900">{l.name}</p>
                    <MarketingCreatorBadge name={l.createdByName} isOwn={l.isOwn} />
                  </div>
                  <p className="text-xs text-gray-500">
                    {l.leadIds?.length || 0} leads
                    {l.description ? ` · ${l.description}` : ''}
                  </p>
                </div>
              ))}
            </section>
          </div>
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
          <MarketingTemplateBuilder
            value={templateForm}
            onChange={setTemplateForm}
            onSave={saveTemplate}
            onCancel={
              templateForm.id
                ? () => setTemplateForm({ ...EMPTY_TEMPLATE, design: { ...DEFAULT_THEME } })
                : undefined
            }
            busy={busy}
            templates={templates}
            onEdit={editTemplate}
            onDelete={deleteTemplate}
            marketingForms={forms}
          />
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
