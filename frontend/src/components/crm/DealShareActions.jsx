import { useEffect, useMemo, useState } from 'react'
import { formatDealShareContent } from '../../lib/dealShareFormat'
import { leadHasCallablePhone, openWhatsAppChat } from '../../lib/phoneUtils'

function leadHasEmail(lead) {
  const email = String(lead?.email || '').trim()
  if (!email || email.includes('•') || /locked/i.test(email)) return false
  return email.includes('@')
}

/** Copy, email (with CC), and WhatsApp share for a CRM deal. */
export default function DealShareActions({
  deal,
  lead,
  user,
  freightOrg = false,
  busy = false,
  onNotice,
  onError,
  patchLead,
  logCrmEmailSend,
}) {
  const share = useMemo(
    () => formatDealShareContent({ deal, lead, user, freightOrg }),
    [deal, lead, user, freightOrg]
  )

  const [showEmail, setShowEmail] = useState(false)
  const [subject, setSubject] = useState(share.subject)
  const [body, setBody] = useState(share.plainText)
  const [cc, setCc] = useState('')
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setSubject(share.subject)
    setBody(share.plainText)
  }, [share.subject, share.plainText])

  const hasEmail = leadHasEmail(lead)
  const hasPhone = leadHasCallablePhone(lead)

  const openEmail = () => {
    setSubject(share.subject)
    setBody(share.plainText)
    setShowEmail((v) => !v)
  }

  const copyDeal = async () => {
    try {
      await navigator.clipboard.writeText(share.plainText)
      setCopied(true)
      onNotice?.('Deal copied to clipboard')
      setTimeout(() => setCopied(false), 2500)
    } catch {
      onError?.('Could not copy — try selecting the text manually')
    }
  }

  const sendEmail = async () => {
    if (!hasEmail) {
      onError?.('This contact has no email address on file')
      return
    }
    if (!subject.trim() || !body.trim()) {
      onError?.('Subject and message are required')
      return
    }
    if (sending || busy) return
    setSending(true)
    onError?.(null)
    try {
      await logCrmEmailSend(lead.id, {
        subject: subject.trim(),
        body: body.trim(),
        cc: cc.trim(),
      })
      onNotice?.('Deal shared by email and logged in CRM')
      setShowEmail(false)
    } catch (e) {
      onError?.(e.message || 'Could not send email')
    } finally {
      setSending(false)
    }
  }

  const shareWhatsApp = () => {
    if (!hasPhone) {
      onError?.('This contact has no phone number for WhatsApp')
      return
    }
    if (!openWhatsAppChat(lead.phone, share.plainText)) {
      onError?.('Invalid phone number for WhatsApp')
      return
    }
    onNotice?.('WhatsApp opened — send the pre-filled deal summary')
    void patchLead(lead.id, {
      activity: {
        type: 'whatsapp',
        summary: `Deal shared: ${deal.name}`,
        meta: { dealId: deal.id, channel: 'whatsapp_share' },
      },
    }).catch(() => {})
  }

  return (
    <div className="border-t border-gray-100 pt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase text-gray-400 mr-0.5">Share</span>
        <button
          type="button"
          disabled={busy}
          onClick={copyDeal}
          className="px-2 py-1 rounded-lg text-[10px] font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
        <button
          type="button"
          disabled={busy || !hasEmail}
          onClick={openEmail}
          title={hasEmail ? 'Send deal summary by email' : 'No email on contact'}
          className="px-2 py-1 rounded-lg text-[10px] font-semibold border border-indigo-200 text-indigo-800 bg-indigo-50/60 hover:bg-indigo-50 disabled:opacity-40"
        >
          Email
        </button>
        <button
          type="button"
          disabled={busy || !hasPhone}
          onClick={shareWhatsApp}
          title={hasPhone ? 'Share via WhatsApp' : 'No phone on contact'}
          className="px-2 py-1 rounded-lg text-[10px] font-semibold border border-green-200 text-green-800 bg-green-50/60 hover:bg-green-50 disabled:opacity-40"
        >
          WhatsApp
        </button>
      </div>

      {showEmail && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/30 p-2.5 space-y-2">
          <p className="text-[10px] text-gray-600">
            Sends to <strong>{lead.email}</strong>
            {cc.trim() ? ' with CC recipients' : ''}. Connect work email under Workspace if send is disabled.
          </p>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white"
          />
          <input
            value={cc}
            onChange={(e) => setCc(e.target.value)}
            placeholder="CC — comma-separated emails"
            className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white font-mono leading-relaxed"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={sending || busy}
              onClick={sendEmail}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-indigo-600 text-white disabled:opacity-50"
            >
              {sending ? 'Sending…' : 'Send email'}
            </button>
            <button
              type="button"
              disabled={sending}
              onClick={() => setShowEmail(false)}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-gray-300 text-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
