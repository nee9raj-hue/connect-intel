import { useEffect } from 'react'

/** Legacy route — team intelligence now lives on the main Dashboard. */
export default function TeamDashboardPanel({ onNavigate }) {
  useEffect(() => {
    onNavigate?.('overview')
  }, [onNavigate])

  return null
}
