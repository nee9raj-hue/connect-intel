import { useState } from 'react'
import { formatCrmDate } from '../../lib/crmConstants'
import { formatDateTime } from '../../lib/crmUiConstants'
import { MailIcon } from '../ui/icons'
import {
  LwSection,
  LwBtn,
  LwNotice,
  LwEmpty,
  LwField,
  LwInput,
  LwTextarea,
  LwLinkBtn,
} from './leadWorkspaceUi'

function formatAttachmentSize(bytes) {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function CrmEmailThread({
  lead,
  emails = [],
  gmailConnected,
  gmailConnectAvailable = true,
  inboundReplySync = false,
  replySyncEnabled,
  busy,
  onSync,
  onLogReply,
  onConnectGmail,
}) {
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [replySubject, setReplySubject] = useState('')
  const [replyBody, setReplyBody] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  const autoReplySync = inboundReplySync || replySyncEnabled

  const sorted = [...emails].sort(
    (a, b) => new Date(b.sentAt || 0) - new Date(a.sentAt || 0)
  )

  const submitReply = async () => {
    if (!replyBody.trim()) return
    await onLogReply?.({
      subject: replySubject.trim(),
      body: replyBody.trim(),
    })
    setReplyBody('')
    setReplySubject('')
    setShowReplyForm(false)
  }

  const handleSyncClick = () => {
    if (gmailConnected) {
      onSync?.()
      return
    }
    onConnectGmail?.()
  }

  const syncLabel = busy
    ? 'Syncing…'
    : gmailConnected
      ? 'Sync from Gmail'
      : 'Connect Gmail to sync'

  const syncTitle = gmailConnected
    ? inboundReplySync
      ? 'Pull this thread from Gmail (use if an automatic reply did not appear)'
      : 'Sync trail mail for this lead'
    : 'Connect your work Gmail to pull sent mail and replies into CRM'

  return (
    <LwSection
      icon={MailIcon}
      title="Email thread"
      action={
        <div className="lw-btn-row lw-email-thread__actions">
          <LwBtn
            variant={gmailConnected ? 'secondary' : 'brand'}
            disabled={busy || (!gmailConnected && !gmailConnectAvailable)}
            onClick={handleSyncClick}
            title={syncTitle}
          >
            {syncLabel}
          </LwBtn>
          <LwBtn variant="secondary" disabled={busy} onClick={() => setShowReplyForm((v) => !v)}>
            {showReplyForm ? 'Cancel reply' : '+ Log reply'}
          </LwBtn>
        </div>
      }
    >
      <p className="lw-email-thread__hint">
        {autoReplySync
          ? 'Replies log in CRM automatically and forward to your work inbox.'
          : 'Trail mail — CRM sends and replies for this lead.'}
        {lead?.email ? (
          <>
            {' '}
            Thread with <strong>{lead.email}</strong>
          </>
        ) : null}
      </p>

      {inboundReplySync && (
        <LwNotice type="info">
          {gmailConnected
            ? 'Replies to your CRM routing address log automatically. If a reply is missing, use Sync from Gmail or Log reply.'
            : 'Connect work Gmail to sync replies from your inbox, or use Log reply to paste a message.'}
        </LwNotice>
      )}

      {!gmailConnected && !inboundReplySync && (
        <LwNotice type="info">
          Connect work Gmail to pull sent mail and replies from your inbox into this thread.
        </LwNotice>
      )}

      {showReplyForm && (
        <div className="lw-email-thread__reply-form">
          <LwField label="Subject (optional)">
            <LwInput
              value={replySubject}
              onChange={(e) => setReplySubject(e.target.value)}
              placeholder="Re: your last email"
            />
          </LwField>
          <LwField label="Reply text">
            <LwTextarea
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              rows={4}
              placeholder="Paste the lead's reply here…"
            />
          </LwField>
          <div className="lw-btn-row">
            <LwBtn variant="brand" disabled={busy || !replyBody.trim()} onClick={submitReply}>
              Save reply to CRM
            </LwBtn>
            <LwLinkBtn onClick={() => setShowReplyForm(false)}>Cancel</LwLinkBtn>
          </div>
        </div>
      )}

      <div className="lw-email-thread__list" aria-live="polite">
        {sorted.length === 0 ? (
          <LwEmpty>
            {autoReplySync
              ? 'No emails yet. Send from below — replies will sync automatically.'
              : 'No emails logged yet. Send from below, then sync trail mail for replies.'}
          </LwEmpty>
        ) : (
          <ul className="lw-email-thread__messages">
            {sorted.map((msg) => {
              const inbound = msg.direction === 'inbound'
              const open = expandedId === msg.id
              const badge = msg.isBounce ? 'Bounced' : inbound ? 'Reply' : 'Sent'
              const badgeClass = msg.isBounce
                ? 'is-bounce'
                : inbound
                  ? 'is-inbound'
                  : 'is-outbound'

              return (
                <li key={msg.id}>
                  <article
                    className={`lw-email-thread__card ${inbound ? 'is-inbound' : 'is-outbound'} ${open ? 'is-open' : ''}`}
                  >
                    <button
                      type="button"
                      className="lw-email-thread__card-toggle"
                      onClick={() => setExpandedId(open ? null : msg.id)}
                      aria-expanded={open}
                    >
                      <div className="lw-email-thread__card-head">
                        <span className={`lw-email-thread__badge ${badgeClass}`}>{badge}</span>
                        <time className="lw-email-thread__time">
                          {formatDateTime(msg.sentAt) || formatCrmDate(msg.sentAt)}
                        </time>
                      </div>
                      <p className="lw-email-thread__subject">{msg.subject || '(No subject)'}</p>
                      {msg.fromMailbox ? (
                        <p className="lw-email-thread__from">{msg.fromMailbox}</p>
                      ) : null}
                      {!open && (
                        <p className="lw-email-thread__preview">
                          {msg.bodyPreview || msg.body || ''}
                        </p>
                      )}
                      {!open && msg.attachments?.length > 0 ? (
                        <p className="lw-email-thread__attachments-meta">
                          {msg.attachments.length} attachment{msg.attachments.length === 1 ? '' : 's'}
                        </p>
                      ) : null}
                    </button>
                    {open ? (
                      <div className="lw-email-thread__card-body">
                        <pre className="lw-email-thread__body-text">
                          {msg.body || msg.bodyPreview || ''}
                        </pre>
                        {msg.attachments?.length > 0 ? (
                          <div className="lw-email-thread__attachments">
                            {msg.attachments.map((file, index) => (
                              <span
                                key={`${file.filename}-${index}`}
                                className="lw-email-thread__attachment"
                              >
                                {file.filename}
                                {file.sizeBytes ? ` (${formatAttachmentSize(file.sizeBytes)})` : ''}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </LwSection>
  )
}
