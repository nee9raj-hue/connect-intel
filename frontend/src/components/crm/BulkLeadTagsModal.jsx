import { useEffect, useMemo, useState } from 'react'
import { unionTagIdsFromLeads } from '../../lib/orgLeadTags'
import LeadTag from '../ui/LeadTag'

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

function TagCheckboxGrid({ tags, selected, onToggle, emptyHint }) {
  if (!tags.length) {
    return <p className="text-sm text-[#516f90]">{emptyHint}</p>
  }

  return (
    <div className="bulk-tags-modal__grid">
      {tags.map((tag) => {
        const checked = selected.has(tag.id)
        return (
          <label key={tag.id} className={`bulk-tags-modal__row ${checked ? 'is-checked' : ''}`}>
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onToggle(tag.id)}
              className="crm-filter-check-input"
            />
            <LeadTag name={tag.name} active={checked} />
          </label>
        )
      })}
    </div>
  )
}

export default function BulkLeadTagsModal({
  open,
  count,
  leads = [],
  orgLeadTags = [],
  busy = false,
  onClose,
  onSubmit,
  recordLabel = 'lead',
}) {
  const [addIds, setAddIds] = useState(() => new Set())
  const [removeIds, setRemoveIds] = useState(() => new Set())

  useEffect(() => {
    if (open) {
      setAddIds(new Set())
      setRemoveIds(new Set())
    }
  }, [open])

  const unionOnSelection = useMemo(() => unionTagIdsFromLeads(leads), [leads])

  const tagsOnSelection = useMemo(
    () => orgLeadTags.filter((t) => unionOnSelection.includes(t.id)),
    [orgLeadTags, unionOnSelection]
  )

  const toggleInSet = (setter, tagId) => {
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(tagId)) next.delete(tagId)
      else next.add(tagId)
      return next
    })
  }

  const canApply = addIds.size > 0 || removeIds.size > 0
  const noun = count === 1 ? recordLabel : `${recordLabel}s`
  const title = count === 1 ? `Tags for 1 ${recordLabel}` : `Tags for ${count} ${noun}`

  if (!orgLeadTags.length) {
    return (
      <ModalShell open={open} title={title} onClose={onClose}>
        <p className="text-sm text-[#516f90] leading-relaxed">
          No company tags yet. Ask your admin to create tags under <strong>Team → Lead tags</strong>.
        </p>
      </ModalShell>
    )
  }

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
            disabled={busy || !canApply}
            onClick={() =>
              onSubmit?.({
                addTagIds: [...addIds],
                removeTagIds: [...removeIds],
              })
            }
          >
            Apply tags
          </button>
          <button type="button" className="crm-btn crm-btn-secondary" disabled={busy} onClick={onClose}>
            Cancel
          </button>
        </>
      }
    >
      <p className="text-sm text-[#516f90] leading-relaxed mb-4">
        Adding tags keeps existing tags on each record. Removing only takes off the tags you select below.
      </p>

      <section className="bulk-tags-modal__section">
        <h3 className="bulk-tags-modal__heading">Existing tags on selection</h3>
        {tagsOnSelection.length > 0 ? (
          <div className="bulk-tags-modal__chips mb-3">
            {tagsOnSelection.map((tag) => (
              <LeadTag key={tag.id} name={tag.name} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-[#7c98b6] mb-3">None of the selected records have tags yet.</p>
        )}
        <p className="bulk-tags-modal__subheading">Remove from selected {noun}</p>
        <TagCheckboxGrid
          tags={tagsOnSelection}
          selected={removeIds}
          onToggle={(id) => toggleInSet(setRemoveIds, id)}
          emptyHint="No tags to remove — nothing is tagged on this selection."
        />
      </section>

      <section className="bulk-tags-modal__section">
        <h3 className="bulk-tags-modal__heading">Add tags</h3>
        <TagCheckboxGrid
          tags={orgLeadTags}
          selected={addIds}
          onToggle={(id) => toggleInSet(setAddIds, id)}
          emptyHint="No tags available."
        />
      </section>
    </ModalShell>
  )
}
