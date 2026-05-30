import useChithiPush from '../../hooks/useChithiPush'

export default function ChithiPushBanner({ enabled = true }) {
  const { showPrompt, busy, error, subscribe, dismiss, permission } = useChithiPush({
    enabled,
  })

  if (!showPrompt) return null

  return (
    <div
      className="chithi-push-banner shrink-0 mx-3 mt-2 rounded-2xl border border-[#d7dde5] bg-white px-3 py-2.5 shadow-sm"
      role="region"
      aria-label="Chithi push notifications"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold text-[#17191c]">Chithi alerts</p>
        {error && <span className="text-xs text-red-700">{error}</span>}
        <button
          type="button"
          disabled={busy || permission === 'denied'}
          onClick={() => void subscribe()}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#17191c] text-white disabled:opacity-50"
        >
          {busy ? '…' : 'Enable'}
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="text-xs font-semibold px-2 py-1.5 rounded-lg text-[#536072] hover:text-[#17191c]"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
