import { useState } from 'react'
import { useApp } from '../context/AppContext'
import GoogleSignIn from '../components/auth/GoogleSignIn'
import InviteBanner from '../components/auth/InviteBanner'
import { GOOGLE_SIGNIN_ON_LOGIN_ENABLED } from '../lib/crmProductFlags'
import { BRAND_LOGO_MARK_TRANSPARENT, BRAND_LOGO_MARK_CLASS } from '../lib/brandAssets'
import { CRM_ONBOARDING_STEPS, FREE_PLAN, FREE_TIER_HIGHLIGHTS } from '../lib/crmPlanLimits'

export default function AuthPage({ inviteToken = null }) {
  const { login, setScreen, authBusy } = useApp()
  const [mode, setMode] = useState('signup')
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleEmailAuth = async (e) => {
    e.preventDefault()
    setError(null)
    if (mode === 'signup' && form.password !== form.confirm) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await login({
        mode,
        email: form.email.trim(),
        password: form.password,
        ...(mode === 'signup' ? { name: form.name.trim() } : {}),
      })
    } catch (err) {
      setError(err.message || 'Could not sign in')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-white">
      <div className="hidden lg:flex lg:w-[44%] bg-[#1f1d1c] text-white flex-col justify-between p-12">
        <div>
          <button onClick={() => setScreen('landing')} className="flex items-center gap-2 mb-12">
            <img
              src={BRAND_LOGO_MARK_TRANSPARENT}
              alt="Connect Intel"
              className={`h-11 w-auto max-w-[240px] ${BRAND_LOGO_MARK_CLASS}`}
            />
          </button>
          <h2 className="text-3xl font-bold leading-tight mb-4 text-white">
            Enterprise sales workspace
            <br />
            without email setup on day one
          </h2>
          <p className="text-zinc-300 max-w-sm text-[15px] leading-relaxed">
            Multi-tenant CRM with role-based access, AI copilot, and team intelligence. Sign in once—your session
            stays secure across visits.
          </p>

          <div className="mt-8 space-y-3">
            {FREE_TIER_HIGHLIGHTS.map((item) => (
              <div
                key={item.title}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-3"
              >
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="text-xs text-gray-300 mt-0.5">{item.detail}</p>
              </div>
            ))}
          </div>

          <p className="mt-6 text-xs text-gray-400 leading-relaxed max-w-sm">
            Free includes up to {FREE_PLAN.maxSeats} seats and {FREE_PLAN.maxLeads} leads. When you outgrow that,
            your admin can confirm a Team CRM upgrade and see the monthly amount before payment is collected.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-10">
          {CRM_ONBOARDING_STEPS.map((s) => (
            <div key={s.step} className="rounded-lg border border-white/10 bg-white/5 p-3 text-left">
              <div className="text-[10px] font-bold uppercase tracking-wide text-ci-yellow mb-1">
                Step {s.step}
              </div>
              <div className="text-sm font-semibold text-white">{s.title}</div>
              <div className="text-xs text-gray-300 mt-0.5">{s.detail}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-ci-surface">
        <div className="w-full max-w-[400px]">
          <button
            onClick={() => setScreen('landing')}
            className="text-sm text-gray-600 hover:text-gray-900 mb-8"
          >
            ← Back
          </button>

          <h1 className="text-2xl font-bold text-ci-dark mb-1">
            {mode === 'signup' ? 'Create organization' : 'Sign in to workspace'}
          </h1>
          <p className="text-sm text-gray-600 mb-2">
            {mode === 'signup'
              ? 'Work email and password. Chrome extension handles Gmail sync when you are ready.'
              : 'Work email + password. Active sessions redirect you straight to your workspace.'}
          </p>
          <p className="text-xs text-zinc-500 mb-6 flex items-start gap-2">
            <span className="text-emerald-600 font-bold" aria-hidden>
              ●
            </span>
            HTTPS · encrypted session cookie · rate-limited login
          </p>

          {inviteToken && <InviteBanner token={inviteToken} />}

          <div className="grid grid-cols-2 gap-2 mb-6 p-1 bg-gray-100 rounded-lg">
            {[
              { id: 'signup', label: 'Sign up' },
              { id: 'login', label: 'Sign in' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setMode(tab.id)
                  setError(null)
                }}
                className={`py-2 text-sm font-semibold rounded-md transition-colors ${
                  mode === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            {mode === 'signup' ? (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Your name</label>
                <input
                  type="text"
                  required
                  className={inputCls}
                  placeholder="Neeraj Kumar"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
            ) : null}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Work email</label>
              <input
                type="email"
                required
                autoComplete="email"
                className={inputCls}
                placeholder="you@company.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-gray-700">Password</label>
                {mode === 'login' ? (
                  <a
                    href="mailto:invite@connectintel.net?subject=Password%20reset%20request"
                    className="text-xs font-medium text-gray-600 hover:text-gray-900"
                  >
                    Forgot password?
                  </a>
                ) : null}
              </div>
              <input
                type="password"
                required
                minLength={8}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                className={inputCls}
                placeholder="At least 8 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            {mode === 'signup' ? (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Confirm password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className={inputCls}
                  placeholder="Repeat password"
                  value={form.confirm}
                  onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                />
              </div>
            ) : null}

            {error ? (
              <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded px-2 py-1.5">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={loading || authBusy}
              className="w-full py-3 bg-ci-nav text-white font-semibold rounded-lg hover:bg-gray-800 disabled:opacity-60"
            >
              {loading || authBusy ? 'Please wait…' : mode === 'signup' ? 'Create workspace →' : 'Sign in →'}
            </button>
          </form>

          {mode === 'login' && GOOGLE_SIGNIN_ON_LOGIN_ENABLED ? (
            <>
              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-500 font-medium">or</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <GoogleSignIn text="signin_with" layout="block" enabled />

              <p className="mt-4 text-xs text-gray-600 text-center leading-relaxed">
                For teams already on Connect Intel (e.g. registered with Google). Uses profile only — work Gmail
                for send/receive connects separately in settings.
              </p>
            </>
          ) : null}

          {mode === 'signup' ? (
            <p className="mt-6 text-xs text-gray-500 text-center leading-relaxed">
              After signup you will confirm company details and mobile in setup. Work Gmail uses normal Google scopes
              only when you choose to connect it.
            </p>
          ) : null}

          <p className="mt-4 text-sm text-gray-500 text-center leading-relaxed">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  )
}

const inputCls =
  'w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-ci-yellow/40 focus:border-ci-yellow bg-white'
