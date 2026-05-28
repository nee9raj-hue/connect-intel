import { useState } from 'react'
import { CRM_STATUSES } from '../../lib/crmConstants'
import { MailIcon, WhatsAppIcon } from '../ui/icons'

export default function PipelineBulkActionsBar({
  count,
  statusOptions = CRM_STATUSES,
  teamMembers = [],
  canAssign = false,
  busy = false,
  onApplyStatus,
  onAssign,
  onMarkReplied,
  onEmail,
  onWhatsApp,
  emailCount = null,
  phoneCount = null,
  onClear,
  compact = false,
}) {
  const [status, setStatus] = useState('')
  const [assignee, setAssignee] = useState('')

  if (count < 1) return null

  if (compact) {
    return (
      <div className="pipeline-bulk-mobile shrink-0 mx-2 mt-1 mb-1 rounded-xl border border-[#ffe48a] bg-[#fffbeb] px-2 py-1.5 shadow-sm">
        <div className="pipeline-bulk-mobile__row">
          <span className="text-[10px] font-semibold text-[#5b4a00] tabular-nums shrink-0">{count}</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="text-[11px] border border-gray-200 rounded-lg px-1.5 py-1 bg-white min-w-[6.5rem] max-w-[7.5rem]"
            aria-label="Bulk change status"
          >
            <option value="">Status…</option>
            {statusOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || !status}
            onClick={() => {
              onApplyStatus?.(status)
              setStatus('')
            }}
            className="pipeline-bulk-icon-btn bg-gray-900 text-white disabled:opacity-50"
            aria-label="Apply status"
            title="Apply status"
          >
            ✓
          </button>
          {canAssign && (
            <>
              <select
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="text-[11px] border border-gray-200 rounded-lg px-1.5 py-1 bg-white min-w-[6.5rem] max-w-[7.5rem]"
                aria-label="Bulk assign"
              >
                <option value="">Assign…</option>
                <option value="__unassign__">None</option>
                {teamMembers.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={busy || !assignee}
                onClick={() => {
                  onAssign?.(assignee === '__unassign__' ? null : assignee)
                  setAssignee('')
                }}
                className="pipeline-bulk-icon-btn border border-gray-300 bg-white disabled:opacity-50"
                aria-label="Apply assign"
                title="Apply assign"
              >
                👤
              </button>
            </>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => onMarkReplied?.()}
            className="pipeline-bulk-icon-btn border border-violet-200 text-violet-800 bg-violet-50 disabled:opacity-50"
            aria-label="Mark replied"
            title="Mark replied"
          >
            ↩
          </button>
          <button
            type="button"
            disabled={busy || (emailCount !== null && emailCount < 1)}
            onClick={() => onEmail?.()}
            className="pipeline-bulk-icon-btn bg-[#ffcb2b] text-[#242424] disabled:opacity-50"
            aria-label={`Bulk email${emailCount != null ? ` (${emailCount})` : ''}`}
            title={emailCount === 0 ? 'No selected leads have email' : 'Bulk email'}
          >
            <MailIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={busy || (phoneCount !== null && phoneCount < 1)}
            onClick={() => onWhatsApp?.()}
            className="pipeline-bulk-icon-btn bg-[#25D366] text-white disabled:opacity-50"
            aria-label={`Bulk WhatsApp${phoneCount != null ? ` (${phoneCount})` : ''}`}
            title={phoneCount === 0 ? 'No selected leads have phone' : 'Bulk WhatsApp'}
          >
            <WhatsAppIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onClear}
            className="pipeline-bulk-icon-btn border border-gray-200 bg-white text-gray-700"
            aria-label="Clear selection"
            title="Clear"
          >
            ×
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="shrink-0 flex flex-wrap items-center gap-1.5 md:gap-2 rounded-xl border border-[#ffe48a] bg-[#fffbeb] shadow-sm mx-4 mb-2 mt-0 px-3 py-2.5">
      <span className="font-semibold text-[#5b4a00] tabular-nums text-xs pipeline-bulk-label">
        {count} selected
      </span>

      <div className="flex flex-wrap items-center gap-2 flex-1">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white min-w-[130px]"
          aria-label="Bulk change status"
        >
          <option value="">Change status…</option>
          {statusOptions.map((s) => (
            <option key={s.id} value={s.id}>
              → {s.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={busy || !status}
          onClick={() => {
            onApplyStatus?.(status)
            setStatus('')
          }}
          className="text-xs font-semibold px-2.5 py-1.5 bg-gray-900 text-white rounded-lg disabled:opacity-50"
        >
          Apply status
        </button>

        {canAssign && (
          <>
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white min-w-[140px]"
              aria-label="Bulk assign"
            >
              <option value="">Assign to…</option>
              <option value="__unassign__">Unassigned</option>
              {teamMembers.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy || !assignee}
              onClick={() => {
                onAssign?.(assignee === '__unassign__' ? null : assignee)
                setAssignee('')
              }}
              className="text-xs font-semibold px-2.5 py-1.5 border border-gray-300 rounded-lg disabled:opacity-50"
            >
              Apply assign
            </button>
          </>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => onMarkReplied?.()}
          className="text-xs font-semibold px-2.5 py-1.5 border border-violet-200 text-violet-800 bg-violet-50 rounded-lg disabled:opacity-50"
        >
          Mark replied
        </button>

        <button
          type="button"
          disabled={busy || (emailCount !== null && emailCount < 1)}
          onClick={() => onEmail?.()}
          className="text-xs font-semibold px-2.5 py-1.5 bg-[#ffcb2b] text-[#242424] rounded-lg disabled:opacity-50"
          title={emailCount === 0 ? 'No selected leads have email' : undefined}
        >
          Email{emailCount != null ? ` (${emailCount})` : ''}
        </button>

        <button
          type="button"
          disabled={busy || (phoneCount !== null && phoneCount < 1)}
          onClick={() => onWhatsApp?.()}
          className="text-xs font-semibold px-2.5 py-1.5 bg-[#25D366] text-white rounded-lg disabled:opacity-50"
          title={phoneCount === 0 ? 'No selected leads have phone' : undefined}
        >
          WhatsApp{phoneCount != null ? ` (${phoneCount})` : ''}
        </button>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={onClear}
        className="text-xs text-gray-600 hover:text-gray-900 underline"
      >
        Clear
      </button>
    </div>
  )
}
