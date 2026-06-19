import { CRM_STATUSES } from '../../lib/crmConstants'
import { DashboardSegmented } from '../dashboard/dashboardUi'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function weekAgoIso() {
  const d = new Date()
  d.setDate(d.getDate() - 6)
  return d.toISOString().slice(0, 10)
}

export default function ActivityDashboardFilters({
  period,
  onPeriodChange,
  memberUserId,
  onMemberChange,
  memberOptions = [],
  showMemberFilter = false,
  status,
  onStatusChange,
  tagId,
  onTagChange,
  orgLeadTags = [],
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  useCustomRange,
  onUseCustomRangeChange,
  className = '',
}) {
  return (
    <div className={`ti3-dash-filters ${className}`.trim()}>
      {showMemberFilter && memberOptions.length > 0 ? (
        <label className="ti3-filter-field">
          <span className="sr-only">Team member</span>
          <select value={memberUserId || ''} onChange={(e) => onMemberChange?.(e.target.value)}>
            <option value="">All team</option>
            {memberOptions.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="ti3-filter-field">
        <span className="sr-only">Pipeline stage</span>
        <select value={status || 'all'} onChange={(e) => onStatusChange?.(e.target.value)}>
          <option value="all">All stages</option>
          {CRM_STATUSES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      {orgLeadTags.length > 0 ? (
        <label className="ti3-filter-field">
          <span className="sr-only">Tag</span>
          <select value={tagId || ''} onChange={(e) => onTagChange?.(e.target.value)}>
            <option value="">All tags</option>
            {orgLeadTags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="ti3-filter-field ti3-filter-field--check">
        <input
          type="checkbox"
          checked={Boolean(useCustomRange)}
          onChange={(e) => {
            const on = e.target.checked
            onUseCustomRangeChange?.(on)
            if (on && !fromDate) onFromDateChange?.(weekAgoIso())
            if (on && !toDate) onToDateChange?.(todayIso())
          }}
        />
        <span>Custom dates</span>
      </label>

      {useCustomRange ? (
        <>
          <label className="ti3-filter-field">
            <span className="sr-only">From</span>
            <input type="date" value={fromDate || ''} onChange={(e) => onFromDateChange?.(e.target.value)} />
          </label>
          <label className="ti3-filter-field">
            <span className="sr-only">To</span>
            <input type="date" value={toDate || ''} onChange={(e) => onToDateChange?.(e.target.value)} />
          </label>
        </>
      ) : (
        <DashboardSegmented
          value={period}
          onChange={onPeriodChange}
          options={[
            { value: 'day', label: 'Today' },
            { value: 'week', label: '7d' },
            { value: 'month', label: '30d' },
          ]}
        />
      )}
    </div>
  )
}
