/** Shared UI primitives for the lead record panel (drawer + split view). */

export function LwSection({ icon: Icon, title, action, children, className = '', padded = true }) {
  return (
    <section className={`lw-section ${padded ? 'lw-section--padded' : ''} ${className}`.trim()}>
      {(title || action) && (
        <header className="lw-section__head">
          <div className="lw-section__title-wrap">
            {Icon ? <Icon className="lw-section__icon" aria-hidden /> : null}
            {title ? <h3 className="lw-section__title">{title}</h3> : null}
          </div>
          {action || null}
        </header>
      )}
      <div className="lw-section__body">{children}</div>
    </section>
  )
}

export function LwDivider({ label }) {
  if (label) {
    return (
      <div className="lw-divider lw-divider--labeled" role="separator">
        <span>{label}</span>
      </div>
    )
  }
  return <div className="lw-divider" role="separator" />
}

export function LwField({ label, icon: Icon, children, htmlFor }) {
  return (
    <label className="lw-field" htmlFor={htmlFor}>
      {label ? (
        <span className="lw-field__label">
          {Icon ? <Icon className="lw-field__label-icon" aria-hidden /> : null}
          {label}
        </span>
      ) : null}
      {children}
    </label>
  )
}

export function LwInput(props) {
  return <input {...props} className={`lw-input ${props.className || ''}`.trim()} />
}

export function LwSelect(props) {
  return <select {...props} className={`lw-select ${props.className || ''}`.trim()} />
}

export function LwTextarea(props) {
  return <textarea {...props} className={`lw-textarea ${props.className || ''}`.trim()} />
}

export function LwBtn({ variant = 'secondary', icon: Icon, children, className = '', ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={`lw-btn lw-btn--${variant} ${className}`.trim()}
    >
      {Icon ? <Icon className="lw-btn__icon" aria-hidden /> : null}
      {children ? <span>{children}</span> : null}
    </button>
  )
}

export function LwSubmitBtn({ variant = 'brand', icon: Icon, children, className = '', ...props }) {
  return (
    <button type="submit" {...props} className={`lw-btn lw-btn--${variant} lw-btn--block ${className}`.trim()}>
      {Icon ? <Icon className="lw-btn__icon" aria-hidden /> : null}
      <span>{children}</span>
    </button>
  )
}

export function LwChip({ active, children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={`lw-chip ${active ? 'is-active' : ''} ${props.className || ''}`.trim()}
    >
      {children}
    </button>
  )
}

export function LwNotice({ type = 'success', children }) {
  if (!children) return null
  return (
    <div className={`lw-notice lw-notice--${type}`} role="status">
      {children}
    </div>
  )
}

export function LwAlert({ type = 'error', children }) {
  if (!children) return null
  return (
    <div className={`lw-alert lw-alert--${type}`} role="alert">
      {children}
    </div>
  )
}

export function LwStatCard({ label, value, sub, action }) {
  return (
    <div className="lw-stat-card">
      <div className="lw-stat-card__main">
        <span className="lw-stat-card__label">{label}</span>
        <span className="lw-stat-card__value">{value}</span>
        {sub ? <span className="lw-stat-card__sub">{sub}</span> : null}
      </div>
      {action || null}
    </div>
  )
}

export function LwContactGrid({ rows }) {
  return (
    <dl className="lw-contact-grid">
      {rows.map(({ icon: Icon, label, value, action }) => (
        <div key={label} className="lw-contact-grid__row">
          <dt className="lw-contact-grid__label">
            {Icon ? <Icon className="lw-contact-grid__icon" aria-hidden /> : null}
            {label}
          </dt>
          <dd className="lw-contact-grid__value">
            {value}
            {action || null}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function LwInfoGrid({ items }) {
  return (
    <div className="lw-info-grid">
      {items.map(({ label, value }) => (
        <div key={label} className="lw-info-grid__item">
          <span className="lw-info-grid__label">{label}</span>
          <span className="lw-info-grid__value">{value}</span>
        </div>
      ))}
    </div>
  )
}

export function LwListItem({ title, meta, action, muted, children }) {
  return (
    <li className={`lw-list-item ${muted ? 'is-muted' : ''}`.trim()}>
      <div className="lw-list-item__main">
        <p className="lw-list-item__title">{title}</p>
        {meta ? <p className="lw-list-item__meta">{meta}</p> : null}
        {children}
      </div>
      {action || null}
    </li>
  )
}

export function LwTimeline({ items, renderItem }) {
  return (
    <ul className="lw-timeline">
      {items.map((item) => (
        <li key={item.id} className="lw-timeline__item">
          {renderItem(item)}
        </li>
      ))}
    </ul>
  )
}

export function LwTimelineCard({ badge, title, subtitle, at, children }) {
  return (
    <article className="lw-timeline-card">
      {badge ? <span className="lw-timeline-card__badge">{badge}</span> : null}
      <p className="lw-timeline-card__title">{title}</p>
      {subtitle ? <p className="lw-timeline-card__subtitle">{subtitle}</p> : null}
      {children}
      {at ? <time className="lw-timeline-card__time">{at}</time> : null}
    </article>
  )
}

export function LwFormStack({ onSubmit, children, className = '' }) {
  return (
    <form onSubmit={onSubmit} className={`lw-form-stack ${className}`.trim()}>
      {children}
    </form>
  )
}

export function LwLinkBtn({ children, ...props }) {
  return (
    <button type="button" {...props} className={`lw-link-btn ${props.className || ''}`.trim()}>
      {children}
    </button>
  )
}

export function LwEmpty({ children }) {
  return <p className="lw-empty">{children}</p>
}
