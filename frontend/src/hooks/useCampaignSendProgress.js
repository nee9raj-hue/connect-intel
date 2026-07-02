import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.js'

const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'stopped', 'archived'])

export function useCampaignSendProgress(
  campaignId,
  { enabled = true, pollMs = 3000, onDone = null } = {}
) {
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)
  const [polling, setPolling] = useState(false)
  const timerRef = useRef(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  const load = useCallback(async () => {
    if (!campaignId) return null
    try {
      const data = await api.getCampaignSendStatus(campaignId, { silent: true })
      setProgress(data)
      setError(null)
      return data
    } catch (e) {
      setError(e.message || 'Could not load campaign progress')
      return null
    }
  }, [campaignId])

  useEffect(() => {
    if (!enabled || !campaignId) {
      setPolling(false)
      if (timerRef.current) clearInterval(timerRef.current)
      return undefined
    }

    let cancelled = false
    setPolling(true)

    const tick = async () => {
      const data = await load()
      if (cancelled || !data) return
      const status = String(data.sendStatus || '').toLowerCase()
      if (data.done || TERMINAL.has(status)) {
        setPolling(false)
        if (timerRef.current) clearInterval(timerRef.current)
        onDoneRef.current?.(data)
      }
    }

    void tick()
    timerRef.current = setInterval(() => void tick(), pollMs)

    return () => {
      cancelled = true
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [campaignId, enabled, load, pollMs])

  return { progress, error, polling, refresh: load }
}
