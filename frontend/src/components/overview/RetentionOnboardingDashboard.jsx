import { useMemo } from 'react'
import FilterDropdown from '../crm/FilterDropdown'
import {
  DEAL_MONTH_OPTIONS,
  dealYearOptions,
  isoWeeksOverlappingMonth,
} from '../../lib/pipelineDealsFilter'
import { DEFAULT_TIME_ZONE } from '../../lib/dateLocale'

function currentYearMonth(timeZone = DEFAULT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date())
  const year = parts.find((p) => p.type === 'year')?.value || String(new Date().getFullYear())
  const month = String(Number(parts.find((p) => p.type === 'month')?.value || new Date().getMonth() + 1))
  return { year, month }
}

function formatCount(n) {
  return Number(n || 0).toLocaleString('en-IN')
}

function optionLabel(options, id) {
  return options.find((o) => String(o.value) === String(id) || String(o.id) === String(id))?.label || id
}

export default function RetentionOnboardingDashboard({
  report,
  loading,
  error,
  filters,
  onChangeFilters,
  ownerOptions = [],
  teamOptions = [],
  onRetry,
}) {
  const timeZone = DEFAULT_TIME_ZONE
  const yearOptions = useMemo(() => dealYearOptions(new Date(), [], timeZone), [timeZone])
  const weekOptions = useMemo(() => {
    if (!filters.year || !filters.month) return []
    return isoWeeksOverlappingMonth(Number(filters.year), Number(filters.month), timeZone).map((w) => ({
      value: String(w.week),
      label: `Week ${w.week}`,
    }))
  }, [filters.year, filters.month, timeZone])

  const monthDisplay = DEAL_MONTH_OPTIONS.find((o) => o.value === String(filters.month))?.label || null
  const weekDisplay = filters.weeks.length
    ? filters.weeks.length === 1
      ? `Week ${filters.weeks[0]}`
      : `${filters.weeks.length} weeks`
    : null
  const ownerDisplay = filters.ownerIds.length
    ? filters.ownerIds.length === 1
      ? optionLabel(ownerOptions, filters.ownerIds[0])
      : `${filters.ownerIds.length} owners`
    : null
  const teamDisplay = filters.teamIds.length
    ? filters.teamIds.length === 1
      ? optionLabel(teamOptions, filters.teamIds[0])
      : `${filters.teamIds.length} teams`
    : null

  const weeks = report?.weeks || []
  const teams = report?.teams || []
  const totals = report?.totals || { onboarded: 0 }

  return (
    <section className="uc-dash uc-dash--retention" aria-label="Retention">
      <header className="uc-dash__hero">
        <div>
          <p className="uc-dash__eyebrow">Retention</p>
          <h2 className="uc-dash__title">New customer onboarding</h2>
          <p className="uc-dash__sub">
            ERP onboarding date (first shipment, else customer created) against each team.
            Sales owner comes from ERP account / lead / sales owner.
          </p>
        </div>
        <div className="uc-dash__kpis">
          <article className="uc-dash__kpi">
            <span>New customers onboarded</span>
            <strong>{loading ? '…' : formatCount(totals.onboarded)}</strong>
          </article>
        </div>
      </header>

      <div className="uc-dash__filters" role="search" aria-label="Retention filters">
        <FilterDropdown
          label="Year"
          value={filters.year}
          displayValue={filters.year || null}
          options={yearOptions}
          emptyLabel="Year"
          onChange={(next) => onChangeFilters({ year: String(next || ''), month: '', weeks: [] })}
        />
        <FilterDropdown
          label="Month"
          value={filters.month}
          displayValue={monthDisplay}
          options={DEAL_MONTH_OPTIONS}
          emptyLabel="All months"
          disabled={!filters.year}
          onChange={(next) => onChangeFilters({ month: String(next || ''), weeks: [] })}
        />
        <FilterDropdown
          label="Week"
          multiSelect
          values={filters.weeks}
          displayValue={weekDisplay}
          options={weekOptions}
          emptyLabel="All weeks"
          disabled={!filters.year || !filters.month}
          onMultiChange={(next) => onChangeFilters({ weeks: (next || []).map(String) })}
        />
        <FilterDropdown
          label="Sales owner"
          multiSelect
          searchable
          values={filters.ownerIds}
          displayValue={ownerDisplay}
          options={ownerOptions}
          emptyLabel="All owners"
          onMultiChange={(next) => onChangeFilters({ ownerIds: next || [] })}
        />
        <FilterDropdown
          label="Teams"
          multiSelect
          searchable
          values={filters.teamIds}
          displayValue={teamDisplay}
          options={teamOptions}
          emptyLabel="All teams"
          onMultiChange={(next) => onChangeFilters({ teamIds: next || [] })}
        />
      </div>

      {error ? (
        <div className="uc-dash__error">
          <p>{error}</p>
          <button type="button" className="dash-home__btn" onClick={onRetry}>
            Retry
          </button>
        </div>
      ) : null}

      <div className="uc-dash__table-wrap">
        <table className="uc-dash__table">
          <thead>
            <tr>
              <th>Team</th>
              {weeks.map((w) => (
                <th key={w.week}>{w.label}</th>
              ))}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => (
              <tr key={team.teamId}>
                <th scope="row">{team.teamName}</th>
                {weeks.map((w) => {
                  const cell = (team.weeks || []).find((cellWeek) => String(cellWeek.week) === String(w.week))
                  return <td key={`${team.teamId}-${w.week}`}>{formatCount(cell?.onboarded)}</td>
                })}
                <td>{formatCount(team.onboarded)}</td>
              </tr>
            ))}
            {teams.length ? (
              <tr>
                <th scope="row">All teams</th>
                {weeks.map((w) => (
                  <td key={`all-${w.week}`}>{formatCount(w.onboarded)}</td>
                ))}
                <td>{formatCount(totals.onboarded)}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
        {!loading && !weeks.length ? (
          <p className="uc-dash__empty">
            {filters.month
              ? 'No new customers onboarded in this period.'
              : 'Pick a month to see week-wise onboarding. Team totals below cover the selected year.'}
          </p>
        ) : null}
        {!loading && weeks.length && !teams.length ? (
          <p className="uc-dash__empty">No new customers onboarded in this period.</p>
        ) : null}
      </div>
    </section>
  )
}

export function defaultRetentionFilters() {
  const { year } = currentYearMonth()
  return {
    year,
    month: '',
    weeks: [],
    ownerIds: [],
    teamIds: [],
  }
}
