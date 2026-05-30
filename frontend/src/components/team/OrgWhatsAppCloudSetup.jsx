import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'

/**
 * @param {'platform' | 'org'} [scope]
 *   platform — Data & imports admin (all customer workspaces)
 *   org — company Team settings (default)
 */
export default function OrgWhatsAppCloudSetup({ compact = false, scope = 'org' }) {
  const { refreshSession } = useApp()
  const isPlatform = scope === 'platform'
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [displayPhone, setDisplayPhone] = useState('')
  const [defaultTemplateName, setDefaultTemplateName] = useState('')
  const [defaultTemplateLanguage, setDefaultTemplateLanguage] = useState('en')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = isPlatform ? await api.getAdminWhatsAppCloud() : await api.getOrgWhatsAppCloud()
      setStatus(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [isPlatform])

  useEffect(() => {
    load()
  }, [load])

  const payload = {
    phoneNumberId: phoneNumberId.trim(),
    accessToken: accessToken.trim(),
    displayPhone: displayPhone.trim() || undefined,
    defaultTemplateName: defaultTemplateName.trim() || undefined,
    defaultTemplateLanguage: defaultTemplateLanguage.trim() || 'en',
  }

  const handleConnect = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const data = isPlatform
        ? await api.connectAdminWhatsAppCloud(payload)
        : await api.connectOrgWhatsAppCloud(payload)
      setStatus(data)
      setShowForm(false)
      setAccessToken('')
      await refreshSession?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect WhatsApp Business API? Auto-send will stop.')) return
    setSaving(true)
    setError(null)
    try {
      const data = isPlatform
        ? await api.disconnectAdminWhatsAppCloud()
        : await api.disconnectOrgWhatsAppCloud()
      setStatus(data)
      await refreshSession?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-xs text-gray-500">Checking WhatsApp API…</p>
  }

  const configured = status?.configured

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {isPlatform && (
        <p className="text-xs text-gray-600 leading-relaxed">
          Applies to <strong>all customer workspaces</strong> unless a company connects its own number under{' '}
          <strong>Team</strong>. You can also set <code className="text-xs bg-gray-100 px-1 rounded">WHATSAPP_CLOUD_ACCESS_TOKEN</code>{' '}
          and <code className="text-xs bg-gray-100 px-1 rounded">WHATSAPP_CLOUD_PHONE_NUMBER_ID</code> on Vercel instead.
        </p>
      )}

      {configured ? (
        <div className="text-xs rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-900 px-3 py-2.5">
          <p className="font-semibold">Automatic WhatsApp send is on</p>
          <p className="mt-1 text-emerald-800/90 leading-relaxed">
            {isPlatform
              ? 'Platform default is active for marketing campaigns and pipeline bulk send.'
              : 'Marketing campaigns and pipeline bulk send use your WhatsApp Business number'}
            {status.displayPhone ? ` (${status.displayPhone})` : ''}
            {status.phoneNumberId ? ` · ID ${status.phoneNumberId}` : ''}.
            {status.defaultTemplateName && (
              <span className="block mt-1">
                Default Meta template: <strong>{status.defaultTemplateName}</strong> (
                {status.defaultTemplateLanguage || 'en'})
              </span>
            )}
          </p>
          <button
            type="button"
            disabled={saving}
            onClick={handleDisconnect}
            className="mt-2 text-xs font-semibold text-emerald-900 underline disabled:opacity-50"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <p className="text-xs text-gray-500 leading-relaxed">
          Connect Meta WhatsApp Business Cloud API to send marketing campaigns and bulk pipeline messages
          automatically — no need to open WhatsApp for each contact.
        </p>
      )}

      {error && (
        <p className="text-xs text-red-800 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      )}

      {!configured && !showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="text-xs font-semibold px-3 py-2 bg-[#25D366] text-white rounded-lg"
        >
          Connect WhatsApp Business API
        </button>
      )}

      {(showForm || configured) && showForm && (
        <form onSubmit={handleConnect} className="space-y-2 border border-gray-100 rounded-lg p-3 bg-gray-50/80">
          <p className="text-xs text-gray-600 leading-relaxed">
            From{' '}
            <a
              href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#FF773D] underline"
            >
              Meta Business Manager
            </a>
            : create a WhatsApp app, add a phone number, and copy the <strong>Phone number ID</strong> and{' '}
            <strong>Permanent access token</strong>.
          </p>
          <label className="block text-xs text-gray-600">
            Phone number ID
            <input
              required
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              className="mt-0.5 w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 font-mono"
              placeholder="123456789012345"
            />
          </label>
          <label className="block text-xs text-gray-600">
            Permanent access token
            <input
              required
              type="password"
              autoComplete="off"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              className="mt-0.5 w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 font-mono"
            />
          </label>
          <label className="block text-xs text-gray-600">
            Display label (optional)
            <input
              value={displayPhone}
              onChange={(e) => setDisplayPhone(e.target.value)}
              className="mt-0.5 w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5"
              placeholder="+91 98765 43210"
            />
          </label>
          <label className="block text-xs text-gray-600">
            Default Meta template name (recommended for cold outreach)
            <input
              value={defaultTemplateName}
              onChange={(e) => setDefaultTemplateName(e.target.value)}
              className="mt-0.5 w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5"
              placeholder="hello_world"
            />
          </label>
          <label className="block text-xs text-gray-600">
            Template language code
            <input
              value={defaultTemplateLanguage}
              onChange={(e) => setDefaultTemplateLanguage(e.target.value)}
              className="mt-0.5 w-24 text-sm border border-gray-200 rounded-lg px-2 py-1.5"
              placeholder="en"
            />
          </label>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="text-xs font-semibold px-3 py-1.5 bg-gray-900 text-white rounded-lg disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save & enable auto-send'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs font-semibold px-3 py-1.5 border border-gray-200 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {configured && !showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="text-xs font-semibold text-gray-600 underline"
        >
          Update credentials
        </button>
      )}

      {configured && (
        <div className="mt-3 rounded-lg border border-green-100 bg-green-50/80 px-3 py-2.5 space-y-1.5">
          <p className="text-xs font-semibold text-green-900">Inbox webhook (Meta App Dashboard)</p>
          <p className="text-xs text-green-900/90 leading-relaxed">
            To receive replies in <strong>Marketing → WA Inbox</strong>, add this callback URL in Meta → WhatsApp →
            Configuration → Webhook:
          </p>
          <code className="block text-xs break-all bg-white/80 border border-green-100 rounded px-2 py-1">
            {typeof window !== 'undefined'
              ? `${window.location.origin}/api/whatsapp/webhook`
              : 'https://connectintel.net/api/whatsapp/webhook'}
          </code>
          <p className="text-xs text-green-900/80">
            Set the same verify token in Meta and as <code className="text-green-950">WHATSAPP_WEBHOOK_VERIFY_TOKEN</code>{' '}
            on Vercel. Subscribe to <strong>messages</strong>.
          </p>
        </div>
      )}
    </div>
  )
}
