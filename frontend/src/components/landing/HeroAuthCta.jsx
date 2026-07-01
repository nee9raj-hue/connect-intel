import { useApp } from '../../context/AppContext'
import { FREE_PLAN } from '../../lib/crmPlanLimits'

/** Hero CTAs — email/password signup only (no Google on landing). */
export default function HeroAuthCta({ id }) {
  const { setScreen } = useApp()

  return (
    <div id={id} className="w-full max-w-[420px] mx-auto flex flex-col items-stretch gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
        <button
          type="button"
          onClick={() => setScreen('auth')}
          className="w-full min-h-[48px] px-6 py-3.5 bg-[#0f0f0f] text-white text-[15px] font-semibold rounded-lg hover:bg-[#2a2a2a] transition-colors shadow-lg shadow-black/10"
        >
          Start free workspace
        </button>
        <a
          href="#product"
          className="w-full min-h-[48px] flex items-center justify-center px-6 py-3.5 bg-white text-[#0f0f0f] text-[15px] font-semibold rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          See the CRM
        </a>
      </div>

      <p className="text-xs text-gray-600 text-center leading-relaxed">
        Free for up to {FREE_PLAN.maxSeats} seats and {FREE_PLAN.maxLeads} leads · Email sign-up · No card required
      </p>
    </div>
  )
}
