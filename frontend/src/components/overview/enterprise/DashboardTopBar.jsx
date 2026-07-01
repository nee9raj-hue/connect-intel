const ROLE_LABELS = {
  org_admin: 'Executive',
  manager: 'Manager',
  rep: 'Sales rep',
  marketing_manager: 'Marketing',
}

export default function DashboardTopBar({
  greeting,
  firstName,
  role,
  scopeLabel,
  freshnessLabel,
  refreshing,
  primaryAction,
  onRefresh,
  onPrimaryAction,
  period,
  periods = [],
  onPeriodChange,
  quickActions = [],
  onAction,
  onCustomize,
}) {
  const roleLabel = ROLE_LABELS[role] || 'Workspace'

  return (
    <header className="dash-ent__topbar">
      <div className="dash-ent__topbar-main">
        <div className="dash-ent__topbar-titles">
          <div className="dash-ent__topbar-badges">
            <span className="dash-ent__role-badge">{roleLabel}</span>
            {scopeLabel ? <span className="dash-ent__scope-badge">{scopeLabel}</span> : null}
          </div>
          <h1 className="dash-ent__page-title">
            {greeting}, {firstName || 'there'}
          </h1>
          <p className="dash-ent__page-meta">
            Updated {freshnessLabel || '…'}
            {refreshing ? ' · refreshing…' : ''}
            <button type="button" className="dash-home__link" onClick={onRefresh} aria-label="Refresh dashboard">
              ↺ Refresh
            </button>
          </p>
        </div>
        {primaryAction ? (
          <button type="button" className="dash-ent__cta" onClick={onPrimaryAction}>
            {primaryAction.label}
          </button>
        ) : null}
      </div>

      <div className="dash-ent__topbar-toolbar">
        <div className="dash-home__filters" role="group" aria-label="Reporting period">
          <span className="dash-home__filters-label">Period</span>
          {periods.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`dash-home__filter-pill${period === p.id ? ' is-active' : ''}`}
              onClick={() => onPeriodChange(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
        {quickActions.length ? (
          <div className="dash-home__quick-actions">
            {quickActions.map((q) => (
              <button key={q.id} type="button" className="dash-home__btn" onClick={() => onAction(q.action)}>
                {q.label}
              </button>
            ))}
          </div>
        ) : null}
        {onCustomize ? (
          <button type="button" className="dash-home__btn" onClick={onCustomize}>
            Customize
          </button>
        ) : null}
      </div>
    </header>
  )
}
