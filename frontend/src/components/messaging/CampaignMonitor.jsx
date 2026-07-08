import { useCallback, useState } from 'react'
import { api } from '../../lib/api.js'
import CampaignSendProgress from '../marketing/CampaignSendProgress.jsx'
import { useCampaignSendProgress } from '../../hooks/useCampaignSendProgress.js'

const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'stopped', 'archived', 'delivered'])

/**
 * Non-blocking campaign monitor — progress, failures, retry, export.
 */
export default function CampaignMonitor({
  campaignId,
  campaignName = 'Campaign',
  enabled = true,
  className = '',
  onDone,
  onClose,
}) {
  const { progress, error, polling, refresh } = useCampaignSendProgress(campaignId, {
    enabled: enabled && Boolean(campaignId),
    onDone,
  })
  const [actionBusy, setActionBusy] = useState(false)
  const [actionNote, setActionNote] = useState(null)

  const status = String(progress?.sendStatus || 'queued').toLowerCase()
  const isActive = progress && !progress.done && !TERMINAL.has(status)
  const failed = progress?.failed || 0

  const retryFailed = useCallback(async () => {
    if (!campaignId) return
    setActionBusy(true)
    setActionNote(null)
    try {
      await api.drainBulkCrmEmail(campaignId, { silent: true })
      setActionNote('Retrying failed sends…')
      await refresh()
    } catch (e) {
      setActionNote(e.message || 'Retry failed')
    } finally {
      setActionBusy(false)
    }
  }, [campaignId, refresh])

  const exportReport = useCallback(() => {
    if (!progress) return
    const rows = [
      ['Campaign', campaignName],
      ['Status', progress.sendStatus],
      ['Total', progress.total],
      ['Sent', progress.sent],
      ['Failed', progress.failed],
      ['Opened', progress.opened],
      ['Clicked', progress.clicked],
      ['Remaining', progress.remaining],
    ]
    const csv = rows.map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `campaign-${campaignId || 'report'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [campaignId, campaignName, progress])

  if (!campaignId || !enabled) return null

  return (
    <div className={`rounded-xl border border-[#cbd6e2] bg-white p-4 space-y-3 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#516f90]">Communications</p>
          <h3 className="text-sm font-semibold text-[#33475b]">{campaignName}</h3>
        </div>
        {onClose ? (
          <button type="button" className="ci-btn ci-btn-ghost text-xs" onClick={onClose}>
            Close
          </button>
        ) : null}
      </div>

      <CampaignSendProgress campaignId={campaignId} enabled={enabled} onDone={onDone} />

      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      {actionNote ? <p className="text-xs text-[#516f90]">{actionNote}</p> : null}

      <div className="flex flex-wrap gap-2">
        {failed > 0 ? (
          <button
            type="button"
            className="ci-btn ci-btn-secondary text-xs"
            disabled={actionBusy || polling}
            onClick={() => void retryFailed()}
          >
            Retry failed ({failed})
          </button>
        ) : null}
        <button
          type="button"
          className="ci-btn ci-btn-ghost text-xs"
          disabled={!progress}
          onClick={exportReport}
        >
          Export report
        </button>
        {isActive ? (
          <span className="text-xs text-[#516f90] self-center">Sending in background — you can keep working</span>
        ) : null}
      </div>
    </div>
  )
}
