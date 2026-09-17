import { useMemo } from 'react'
import FilterDropdown from '../crm/FilterDropdown'
import {
  DEAL_MONTH_OPTIONS,
  dealYearOptions,
  isoWeeksOverlappingMonth,
} from '../../lib/pipelineDealsFilter'
import { DEFAULT_TIME_ZONE } from '../../lib/dateLocale'
import { CRM_STATUSES } from '../../lib/crmConstants'
import { formatDealValue } from '../../lib/crmTimeline'

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

function formatRevenue(n) {
  if (!n) return '0'
  return formatDealValue(n, 'INR')
}

function optionLabel(options, id) {
  return options.find((o) => String(o.value) === String(id) || String(o.id) === String(id))?.label || id
}

export default function UniqueCustomersDashboard({
  report,
  loading,
  error,
  filters,
  onChangeFilters,
  tagOptions = [],
  ownerOptions = [],
  onRetry,
  onOpenLead,
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
  const tagDisplay = filters.tagIds.length
    ? filters.tagIds.length === 1
      ? optionLabel(tagOptions, filters.tagIds[0])
      : `${filters.tagIds.length} tags`
    : null
  const statusDisplay = filters.statuses.length
    ? filters.statuses.length === 1
      ? optionLabel(CRM_STATUSES.map((s) => ({ value: s.id, label: s.label })), filters.statuses[0])
      : `${filters.statuses.length} statuses`
    : null
  const ownerDisplay = filters.ownerIds.length
    ? filters.ownerIds.length === 1
      ? optionLabel(ownerOptions, filters.ownerIds[0])
      : `${filters.ownerIds.length} owners`
    : null

  const weeks = report?.weeks || []
  const totals = report?.totals || { uniqueCustomers: 0, revenue: 0 }
  const groups = report?.groups || []

  return (
    <section className="uc-dash" aria-label="Unique customers">
      <header className="uc-dash__hero">
        <div>
          <p className="uc-dash__eyebrow">Dashboard</p>
          <h1 className="uc-dash__title">Unique customers</h1>
          <p className="uc-dash__sub">
            Who ordered in the selected weeks, grouped by sales owner. Revenue uses recorded ERP
            figures when present.
          </p>
        </div>
        <div className="uc-dash__kpis">
          <article className="uc-dash__kpi">
            <span>Unique customers</span>
            <strong>{loading ? '…' : formatCount(totals.uniqueCustomers)}</strong>
          </article>
          <article className="uc-dash__kpi">
            <span>Revenue</span>
            <strong>{loading ? '…' : formatRevenue(totals.revenue)}</strong>
          </article>
        </div>
      </header>

      <div className="uc-dash__filters" role="search" aria-label="Customer filters">
        <FilterDropdown
          label="Year"
          value={filters.year}
          displayValue={filters.year || null}
          options={yearOptions}
          emptyLabel="Year"
          onChange={(next) =>
            onChangeFilters({ year: String(next || ''), month: '', weeks: [] })
          }
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
          label="Tags"
          multiSelect
          searchable
          values={filters.tagIds}
          displayValue={tagDisplay}
          options={tagOptions}
          emptyLabel="All tags"
          onMultiChange={(next) => onChangeFilters({ tagIds: next || [] })}
        />
        <FilterDropdown
          label="Status"
          multiSelect
          values={filters.statuses}
          displayValue={statusDisplay}
          options={CRM_STATUSES.map((s) => ({ value: s.id, label: s.label }))}
          emptyLabel="All statuses"
          onMultiChange={(next) => onChangeFilters({ statuses: next || [] })}
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
              <th>Metric</th>
              {weeks.map((w) => (
                <th key={w.week}>{w.label}</th>
              ))}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Unique customers</th>
              {weeks.map((w) => (
                <td key={`u-${w.week}`}>{formatCount(w.uniqueCustomers)}</td>
              ))}
              <td>{formatCount(totals.uniqueCustomers)}</td>
            </tr>
            <tr>
              <th scope="row">Revenue</th>
              {weeks.map((w) => (
                <td key={`r-${w.week}`}>{formatRevenue(w.revenue)}</td>
              ))}
              <td>{formatRevenue(totals.revenue)}</td>
            </tr>
          </tbody>
        </table>
        {!loading && !weeks.length ? (
          <p className="uc-dash__empty">Pick a year and month to see week-wise unique customers.</p>
        ) : null}
      </div>

      <div className="uc-dash__list">
        <h2 className="uc-dash__list-title">Customer list</h2>
        {loading ? <p className="uc-dash__empty">Loading customers…</p> : null}
        {!loading && !groups.length ? (
          <p className="uc-dash__empty">No unique customers with a last order in this period.</p>
        ) : null}
        {groups.map((group) => (
          <section key={group.ownerId} className="uc-dash__group">
            <header className="uc-dash__group-head">
              <h3>Team — {group.ownerName}</h3>
              <p>
                Unique customers {formatCount(group.uniqueCustomers)} · Revenue{' '}
                {formatRevenue(group.revenue)}
              </p>
            </header>
            <table className="uc-dash__table uc-dash__table--list">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Unique customers</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {group.customers.map((c) => (
                  <tr key={c.leadId || c.name}>
                    <td>
                      <button type="button" className="uc-dash__name" onClick={() => onOpenLead(c.leadId)}>
                        {c.name}
                      </button>
                    </td>
                    <td>{formatCount(c.uniqueCustomers)}</td>
                    <td>{formatRevenue(c.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </section>
  )
}

export function defaultUniqueCustomerFilters() {
  const { year, month } = currentYearMonth()
  return {
    year,
    month,
    weeks: [],
    tagIds: [],
    statuses: [],
    ownerIds: [],
  }
}
