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

  if (!supported) {
    return (
      <p className="text-gray-500">
        Use Chrome or Safari on a phone, install Connect Intel to your home screen, then return here.
      </p>
    )
  }

  if (!configured) {
    return (
      <p className="text-gray-500">
        Push is still starting on the server. Hard-refresh the app in a minute, or ask your admin to redeploy
        after adding VAPID keys.
      </p>
    )
  }

  const installed = isPwaStandalone()

  return (
    <div className="space-y-1.5">
      {!installed && (
        <p className="text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1.5">
          Add Connect Intel to your home screen first (Share → Add to Home Screen on iPhone, Install app on
          Android). Push alerts work from the installed app, not a regular browser tab.
        </p>
      )}
      <p>
        {subscribed
          ? 'Lock-screen alerts are on for Chithi DMs and @mentions (when the app is closed).'
          : 'Turn on lock-screen alerts for Chithi direct messages and @mentions.'}
      </p>
      {permission === 'denied' && (
        <p className="text-red-700">
          Notifications are blocked. Open phone Settings → allow notifications for Connect Intel / Safari /
          Chrome.
        </p>
      )}
      {error && <p className="text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || permission === 'denied' || (!installed && !subscribed)}
          onClick={() => void (subscribed ? unsubscribe() : subscribe())}
          className="text-[11px] font-semibold px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          {busy ? 'Saving…' : subscribed ? 'Turn off push alerts' : 'Enable push alerts'}
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
    </div>
  )
}
