import { formatDealValue } from '../../lib/crmTimeline'
import {
  DashboardSection,
  DashboardEmpty,
  DashboardSegmented,
} from '../dashboard/dashboardUi'

function formatShortDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

export default function DashboardTeamSnapshot({
  data,
  loading = false,
  period = 'week',
  onPeriodChange,
  members = [],
  onNavigate,
  onMemberClick,
}) {
  const snap = data?.teamSnapshot
  const summary = data?.summary || {}

  const totalLeads = snap?.pipeline?.totalLeads ?? summary.totalLeads ?? 0
  const active = snap?.activeCustomers || {}
  const revenue = snap?.revenue || {}

  const go = (target) => onNavigate?.(target.panel, target.options || {})

  if (loading && !snap) {
    return (
      <DashboardSection title="Team & pipeline intelligence" subtitle="Loading team metrics…">
        <DashboardEmpty>Loading…</DashboardEmpty>
      </DashboardSection>
    )
  }

  if (!snap) return null

  return (
    <DashboardSection
      title="Team & pipeline intelligence"
      subtitle="Active customers, trading activity, and team performance — stages are in Pipeline above"
      actionLabel="Full team metrics"
      onAction={() => go({ panel: 'crm-dashboard' })}
      className="dashboard-team-snapshot"
    >
      <div className="dashboard-team-snapshot__toolbar">
        <DashboardSegmented
          value={period}
          onChange={onPeriodChange}
          options={[
            { value: 'week', label: 'This week' },
            { value: 'month', label: 'This month' },
          ]}
        />
        <span className="dashboard-team-snapshot__period">{snap.periodLabel}</span>
      </div>

      <div className="dashboard-team-snapshot__kpis">
        <button
          type="button"
          className="dashboard-team-snapshot__kpi"
          onClick={() => go({ panel: 'pipeline', options: { status: 'all' } })}
        >
          <span className="dashboard-team-snapshot__kpi-label">Pipeline leads</span>
          <span className="dashboard-team-snapshot__kpi-value">{totalLeads.toLocaleString()}</span>
        </button>
        <button
          type="button"
          className="dashboard-team-snapshot__kpi"
          onClick={() => go({ panel: 'active-customers' })}
        >
          <span className="dashboard-team-snapshot__kpi-label">Active customers</span>
          <span className="dashboard-team-snapshot__kpi-value">{active.total?.toLocaleString() ?? '0'}</span>
          <span className="dashboard-team-snapshot__kpi-hint">
            {active.newThisMonth ? `${active.newThisMonth} new this month` : 'Trading / shipments'}
          </span>
        </button>
        <button
          type="button"
          className="dashboard-team-snapshot__kpi"
          onClick={() => go({ panel: 'pipeline', options: { status: 'won' } })}
        >
          <span className="dashboard-team-snapshot__kpi-label">Won</span>
          <span className="dashboard-team-snapshot__kpi-value">{(summary.won ?? 0).toLocaleString()}</span>
          <span className="dashboard-team-snapshot__kpi-hint">
            {summary.wonValue ? formatDealValue(summary.wonValue) : 'Deals closed'}
          </span>
        </button>
        <button
          type="button"
          className="dashboard-team-snapshot__kpi"
          onClick={() => go({ panel: 'pipeline', options: { status: 'follow_up' } })}
        >
          <span className="dashboard-team-snapshot__kpi-label">Follow-up</span>
          <span className="dashboard-team-snapshot__kpi-value">
            {(summary.needsFollowUp ?? 0).toLocaleString()}
          </span>
        </button>
      </div>

      <div className="dashboard-team-snapshot__stack">
        <div className="dashboard-team-snapshot__panel dashboard-team-snapshot__panel--full">
          <h3 className="dashboard-team-snapshot__panel-title">Shipments & revenue</h3>
          <ul className="dashboard-stat-list dashboard-team-snapshot__stat-grid">
            <li>
              <span>Latest shipment (org)</span>
              <span>{formatShortDate(active.latestLastShipmentAt)}</span>
            </li>
            <li>
              <span>Active customers (trading)</span>
              <span>{active.total?.toLocaleString() ?? 0}</span>
            </li>
            <li>
              <span>New active this month</span>
              <span>{active.newThisMonth?.toLocaleString() ?? 0}</span>
            </li>
            <li>
              <span>Shipments (last 30 days)</span>
              <span>{active.shipmentsLast30Days?.toLocaleString() ?? 0}</span>
            </li>
            <li>
              <span>Repeat shippers (2+ loads)</span>
              <span>{active.withMultipleShipments?.toLocaleString() ?? 0}</span>
            </li>
            <li>
              <span>60+ days no trade (Churn preview)</span>
              <span className="dashboard-team-snapshot__warn">
                {active.churnCandidates?.toLocaleString() ?? 0}
              </span>
            </li>
            <li>
              <span>Current month revenue</span>
              <span>{revenue.available ? formatDealValue(revenue.currentMonth) : '—'}</span>
            </li>
            <li>
              <span>Last month revenue</span>
              <span>{revenue.available ? formatDealValue(revenue.lastMonth) : '—'}</span>
            </li>
            <li>
              <span>Pipeline value (open)</span>
              <span>{formatDealValue(summary.pipelineValue ?? 0)}</span>
            </li>
          </ul>
          {!revenue.available && (
            <p className="dashboard-team-snapshot__note">{revenue.note}</p>
          )}
          <div className="dashboard-team-snapshot__panel-actions">
            <button
              type="button"
              className="crm-btn crm-btn-secondary crm-btn-sm"
              onClick={() => go({ panel: 'active-customers' })}
            >
              Active customers
            </button>
            <button
              type="button"
              className="crm-btn crm-btn-secondary crm-btn-sm"
              onClick={() => go({ panel: 'pipeline', options: { status: 'active_trading' } })}
            >
              Active trading in pipeline
            </button>
          </div>
        </div>

        <div className="dashboard-team-snapshot__panel dashboard-team-snapshot__panel--full">
          <h3 className="dashboard-team-snapshot__panel-title">
            Team activity ({snap.periodLabel})
          </h3>
          <ul className="dashboard-stat-list dashboard-team-snapshot__stat-grid">
            <li>
              <span>Touchpoints logged</span>
              <span>{summary.activitiesInPeriod?.toLocaleString() ?? 0}</span>
            </li>
            <li>
              <span>Emails sent</span>
              <span>{summary.emailsSent?.toLocaleString() ?? 0}</span>
            </li>
            <li>
              <span>Upcoming meetings</span>
              <span>{summary.meetingsUpcoming?.toLocaleString() ?? 0}</span>
            </li>
            <li>
              <span>Stale leads (7d+ quiet)</span>
              <span>{summary.staleLeads?.toLocaleString() ?? 0}</span>
            </li>
            <li>
              <span>Weighted forecast</span>
              <span>{formatDealValue(summary.weightedPipelineValue ?? 0)}</span>
            </li>
            <li>
              <span>Avg lead score</span>
              <span>{summary.avgLeadScore ?? '—'}</span>
            </li>
          </ul>
        </div>
      </div>

      {members.length > 0 && (
        <div className="dashboard-team-snapshot__members dashboard-team-snapshot__panel--full">
          <h3 className="dashboard-team-snapshot__panel-title">Team members</h3>
          <div className="dashboard-team-snapshot__member-table-wrap">
            <table className="dashboard-team-snapshot__member-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Leads</th>
                  <th>Contacted</th>
                  <th>Follow-up</th>
                  <th>Won</th>
                  <th>Emails</th>
                  <th>Pipeline value</th>
                  <th>Stale</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {members.slice(0, 12).map((m) => (
                  <tr key={m.userId}>
                    <td>
                      <button
                        type="button"
                        className="dashboard-team-snapshot__member-link"
                        onClick={() => onMemberClick?.(m)}
                      >
                        {m.name}
                      </button>
                    </td>
                    <td>{m.totalLeads?.toLocaleString() ?? '—'}</td>
                    <td>{m.contacted?.toLocaleString() ?? '—'}</td>
                    <td>{m.needsFollowUp?.toLocaleString() ?? '—'}</td>
                    <td>{m.won?.toLocaleString() ?? '—'}</td>
                    <td>{m.emailsSent?.toLocaleString() ?? '—'}</td>
                    <td>{formatDealValue(m.pipelineValue ?? 0)}</td>
                    <td>{m.staleLeads?.toLocaleString() ?? '—'}</td>
                    <td className="dashboard-team-snapshot__member-status">{m.needsHelp || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardSection>
  )
}
