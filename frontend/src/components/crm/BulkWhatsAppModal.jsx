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
    <div
      className="crm-modal-overlay"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="crm-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <header className="crm-modal-header">
          <div>
            <h2>WhatsApp outreach</h2>
            <p className="text-xs text-[#516f90] mt-0.5">
              {withPhone.length} of {leads?.length || 0} selected have a valid phone
            </p>
          </div>
          <button type="button" onClick={onClose} className="crm-modal-close" aria-label="Close">
            ×
          </button>
        </header>

        <div className="crm-modal-body crm-modal-body-padded space-y-4">
          {autoSendReady && (
            <p className="crm-alert text-emerald-900 bg-emerald-50 border-emerald-100 mb-0">
              WhatsApp Business API is connected — use <strong>Send all automatically</strong> to deliver
              without opening WhatsApp.
            </p>
          )}

          {!autoSendReady && (
            <p className="crm-alert text-[#516f90] bg-[#f5f8fa] border-[#dfe3eb] mb-0">
              Connect WhatsApp Business API under <strong>Team</strong> to send in bulk automatically.
              Until then, open WhatsApp per contact below.
            </p>
          )}

          {withoutPhone > 0 && (
            <p className="crm-alert crm-alert-error mb-0">
              {withoutPhone} selected contact{withoutPhone === 1 ? '' : 's'} skipped — no valid phone on
              file.
            </p>
          )}

          {error && <p className="crm-alert crm-alert-error mb-0">{error}</p>}

          {result && (
            <p className="crm-alert crm-alert-success mb-0">
              Sent {result.sent} message{result.sent === 1 ? '' : 's'}
              {result.failed > 0 ? ` · ${result.failed} failed` : ''}.
            </p>
          )}

          <label className="block text-xs text-[#516f90]">
            Message
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Hi {{firstName}}, following up on…"
              className="crm-input mt-1"
            />
          </label>

          {autoSendReady && withPhone.length > 0 && (
            <button
              type="button"
              disabled={sending || !message.trim()}
              onClick={sendAllAutomatic}
              className="crm-btn w-full py-2.5 bg-[#25D366] text-white border-[#25D366] hover:opacity-90 disabled:opacity-50"
            >
              {sending ? 'Sending…' : `Send all automatically (${withPhone.length})`}
            </button>
          )}

          {!withPhone.length ? (
            <p className="text-sm text-[#516f90] text-center py-6">No selected leads have a phone number.</p>
          ) : (
            <ul className="space-y-2">
              {withPhone.map((lead) => (
                <li
                  key={lead.id}
                  className="flex items-center justify-between gap-3 border border-[#dfe3eb] rounded-lg px-3 py-2.5 bg-[#f5f8fa]"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#33475b] truncate">{leadDisplayName(lead)}</p>
                    <p className="text-xs text-[#7c98b6] truncate">{lead.phone}</p>
                  </div>
                  {!autoSendReady && (
                    <button
                      type="button"
                      onClick={() => openOne(lead)}
                      className="crm-btn shrink-0 bg-[#25D366] text-white border-[#25D366]"
                    >
                      Open WhatsApp
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="crm-modal-footer">
          <button type="button" onClick={onClose} className="crm-btn crm-btn-secondary">
            Done
          </button>
        </footer>
      </div>
    </div>
  )
}
