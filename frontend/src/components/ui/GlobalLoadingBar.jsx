import { useEffect, useState } from 'react'
import { subscribeApiLoading } from '../../lib/apiLoading'
import { LoadingBar, useDelayedLoading } from './LoadingExperience'

export default function GlobalLoadingBar() {
  const [active, setActive] = useState(false)
  const show = useDelayedLoading(active, 300)

  useEffect(() => subscribeApiLoading(setActive), [])

  if (!show) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] pointer-events-none" aria-hidden>
      <LoadingBar />
    </div>
  )
}
