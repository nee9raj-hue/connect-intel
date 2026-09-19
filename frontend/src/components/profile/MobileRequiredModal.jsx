import { useState } from 'react'
import { useApp } from '../../context/AppContext'

export default function MobileRequiredModal() {
  const { user, updateMobile } = useApp()
  const [mobile, setMobile] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  if (!user || user.isPlatformAdmin || user.mobileE164) return null

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await updateMobile(mobile.trim())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={submit} className="w-full max-w-md bg-white rounded-xl shadow-xl border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Your mobile number</h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          We use this for WhatsApp outreach from Connect Intel. Use the same number as your WhatsApp account (include
          country code, e.g. +91 98765 43210).
        </p>
        <input
          required
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          placeholder="+91 98765 43210"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
        {error && <p className="text-xs text-red-700 bg-red-50 rounded px-2 py-1">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-[#FF773D] text-[#242424] font-semibold rounded-lg disabled:opacity-60"
        >
          {loading ? 'Saving…' : 'Continue'}
        </button>
      </form>
    </div>
  )
}
