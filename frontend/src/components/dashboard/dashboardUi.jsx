import {
  BoltIcon,
  CalendarIcon,
  ChartIcon,
  ChevronRightIcon,
  HomeIcon,
  ListIcon,
  LogIcon,
  MailIcon,
  NoteIcon,
  PeopleIcon,
  PipelineIcon,
  SparkIcon,
  TaskIcon,
  TeamIcon,
  WhatsAppIcon,
} from '../ui/icons'

export const DASHBOARD_NAV_ICONS = {
  home: HomeIcon,
  people: PeopleIcon,
  list: ListIcon,
  pipeline: PipelineIcon,
  log: LogIcon,
  calendar: CalendarIcon,
  bolt: BoltIcon,
  mail: MailIcon,
  chart: ChartIcon,
  note: NoteIcon,
  task: TaskIcon,
  spark: SparkIcon,
  team: TeamIcon,
  whatsapp: WhatsAppIcon,
}

export function DashboardNavIcon({ name, className = 'dashboard-icon' }) {
  const Icon = DASHBOARD_NAV_ICONS[name] || HomeIcon
  return <Icon className={className} />
}

export function DashboardShell({ title, subtitle, actions, children }) {
  return (
    <div className="dashboard-workspace panel-shell panel-scroll-page hs-canvas">
      <header className="dashboard-page-header">
        <div className="dashboard-page-header-top">
          <div className="min-w-0">
            <h1 className="dashboard-page-title">{title}</h1>
            {subtitle ? <p className="dashboard-page-subtitle">{subtitle}</p> : null}
          </div>
          {actions ? <div className="dashboard-page-actions">{actions}</div> : null}
        </div>
      </header>
      <div className="dashboard-page-body panel-body-scroll">{children}</div>
    </div>
  )
}

export function DashboardKpiCard({ label, value, hint, icon, onClick }) {
  return (
    <button type="button" className="dashboard-kpi-card" onClick={onClick}>
      <div className="dashboard-kpi-card__top">
        {icon ? (
          <span className="dashboard-kpi-card__icon" aria-hidden>
            <DashboardNavIcon name={icon} className="dashboard-icon dashboard-icon--sm" />
          </span>
        ) : null}
        <ChevronRightIcon className="dashboard-kpi-card__chevron" />
      </div>
      <p className="dashboard-kpi-card__label">{label}</p>
      <p className="dashboard-kpi-card__value">{value}</p>
      {hint ? <p className="dashboard-kpi-card__hint">{hint}</p> : null}
    </button>
  )
}

export function DashboardSection({ title, subtitle, action, actionLabel, onAction, children, className = '' }) {
  return (
    <section className={`dashboard-section-card ${className}`.trim()}>
      {(title || actionLabel) && (
        <div className="dashboard-section-card__head">
          <div className="min-w-0">
            {title ? <h2 className="dashboard-section-card__title">{title}</h2> : null}
            {subtitle ? <p className="dashboard-section-card__subtitle">{subtitle}</p> : null}
          </div>
          {actionLabel ? (
            <button type="button" className="dashboard-link-btn" onClick={onAction || action}>
              {actionLabel}
            </button>
          ) : null}
        </div>
      )}
      <div className="dashboard-section-card__body">{children}</div>
    </section>
  )
}

export function DashboardQuickTile({ tile, onClick }) {
  return (
    <button
      type="button"
      className="dashboard-quick-tile"
      onClick={onClick}
      title={tile.desc}
    >
      <span className="dashboard-quick-tile__icon" aria-hidden>
        <DashboardNavIcon name={tile.icon} className="dashboard-icon" />
      </span>
      <span className="dashboard-quick-tile__label">{tile.label}</span>
      <span className="dashboard-quick-tile__desc">{tile.desc}</span>
    </button>
  )
}

export function DashboardListRow({ title, meta, onClick, badge }) {
  return (
    <li>
      <button type="button" className="dashboard-list-row" onClick={onClick}>
        <span className="dashboard-list-row__main min-w-0">
          <span className="dashboard-list-row__title">{title}</span>
          {meta ? <span className="dashboard-list-row__meta">{meta}</span> : null}
        </span>
        {badge != null ? <span className="dashboard-list-row__badge">{badge}</span> : null}
        <ChevronRightIcon className="dashboard-list-row__chevron" />
      </button>
    </li>
  )
}

export function DashboardProgressRow({ label, count, total, onClick }) {
  const pct = total ? Math.round((count / total) * 100) : 0
  return (
    <button type="button" className="dashboard-progress-row" onClick={onClick}>
      <span className="dashboard-progress-row__label">{label}</span>
      <span className="dashboard-progress-row__track">
        <span
          className="dashboard-progress-row__fill"
          style={{ width: `${Math.max(pct, count ? 6 : 0)}%` }}
        />
      </span>
      <span className="dashboard-progress-row__count">{count.toLocaleString()}</span>
    </button>
  )
}

export function DashboardSegmented({ value, onChange, options }) {
  return (
    <div className="dashboard-segmented" role="group">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`dashboard-segmented__btn ${value === opt.value ? 'is-active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function DashboardEmpty({ children }) {
  return <p className="dashboard-empty">{children}</p>
}

export function DashboardFeatureCard({ icon, title, description, actionLabel, onAction, accent = 'default' }) {
  return (
    <section className={`dashboard-feature-card dashboard-feature-card--${accent}`}>
      {icon ? (
        <span className="dashboard-feature-card__icon" aria-hidden>
          <DashboardNavIcon name={icon} className="dashboard-icon" />
        </span>
      ) : null}
      <h3 className="dashboard-feature-card__title">{title}</h3>
      <p className="dashboard-feature-card__desc">{description}</p>
      <button type="button" className="crm-btn crm-btn-primary crm-btn-sm" onClick={onAction}>
        {actionLabel}
      </button>
    </section>
  )
}
