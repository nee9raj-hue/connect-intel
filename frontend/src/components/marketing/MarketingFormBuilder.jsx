import {
  createEmptyField,
  FIELD_TYPES,
  normalizeFields,
} from '../../../../lib/marketingFormSchema.js'

export const FORM_FIELD_GROUPS = [
  {
    id: 'lead',
    label: 'Lead capture',
    items: [
      { type: 'text', preset: { id: 'firstName', label: 'First name', placeholder: '' } },
      { type: 'text', preset: { id: 'lastName', label: 'Last name', placeholder: '' } },
      { type: 'email', preset: { id: 'email', label: 'Email', placeholder: 'you@company.com', required: true } },
      { type: 'phone', preset: { id: 'phone', label: 'Phone', placeholder: '' } },
      { type: 'company', preset: { id: 'company', label: 'Company', placeholder: '' } },
    ],
  },
  {
    id: 'input',
    label: 'Questions',
    items: [
      { type: 'text' },
      { type: 'textarea' },
      { type: 'number' },
      { type: 'date' },
      { type: 'select' },
      { type: 'radio' },
      { type: 'checkbox' },
    ],
  },
  {
    id: 'compliance',
    label: 'Compliance',
    items: [{ type: 'consent' }],
  },
  {
    id: 'layout',
    label: 'Layout',
    items: [{ type: 'section' }],
  },
]

function fieldTypeLabel(type) {
  return FIELD_TYPES.find((t) => t.id === type)?.label || type
}

function FieldInspector({ field, onChange, onRemove, onMove, index, total }) {
  if (!field) {
    return (
      <div className="mhub-form-inspector mhub-form-inspector--empty">
        <p className="mhub-form-inspector__hint">Select a field in the preview to edit it, or add a field from the palette.</p>
      </div>
    )
  }

  const set = (patch) => onChange({ ...field, ...patch })
  const needsOptions = field.type === 'select' || field.type === 'radio' || field.type === 'checkbox'
  const isConsent = field.type === 'consent'
  const isSection = field.type === 'section'

  return (
    <div className="mhub-form-inspector">
      <div className="mhub-form-inspector__head">
        <span className="mhub-form-inspector__type">{fieldTypeLabel(field.type)}</span>
        <div className="mhub-form-inspector__actions">
          <button type="button" className="mhub-v3-btn mhub-v3-btn--ghost" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move up">
            ↑
          </button>
          <button type="button" className="mhub-v3-btn mhub-v3-btn--ghost" disabled={index === total - 1} onClick={() => onMove(1)} aria-label="Move down">
            ↓
          </button>
          <button type="button" className="mhub-v3-btn mhub-v3-btn--ghost mhub-v3-btn--danger" onClick={onRemove}>
            Remove
          </button>
        </div>
      </div>

      {!isSection ? (
        <label className="mhub-v3-label">
          Field type
          <select
            className="mhub-v3-input"
            value={field.type}
            onChange={(e) => onChange({ ...createEmptyField(e.target.value), id: field.id })}
          >
            {FIELD_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="mhub-v3-label">
        {isSection ? 'Section title' : isConsent ? 'Consent text' : 'Label'}
        <input
          className="mhub-v3-input"
          value={field.label}
          onChange={(e) => set({ label: e.target.value })}
        />
      </label>

      {!isSection && !isConsent ? (
        <>
          <label className="mhub-v3-label mhub-form-inspector__check">
            <input type="checkbox" checked={Boolean(field.required)} onChange={(e) => set({ required: e.target.checked })} />
            Required
          </label>
          <label className="mhub-v3-label">
            Placeholder
            <input
              className="mhub-v3-input"
              value={field.placeholder || ''}
              onChange={(e) => set({ placeholder: e.target.value })}
            />
          </label>
        </>
      ) : null}

      {isConsent ? (
        <label className="mhub-v3-label mhub-form-inspector__check">
          <input type="checkbox" checked={field.required !== false} onChange={(e) => set({ required: e.target.checked })} />
          Required to submit
        </label>
      ) : null}

      <label className="mhub-v3-label">
        Help text
        <input
          className="mhub-v3-input"
          value={field.helpText || ''}
          onChange={(e) => set({ helpText: e.target.value })}
          placeholder={isConsent ? 'Shown above the consent checkbox' : 'Optional hint under the label'}
        />
      </label>

      {needsOptions ? (
        <label className="mhub-v3-label">
          Choices (one per line)
          <textarea
            className="mhub-v3-input mhub-form-inspector__mono"
            rows={4}
            value={(field.options || []).join('\n')}
            onChange={(e) => set({ options: e.target.value.split('\n') })}
          />
        </label>
      ) : null}
    </div>
  )
}

export function MarketingFormFieldInspector({
  form,
  onChange,
  selectedFieldId,
  onSelectFieldId,
}) {
  const fields = normalizeFields(form.fields)
  const setFields = (next) => onChange({ ...form, fields: next })
  const selectedIndex = fields.findIndex((f) => f.id === selectedFieldId)
  const selectedField = selectedIndex >= 0 ? fields[selectedIndex] : null

  const updateSelected = (field) => {
    if (selectedIndex < 0) return
    const copy = [...fields]
    copy[selectedIndex] = field
    setFields(copy)
  }

  const moveSelected = (dir) => {
    if (selectedIndex < 0) return
    const next = selectedIndex + dir
    if (next < 0 || next >= fields.length) return
    const copy = [...fields]
    const [item] = copy.splice(selectedIndex, 1)
    copy.splice(next, 0, item)
    setFields(copy)
  }

  return (
    <FieldInspector
      field={selectedField}
      index={selectedIndex}
      total={fields.length}
      onChange={updateSelected}
      onRemove={() => {
        if (selectedIndex < 0) return
        setFields(fields.filter((_, i) => i !== selectedIndex))
        onSelectFieldId?.(null)
      }}
      onMove={moveSelected}
    />
  )
}

export default function MarketingFormPalette({ form, onChange, onSelectFieldId }) {
  const fields = normalizeFields(form.fields)

  const setFields = (next) => onChange({ ...form, fields: next })

  const addField = (type, preset = null) => {
    if (type === 'consent' && fields.some((f) => f.type === 'consent')) return
    const base = createEmptyField(type)
    const next = preset
      ? {
          ...base,
          ...preset,
          id: fields.some((f) => f.id === preset.id) ? base.id : preset.id || base.id,
        }
      : base
    const updated = [...fields, next]
    setFields(updated)
    onSelectFieldId?.(next.id)
  }

  return (
    <aside className="mhub-form-builder__palette">
      <p className="mhub-v3-eyebrow">Add fields</p>
      {FORM_FIELD_GROUPS.map((group) => (
        <div key={group.id} className="mhub-form-builder__group">
          <p className="mhub-form-builder__group-label">{group.label}</p>
          {group.items.map((item) => {
            const label = item.preset?.label || fieldTypeLabel(item.type)
            const disabled = item.type === 'consent' && fields.some((f) => f.type === 'consent')
            return (
              <button
                key={`${group.id}-${label}`}
                type="button"
                className="mhub-v3-palette-item"
                disabled={disabled}
                onClick={() => addField(item.type, item.preset)}
                title={disabled ? 'Only one consent field per form' : undefined}
              >
                {label}
              </button>
            )
          })}
        </div>
      ))}
      <p className="mhub-form-builder__palette-foot">
        Submissions create or update pipeline leads with a timeline event.
      </p>
    </aside>
  )
}
