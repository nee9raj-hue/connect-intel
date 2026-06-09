import { useCampaignSendProgress } from '../../hooks/useCampaignSendProgress.js'

const STATUS_LABELS = {
  queued: 'Queued',
  preparing: 'Preparing',
  sending: 'Sending',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
  paused: 'Paused',
  draft: 'Draft',
}

function formatEta(ms) {
  if (!ms || ms <= 0) return null
  const min = Math.ceil(ms / 60_000)
  if (min < 2) return 'about 1 minute'
  return `about ${min} minutes`
}

export default function CampaignSendProgress({ campaignId, enabled = true, className = '' }) {
  const { progress, error, polling } = useCampaignSendProgress(campaignId, { enabled })

  if (!campaignId || !enabled) return null
  if (error) {
    return <p className={`text-xs text-red-700 ${className}`}>{error}</p>
  }
  if (!progress) return null

  const status = progress.sendStatus || 'queued'
  const statusLabel = STATUS_LABELS[String(status).toLowerCase()] || status
  const total = progress.total || progress.enrolled || 0
  const processed = (progress.sent || 0) + (progress.failed || 0)
  const remaining = progress.remaining ?? Math.max(0, total - processed)
  const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0

  return (
    <div className={`text-xs text-[#33475b] bg-[#eaf0f6] rounded-lg px-3 py-2 space-y-2 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="font-medium">{statusLabel}</span>
        <span className="text-sm font-semibold tabular-nums text-[#33475b]">
          {processed} of {total || '—'} sent
          {remaining > 0 ? ` · ${remaining} remaining` : ''}
        </span>
      </div>
      <div className="h-2 rounded-full bg-[#cbd6e2] overflow-hidden">
        <div className="h-full bg-[#00a4bd] transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[#516f90] tabular-nums">
        {progress.sent} delivered
        {progress.failed ? ` · ${progress.failed} failed` : ''}
        {remaining > 0 ? ` · ${remaining} in queue` : ''}
        {progress.opened ? ` · ${progress.opened} opened` : ''}
        {progress.clicked ? ` · ${progress.clicked} clicked` : ''}
      </p>
      {(progress.mode === 'queued' || progress.background) && progress.estimatedCompletionMs ? (
        <p className="text-[#516f90]">
          Sending in the background — you can close this tab.
          {formatEta(progress.estimatedCompletionMs)
            ? ` Est. ${formatEta(progress.estimatedCompletionMs)} remaining.`
            : ''}
        </p>
      ) : null}
    </div>
  )
}
