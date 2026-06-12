import { useEffect, useMemo, useState } from 'react'
import { renderEmailCanvasHtml, STARTER_TEMPLATES } from '../../lib/marketingEmailDesign'
import {
  audienceCount,
  audienceLabel,
  canSendCampaign,
  checklistProgress,
  defaultFromFields,
  isChecklistStepComplete,
  stepSummary,
  visibleChecklistSteps,
} from '../../lib/marketingCampaignChecklist'
import { marketingOptionLabel } from './MarketingCreatorBadge'
import MarketingTemplateMarketplace from './MarketingTemplateMarketplace'
import WorkEmailOptions from '../team/WorkEmailOptions'

export default function MarketingCampaignChecklistBuilder({
  campaignForm,
  setCampaignForm,
  lists = [],
  segments = [],
  templates = [],
  user,
  gmailStatus,
  orgName,
  onBackToList,
  onEnterEditor,
  onSaveDraft,
  onLaunch,
  onTestSend,
  busy,
  error,
  notice,
  onNavigate,
  needsWorkEmail,
}) {
  const [activeStep, setActiveStep] = useState('to')
  const [previewOpen, setPreviewOpen] = useState(false)

  const gmailConnected = Boolean(gmailStatus?.connected)
  const progress = useMemo(
    () => checklistProgress(campaignForm, { gmailConnected }),
    [campaignForm, gmailConnected]
  )
  const steps = useMemo(
    () => visibleChecklistSteps(campaignForm.channel),
    [campaignForm.channel]
  )
  const readyToSend = useMemo(
    () => canSendCampaign(campaignForm, { gmailConnected }),
    [campaignForm, gmailConnected]
  )

  useEffect(() => {
    if (!campaignForm.fromName && !campaignForm.fromEmail) {
      const { fromName, fromEmail } = defaultFromFields(user, gmailStatus, orgName)
      setCampaignForm((p) => ({
        ...p,
        fromName: p.fromName || fromName,
        fromEmail: p.fromEmail || fromEmail,
      }))
    }
  }, [user, gmailStatus, orgName, campaignForm.fromName, campaignForm.fromEmail, setCampaignForm])

  const previewHtml = useMemo(() => {
    if (!campaignForm.blocks?.length) return ''
    return renderEmailCanvasHtml(campaignForm.blocks, campaignForm.design || {}, { preview: true })
  }, [campaignForm.blocks, campaignForm.design])

  const channelLists = lists.filter((l) => (l.channel || 'email') === campaignForm.channel)
  const channelSegments = segments.filter((s) => (s.channel || 'email') === campaignForm.channel)
  const audienceMode = campaignForm.audienceMode || (campaignForm.segmentId ? 'segment' : 'list')

  const applyStarter = (tpl) => {
    if (!tpl) return
    setCampaignForm((p) => ({
      ...p,
      templateId: tpl.id,
      subject: tpl.subject || p.subject,
      body: tpl.body || '',
      blocks: tpl.blocks ? [...tpl.blocks] : [],
      design: tpl.design || p.design,
      previewText: tpl.previewText || '',
      name: p.name || tpl.name,
    }))
  }

  const saveStep = () => {
    const idx = progress.stepIds.indexOf(activeStep)
    const nextIncomplete = progress.stepIds.slice(idx + 1).find(
      (id) => !isChecklistStepComplete(id, campaignForm, { gmailConnected })
    )
    if (nextIncomplete) setActiveStep(nextIncomplete)
    else {
      const next = progress.stepIds[idx + 1]
      if (next) setActiveStep(next)
    }
  }

  const renderStepPanel = () => {
    switch (activeStep) {
      case 'to':
        return (
          <div className="mc-checklist-panel">
            <p className="mc-checklist-panel__lead">
              Pick a saved audience list or dynamic segment. Contacts must have valid{' '}
              {campaignForm.channel === 'whatsapp' ? 'phone numbers' : 'email addresses'}.
            </p>
            <div className="mc-checklist-segmented">
              {[
                { id: 'list', label: 'Static list' },
                { id: 'segment', label: 'Dynamic segment' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`mc-checklist-segmented__btn${audienceMode === m.id ? ' is-active' : ''}`}
                  onClick={() =>
                    setCampaignForm((p) => ({
                      ...p,
                      audienceMode: m.id,
                      listId: m.id === 'list' ? p.listId : '',
                      segmentId: m.id === 'segment' ? p.segmentId : '',
                    }))
                  }
                >
                  {m.label}
                </button>
              ))}
            </div>
            {audienceMode === 'segment' ? (
              <select
                className="mc-checklist-input"
                value={campaignForm.segmentId || ''}
                onChange={(e) =>
                  setCampaignForm((p) => ({ ...p, segmentId: e.target.value, listId: '' }))
                }
              >
                <option value="">Choose segment…</option>
                {channelSegments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {marketingOptionLabel(s)} ({s.memberCount ?? 0})
                  </option>
                ))}
              </select>
            ) : (
              <select
                className="mc-checklist-input"
                value={campaignForm.listId || ''}
                onChange={(e) =>
                  setCampaignForm((p) => ({ ...p, listId: e.target.value, segmentId: '' }))
                }
              >
                <option value="">Choose audience list…</option>
                {channelLists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {marketingOptionLabel(l)} ({l.leadIds?.length || l.memberCount || 0})
                  </option>
                ))}
              </select>
            )}
            {!channelLists.length && audienceMode === 'list' && (
              <p className="mc-checklist-hint">
                No lists yet.{' '}
                <button type="button" className="mc-checklist-link" onClick={() => onNavigate?.('marketing', { tab: 'audiences', audienceTab: 'lists' })}>
                  Create an audience
                </button>
              </p>
            )}
            <div className="mc-checklist-panel__actions">
              <button type="button" className="mc-checklist-btn mc-checklist-btn--primary" onClick={saveStep} disabled={!isChecklistStepComplete('to', campaignForm)}>
                Save
              </button>
              <button type="button" className="mc-checklist-btn" onClick={() => setActiveStep('to')}>
                Cancel
              </button>
            </div>
          </div>
        )
      case 'from':
        return (
          <div className="mc-checklist-panel">
            {needsWorkEmail && (
              <div className="mc-checklist-warn">
                <WorkEmailOptions onNavigate={onNavigate} compact />
              </div>
            )}
            <label className="mc-checklist-field">
              <span>Name</span>
              <input
                className="mc-checklist-input"
                value={campaignForm.fromName || ''}
                onChange={(e) => setCampaignForm((p) => ({ ...p, fromName: e.target.value }))}
                placeholder="Your company or team name"
              />
            </label>
            <label className="mc-checklist-field">
              <span>Email address</span>
              <input
                className="mc-checklist-input"
                type="email"
                value={campaignForm.fromEmail || ''}
                onChange={(e) => setCampaignForm((p) => ({ ...p, fromEmail: e.target.value }))}
                placeholder="you@company.com"
              />
            </label>
            {gmailConnected && (
              <p className="mc-checklist-hint">Sending via your connected Gmail ({gmailStatus?.email}).</p>
            )}
            <div className="mc-checklist-panel__actions">
              <button type="button" className="mc-checklist-btn mc-checklist-btn--primary" onClick={saveStep}>
                Save
              </button>
              <button type="button" className="mc-checklist-btn" onClick={() => setActiveStep('from')}>
                Cancel
              </button>
            </div>
          </div>
        )
      case 'subject':
        return (
          <div className="mc-checklist-panel">
            <label className="mc-checklist-field">
              <span>Subject line</span>
              <input
                className="mc-checklist-input"
                value={campaignForm.subject || ''}
                onChange={(e) => setCampaignForm((p) => ({ ...p, subject: e.target.value }))}
                placeholder="Subject line for recipients"
              />
            </label>
            <label className="mc-checklist-field">
              <span>Preview text</span>
              <input
                className="mc-checklist-input"
                value={campaignForm.previewText || ''}
                onChange={(e) => setCampaignForm((p) => ({ ...p, previewText: e.target.value }))}
                placeholder="Inbox snippet (optional)"
              />
            </label>
            <input
              className="mc-checklist-input"
              value={campaignForm.name || ''}
              onChange={(e) => setCampaignForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Internal campaign name"
            />
            <div className="mc-checklist-panel__actions">
              <button
                type="button"
                className="mc-checklist-btn mc-checklist-btn--primary"
                onClick={saveStep}
                disabled={!campaignForm.subject?.trim()}
              >
                Save
              </button>
              <button type="button" className="mc-checklist-btn" onClick={() => setActiveStep('subject')}>
                Cancel
              </button>
            </div>
          </div>
        )
      case 'sendtime':
        return (
          <div className="mc-checklist-panel">
            <div className="mc-checklist-send-cards">
              <button
                type="button"
                className={`mc-checklist-send-card${campaignForm.sendMode !== 'scheduled' ? ' is-active' : ''}`}
                onClick={() => setCampaignForm((p) => ({ ...p, sendMode: 'immediate', scheduledAt: '' }))}
              >
                <strong>Send now</strong>
                <span>Deliver as soon as you click Send</span>
              </button>
              <button
                type="button"
                className={`mc-checklist-send-card${campaignForm.sendMode === 'scheduled' ? ' is-active' : ''}`}
                onClick={() => setCampaignForm((p) => ({ ...p, sendMode: 'scheduled' }))}
              >
                <strong>Schedule</strong>
                <span>Pick a date and time</span>
              </button>
            </div>
            {campaignForm.sendMode === 'scheduled' && (
              <label className="mc-checklist-field">
                <span>Send date & time</span>
                <input
                  type="datetime-local"
                  className="mc-checklist-input"
                  value={campaignForm.scheduledAt || ''}
                  onChange={(e) => setCampaignForm((p) => ({ ...p, scheduledAt: e.target.value }))}
                />
              </label>
            )}
            <div className="mc-checklist-panel__actions">
              <button type="button" className="mc-checklist-btn mc-checklist-btn--primary" onClick={saveStep}>
                Save
              </button>
              <button type="button" className="mc-checklist-btn" onClick={() => setActiveStep('sendtime')}>
                Cancel
              </button>
            </div>
          </div>
        )
      case 'content':
        return (
          <div className="mc-checklist-panel">
            {campaignForm.blocks?.length ? (
              <>
                <p className="mc-checklist-hint">Your email design is ready. Open the studio to refine blocks, images, and brand styling.</p>
                <button type="button" className="mc-checklist-btn mc-checklist-btn--primary" onClick={onEnterEditor}>
                  Edit design
                </button>
              </>
            ) : (
              <>
                <p className="mc-checklist-panel__lead">Start from a template or open the drag-and-drop email studio.</p>
                <MarketingTemplateMarketplace
                  templates={templates}
                  title="Choose a template"
                  subtitle="Pick a layout, then customize in the email studio."
                  onSelect={(tpl) => {
                    applyStarter(tpl)
                    onEnterEditor?.()
                  }}
                  onCreateBlank={() => {
                    const blank = STARTER_TEMPLATES.find((t) => t.id === 'blank') || STARTER_TEMPLATES[0]
                    applyStarter(blank)
                    onEnterEditor?.()
                  }}
                />
              </>
            )}
            <div className="mc-checklist-panel__actions">
              <button
                type="button"
                className="mc-checklist-btn mc-checklist-btn--primary"
                onClick={saveStep}
                disabled={!isChecklistStepComplete('content', campaignForm)}
              >
                Save
              </button>
            </div>
          </div>
        )
      default:
        return null
    }
  }

  const count = audienceCount(campaignForm, lists, segments)

  return (
    <div className="mc-checklist">
      <header className="mc-checklist__header">
        <div className="mc-checklist__header-left">
          <button type="button" className="mc-checklist-back" onClick={onBackToList}>
            ← Campaigns
          </button>
          <input
            className="mc-checklist-title-input"
            value={campaignForm.name || ''}
            onChange={(e) => setCampaignForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="Untitled"
            aria-label="Campaign name"
          />
          <span className="mc-checklist-draft">Draft</span>
        </div>
        <div className="mc-checklist__header-right">
          <button type="button" className="mc-checklist-btn" onClick={onSaveDraft} disabled={busy}>
            Finish later
          </button>
          <button
            type="button"
            className="mc-checklist-btn mc-checklist-btn--send"
            disabled={busy || !readyToSend}
            onClick={onLaunch}
          >
            Send
          </button>
        </div>
      </header>

      {(error || notice) && (
        <div className="mc-checklist-alerts">
          {error && <p className="crm-alert crm-alert-error">{error}</p>}
          {notice && <p className="crm-alert crm-alert-success">{notice}</p>}
        </div>
      )}

      <div className="mc-checklist__progress">
        <div className="mc-checklist__progress-label">
          {progress.complete}/{progress.total} items complete
        </div>
        <div className="mc-checklist__progress-bar" aria-hidden>
          {progress.stepIds.map((id) => (
            <span
              key={id}
              className={`mc-checklist__progress-seg${
                isChecklistStepComplete(id, campaignForm, { gmailConnected }) ? ' is-done' : ''
              }`}
            />
          ))}
        </div>
      </div>

      <div className="mc-checklist__body">
        <aside className="mc-checklist__steps">
          {steps.map((step) => {
            const done = isChecklistStepComplete(step.id, campaignForm, { gmailConnected })
            const summary = stepSummary(step.id, campaignForm, lists, segments, { gmailStatus })
            const expanded = activeStep === step.id
            return (
              <div
                key={step.id}
                className={`mc-checklist-step${expanded ? ' is-expanded' : ''}${done ? ' is-done' : ''}`}
              >
                <button
                  type="button"
                  className="mc-checklist-step__head"
                  onClick={() => setActiveStep(step.id)}
                >
                  <span className={`mc-checklist-step__icon${done ? ' is-done' : ''}`} aria-hidden>
                    {done ? '✓' : ''}
                  </span>
                  <span className="mc-checklist-step__meta">
                    <span className="mc-checklist-step__label">{step.label}</span>
                    {!expanded && summary ? (
                      <span className="mc-checklist-step__summary">{summary}</span>
                    ) : (
                      <span className="mc-checklist-step__question">{step.question}</span>
                    )}
                  </span>
                </button>
                {expanded && <div className="mc-checklist-step__body">{renderStepPanel()}</div>}
              </div>
            )
          })}
        </aside>

        <aside className="mc-checklist__preview">
          <div className="mc-checklist-preview__toolbar">
            <button type="button" className="mc-checklist-link" onClick={() => setPreviewOpen(true)}>
              ⊙ Preview
            </button>
            {campaignForm.channel === 'email' && (
              <button type="button" className="mc-checklist-link" onClick={onTestSend} disabled={busy}>
                ✈ Send a test email
              </button>
            )}
          </div>
          <div className="mc-checklist-preview__frame">
            <div className="mc-checklist-preview__inbox">
              <div className="mc-checklist-preview__inbox-row">
                <span className="mc-checklist-preview__inbox-label">To</span>
                <span>
                  {audienceLabel(campaignForm, lists, segments) || 'Audience'}
                  {count > 0 ? ` (${count.toLocaleString()})` : ''}
                </span>
              </div>
              <div className="mc-checklist-preview__inbox-row">
                <span className="mc-checklist-preview__inbox-label">From</span>
                <span>
                  {stepSummary('from', campaignForm, lists, segments, { gmailStatus }) || '—'}
                </span>
              </div>
              <div className="mc-checklist-preview__inbox-row">
                <span className="mc-checklist-preview__inbox-label">Subject</span>
                <span>{campaignForm.subject || '—'}</span>
              </div>
            </div>
            {previewHtml ? (
              <div className="mc-checklist-preview__html" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            ) : (
              <div className="mc-checklist-preview__empty">
                <p>Drag, drop, and build</p>
                <p className="mc-checklist-hint">Complete Content to see your email here, or open the design studio.</p>
                <button type="button" className="mc-checklist-btn mc-checklist-btn--primary" onClick={onEnterEditor}>
                  Edit design
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>

      {previewOpen && (
        <div className="mc-checklist-modal" role="dialog" aria-modal="true">
          <div className="mc-checklist-modal__backdrop" onClick={() => setPreviewOpen(false)} />
          <div className="mc-checklist-modal__card">
            <header className="mc-checklist-modal__head">
              <h3>Email preview</h3>
              <button type="button" onClick={() => setPreviewOpen(false)}>
                Close
              </button>
            </header>
            {previewHtml ? (
              <div className="mc-checklist-preview__html" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            ) : (
              <p className="mc-checklist-hint">Add content to preview your email.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
