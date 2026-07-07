import { useEffect, useState } from 'react'
import { api } from '../lib/api'

/** Debounced consent-aware audience preview for campaign setup (desktop + mobile). */
export function useAudiencePreview(campaignForm) {
  const [audiencePreview, setAudiencePreview] = useState(null)
  const [audiencePreviewLoading, setAudiencePreviewLoading] = useState(false)

  const audienceMode =
    campaignForm?.audienceMode ||
    (campaignForm?.segmentId ? 'segment' : campaignForm?.listId ? 'list' : 'all')

  useEffect(() => {
    const canPreview =
      audienceMode === 'all' ||
      (audienceMode === 'segment' && campaignForm?.segmentId) ||
      (audienceMode === 'list' && campaignForm?.listId)
    if (!canPreview) {
      setAudiencePreview(null)
      return undefined
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      setAudiencePreviewLoading(true)
      try {
        const data = await api.previewMarketingAudience({
          audienceMode,
          listId: campaignForm.listId || undefined,
          segmentId: campaignForm.segmentId || undefined,
          channel: campaignForm.channel || 'email',
        })
        if (!cancelled) setAudiencePreview(data)
      } catch {
        if (!cancelled) setAudiencePreview(null)
      } finally {
        if (!cancelled) setAudiencePreviewLoading(false)
      }
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [audienceMode, campaignForm?.listId, campaignForm?.segmentId, campaignForm?.channel])

  return { audiencePreview, audiencePreviewLoading, audienceMode }
}
