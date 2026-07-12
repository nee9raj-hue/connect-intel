import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import GoogleSignIn from '../components/auth/GoogleSignIn'
import EnterpriseSsoSignIn from '../components/auth/EnterpriseSsoSignIn'
import InviteBanner from '../components/auth/InviteBanner'
import { GOOGLE_SIGNIN_ON_LOGIN_ENABLED } from '../lib/crmProductFlags'
import { isEnterprisePrimary, resolvePublicAuthConfig } from '../lib/enterpriseAuthConfig'
import { BRAND_LOGO_MARK_TRANSPARENT, BRAND_LOGO_MARK_CLASS } from '../lib/brandAssets'
import { FREE_PLAN } from '../lib/crmPlanLimits'
import '../styles/landing-v3.css'

export default function AuthPage({ inviteToken = null }) {
  const { login, setScreen, authBusy } = useApp()
  const [mode, setMode] = useState('signup')
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [authConfig, setAuthConfig] = useState(null)

  useEffect(() => {
    resolvePublicAuthConfig().then(setAuthConfig)
  }, [])

  const enterprisePrimary = isEnterprisePrimary(authConfig)
  const showEmailPassword = mode === 'signup' || authConfig?.emailPassword?.enabled !== false
  const showGoogle =
    mode === 'login' && GOOGLE_SIGNIN_ON_LOGIN_ENABLED && authConfig?.google?.enabled !== false

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

  const showLoginAlternatives = mode === 'login' && (showEmailPassword || showGoogle)

  return (
    <div className="ci-v3 min-h-screen flex flex-col lg:flex-row bg-[#fafafa]">
      <aside className="hidden lg:flex lg:w-[46%] relative overflow-hidden bg-zinc-950 text-white flex-col justify-between p-12">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_20%_0%,rgba(255,119,61,0.15),transparent_55%)]" aria-hidden />
        <div className="relative z-10">
          <button onClick={() => setScreen('landing')} className="flex items-center gap-2 mb-14">
            <img src={BRAND_LOGO_MARK_TRANSPARENT} alt="Connect Intel" className={`h-10 w-auto max-w-[220px] ${BRAND_LOGO_MARK_CLASS}`} />
          </button>
          <p className="ci-v3-eyebrow text-amber-300/90 mb-4">Secure workspace access</p>
          <h2 className="font-display text-[2rem] font-bold leading-tight mb-4 text-white">
            Enterprise AI sales
            <br />
            intelligence platform
          </h2>
          <p className="text-zinc-400 max-w-md text-[15px] leading-relaxed">
            Multi-tenant CRM with role-based access, AI copilot, and persistent secure sessions. Active logins redirect
            straight to your workspace.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-zinc-300">
            {[
              'Organization isolation at API layer',
              'Rate-limited authentication',
              'Google Workspace sign-in available',
              'Enterprise SSO (Azure AD, Okta) when enabled',
            ].map((line) => (
              <li key={line} className="flex gap-2">
                <span className="text-[#FF773D]" aria-hidden>
                  ✓
                </span>
                {line}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative z-10 text-xs text-zinc-500">
          Free tier: {FREE_PLAN.maxSeats} seats · {FREE_PLAN.maxLeads} leads · No card required
        </p>
      </aside>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[420px] ci-v3-glass rounded-2xl p-6 sm:p-8 border border-zinc-200/80 bg-white/90 shadow-xl">
          <button type="button" onClick={() => setScreen('landing')} className="text-sm text-zinc-500 hover:text-zinc-900 mb-6 font-medium">
            ← Back to experience
          </button>

          <h1 className="font-display text-2xl font-bold text-zinc-950 mb-1">
            {mode === 'signup' ? 'Create organization' : 'Sign in to workspace'}
          </h1>
          <p className="text-sm text-zinc-600 mb-4">
            {mode === 'signup' ? 'Work email and password to launch your CRM.' : 'Welcome back — your session persists securely.'}
          </p>

          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 mb-6">
            <span className="font-bold" aria-hidden>
              ●
            </span>
            HTTPS · encrypted cookies · brute-force protection
          </div>

          {inviteToken ? <InviteBanner token={inviteToken} /> : null}

          <div className="grid grid-cols-2 gap-1 mb-6 p-1 bg-zinc-100 rounded-xl" role="tablist">
            {[
              { id: 'signup', label: 'Create workspace' },
              { id: 'login', label: 'Sign in' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={mode === tab.id}
                onClick={() => {
                  setMode(tab.id)
                  setError(null)
                }}
                className={`py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                  mode === tab.id ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {mode === 'login' && enterprisePrimary ? <EnterpriseSsoSignIn layout="block" /> : null}

          {mode === 'login' && enterprisePrimary && showLoginAlternatives ? (
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-zinc-200" />
              <span className="text-xs text-zinc-500 font-medium">or</span>
              <div className="flex-1 h-px bg-zinc-200" />
            </div>
          ) : null}

          {showEmailPassword ? (
            <form onSubmit={handleEmailAuth} className="space-y-4">
              {mode === 'signup' ? (
                <Field label="Your name">
                  <input
                    type="text"
                    required
                    className={inputCls}
                    placeholder="Neeraj Kumar"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </Field>
              ) : null}
              <Field label="Work email">
                <input
                  type="email"
                  required
                  autoComplete="email"
                  className={inputCls}
                  placeholder="you@company.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>
              <Field
                label="Password"
                action={
                  mode === 'login' ? (
                    <a href="mailto:invite@connectintel.net?subject=Password%20reset%20request" className="text-xs font-medium text-zinc-500 hover:text-zinc-900">
                      Forgot password?
                    </a>
                  ) : null
                }
              >
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
              </Field>
              {mode === 'signup' ? (
                <Field label="Confirm password">
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
                </Field>
              ) : null}

              {mode === 'login' ? (
                <label className="flex items-center gap-2 text-sm text-zinc-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="rounded border-zinc-300 text-zinc-900 focus:ring-[#FF773D]/40"
                  />
                  Remember me on this device
                </label>
              ) : null}

              {error ? <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p> : null}

              <button type="submit" disabled={loading || authBusy} className="ci-btn-primary w-full py-3 text-sm disabled:opacity-60">
                {loading || authBusy ? 'Please wait…' : mode === 'signup' ? 'Launch workspace →' : 'Sign in →'}
              </button>
            </form>
          ) : null}

          {mode === 'login' && !enterprisePrimary ? (
            <EnterpriseSsoSignIn layout="block" dividerBefore={showLoginAlternatives} />
          ) : null}

          {showGoogle ? (
            <>
              {showEmailPassword ? (
                <div className="flex items-center gap-3 my-6">
                  <div className="flex-1 h-px bg-zinc-200" />
                  <span className="text-xs text-zinc-500 font-medium">or</span>
                  <div className="flex-1 h-px bg-zinc-200" />
                </div>
              ) : null}
              <GoogleSignIn text="signin_with" layout="block" enabled />
              <p className="mt-3 text-xs text-zinc-500 text-center">Google Workspace · profile only at sign-in</p>
            </>
          ) : null}

          {mode === 'login' && !showEmailPassword && !showGoogle && !enterprisePrimary ? (
            <p className="text-sm text-zinc-600 text-center py-4">Contact your administrator for workspace access.</p>
          ) : null}

          <p className="mt-6 text-xs text-zinc-500 text-center leading-relaxed">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children, action }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-xs font-semibold text-zinc-700">{label}</label>
        {action}
      </div>
      {children}
    </div>
  )
}

const inputCls =
  'w-full px-3.5 py-2.5 border border-zinc-200 rounded-xl text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#FF773D]/30 focus:border-[#FF773D] bg-white transition-shadow'
