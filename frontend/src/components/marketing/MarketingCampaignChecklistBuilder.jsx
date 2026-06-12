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
import MarketingSendConfirmModal from './MarketingSendConfirmModal'
import WorkEmailOptions from '../team/WorkEmailOptions'
import { BRAND_LOGO_MARK_LIGHT, BRAND_LOGO_MARK_CLASS } from '../../lib/brandAssets'
import { ChevronLeftIcon, EyeIcon, MailIcon, SearchIcon, SettingsGearIcon } from '../ui/icons'

const STEP_QUESTIONS = {
  to: 'Who are you sending this email to?',
  from: 'Who is sending this email?',
  subject: "What's the subject line for this email?",
  sendtime: 'When should we send this email?',
  content: 'Design your email content',
}

function ProgressBar({ completed, total, stepIds, campaignForm, gmailConnected }) {
  return (
    <div>
      <span className="mc-progress__label">
        {completed}/{total} items complete
      </span>
      <div className="mc-progress__bar" aria-hidden>
        {stepIds.map((id) => (
          <span
            key={id}
            className={`mc-progress__seg${
              isChecklistStepComplete(id, campaignForm, { gmailConnected }) ? ' is-done' : ''
            }`}
          />
        ))}
      </div>
    </div>
  )
}

export default function MarketingCampaignChecklistBuilder({
  campaignForm,
  setCampaignForm,
  lists = [],
  segments = [],
  templates = [],
  user,
  gmailStatus,
  orgName,
  totalContacts = 0,
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
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mobilePreview, setMobilePreview] = useState(false)

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
  const audienceMode = campaignForm.audienceMode || (campaignForm.segmentId ? 'segment' : campaignForm.listId ? 'list' : 'all')

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
    setActiveStep(nextIncomplete || progress.stepIds[idx + 1] || activeStep)
  }

  const toggleStep = (id) => {
    setActiveStep((prev) => (prev === id ? prev : id))
  }

  const renderToPanel = () => (
    <>
      <p className="mc-field-hint">Send to:</p>
      {[
        {
          id: 'all',
          title: 'Entire audience',
          desc: `All ${totalContacts.toLocaleString()} contacts in your CRM`,
        },
        {
          id: 'segment',
          title: 'Audience segment or tag',
          desc: 'Dynamic segment from pipeline rules',
        },
        {
          id: 'list',
          title: 'Static list',
          desc: 'Saved marketing audience list',
        },
      ].map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={`mc-radio-block${audienceMode === opt.id ? ' is-active' : ''}`}
          onClick={() =>
            setCampaignForm((p) => ({
              ...p,
              audienceMode: opt.id,
              listId: opt.id === 'list' ? p.listId : '',
              segmentId: opt.id === 'segment' ? p.segmentId : '',
            }))
          }
        >
          <span aria-hidden>{audienceMode === opt.id ? '●' : '○'}</span>
          <span>
            <strong>{opt.title}</strong>
            <span>{opt.desc}</span>
          </span>
        </button>
      ))}
      {audienceMode === 'segment' && (
        <div className="mc-field">
          <select
            value={campaignForm.segmentId || ''}
            onChange={(e) =>
              setCampaignForm((p) => ({ ...p, segmentId: e.target.value, listId: '' }))
            }
          >
            <option value="">Select a segment or tag…</option>
            {channelSegments.map((s) => (
              <option key={s.id} value={s.id}>
                {marketingOptionLabel(s)} ({s.memberCount ?? 0})
              </option>
            ))}
          </select>
        </div>
      )}
      {audienceMode === 'list' && (
        <div className="mc-field">
          <select
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
        </div>
      )}
      {!channelLists.length && audienceMode === 'list' && (
        <p className="mc-field-hint">
          No lists yet.{' '}
          <button type="button" className="mc-link" onClick={() => onNavigate?.('marketing', { tab: 'audiences', audienceTab: 'lists' })}>
            Create an audience
          </button>
        </p>
      )}
      <div className="mc-accordion__actions">
        <button
          type="button"
          className="mc-btn mc-btn--primary"
          onClick={saveStep}
          disabled={!isChecklistStepComplete('to', campaignForm, { gmailConnected })}
        >
          Save
        </button>
        <button type="button" className="mc-btn mc-btn--ghost" onClick={() => setActiveStep('to')}>
          Cancel
        </button>
        <button type="button" className="mc-link">About audience organization →</button>
      </div>
    </>
  )

  const renderFromPanel = () => (
    <>
      {needsWorkEmail && (
        <div className="mc-field">
          <WorkEmailOptions onNavigate={onNavigate} compact />
        </div>
      )}
      <div className="mc-field">
        <label>Name *</label>
        <input
          value={campaignForm.fromName || ''}
          onChange={(e) => setCampaignForm((p) => ({ ...p, fromName: e.target.value }))}
          placeholder="Your company or team name"
        />
        <p className="mc-field-hint">Use something recognizable, like company name.</p>
      </div>
      <div className="mc-field">
        <label>Email address *</label>
        <input
          type="email"
          value={campaignForm.fromEmail || ''}
          onChange={(e) => setCampaignForm((p) => ({ ...p, fromEmail: e.target.value }))}
          placeholder="you@company.com"
        />
        {gmailConnected && (
          <p className="mc-field-hint">Sending via connected Gmail ({gmailStatus?.email}).</p>
        )}
      </div>
      <div className="mc-accordion__actions">
        <button type="button" className="mc-btn mc-btn--primary" onClick={saveStep}>
          Save
        </button>
        <button type="button" className="mc-btn mc-btn--ghost" onClick={() => setActiveStep('from')}>
          Cancel
        </button>
        <button type="button" className="mc-link">How to set default &quot;from&quot; fields →</button>
      </div>
    </>
  )

  const renderSubjectPanel = () => (
    <>
      <div className="mc-field">
        <label>Subject line *</label>
        <input
          value={campaignForm.subject || ''}
          onChange={(e) => setCampaignForm((p) => ({ ...p, subject: e.target.value }))}
          placeholder="Subject line for recipients"
        />
      </div>
      <div className="mc-field">
        <label>Preview text</label>
        <input
          value={campaignForm.previewText || ''}
          onChange={(e) => setCampaignForm((p) => ({ ...p, previewText: e.target.value }))}
          placeholder="Inbox snippet (optional)"
        />
        <p className="mc-field-hint">Preview text appears in the inbox after the subject line.</p>
      </div>
      <div className="mc-field">
        <label>Internal campaign name</label>
        <input
          value={campaignForm.name || ''}
          onChange={(e) => setCampaignForm((p) => ({ ...p, name: e.target.value }))}
          placeholder="Untitled"
        />
      </div>
      <div className="mc-accordion__actions">
        <button
          type="button"
          className="mc-btn mc-btn--primary"
          onClick={saveStep}
          disabled={!campaignForm.subject?.trim()}
        >
          Save
        </button>
        <button type="button" className="mc-btn mc-btn--ghost" onClick={() => setActiveStep('subject')}>
          Cancel
        </button>
      </div>
    </>
  )

  const renderSendtimePanel = () => (
    <>
      {[
        { id: 'scheduled', title: 'Schedule', desc: 'Pick a date and time' },
        { id: 'immediate', title: 'Send now', desc: 'Deliver as soon as you click Send' },
      ].map((opt) => {
        const active =
          opt.id === 'immediate'
            ? campaignForm.sendMode !== 'scheduled'
            : campaignForm.sendMode === 'scheduled'
        return (
          <button
            key={opt.id}
            type="button"
            className={`mc-radio-block${active ? ' is-active' : ''}`}
            onClick={() =>
              setCampaignForm((p) => ({
                ...p,
                sendMode: opt.id === 'scheduled' ? 'scheduled' : 'immediate',
                scheduledAt: opt.id === 'scheduled' ? p.scheduledAt : '',
              }))
            }
          >
            <span aria-hidden>{active ? '●' : '○'}</span>
            <span>
              <strong>{opt.title}</strong>
              <span>{opt.desc}</span>
            </span>
          </button>
        )
      })}
      {campaignForm.sendMode === 'scheduled' && (
        <div className="mc-field">
          <label>Send on</label>
          <input
            type="datetime-local"
            value={campaignForm.scheduledAt || ''}
            onChange={(e) => setCampaignForm((p) => ({ ...p, scheduledAt: e.target.value }))}
          />
        </div>
      )}
      <div className="mc-accordion__actions">
        <button type="button" className="mc-btn mc-btn--primary" onClick={saveStep}>
          Save
        </button>
        <button type="button" className="mc-btn mc-btn--ghost" onClick={() => setActiveStep('sendtime')}>
          Cancel
        </button>
        <button type="button" className="mc-link">How to schedule or pause emails →</button>
      </div>
    </>
  )

  const renderContentPanel = () => (
    <>
      {campaignForm.blocks?.length ? (
        <>
          <p className="mc-field-hint">✓ A plain-text version of this email will be included.</p>
          <button type="button" className="mc-btn mc-btn--primary" onClick={onEnterEditor}>
            Edit design →
          </button>
        </>
      ) : (
        <>
          <p className="mc-field-hint">Start from a template or open the drag-and-drop email studio.</p>
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
      <div className="mc-accordion__actions">
        <button
          type="button"
          className="mc-btn mc-btn--primary"
          onClick={saveStep}
          disabled={!isChecklistStepComplete('content', campaignForm)}
        >
          Save
        </button>
      </div>
    </>
  )

  const panels = {
    to: renderToPanel,
    from: renderFromPanel,
    subject: renderSubjectPanel,
    sendtime: renderSendtimePanel,
    content: renderContentPanel,
  }

  const count = audienceCount(campaignForm, lists, segments, totalContacts)

  return (
    <div className="mc-editor">
      <header className="mc-editor__topbar">
        <div className="mc-editor__topbar-left">
          <button type="button" className="mc-editor__back" onClick={onBackToList} aria-label="Back to campaigns">
            <ChevronLeftIcon className="mc-editor__back-icon" />
          </button>
          <img
            src={BRAND_LOGO_MARK_LIGHT}
            alt=""
            className={`mc-editor__logo ${BRAND_LOGO_MARK_CLASS}`}
          />
          <input
            className="mc-editor__title"
            value={campaignForm.name || ''}
            onChange={(e) => setCampaignForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="Untitled"
            aria-label="Campaign name"
          />
          <span className="mc-editor__draft">Draft</span>
        </div>
        <div className="mc-editor__topbar-right">
          <button
            type="button"
            className="mc-btn mc-btn--icon"
            onClick={() => setSettingsOpen((v) => !v)}
            title="Settings"
          >
            <SettingsGearIcon className="w-4 h-4" />
          </button>
          <button type="button" className="mc-btn mc-btn--ghost" onClick={onSaveDraft} disabled={busy}>
            Finish later
          </button>
          <button
            type="button"
            className="mc-btn mc-btn--primary"
            disabled={busy || !readyToSend}
            onClick={() => setSendConfirmOpen(true)}
          >
            Send
          </button>
        </div>
      </header>

      {(error || notice) && (
        <div className="mc-shell__alerts">
          {error && <p className="crm-alert crm-alert-error">{error}</p>}
          {notice && <p className="crm-alert crm-alert-success">{notice}</p>}
        </div>
      )}

      {settingsOpen && (
        <div className="mc-shell__alerts">
          <p className="mc-field-hint">Campaign settings — tracking and folder options coming soon.</p>
        </div>
      )}

      <div className="mc-editor__body">
        <div className="mc-editor__layout">
          <div className="mc-editor__main">
            <ProgressBar
              completed={progress.complete}
              total={progress.total}
              stepIds={progress.stepIds}
              campaignForm={campaignForm}
              gmailConnected={gmailConnected}
            />

            <div className="mc-accordion-list">
            {steps.map((step) => {
              const done = isChecklistStepComplete(step.id, campaignForm, { gmailConnected })
              const summary = stepSummary(step.id, campaignForm, lists, segments, {
                gmailStatus,
                totalContacts,
              })
              const expanded = activeStep === step.id
              const contentDone = step.id === 'content' && done
              return (
                <section
                  key={step.id}
                  className={`mc-accordion${expanded ? ' is-expanded' : ''}`}
                >
                  <div className="mc-accordion__head-row">
                    <button
                      type="button"
                      className="mc-accordion__head"
                      onClick={() => toggleStep(step.id)}
                    >
                      <span className={`mc-accordion__icon${done ? ' is-done' : ''}`}>
                        {done ? '✓' : ''}
                      </span>
                      <span className="mc-accordion__meta">
                        <span className="mc-accordion__label">{step.label}</span>
                        <span className="mc-accordion__sub">
                          {!expanded && summary ? summary : STEP_QUESTIONS[step.id]}
                        </span>
                        {contentDone && !expanded && (
                          <span className="mc-content-badge-warn">
                            <span className="mc-content-badge-warn__icon" aria-hidden>!</span>
                            We automatically add a required Connect Intel badge to your email footer.
                          </span>
                        )}
                      </span>
                      <span className="mc-accordion__chev" aria-hidden />
                    </button>
                    {contentDone && !expanded && (
                      <button
                        type="button"
                        className="mc-btn mc-btn--outline mc-accordion__edit-design"
                        onClick={onEnterEditor}
                      >
                        Edit design
                      </button>
                    )}
                  </div>
                  {expanded && (
                    <div className="mc-accordion__body">
                      {panels[step.id]?.()}
                      {contentDone && (
                        <p className="mc-content-badge-warn mc-content-badge-warn--inline">
                          <span className="mc-content-badge-warn__icon" aria-hidden>!</span>
                          We automatically add a required Connect Intel badge to your email footer.
                        </p>
                      )}
                    </div>
                  )}
                </section>
              )
            })}
            </div>
          </div>

          <aside className="mc-editor__preview-col">
            <div className="mc-preview-panel">
              <div className="mc-preview-panel__toolbar">
                <button type="button" className="mc-preview-tool" onClick={() => setPreviewOpen(true)}>
                  <SearchIcon className="mc-preview-tool__icon" />
                  Preview
                </button>
                {campaignForm.channel === 'email' && (
                  <button
                    type="button"
                    className="mc-preview-tool"
                    onClick={onTestSend}
                    disabled={busy}
                  >
                    <MailIcon className="mc-preview-tool__icon" />
                    Send a Test Email
                  </button>
                )}
              </div>
              <div
                className="mc-preview-frame"
                style={mobilePreview ? { maxWidth: 375, margin: '0 auto' } : undefined}
              >
                <div className="mc-mc-practice-banner mc-mc-practice-banner--preview" role="note">
                  <span className="mc-mc-practice-banner__tag">Note</span>
                  <span>
                    This is a practice email. Follow the tips below to learn how the builder works.
                  </span>
                </div>
                {previewHtml ? (
                  <div
                    className="mc-preview-html"
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                ) : (
                  <div className="mc-preview-empty">
                    <p className="mc-preview-empty__logo">LOGO</p>
                    <h3>Drag, drop, and build</h3>
                    <p className="mc-field-hint">
                      Complete Content to see your email here, or open the design studio.
                    </p>
                    <button type="button" className="mc-btn mc-btn--outline" onClick={onEnterEditor}>
                      Click me to edit
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                className="mc-preview-tool mc-preview-tool--toggle"
                onClick={() => setMobilePreview((v) => !v)}
              >
                <EyeIcon className="mc-preview-tool__icon" />
                {mobilePreview ? 'Desktop preview' : 'Mobile preview'}
              </button>
            </div>
          </aside>
        </div>
      </div>

      {previewOpen && (
        <div className="mc-modal" role="dialog" aria-modal="true">
          <div className="mc-modal__backdrop" onClick={() => setPreviewOpen(false)} />
          <div className="mc-modal__card" style={{ maxWidth: 640 }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Email preview</h3>
              <button type="button" className="mc-btn mc-btn--ghost" onClick={() => setPreviewOpen(false)}>
                Close
              </button>
            </header>
            {previewHtml ? (
              <div className="mc-preview-html" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            ) : (
              <p className="mc-field-hint">Add content to preview your email.</p>
            )}
          </div>
        </div>
      )}

      <MarketingSendConfirmModal
        open={sendConfirmOpen}
        onClose={() => setSendConfirmOpen(false)}
        onConfirm={() => {
          setSendConfirmOpen(false)
          onLaunch?.()
        }}
        campaignForm={campaignForm}
        lists={lists}
        segments={segments}
        gmailStatus={gmailStatus}
        busy={busy}
      />

      <button type="button" className="mc-feedback-tab" tabIndex={-1} aria-hidden>
        Feedback
      </button>
    </div>
  )
}
