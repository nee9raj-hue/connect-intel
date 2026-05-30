import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import MarketingTemplateBuilder, { FOLLOW_UP_STARTER } from './MarketingTemplateBuilder'
const PAGE_LABELS = ['Design', 'Follow-up', 'Review']

export default function MarketingCampaignWizardModal({
  open,
  onClose,
  campaignForm,
  setCampaignForm,
  setCampaignEmailStep,
  forms,
  lists,
  templates,
  busy,
  canSaveCampaignDraft,
  saveHint = null,
  error = null,
  notice = null,
  onSaveDraft,
  onSend,
  onSaveAsTemplate,
}) {
  const trackRef = useRef(null)
  const [page, setPage] = useState(0)
  const [stepError, setStepError] = useState(null)
  const pageCount = 3

  const listLabel =
    lists.find((l) => l.id === campaignForm.listId)?.name || '—'
  const tplLabel = campaignForm.templateId
    ? templates.find((t) => t.id === campaignForm.templateId)?.name || 'Template'
    : 'Custom design'

  const scrollToPage = useCallback((index) => {
    const el = trackRef.current
    if (!el) return
    const next = Math.max(0, Math.min(pageCount - 1, index))
    el.scrollTo({ left: el.clientWidth * next, behavior: 'smooth' })
    setPage(next)
  }, [])

  useEffect(() => {
    if (!open) return undefined
    setPage(0)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    requestAnimationFrame(() => {
      if (trackRef.current) trackRef.current.scrollLeft = 0
    })
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const onTrackScroll = useCallback(() => {
    const el = trackRef.current
    if (!el || !el.clientWidth) return
    const idx = Math.round(el.scrollLeft / el.clientWidth)
    setPage(Math.max(0, Math.min(pageCount - 1, idx)))
  }, [])

  const goNext = () => {
    setStepError(null)
    if (page === 0) {
      const isWa = campaignForm.channel === 'whatsapp'
      if (!campaignForm.blocks?.length && !campaignForm.body.trim()) {
        setStepError(isWa ? 'Add message content (blocks or text).' : 'Add at least one block to your email.')
        return
      }
      if (!isWa && !campaignForm.subject.trim()) {
        setStepError('Enter a subject line at the top of the Design step.')
        return
      }
    }
    if (page === 0 && campaignForm.useSequence) {
      setCampaignEmailStep(2)
    } else if (page === 0) {
      setCampaignEmailStep(1)
    }
    scrollToPage(page + 1)
  }

  const goBack = () => {
    if (page === 2 && campaignForm.useSequence) {
      setCampaignEmailStep(2)
    } else {
      setCampaignEmailStep(1)
    }
    scrollToPage(page - 1)
  }

  const handleClose = () => {
    onClose?.()
  }

  if (!open) return null

  const isWa = campaignForm.channel === 'whatsapp'
  const page2Active = campaignForm.useSequence

  return createPortal(
    <div className="marketing-wizard-overlay" role="dialog" aria-modal="true" aria-label="Campaign builder">
      <div className="marketing-wizard">
        <header className="marketing-wizard-header">
          <button
            type="button"
            className="marketing-wizard-nav-btn"
            disabled={page === 0}
            onClick={goBack}
            aria-label="Previous step"
          >
            ←
          </button>
          <div className="marketing-wizard-header-center">
            <p className="marketing-wizard-step-kicker">
              Step {page + 1} of {pageCount}
            </p>
            <h2 className="marketing-wizard-step-title">{PAGE_LABELS[page]}</h2>
          </div>
          <button type="button" onClick={handleClose} className="crm-modal-close" aria-label="Close">
            ×
          </button>
        </header>

        <div className="marketing-wizard-dots" aria-hidden>
          {PAGE_LABELS.map((label, i) => (
            <button
              key={label}
              type="button"
              className={`marketing-wizard-dot ${page === i ? 'is-active' : ''}`}
              onClick={() => scrollToPage(i)}
              aria-label={`Go to ${label}`}
            />
          ))}
        </div>

        <p className="marketing-wizard-swipe-hint">Swipe left or right between steps · scroll down in each step</p>

        <div
          ref={trackRef}
          className="marketing-wizard-track"
          onScroll={onTrackScroll}
        >
          {/* Page 1 — Design */}
          <section className="marketing-wizard-page">
            <div className="marketing-wizard-page-inner marketing-wizard-page-inner--studio">
              <MarketingTemplateBuilder
                  embedded
                  compactMode
                  fillHeight={false}
                  showNameField={false}
                  showSavedTemplates={false}
                  title={isWa ? 'WhatsApp message' : 'Email design'}
                  subtitle={
                    isWa
                      ? 'Use merge tags like {{firstName}}. Designed blocks convert to text for WhatsApp.'
                      : 'Drag blocks, edit copy, then continue to review.'
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
            </div>
          </section>

          {/* Page 2 — Follow-up or options */}
          <section className="marketing-wizard-page">
            <div className="marketing-wizard-page-inner">
              {page2Active ? (
                <MarketingTemplateBuilder
                  embedded
                  compactMode
                  fillHeight={false}
                  showNameField={false}
                  showSavedTemplates={false}
                  title={isWa ? 'Follow-up WhatsApp' : 'Follow-up email'}
                  subtitle={`Sent ${campaignForm.step2Delay || 3} days after the first message.`}
                  starterOptions={
                    isWa
                      ? undefined
                      : [{ id: 'followup', name: 'Follow-up check-in', ...FOLLOW_UP_STARTER }]
                  }
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
              ) : (
                <div className="marketing-wizard-review-card space-y-4">
                  <h3 className="text-sm font-semibold text-slate-900">Optional follow-up</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    You can add a second message after a delay. Turn it on here, or skip to review on the
                    next screen.
                  </p>
                  <label className="flex items-center gap-2 text-sm text-gray-800">
                    <input
                      type="checkbox"
                      checked={campaignForm.useSequence}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setCampaignForm((p) => ({
                          ...p,
                          useSequence: checked,
                          step2Blocks:
                            checked && !p.step2Blocks?.length && !isWa
                              ? FOLLOW_UP_STARTER.blocks.map((b) => ({
                                  ...b,
                                  id: `blk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                                }))
                              : p.step2Blocks,
                          step2Subject:
                            checked && !p.step2Subject && !isWa
                              ? FOLLOW_UP_STARTER.subject
                              : p.step2Subject,
                        }))
                      }}
                    />
                    Add follow-up {isWa ? 'WhatsApp' : 'email'}
                  </label>
                  {campaignForm.useSequence && (
                    <label className="flex items-center gap-2 text-xs text-gray-600">
                      Send after
                      <input
                        value={campaignForm.step2Delay}
                        onChange={(e) =>
                          setCampaignForm((p) => ({ ...p, step2Delay: e.target.value }))
                        }
                        type="number"
                        min={1}
                        max={30}
                        className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-1"
                      />
                      days
                    </label>
                  )}
                  {campaignForm.useSequence && (
                    <button
                      type="button"
                      className="crm-btn crm-btn-secondary w-full"
                      onClick={() => {
                        setCampaignEmailStep(2)
                        scrollToPage(1)
                      }}
                    >
                      Edit follow-up design →
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Page 3 — Review */}
          <section className="marketing-wizard-page">
            <div className="marketing-wizard-page-inner">
              <div className="marketing-wizard-review-card">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Review campaign</h3>
                <dl className="marketing-wizard-review-dl">
                  <div>
                    <dt>Name</dt>
                    <dd>{campaignForm.name.trim() || '—'}</dd>
                  </div>
                  <div>
                    <dt>Channel</dt>
                    <dd>{isWa ? 'WhatsApp' : 'Email'}</dd>
                  </div>
                  <div>
                    <dt>List</dt>
                    <dd>{listLabel}</dd>
                  </div>
                  <div>
                    <dt>Starter</dt>
                    <dd>{tplLabel}</dd>
                  </div>
                  {!isWa && (
                    <div>
                      <dt>Subject</dt>
                      <dd>{campaignForm.subject.trim() || '—'}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Follow-up</dt>
                    <dd>
                      {campaignForm.useSequence
                        ? `Yes — after ${campaignForm.step2Delay || 3} days`
                        : 'No'}
                    </dd>
                  </div>
                </dl>
                <p className="text-xs text-slate-500 mt-4 leading-relaxed">
                  Save as draft to finish later, send now, or close (×) to keep your setup on the main
                  screen.
                </p>
              </div>
            </div>
          </section>
        </div>

        <footer className="marketing-wizard-footer">
          {(error || notice || stepError || (page === pageCount - 1 && saveHint && !canSaveCampaignDraft)) && (
            <div className="marketing-wizard-footer-alerts">
              {error && <p className="crm-alert crm-alert-error mb-0">{error}</p>}
              {stepError && !error && <p className="crm-alert crm-alert-error mb-0">{stepError}</p>}
              {notice && <p className="crm-alert crm-alert-success mb-0">{notice}</p>}
              {page === pageCount - 1 && saveHint && !canSaveCampaignDraft && !error && (
                <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2 mb-0">
                  {saveHint}
                </p>
              )}
            </div>
          )}
          {page < pageCount - 1 ? (
            <button type="button" className="crm-btn crm-btn-primary w-full" onClick={goNext}>
              Continue
            </button>
          ) : (
            <div className="marketing-wizard-footer-actions">
              <button
                type="button"
                className="crm-btn crm-btn-secondary"
                disabled={busy}
                onClick={() => void onSaveAsTemplate?.()}
              >
                Save template
              </button>
              <button
                type="button"
                className="crm-btn crm-btn-secondary"
                disabled={busy || !canSaveCampaignDraft}
                onClick={() => void onSaveDraft?.()}
              >
                Save draft
              </button>
              <button
                type="button"
                className="crm-btn crm-btn-primary"
                disabled={busy || !canSaveCampaignDraft}
                onClick={() => void onSend?.()}
              >
                {busy ? 'Working…' : isWa ? 'Send WhatsApp' : 'Send campaign'}
              </button>
            </div>
          )}
        </footer>
      </div>
    </div>,
    document.body
  )
}
