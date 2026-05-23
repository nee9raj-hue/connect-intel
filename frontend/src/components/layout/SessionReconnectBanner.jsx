import { useApp } from '../../context/AppContext'

export default function SessionReconnectBanner() {
  const { sessionError, refreshSession, logout } = useApp()

  if (!sessionError) return null

  return (
    <div
      className="shrink-0 mx-3 mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950"
      role="alert"
    >
      <p className="font-medium">{sessionError}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => refreshSession()}
          className="font-semibold underline hover:no-underline"
        >
          Reconnect
        </button>
        <button
          type="button"
          onClick={() => logout()}
          className="font-semibold text-amber-900/80 hover:underline"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
