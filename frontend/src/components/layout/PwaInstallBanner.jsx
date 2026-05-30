import useIsMobile from '../../hooks/useIsMobile'
import usePwaInstall from '../../hooks/usePwaInstall'

export default function PwaInstallBanner({ enabled = true }) {
  const isMobile = useIsMobile()
  const { visible, installing, canNativeInstall, isIos, install, dismiss } = usePwaInstall({
    enabled: enabled && isMobile,
  })

  if (!visible) return null

  return (
    <div
      className="pwa-install-banner shrink-0 mx-3 mt-2 rounded-2xl border border-[#ffd4b8] bg-[#fff4ee] px-3 py-2.5 shadow-sm"
      role="region"
      aria-label="Install Connect Intel app"
    >
      <div className="flex items-start gap-2.5">
        <img src="/pwa-192.png" alt="" className="w-10 h-10 rounded-xl shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-[#17191c]">Install Connect Intel</p>
          {isIos ? (
            <p className="text-[11px] text-[#536072] mt-0.5 leading-snug">
              Tap <span className="font-semibold">Share</span> in Safari, then{' '}
              <span className="font-semibold">Add to Home Screen</span> for full-screen Chithi and CRM.
            </p>
          ) : (
            <p className="text-[11px] text-[#536072] mt-0.5 leading-snug">
              Add the app to your home screen for faster access and a full-screen experience.
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {canNativeInstall && (
              <button
                type="button"
                disabled={installing}
                onClick={() => void install()}
                className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-[#17191c] text-white disabled:opacity-60"
              >
                {installing ? 'Installing…' : 'Install app'}
              </button>
            )}
            <button
              type="button"
              onClick={dismiss}
              className="text-[11px] font-semibold px-2 py-1.5 rounded-lg text-[#536072] hover:text-[#17191c]"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
