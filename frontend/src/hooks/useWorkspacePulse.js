import { useEffect, useRef } from 'react'
import { api } from '../lib/api'

const PULSE_MS = 60 * 1000

/** Track active workspace time and panel usage for team intelligence (managers). */
export function useWorkspacePulse({ enabled, userId, panel = null }) {
  const panelRef = useRef(panel)
  panelRef.current = panel

  useEffect(() => {
    if (!enabled || !userId) return undefined

    const send = () => {
      if (document.visibilityState !== 'visible') return
      void api.postWorkspacePulse({ panel: panelRef.current || 'overview' }, { silent: true })
    }

    send()
    const id = setInterval(send, PULSE_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') send()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, userId])
}
