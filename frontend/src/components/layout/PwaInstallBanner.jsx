import useIsMobile from '../../hooks/useIsMobile'
import usePwaInstall from '../../hooks/usePwaInstall'

export default function PwaInstallBanner({ enabled = true }) {
  const isMobile = useIsMobile()
  const { visible, installing, canNativeInstall, install, dismiss } = usePwaInstall({
    enabled: enabled && isMobile,
  })

  if (!visible) return null

  return (
    <div
      className="pwa-install-banner shrink-0 mx-3 mt-2 rounded-2xl border border-[#ffd4b8] bg-[#fff4ee] px-3 py-2.5 shadow-sm"
      role="region"
      aria-label="Install Connect Intel app"
    >
      <div className="flex items-center gap-2.5">
        <img src="/pwa-192.png" alt="" className="w-10 h-10 rounded-xl shrink-0" aria-hidden />
        <div className="min-w-0 flex-1 flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold text-[#17191c]">Install app</p>
          {canNativeInstall && (
            <button
              type="button"
              disabled={installing}
              onClick={() => void install()}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#17191c] text-white disabled:opacity-60"
            >
              {installing ? '…' : 'Install'}
            </button>
          )}
          <button
            type="button"
            onClick={dismiss}
            className="text-xs font-semibold px-2 py-1.5 rounded-lg text-[#536072] hover:text-[#17191c]"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}
