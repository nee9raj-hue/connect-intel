import { useEffect, useMemo, useState } from 'react'
import { formatDealShareContent } from '../../lib/dealShareFormat'
import { leadHasCallablePhone, openWhatsAppChat } from '../../lib/phoneUtils'
import { CopyIcon, MailIcon, WhatsAppIcon } from '../ui/icons'
import { LwBtn, LwField, LwInput, LwTextarea } from './leadWorkspaceUi'

function leadHasEmail(lead) {
  const email = String(lead?.email || '').trim()
  if (!email || email.includes('•') || /locked/i.test(email)) return false
  return email.includes('@')
}

/** Copy, email, and WhatsApp share for a deal — icon bar. */
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

  const copyDeal = async () => {
    try {
      await navigator.clipboard.writeText(share.plainText)
      setCopied(true)
      onNotice?.('Copied')
      setTimeout(() => setCopied(false), 2500)
    } catch {
      onError?.('Could not copy')
    }
  }

  const sendEmail = async () => {
    if (!hasEmail) {
      onError?.('No email on contact')
      return
    }
    if (!subject.trim() || !body.trim()) {
      onError?.('Subject and message required')
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
      onNotice?.('Email sent')
      setShowEmail(false)
    } catch (e) {
      onError?.(e.message || 'Could not send')
    } finally {
      setSending(false)
    }
  }

  const shareWhatsApp = () => {
    if (!hasPhone) {
      onError?.('No phone on contact')
      return
    }
    if (!openWhatsAppChat(lead.phone, share.plainText)) {
      onError?.('Invalid phone')
      return
    }
    onNotice?.('WhatsApp opened')
    void patchLead(lead.id, {
      activity: {
        type: 'whatsapp',
        summary: `Deal shared: ${deal.name}`,
        meta: { dealId: deal.id, channel: 'whatsapp_share' },
      },
    }).catch(() => {})
  }

  return (
    <div className="lw-deal-share">
      <div className="lw-deal-share__bar">
        <button
          type="button"
          disabled={busy}
          onClick={copyDeal}
          className={`lw-deal-share__btn ${copied ? 'is-copied' : ''}`}
          title="Copy deal summary"
          aria-label="Copy"
        >
          <CopyIcon aria-hidden />
        </button>
        <button
          type="button"
          disabled={busy || !hasEmail}
          onClick={() => setShowEmail((v) => !v)}
          className="lw-deal-share__btn lw-deal-share__btn--email"
          title={hasEmail ? 'Email deal' : 'No email'}
          aria-label="Email"
        >
          <MailIcon aria-hidden />
        </button>
        <button
          type="button"
          disabled={busy || !hasPhone}
          onClick={shareWhatsApp}
          className="lw-deal-share__btn lw-deal-share__btn--wa"
          title={hasPhone ? 'WhatsApp' : 'No phone'}
          aria-label="WhatsApp"
        >
          <WhatsAppIcon aria-hidden />
        </button>
      </div>

      {showEmail && (
        <div className="lw-deal-share__panel">
          <LwField label="To">
            <LwInput value={lead.email || ''} readOnly disabled />
          </LwField>
          <LwField label="Subject">
            <LwInput value={subject} onChange={(e) => setSubject(e.target.value)} />
          </LwField>
          <LwField label="Cc">
            <LwInput value={cc} onChange={(e) => setCc(e.target.value)} placeholder="Optional" />
          </LwField>
          <LwField label="Message">
            <LwTextarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} />
          </LwField>
          <div className="lw-btn-row">
            <LwBtn variant="primary" onClick={sendEmail} disabled={sending || busy}>
              {sending ? 'Sending…' : 'Send'}
            </LwBtn>
            <LwBtn variant="secondary" onClick={() => setShowEmail(false)} disabled={sending}>
              Cancel
            </LwBtn>
          </div>
        </div>
      )}
    </div>
  )
}
