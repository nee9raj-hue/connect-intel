import useChithiPush from '../../hooks/useChithiPush'
import { isPwaStandalone } from '../../lib/pwaInstall'

export default function ChithiPushToggle() {
  const {
    supported,
    configured,
    subscribed,
    busy,
    error,
    permission,
    subscribe,
    unsubscribe,
    refreshStatus,
  } = useChithiPush({ enabled: true })

  if (!supported || !configured) return null

  const installed = isPwaStandalone()

  return (
    <div className="flex flex-wrap items-center gap-2">
      {permission === 'denied' && (
        <span className="text-[11px] text-red-700">Blocked in system settings</span>
      )}
      {error && <span className="text-[11px] text-red-700">{error}</span>}
      <button
        type="button"
        disabled={busy || permission === 'denied' || (!installed && !subscribed)}
        onClick={() => void (subscribed ? unsubscribe() : subscribe())}
        className="text-[11px] font-semibold px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
      >
        {busy ? '…' : subscribed ? 'Off' : 'On'}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void refreshStatus()}
        className="text-[11px] font-semibold px-2 py-1 rounded text-gray-600 hover:text-gray-900"
      >
        Refresh
      </button>
    </div>
  )
}
