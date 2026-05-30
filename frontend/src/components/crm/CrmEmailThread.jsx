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
  replySyncEnabled,
  busy,
  onSync,
  onLogReply,
  onEnableReplySync,
  enableReplySyncBusy = false,
  showReplySyncUpgrade = false,
}) {
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [replySubject, setReplySubject] = useState('')
  const [replyBody, setReplyBody] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  const sorted = [...emails].sort(
    (a, b) => new Date(a.sentAt || 0) - new Date(b.sentAt || 0)
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
            Email thread — outbound sends and replies in one place
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
                replySyncEnabled
                  ? 'Pull recent messages from your inbox'
                  : 'Reconnect work email to enable automatic reply sync'
              }
            >
              {busy ? 'Syncing…' : '↻ Sync inbox'}
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

      {showReplySyncUpgrade && gmailConnected && !replySyncEnabled && onEnableReplySync && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-amber-950 bg-amber-50 border-b border-amber-100 px-3 py-2">
          <p className="leading-relaxed">
            Allow email import (one-time). If sign-in is blocked, contact your Connect Intel administrator.
          </p>
          <button
            type="button"
            disabled={busy || enableReplySyncBusy}
            onClick={() => onEnableReplySync()}
            className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-md bg-[#FF773D] text-[#242424] border border-[#ffd4b8] disabled:opacity-50"
          >
            {enableReplySyncBusy ? 'Connecting…' : 'Allow reply import'}
          </button>
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
            No emails logged yet. Send from below or sync from your inbox.
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
                        inbound ? 'bg-violet-200 text-violet-900' : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {inbound ? 'Reply' : 'Sent'}
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
