import { useEffect, useState } from 'react'
import { applyPwaUpdate, isPwaUpdatePending } from '../../lib/pwaUpdate'

export default function PwaUpdateBanner() {
  const [visible, setVisible] = useState(() => isPwaUpdatePending())

  useEffect(() => {
    const onUpdate = () => setVisible(true)
    window.addEventListener('ci-pwa-update', onUpdate)
    return () => window.removeEventListener('ci-pwa-update', onUpdate)
  }, [])

  if (!visible) return null

  return (
    <div
      className="shrink-0 mx-3 mt-2 rounded-2xl border border-[#cbd6e2] bg-white px-3 py-2.5 shadow-sm"
      role="region"
      aria-label="App update available"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold text-[#33475b] flex-1 min-w-[12rem]">
          A new version is ready. Refresh when you are done with your current task.
        </p>
        <button
          type="button"
          onClick={() => applyPwaUpdate()}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#17191c] text-white"
        >
          Refresh now
        </button>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="text-xs font-semibold px-2 py-1.5 rounded-lg text-[#516f90]"
        >
          Later
        </button>
      </div>
    </div>
  )
}
