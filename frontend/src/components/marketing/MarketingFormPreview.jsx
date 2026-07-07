import { normalizeFields, normalizeFormTheme } from '../../../../lib/marketingFormSchema.js'

function PreviewField({ field, selected, onSelect }) {
  const selectedClass = selected ? ' mhub-form-preview__field--selected' : ''
  const common = {
    className: `mhub-form-preview__field${selectedClass}`,
    onClick: (e) => {
      e.preventDefault()
      onSelect?.(field.id)
    },
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onSelect?.(field.id)
      }
    },
    role: 'button',
    tabIndex: 0,
  }

  if (field.type === 'section') {
    return (
      <h2 {...common} className={`mhub-form-preview__section${selectedClass}`}>
        {field.label || 'Section'}
      </h2>
    )
  }

  if (field.type === 'consent') {
    return (
      <div {...common} className={`mhub-form-preview__consent${selectedClass}`}>
        {field.helpText ? <p className="mhub-form-preview__help">{field.helpText}</p> : null}
        <label className="mhub-form-preview__choice">
          <input type="checkbox" disabled tabIndex={-1} />
          <span>
            {field.label}
            {field.required ? ' *' : ''}
          </span>
        </label>
      </div>
    )
  }

  if (field.type === 'textarea') {
    return (
      <div {...common}>
        <label className="mhub-form-preview__label">
          {field.label}
          {field.required ? ' *' : ''}
        </label>
        {field.helpText ? <p className="mhub-form-preview__help">{field.helpText}</p> : null}
        <textarea
          readOnly
          tabIndex={-1}
          placeholder={field.placeholder || ''}
          rows={4}
          className="mhub-form-preview__input"
        />
      </div>
    )
  }

  if (field.type === 'select') {
    return (
      <div {...common}>
        <label className="mhub-form-preview__label">
          {field.label}
          {field.required ? ' *' : ''}
        </label>
        {field.helpText ? <p className="mhub-form-preview__help">{field.helpText}</p> : null}
        <select disabled tabIndex={-1} className="mhub-form-preview__input">
          <option>Choose…</option>
          {(field.options || []).map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </div>
    )
  }

  if (field.type === 'radio') {
    return (
      <fieldset {...common} className={`mhub-form-preview__fieldset${selectedClass}`}>
        <legend className="mhub-form-preview__label">
          {field.label}
          {field.required ? ' *' : ''}
        </legend>
        {field.helpText ? <p className="mhub-form-preview__help">{field.helpText}</p> : null}
        {(field.options || []).map((o) => (
          <label key={o} className="mhub-form-preview__choice">
            <input type="radio" disabled tabIndex={-1} name={field.id} />
            <span>{o}</span>
          </label>
        ))}
      </fieldset>
    )
  }

  if (field.type === 'checkbox') {
    return (
      <fieldset {...common} className={`mhub-form-preview__fieldset${selectedClass}`}>
        <legend className="mhub-form-preview__label">{field.label}</legend>
        {field.helpText ? <p className="mhub-form-preview__help">{field.helpText}</p> : null}
        {(field.options || []).map((o) => (
          <label key={o} className="mhub-form-preview__choice">
            <input type="checkbox" disabled tabIndex={-1} />
            <span>{o}</span>
          </label>
        ))}
      </fieldset>
    )
  }

  const inputType =
    field.type === 'email'
      ? 'email'
      : field.type === 'phone'
        ? 'tel'
        : field.type === 'number'
          ? 'number'
          : field.type === 'date'
            ? 'date'
            : 'text'

  return (
    <div {...common}>
      <label className="mhub-form-preview__label">
        {field.label}
        {field.required ? ' *' : ''}
      </label>
      {field.helpText ? <p className="mhub-form-preview__help">{field.helpText}</p> : null}
      <input
        readOnly
        tabIndex={-1}
        type={inputType}
        placeholder={field.placeholder || ''}
        className="mhub-form-preview__input"
      />
    </div>
  )
}

export default function MarketingFormPreview({ form, selectedFieldId, onSelectField }) {
  const theme = normalizeFormTheme(form?.theme)
  const fields = normalizeFields(form?.fields)

  return (
    <div
      className="mhub-form-preview__page"
      style={{ background: theme.pageBackground }}
    >
      <div
        className="mhub-form-preview__card"
        style={{ background: theme.cardBackground }}
      >
        <h1 className="mhub-form-preview__title">{form?.title?.trim() || 'Untitled form'}</h1>
        {form?.description?.trim() ? (
          <p className="mhub-form-preview__desc">{form.description}</p>
        ) : (
          <p className="mhub-form-preview__desc mhub-form-preview__desc--muted">
            Add a short description for visitors (optional).
          </p>
        )}
        <div className="mhub-form-preview__fields">
          {fields.map((field) => (
            <PreviewField
              key={field.id}
              field={field}
              selected={selectedFieldId === field.id}
              onSelect={onSelectField}
            />
          ))}
        </div>
        <button
          type="button"
          className="mhub-form-preview__submit"
          style={{ background: theme.primaryColor }}
          tabIndex={-1}
        >
          {form?.submitLabel?.trim() || 'Submit'}
        </button>
      </div>
    </div>
  )
}
