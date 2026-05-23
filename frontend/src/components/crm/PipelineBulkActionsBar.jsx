import { useState } from 'react'
import { CRM_STATUSES } from '../../lib/crmConstants'

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
  onClear,
}) {
  const [status, setStatus] = useState('')
  const [assignee, setAssignee] = useState('')

  if (count < 1) return null

  return (
    <div className="sticky top-0 z-10 mx-4 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[#ffe48a] bg-[#fffbeb] px-3 py-2.5 shadow-sm">
      <span className="text-xs font-semibold text-[#5b4a00] tabular-nums">{count} selected</span>

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
          disabled={busy}
          onClick={() => onEmail?.()}
          className="text-xs font-semibold px-2.5 py-1.5 bg-[#ffcb2b] text-[#242424] rounded-lg disabled:opacity-50"
        >
          Email selected
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
