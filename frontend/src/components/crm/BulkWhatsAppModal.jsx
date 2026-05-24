import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { buildWhatsAppUrl, leadHasCallablePhone } from '../../lib/phoneUtils'
import { leadDisplayName } from '../../lib/emailUtils'

export default function BulkWhatsAppModal({ open, leads, onClose }) {
  const { user } = useApp()
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const autoSendReady = Boolean(user?.whatsappAutoSendReady)
  const withPhone = useMemo(() => (leads || []).filter(leadHasCallablePhone), [leads])
  const withoutPhone = (leads || []).length - withPhone.length

  if (!open) return null

  const openOne = (lead) => {
    const url = buildWhatsAppUrl(lead.phone, message.trim())
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  const sendAllAutomatic = async () => {
    const body = message.trim()
    if (!body && !autoSendReady) {
      setError('Enter a message to send.')
      return
    }
    setSending(true)
    setError(null)
    setResult(null)
    try {
      const data = await api.bulkSendWhatsApp({
        leadIds: withPhone.map((l) => l.id),
        message: body,
      })
      setResult(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-xl border border-gray-200 max-h-[85vh] flex flex-col">
        <div className="px-5 py-4 border-b flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">WhatsApp outreach</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {withPhone.length} of {leads?.length || 0} selected have a valid phone
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">
            ×
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {autoSendReady && (
            <p className="text-xs text-emerald-900 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              WhatsApp Business API is connected — use <strong>Send all automatically</strong> to deliver without
              opening WhatsApp.
            </p>
          )}

          {!autoSendReady && (
            <p className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
              Connect WhatsApp Business API under <strong>Team</strong> to send in bulk automatically. Until then,
              open WhatsApp per contact below.
            </p>
          )}

          {withoutPhone > 0 && (
            <p className="text-xs text-amber-900 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              {withoutPhone} selected contact{withoutPhone === 1 ? '' : 's'} skipped — no valid phone on file.
            </p>
          )}

          {error && (
            <p className="text-xs text-red-800 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}

          {result && (
            <p className="text-xs text-emerald-900 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              Sent {result.sent} message{result.sent === 1 ? '' : 's'}
              {result.failed > 0 ? ` · ${result.failed} failed` : ''}.
            </p>
          )}

          <label className="block text-xs text-gray-600">
            Message
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Hi {{firstName}}, following up on…"
              className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
            />
          </label>

          {autoSendReady && withPhone.length > 0 && (
            <button
              type="button"
              disabled={sending || !message.trim()}
              onClick={sendAllAutomatic}
              className="w-full text-sm font-semibold px-4 py-2.5 bg-[#25D366] text-white rounded-lg disabled:opacity-50"
            >
              {sending ? 'Sending…' : `Send all automatically (${withPhone.length})`}
            </button>
          )}

          {!withPhone.length ? (
            <p className="text-sm text-gray-500 text-center py-6">No selected leads have a phone number.</p>
          ) : (
            <ul className="space-y-2">
              {withPhone.map((lead) => (
                <li
                  key={lead.id}
                  className="flex items-center justify-between gap-3 border border-gray-100 rounded-lg px-3 py-2.5 bg-gray-50/50"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{leadDisplayName(lead)}</p>
                    <p className="text-xs text-gray-500 truncate">{lead.phone}</p>
                  </div>
                  {!autoSendReady && (
                    <button
                      type="button"
                      onClick={() => openOne(lead)}
                      className="shrink-0 text-xs font-semibold px-3 py-1.5 bg-[#25D366] text-white rounded-lg"
                    >
                      Open WhatsApp
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-5 py-3 border-t shrink-0 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold px-4 py-2 border border-gray-200 rounded-lg"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
