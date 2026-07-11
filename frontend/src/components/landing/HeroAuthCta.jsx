import { useApp } from '../../context/AppContext'
import { FREE_PLAN } from '../../lib/crmPlanLimits'

/** Hero CTAs — enterprise workspace creation */
export default function HeroAuthCta({ id }) {
  const { setScreen } = useApp()

  return (
    <div id={id} className="w-full max-w-[480px] flex flex-col items-stretch gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
        <button
          type="button"
          onClick={() => setScreen('auth')}
          className="w-full min-h-[48px] px-6 py-3.5 bg-zinc-950 text-white text-[15px] font-semibold rounded-lg hover:bg-zinc-800 transition-colors"
        >
          Start free workspace
        </button>
        <a
          href="#platform"
          className="w-full min-h-[48px] flex items-center justify-center px-6 py-3.5 bg-white text-zinc-950 text-[15px] font-semibold rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors"
        >
          See platform
        </a>
      </div>
      <p className="text-xs text-zinc-500 text-center leading-relaxed">
        Free for up to {FREE_PLAN.maxSeats} seats and {FREE_PLAN.maxLeads} leads · Secure sign-in · No card required
      </p>
    </div>
  )
}
