import { useCampaignSendProgress } from '../../hooks/useCampaignSendProgress.js'

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
  const pct =
    progress.total > 0
      ? Math.min(100, Math.round(((progress.sent + progress.failed) / progress.total) * 100))
      : 0

  return (
    <div className={`text-xs text-[#33475b] bg-[#eaf0f6] rounded-lg px-3 py-2 space-y-2 ${className}`}>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        <span className="font-medium capitalize">{status}</span>
        {polling ? <span className="text-[#516f90]">Updating…</span> : null}
      </div>
      <div className="h-1.5 rounded-full bg-[#cbd6e2] overflow-hidden">
        <div className="h-full bg-[#00a4bd] transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[#516f90]">
        {progress.sent} sent · {progress.remaining} remaining
        {progress.failed ? ` · ${progress.failed} failed` : ''}
        {progress.opened ? ` · ${progress.opened} opened` : ''}
        {progress.clicked ? ` · ${progress.clicked} clicked` : ''}
      </p>
      {progress.backgroundEmailEnabled && progress.estimatedCompletionMs ? (
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
