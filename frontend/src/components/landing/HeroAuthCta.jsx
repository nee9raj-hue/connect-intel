import { useApp } from '../../context/AppContext'
import GoogleSignIn from '../auth/GoogleSignIn'

/** Aligned hero CTAs: equal-width buttons + full-width Google sign-in. */
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

      <div className="flex items-center gap-3 w-full" aria-hidden>
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">or</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      <GoogleSignIn text="signup_with" theme="outline" layout="block" />

      <p className="text-xs text-gray-400 text-center leading-relaxed">
        Email sign-up · Google (profile only) · Work Gmail connects later
      </p>
    </div>
  )
}
