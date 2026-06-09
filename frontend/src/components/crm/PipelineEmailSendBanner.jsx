import { useEffect, useState } from 'react'
import CampaignSendProgress from '../marketing/CampaignSendProgress.jsx'
import {
  clearActivePipelineEmailCampaign,
  readActivePipelineEmailCampaign,
} from '../../lib/pipelineEmailCampaign.js'
import { useCampaignSendProgress } from '../../hooks/useCampaignSendProgress.js'

const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'stopped', 'archived'])

export default function PipelineEmailSendBanner({ onNavigate }) {
  const [campaignId, setCampaignId] = useState(() => readActivePipelineEmailCampaign())
  const { progress } = useCampaignSendProgress(campaignId, { enabled: Boolean(campaignId) })

  useEffect(() => {
    if (!campaignId) return
    const status = String(progress?.sendStatus || '').toLowerCase()
    if (progress?.done || TERMINAL.has(status)) {
      clearActivePipelineEmailCampaign(campaignId)
    }
    return undefined
  }, [campaignId, progress?.done, progress?.sendStatus])

  if (!campaignId) return null

  const status = String(progress?.sendStatus || 'queued').toLowerCase()
  const finished = progress?.done || TERMINAL.has(status)

  return (
    <div className="shrink-0 mx-3 md:mx-4 mt-2 rounded-lg border border-[#00a4bd]/30 bg-[#e5f8fa] px-3 py-3 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[#33475b]">
            {finished ? 'Bulk email finished' : 'Bulk email sending in background'}
          </p>
          <p className="text-xs text-[#516f90] mt-0.5">
            {finished
              ? 'Check the lead’s activity log for send confirmation. Delivery to inbox can take a few minutes.'
              : 'You can keep working in Pipeline — progress updates below. Open Marketing → Campaigns for full history.'}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {onNavigate ? (
            <button
              type="button"
              className="crm-btn crm-btn-secondary text-xs py-1.5"
              onClick={() => onNavigate('marketing')}
            >
              Marketing Hub
            </button>
          ) : null}
          <button
            type="button"
            className="crm-btn crm-btn-ghost text-xs py-1.5"
            onClick={() => {
              clearActivePipelineEmailCampaign(campaignId)
              setCampaignId(null)
            }}
            aria-label="Dismiss"
          >
            Dismiss
          </button>
        </div>
      </div>
      <CampaignSendProgress campaignId={campaignId} enabled />
    </div>
  )
}
