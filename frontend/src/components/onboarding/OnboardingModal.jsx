import { useState } from 'react'
import { useApp } from '../../context/AppContext'

export default function OnboardingModal() {
  const { completeOnboarding } = useApp()
  const [accountType, setAccountType] = useState('company')
  const [companyName, setCompanyName] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [mobile, setMobile] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await completeOnboarding({
        accountType,
        companyName: accountType === 'company' ? companyName.trim() : undefined,
        logoUrl: accountType === 'company' ? logoUrl.trim() || null : null,
        mobile: mobile.trim(),
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-lg bg-white rounded-xl shadow-xl border border-gray-200 p-6 space-y-4"
      >
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Welcome to Connect Intel</h2>
          <p className="text-sm text-gray-500 mt-1">
            Tell us how you work so we can set up your workspace — solo prospecting or a shared team CRM.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { id: 'individual', title: 'Individual', sub: 'Solo lead gen & CRM' },
            { id: 'company', title: 'Company', sub: 'Invite team, assign leads' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setAccountType(opt.id)}
              className={`text-left p-3 rounded-lg border-2 transition-colors ${
                accountType === opt.id
                  ? 'border-[#ffcb2b] bg-[#fffbeb]'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className="text-sm font-semibold text-gray-900">{opt.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{opt.sub}</p>
            </button>
          ))}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Your mobile (WhatsApp)</label>
          <input
            required
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="+91 98765 43210"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <p className="text-[11px] text-gray-500 mt-1">Same number you use on WhatsApp — for customer outreach from CRM.</p>
        </div>

        {accountType === 'company' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Company name</label>
              <input
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Acme Exports Pvt Ltd"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Logo URL <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://…"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <p className="text-[11px] text-gray-500">
              You are the company admin. Invite teammates later from Team — searches and credits use your company pool.
            </p>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded px-2 py-1.5">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-[#ffcb2b] hover:bg-[#f0bc00] text-[#242424] font-semibold rounded-lg text-sm disabled:opacity-60"
        >
          {loading ? 'Setting up…' : 'Continue to workspace'}
        </button>
      </form>
    </div>
  )
}
