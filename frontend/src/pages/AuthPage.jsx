import { useState } from 'react'
import { useApp } from '../context/AppContext'
import GoogleSignIn from '../components/auth/GoogleSignIn'
import InviteBanner from '../components/auth/InviteBanner'

export default function AuthPage({ inviteToken = null }) {
  const { login, setScreen } = useApp()
  const [showEmail, setShowEmail] = useState(false)
  const [form, setForm] = useState({ email: '', password: '' })

  const handleEmailLogin = (e) => {
    e.preventDefault()
    if (!form.email) return
    login({
      demoProfile: {
        name: form.email.split('@')[0],
        email: form.email,
        company: form.email.split('@')[1]?.split('.')[0] || 'Your Company',
        plan: 'free',
        searchesLeft: 25,
        authProvider: 'email-demo',
      },
    })
  }

  return (
    <div className="min-h-screen flex bg-white">
      <div className="hidden lg:flex lg:w-[44%] bg-ci-nav text-white flex-col justify-between p-12">
        <div>
          <button onClick={() => setScreen('landing')} className="flex items-center gap-2 mb-20">
            <div className="w-9 h-9 rounded-md bg-ci-yellow flex items-center justify-center text-ci-dark font-bold text-sm">
              CI
            </div>
            <span className="font-display font-bold text-lg">Connect Intel</span>
          </button>
          <h2 className="text-3xl font-bold leading-tight mb-4">
            The smarter way to
            <br />
            find B2B leads
          </h2>
          <p className="text-gray-400 max-w-sm text-[15px] leading-relaxed">
            Search, score, and save prospects. One login gets you into the full workspace instantly.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          {[
            { n: '2.4M+', l: 'Contacts' },
            { n: '25', l: 'Free searches' },
            { n: 'CSV', l: 'Export' },
          ].map((s) => (
            <div key={s.l}>
              <div className="text-xl font-bold text-ci-yellow">{s.n}</div>
              <div className="text-xs text-gray-500">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-ci-surface">
        <div className="w-full max-w-[400px]">
          <button
            onClick={() => setScreen('landing')}
            className="text-sm text-gray-500 hover:text-gray-800 mb-8"
          >
            ← Back
          </button>

          <h1 className="text-2xl font-bold text-ci-dark mb-1">Welcome</h1>
          <p className="text-sm text-gray-500 mb-8">Sign in to access your workspace</p>

          {inviteToken && <InviteBanner token={inviteToken} />}

          <GoogleSignIn text="continue_with" />

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {!showEmail ? (
            <button
              type="button"
              onClick={() => setShowEmail(true)}
              className="w-full py-3 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50"
            >
              Continue with email
            </button>
          ) : (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Work email</label>
                <input
                  type="email"
                  required
                  className={inputCls}
                  placeholder="you@company.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Password</label>
                <input
                  type="password"
                  className={inputCls}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-ci-nav text-white font-semibold rounded-lg hover:bg-gray-800"
              >
                Sign in →
              </button>
            </form>
          )}

          <p className="mt-8 text-[11px] text-gray-400 text-center leading-relaxed">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  )
}

const inputCls =
  'w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ci-yellow/40 focus:border-ci-yellow bg-white'
