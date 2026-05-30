import useChithiPush from '../../hooks/useChithiPush'

export default function ChithiPushBanner({ enabled = true }) {
  const { showPrompt, busy, error, subscribe, dismiss, isInstalledPwa, permission } = useChithiPush({
    enabled,
  })

  if (!showPrompt) return null

  return (
    <div
      className="chithi-push-banner shrink-0 mx-3 mt-2 rounded-2xl border border-[#d7dde5] bg-white px-3 py-2.5 shadow-sm"
      role="region"
      aria-label="Chithi push notifications"
    >
      <p className="text-[12px] font-semibold text-[#17191c]">Chithi notifications</p>
      <p className="text-[11px] text-[#536072] mt-0.5 leading-snug">
        {isInstalledPwa
          ? 'Get lock-screen alerts for direct messages and @mentions — even when the app is closed.'
          : 'Install the app to your home screen, then enable alerts for Chithi DMs and @mentions.'}
        {permission === 'denied' ? ' Notifications are blocked in browser settings — allow them for connectintel.net.' : ''}
      </p>
      {error && <p className="text-[11px] text-red-700 mt-1">{error}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || permission === 'denied'}
          onClick={() => void subscribe()}
          className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-[#17191c] text-white disabled:opacity-50"
        >
          {busy ? 'Enabling…' : 'Enable Chithi alerts'}
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="text-[11px] font-semibold px-2 py-1.5 rounded-lg text-[#536072] hover:text-[#17191c]"
        >
          Not now
        </button>
      </div>
    </div>
  )
}
