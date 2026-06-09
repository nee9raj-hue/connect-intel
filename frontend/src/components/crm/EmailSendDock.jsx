import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  clearActivePipelineEmailCampaign,
  readActivePipelineEmailCampaign,
} from '../../lib/pipelineEmailCampaign.js'
import { useCampaignSendProgress } from '../../hooks/useCampaignSendProgress.js'
import useEmailSendDock from '../../hooks/useEmailSendDock.js'
import useIsMobile from '../../hooks/useIsMobile.js'
import { GripIcon, MailIcon, SidebarCollapseIcon } from '../ui/icons'

const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'stopped', 'archived'])

const STATUS_SHORT = {
  queued: 'Queue',
  preparing: 'Prep',
  sending: 'Send',
  completed: 'Done',
  failed: 'Fail',
  cancelled: 'Stop',
  paused: 'Pause',
}

function progressNumbers(progress) {
  const total = progress?.total || progress?.enrolled || 0
  const sent = progress?.sent || 0
  const failed = progress?.failed || 0
  const processed = sent + failed
  const remaining = progress?.remaining ?? Math.max(0, total - processed)
  const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0
  return { total, sent, failed, remaining, processed, pct }
}

export default function EmailSendDock({ sidebarMode = 'rail', onNavigate }) {
  const isMobile = useIsMobile()
  const [campaignId, setCampaignId] = useState(() => readActivePipelineEmailCampaign())
  const { progress } = useCampaignSendProgress(campaignId, { enabled: Boolean(campaignId) })
  const enabled = Boolean(campaignId)
  const { minimized, setMinimized, dockStyle, onDragHandlePointerDown } = useEmailSendDock(enabled, {
    sidebarMode,
    isMobile,
  })

  useEffect(() => {
    if (!campaignId) return
    const status = String(progress?.sendStatus || '').toLowerCase()
    if (progress?.done || TERMINAL.has(status)) {
      clearActivePipelineEmailCampaign(campaignId)
    }
    return undefined
  }, [campaignId, progress?.done, progress?.sendStatus])

  useEffect(() => {
    const sync = () => {
      const id = readActivePipelineEmailCampaign()
      if (id) setCampaignId(id)
    }
    window.addEventListener('ci:pipeline-email-campaign', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('ci:pipeline-email-campaign', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  if (!campaignId || !progress) return null

  const status = String(progress.sendStatus || 'queued').toLowerCase()
  const finished = progress.done || TERMINAL.has(status)
  const statusLabel = STATUS_SHORT[status] || status
  const { total, sent, processed, remaining, pct } = progressNumbers(progress)

  const dismiss = () => {
    clearActivePipelineEmailCampaign(campaignId)
    setCampaignId(null)
  }

  if (minimized) {
    const node = (
      <button
        type="button"
        className="email-send-dock email-send-dock--docked"
        style={dockStyle}
        onClick={() => setMinimized(false)}
        title={`Bulk email: ${processed} of ${total || '—'} sent`}
        aria-label={`Bulk email ${statusLabel}, ${processed} of ${total} sent`}
      >
        <MailIcon className="email-send-dock__mail-icon" aria-hidden />
        <span className="email-send-dock__mini-count tabular-nums">
          {processed}/{total || '—'}
        </span>
        <span className="email-send-dock__mini-bar" aria-hidden>
          <span className="email-send-dock__mini-bar-fill" style={{ width: `${pct}%` }} />
        </span>
      </button>
    )
    return createPortal(node, document.body)
  }

  const node = (
    <div
      className={`email-send-dock email-send-dock--expanded ${finished ? 'is-finished' : 'is-active'}`}
      style={dockStyle}
      role="status"
      aria-live="polite"
    >
      <div
        className="email-send-dock__drag"
        onPointerDown={onDragHandlePointerDown}
        role="presentation"
        title="Drag to move"
      >
        <GripIcon className="email-send-dock__grip" aria-hidden />
      </div>

      <MailIcon className="email-send-dock__mail-icon" aria-hidden />

      <div className="email-send-dock__main">
        <div className="email-send-dock__row">
          <span className="email-send-dock__status">{statusLabel}</span>
          <span className="email-send-dock__count tabular-nums">
            {processed} of {total || '—'}
          </span>
        </div>
        <div className="email-send-dock__bar" aria-hidden>
          <div className="email-send-dock__bar-fill" style={{ width: `${pct}%` }} />
        </div>
        {remaining > 0 ? (
          <span className="email-send-dock__hint tabular-nums">{remaining} left</span>
        ) : null}
      </div>

      <div className="email-send-dock__actions">
        {onNavigate ? (
          <button
            type="button"
            className="email-send-dock__btn"
            onClick={() => onNavigate('marketing')}
            title="Marketing Hub"
          >
            Hub
          </button>
        ) : null}
        <button
          type="button"
          className="email-send-dock__btn"
          onClick={() => setMinimized(true)}
          aria-label="Dock to sidebar"
          title="Dock left"
        >
          <SidebarCollapseIcon className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          className="email-send-dock__btn email-send-dock__btn--dismiss"
          onClick={dismiss}
          aria-label="Dismiss"
          title="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
