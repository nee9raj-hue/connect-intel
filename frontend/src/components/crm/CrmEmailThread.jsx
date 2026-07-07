import { useState } from 'react'
import { formatCrmDate } from '../../lib/crmConstants'
import { formatDateTime } from '../../lib/crmUiConstants'

function formatAttachmentSize(bytes) {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function CrmEmailThread({
  lead,
  emails = [],
  gmailConnected,
  inboundReplySync = false,
  replySyncEnabled,
  busy,
  onSync,
  onLogReply,
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

  return (
    <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-3 py-2.5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold uppercase text-gray-500">Email thread</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {autoReplySync
              ? 'Replies log in CRM automatically and forward to your work inbox'
              : 'Trail mail — CRM sends and replies for this lead'}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {gmailConnected && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onSync?.()}
              className="text-xs font-semibold px-2 py-1 rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
              title={
                inboundReplySync
                  ? 'Pull this thread from Gmail (use if an automatic reply did not appear)'
                  : 'Sync trail mail for this lead'
              }
            >
              {busy ? 'Syncing…' : '↻ Sync from Gmail'}
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => setShowReplyForm((v) => !v)}
            className="text-xs font-semibold px-2 py-1 rounded-md bg-violet-50 text-violet-800 border border-violet-200"
          >
            + Log reply
          </button>
        </div>
      </div>

      {inboundReplySync && gmailConnected && (
        <div className="text-xs text-emerald-900 bg-emerald-50 border-b border-emerald-100 px-3 py-2 leading-relaxed">
          Replies sent to your CRM routing address log automatically. If a reply is missing, use{' '}
          <strong>Sync from Gmail</strong> or <strong>Log reply</strong>.
        </div>
      )}

      {showReplyForm && (
        <div className="p-3 border-b border-gray-100 bg-violet-50/40 space-y-2">
          <input
            value={replySubject}
            onChange={(e) => setReplySubject(e.target.value)}
            placeholder="Subject (optional)"
            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5"
          />
          <textarea
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            rows={4}
            placeholder="Paste the lead's reply here…"
            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || !replyBody.trim()}
              onClick={submitReply}
              className="text-xs font-semibold px-3 py-1.5 bg-violet-700 text-white rounded-lg disabled:opacity-50"
            >
              Save reply to CRM
            </button>
            <button
              type="button"
              onClick={() => setShowReplyForm(false)}
              className="text-xs text-gray-500 underline"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="max-h-64 overflow-y-auto p-3 space-y-2">
        {sorted.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-4">
            {autoReplySync
              ? 'No emails yet. Send from below — replies will sync automatically.'
              : 'No emails logged yet. Send from below, then sync trail mail for replies.'}
          </p>
        ) : (
          sorted.map((msg) => {
            const inbound = msg.direction === 'inbound'
            const open = expandedId === msg.id
            return (
              <div
                key={msg.id}
                className={`rounded-lg border text-xs ${
                  inbound
                    ? 'border-violet-200 bg-violet-50/60 ml-2'
                    : 'border-gray-200 bg-gray-50 mr-2'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(open ? null : msg.id)}
                  className="w-full text-left px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`text-xs font-bold uppercase px-1.5 py-0.5 rounded ${
                        msg.isBounce
                          ? 'bg-red-200 text-red-900'
                          : inbound
                            ? 'bg-violet-200 text-violet-900'
                            : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {msg.isBounce ? 'Bounced' : inbound ? 'Reply' : 'Sent'}
                    </span>
                    <span className="text-xs text-gray-500 shrink-0">
                      {formatDateTime(msg.sentAt) || formatCrmDate(msg.sentAt)}
                    </span>
                  </div>
                  <p className="font-semibold text-gray-900 mt-1 truncate">{msg.subject || '(No subject)'}</p>
                  {msg.fromMailbox && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{msg.fromMailbox}</p>
                  )}
                  {!open && (
                    <p className="text-gray-600 mt-1 line-clamp-2 whitespace-pre-wrap">
                      {msg.bodyPreview || msg.body || ''}
                    </p>
                  )}
                  {!open && msg.attachments?.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      📎 {msg.attachments.length} attachment{msg.attachments.length === 1 ? '' : 's'}
                    </p>
                  )}
                </button>
                {open && (
                  <div className="px-3 pb-3 border-t border-gray-200/60">
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed mt-2">
                      {msg.body || msg.bodyPreview || ''}
                    </pre>
                    {msg.attachments?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {msg.attachments.map((file, index) => (
                          <span
                            key={`${file.filename}-${index}`}
                            className="text-xs px-2 py-0.5 rounded-md bg-gray-200 text-gray-800"
                          >
                            📎 {file.filename}
                            {file.sizeBytes ? ` (${formatAttachmentSize(file.sizeBytes)})` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}
