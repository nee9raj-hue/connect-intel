import { useMemo, useState } from 'react'
import { STARTER_TEMPLATES } from '../../lib/marketingEmailDesign'
import {
  CAMPAIGN_GOALS,
  WIZARD_STEPS,
  estimateAudienceReach,
  estimatePerformance,
  goalToStarterTemplate,
} from '../../lib/marketingExperience'
import MarketingTemplateMarketplace from './MarketingTemplateMarketplace'
import { renderEmailCanvasHtml } from '../../lib/marketingEmailDesign'
import { marketingOptionLabel } from './MarketingCreatorBadge'
import { mergeBrandKit } from './MarketingBrandKit'

export default function MarketingCampaignWizardStudio({
  campaignForm,
  setCampaignForm,
  lists = [],
  segments = [],
  templates = [],
  summary,
  step = 0,
  setStep,
  onBackToList,
  onEnterEditor,
  onSaveDraft,
  onLaunch,
  busy,
  error,
  notice,
  onOpenBrandKit,
}) {
  const [audienceMode, setAudienceMode] = useState(campaignForm.audienceMode || 'list')

  const reach = useMemo(
    () =>
      estimateAudienceReach(
        campaignForm.audienceMode === 'segment' ? null : campaignForm.listId,
        campaignForm.audienceMode === 'segment' ? campaignForm.segmentId : null,
        lists,
        segments
      ),
    [campaignForm, lists, segments]
  )

  const perf = useMemo(
    () => estimatePerformance({ openRate: summary?.openRate, clickRate: summary?.clickRate }, reach),
    [summary, reach]
  )

  const previewHtml = useMemo(
    () =>
      campaignForm.blocks?.length
        ? renderEmailCanvasHtml(campaignForm.blocks, campaignForm.design || {}, { preview: true })
        : '',
    [campaignForm.blocks, campaignForm.design]
  )

  const applyStarter = (tpl) => {
    if (!tpl) return
    setCampaignForm((p) => ({
      ...p,
      templateId: tpl.id,
      subject: tpl.subject || p.subject,
      body: tpl.body || '',
      blocks: tpl.blocks ? [...tpl.blocks] : [],
      design: mergeBrandKit(tpl.design || p.design),
      previewText: tpl.previewText || '',
      name: p.name || tpl.name,
    }))
  }

  const selectGoal = (goal) => {
    const starterId = goalToStarterTemplate(goal.id)
    const starter = starterId ? STARTER_TEMPLATES.find((t) => t.id === starterId) : null
    setCampaignForm((p) => ({
      ...p,
      goal: goal.id,
      name: p.name || `${goal.label} campaign`,
    }))
    if (starter) applyStarter(starter)
  }

  const channelLists = lists.filter((l) => (l.channel || 'email') === campaignForm.channel)
  const channelSegments = segments.filter((s) => (s.channel || 'email') === campaignForm.channel)

  const canNext = () => {
    if (step === 0) return Boolean(campaignForm.goal)
    if (step === 1) return Boolean(campaignForm.listId || campaignForm.segmentId)
    if (step === 2) return Boolean(campaignForm.blocks?.length || campaignForm.body)
    if (step === 3) return Boolean(campaignForm.blocks?.length)
    if (step === 4) return Boolean(campaignForm.name?.trim() && campaignForm.subject?.trim())
    return true
  }

  const goNext = () => {
    if (step === 2 && !campaignForm.blocks?.length) return
    if (step === 3) {
      onEnterEditor?.()
      return
    }
    setStep((s) => Math.min(s + 1, WIZARD_STEPS.length - 1))
  }

  const goBack = () => {
    if (step === 0) onBackToList?.()
    else setStep((s) => Math.max(s - 1, 0))
  }

  const bestSendTimes = ['Tue 10:00 AM', 'Wed 2:00 PM', 'Thu 9:30 AM']

  return (
    <div className="mkt-wizard">
      <header className="mkt-wizard__head">
        <button type="button" className="mkt-link" onClick={goBack}>
          {step === 0 ? '← Campaign studio' : '← Back'}
        </button>
        <div className="mkt-wizard__steps">
          {WIZARD_STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`mkt-wizard-step${i === step ? ' is-active' : ''}${i < step ? ' is-done' : ''}`}
            >
              <span className="mkt-wizard-step__num">{i + 1}</span>
              <span className="mkt-wizard-step__label">{s.label}</span>
            </div>
          ))}
        </div>
      </header>

      {(error || notice) && (
        <div className="mkt-wizard__alerts">
          {error && <p className="crm-alert crm-alert-error">{error}</p>}
          {notice && <p className="crm-alert crm-alert-success">{notice}</p>}
        </div>
      )}

      <div className="mkt-wizard__body">
        {step === 0 && (
          <section className="mkt-wizard-panel">
            <h2>What are you creating?</h2>
            <p>Choose a campaign goal — we&apos;ll tailor templates and messaging.</p>
            <div className="mkt-goal-grid">
              {CAMPAIGN_GOALS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className={`mkt-goal-card${campaignForm.goal === g.id ? ' is-selected' : ''}`}
                  style={{ '--mkt-goal': g.color }}
                  onClick={() => selectGoal(g)}
                >
                  <span className="mkt-goal-card__emoji">{g.emoji}</span>
                  <strong>{g.label}</strong>
                  <span>{g.desc}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="mkt-wizard-panel mkt-wizard-panel--split">
            <div>
              <h2>Who will receive it?</h2>
              <p>Pick a list or segment — see reach before you send.</p>
              <div className="mkt-audience-toggle">
                {[
                  { id: 'list', label: 'Static list' },
                  { id: 'segment', label: 'Dynamic segment' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`mkt-cat-pill${audienceMode === m.id ? ' is-active' : ''}`}
                    onClick={() => {
                      setAudienceMode(m.id)
                      setCampaignForm((p) => ({
                        ...p,
                        audienceMode: m.id,
                        listId: m.id === 'list' ? p.listId : '',
                        segmentId: m.id === 'segment' ? p.segmentId : '',
                      }))
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              {audienceMode === 'segment' ? (
                <select
                  className="mkt-input"
                  value={campaignForm.segmentId || ''}
                  onChange={(e) =>
                    setCampaignForm((p) => ({ ...p, segmentId: e.target.value, listId: '', audienceMode: 'segment' }))
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
                  className="mkt-input"
                  value={campaignForm.listId || ''}
                  onChange={(e) =>
                    setCampaignForm((p) => ({ ...p, listId: e.target.value, segmentId: '', audienceMode: 'list' }))
                  }
                >
                  <option value="">Choose audience…</option>
                  {channelLists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {marketingOptionLabel(l)} ({l.leadIds?.length || l.memberCount || 0})
                    </option>
                  ))}
                </select>
              )}
              <input
                className="mkt-input mkt-input--mt"
                value={campaignForm.name}
                onChange={(e) => setCampaignForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Campaign name"
              />
            </div>
            <aside className="mkt-audience-stats">
              <div className="mkt-stat-card">
                <span>Audience size</span>
                <strong>{reach.toLocaleString()}</strong>
              </div>
              <div className="mkt-stat-card">
                <span>Estimated reach</span>
                <strong>{Math.round(reach * 0.98).toLocaleString()}</strong>
              </div>
              <div className="mkt-stat-card">
                <span>Growth trend</span>
                <strong>{summary?.audienceGrowth > 0 ? `+${summary.audienceGrowth}%` : 'Stable'}</strong>
              </div>
              <div className="mkt-stat-card mkt-stat-card--wide">
                <span>Segment preview</span>
                <p>{reach ? `${reach} contacts match your selection` : 'Select an audience to preview reach'}</p>
              </div>
            </aside>
          </section>
        )}

        {step === 2 && (
          <section className="mkt-wizard-panel mkt-wizard-panel--full">
            <MarketingTemplateMarketplace
              templates={templates}
              title="Choose a template"
              subtitle="Large previews · categories · your saved layouts"
              onSelect={(tpl) => {
                applyStarter(tpl)
                setStep(3)
              }}
              onCreateBlank={() => {
                setCampaignForm((p) => ({
                  ...p,
                  blocks: [],
                  body: '',
                  design: mergeBrandKit(p.design),
                }))
                setStep(3)
              }}
              onOpenBrandKit={onOpenBrandKit}
            />
          </section>
        )}

        {step === 3 && (
          <section className="mkt-wizard-panel mkt-wizard-panel--center">
            <h2>Design your email</h2>
            <p>Open the visual email studio — drag blocks, edit inline, preview on any device.</p>
            {previewHtml ? (
              <div className="mkt-wizard-preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            ) : (
              <div className="mkt-wizard-preview mkt-wizard-preview--empty">Template selected — open the builder to design.</div>
            )}
            <button type="button" className="mkt-btn mkt-btn--primary mkt-btn--lg" onClick={onEnterEditor}>
              Open email studio
            </button>
          </section>
        )}

        {step === 4 && (
          <section className="mkt-wizard-panel mkt-wizard-panel--split">
            <div>
              <h2>Review before send</h2>
              <p>Subject, audience, and expected performance.</p>
              <label className="mkt-field">
                <span>Subject line</span>
                <input
                  className="mkt-input"
                  value={campaignForm.subject}
                  onChange={(e) => setCampaignForm((p) => ({ ...p, subject: e.target.value }))}
                />
              </label>
              <label className="mkt-field">
                <span>Preview text</span>
                <input
                  className="mkt-input"
                  value={campaignForm.previewText || ''}
                  onChange={(e) => setCampaignForm((p) => ({ ...p, previewText: e.target.value }))}
                />
              </label>
              <button type="button" className="mkt-link" onClick={onEnterEditor}>
                Edit design
              </button>
            </div>
            <aside className="mkt-review-panel">
              {previewHtml ? (
                <div className="mkt-review-preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />
              ) : null}
              <ul className="mkt-review-stats">
                <li>
                  <span>Audience</span>
                  <strong>{reach.toLocaleString()}</strong>
                </li>
                <li>
                  <span>Expected deliveries</span>
                  <strong>{perf.deliveries.toLocaleString()}</strong>
                </li>
                <li>
                  <span>Spam score</span>
                  <strong>{perf.spamScore}</strong>
                </li>
                <li>
                  <span>Est. open rate</span>
                  <strong>{perf.openRate}% (~{perf.estimatedOpens.toLocaleString()} opens)</strong>
                </li>
                <li>
                  <span>Est. click rate</span>
                  <strong>{perf.clickRate}% (~{perf.estimatedClicks.toLocaleString()} clicks)</strong>
                </li>
              </ul>
            </aside>
          </section>
        )}

        {step === 5 && (
          <section className="mkt-wizard-panel mkt-wizard-panel--split">
            <div>
              <h2>Schedule send</h2>
              <p>Pick a time — or send immediately.</p>
              <div className="mkt-schedule-toggle">
                {[
                  { id: 'immediate', label: 'Send now' },
                  { id: 'scheduled', label: 'Schedule' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`mkt-cat-pill${campaignForm.sendMode === m.id ? ' is-active' : ''}`}
                    onClick={() => setCampaignForm((p) => ({ ...p, sendMode: m.id }))}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              {campaignForm.sendMode === 'scheduled' && (
                <>
                  <label className="mkt-field">
                    <span>Date & time</span>
                    <input
                      type="datetime-local"
                      className="mkt-input"
                      value={campaignForm.scheduledAt || ''}
                      onChange={(e) => setCampaignForm((p) => ({ ...p, scheduledAt: e.target.value }))}
                    />
                  </label>
                  <label className="mkt-field">
                    <span>Timezone</span>
                    <input
                      className="mkt-input"
                      value={Intl.DateTimeFormat().resolvedOptions().timeZone}
                      readOnly
                    />
                  </label>
                </>
              )}
              <div className="mkt-best-times">
                <span>Recommended send times</span>
                <div className="mkt-best-times__pills">
                  {bestSendTimes.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className="mkt-cat-pill"
                      onClick={() =>
                        setCampaignForm((p) => ({
                          ...p,
                          sendMode: 'scheduled',
                          scheduledAt: p.scheduledAt || '',
                        }))
                      }
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <aside className="mkt-calendar-placeholder">
              <div className="mkt-calendar-placeholder__inner">
                <strong>Send calendar</strong>
                <p>
                  {campaignForm.sendMode === 'immediate'
                    ? 'Your campaign will send as soon as you launch.'
                    : campaignForm.scheduledAt
                      ? `Scheduled for ${campaignForm.scheduledAt}`
                      : 'Pick a date to see it on the calendar.'}
                </p>
              </div>
            </aside>
          </section>
        )}
      </div>

      {step !== 2 && (
        <footer className="mkt-wizard__foot">
          <button type="button" className="mkt-btn mkt-btn--ghost" onClick={() => onSaveDraft?.()} disabled={busy}>
            Save draft
          </button>
          <div className="mkt-wizard__foot-right">
            {step < WIZARD_STEPS.length - 1 ? (
              <button type="button" className="mkt-btn mkt-btn--primary" disabled={!canNext() || busy} onClick={goNext}>
                {step === 3 ? 'Open studio' : 'Continue'}
              </button>
            ) : (
              <button type="button" className="mkt-btn mkt-btn--primary mkt-btn--lg" disabled={busy} onClick={() => onLaunch?.()}>
                Launch campaign
              </button>
            )}
          </div>
        </footer>
      )}
    </div>
  )
}
