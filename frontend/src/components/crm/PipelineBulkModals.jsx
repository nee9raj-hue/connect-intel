import { useEffect, useMemo, useState } from 'react'
import { CRM_STATUSES } from '../../lib/crmConstants'

const EDIT_PROPERTIES = [
  { id: 'status', label: 'Lead status', group: 'Sales properties' },
  { id: 'owner', label: 'Lead owner', group: 'Sales properties' },
  { id: 'replied', label: 'Mark as replied', group: 'Sales properties' },
]

function ModalShell({ open, title, onClose, children, footer }) {
  if (!open) return null

  return (
    <div
      className="crm-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <div className="crm-modal-dialog pipeline-bulk-modal" onClick={(e) => e.stopPropagation()}>
        <header className="crm-modal-header">
          <h2>{title}</h2>
          <button type="button" onClick={onClose} className="crm-modal-close" aria-label="Close">
            ×
          </button>
        </header>
        <div className="crm-modal-body crm-modal-body-padded">{children}</div>
        {footer ? <footer className="crm-modal-footer">{footer}</footer> : null}
      </div>
    </div>
  )
}

export function PipelineBulkAssignModal({
  open,
  count,
  teamMembers = [],
  canAssign = false,
  busy = false,
  onClose,
  onSubmit,
}) {
  const [ownerId, setOwnerId] = useState('')

  useEffect(() => {
    if (open) setOwnerId('')
  }, [open])

  const title = count === 1 ? 'Bulk assign 1 record' : `Bulk assign ${count} records`

  return (
    <ModalShell
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="crm-btn crm-btn-primary"
            disabled={busy || !canAssign}
            onClick={() => onSubmit?.(ownerId === '__unassign__' || ownerId === '' ? null : ownerId)}
          >
            Update
          </button>
          <button type="button" className="crm-btn crm-btn-secondary" disabled={busy} onClick={onClose}>
            Cancel
          </button>
        </>
      }
    >
      {!canAssign ? (
        <p className="text-sm text-[#516f90]">
          Only admins, managers, or the current lead owner can reassign leads.
        </p>
      ) : (
        <label className="pipeline-bulk-modal-field">
          <span className="pipeline-bulk-modal-label">Lead owner</span>
          <select
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            className="pipeline-bulk-modal-select"
          >
            <option value="">No owner</option>
            {teamMembers.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </ModalShell>
  )
}

export function PipelineBulkEditModal({
  open,
  count,
  statusOptions = CRM_STATUSES,
  teamMembers = [],
  canAssign = false,
  busy = false,
  onClose,
  onSubmit,
}) {
  const [property, setProperty] = useState('')
  const [status, setStatus] = useState('')
  const [ownerId, setOwnerId] = useState('')

  useEffect(() => {
    if (open) {
      setProperty('')
      setStatus('')
      setOwnerId('')
    }
  }, [open])

  const grouped = useMemo(() => {
    const map = new Map()
    for (const p of EDIT_PROPERTIES) {
      if (p.id === 'owner' && !canAssign) continue
      if (!map.has(p.group)) map.set(p.group, [])
      map.get(p.group).push(p)
    }
    return [...map.entries()]
  }, [canAssign])

  const canUpdate =
    property === 'status'
      ? Boolean(status)
      : property === 'owner'
        ? Boolean(ownerId)
        : property === 'replied'

  const handleUpdate = () => {
    if (property === 'status') onSubmit?.({ status })
    else if (property === 'owner') onSubmit?.({ assignToUserId: ownerId === '__unassign__' ? null : ownerId })
    else if (property === 'replied') onSubmit?.({ markReplied: true })
  }

  const title = count === 1 ? 'Bulk edit 1 record' : `Bulk edit ${count} records`

  return (
    <ModalShell
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="crm-btn crm-btn-primary"
            disabled={busy || !canUpdate}
            onClick={handleUpdate}
          >
            Update
          </button>
          <button type="button" className="crm-btn crm-btn-secondary" disabled={busy} onClick={onClose}>
            Cancel
          </button>
        </>
      }
    >
      <label className="pipeline-bulk-modal-field">
        <span className="pipeline-bulk-modal-label">Property to update</span>
        <select
          value={property}
          onChange={(e) => setProperty(e.target.value)}
          className="pipeline-bulk-modal-select"
        >
          <option value="">Select a property to edit</option>
          {grouped.map(([group, items]) => (
            <optgroup key={group} label={group}>
              {items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      {property === 'status' && (
        <label className="pipeline-bulk-modal-field">
          <span className="pipeline-bulk-modal-label">Lead status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="pipeline-bulk-modal-select">
            <option value="">Select status</option>
            {statusOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {property === 'owner' && (
        <label className="pipeline-bulk-modal-field">
          <span className="pipeline-bulk-modal-label">Lead owner</span>
          <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="pipeline-bulk-modal-select">
            <option value="">Select owner</option>
            <option value="__unassign__">Unassigned</option>
            {teamMembers.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {property === 'replied' && (
        <p className="text-sm text-[#516f90] leading-relaxed">
          Mark {count === 1 ? 'this lead' : `all ${count} selected leads`} as replied. This updates CRM activity
          for reporting and follow-up tracking.
        </p>
      )}
    </ModalShell>
  )
}
