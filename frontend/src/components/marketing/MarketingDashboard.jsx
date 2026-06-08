import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import LoadingExperience from '../ui/LoadingExperience'

const PERIODS = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
  { id: 'year', label: 'Year' },
  { id: 'all', label: 'All time' },
]

function KpiCard({ label, value, suffix = '' }) {
  return (
    <div className="marketing-dash-kpi">
      <p className="marketing-dash-kpi-label">{label}</p>
      <p className="marketing-dash-kpi-value">
        {value}
        {suffix && <span className="marketing-dash-kpi-suffix">{suffix}</span>}
      </p>
    </div>
  )
}

export default function MarketingDashboard({ onNavigate }) {
  const [period, setPeriod] = useState('30d')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.getMarketingDashboard(period)
      setData(res)
    } catch (e) {
      setError(e.message || 'Could not load dashboard')
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    load()
  }, [load])

  if (loading && !data) {
    return <LoadingExperience label="Loading email marketing dashboard…" />
  }

  const kpis = data?.kpis || {}

  return (
    <div className="marketing-dashboard space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="crm-section-title mb-1">Email marketing dashboard</h2>
          <p className="text-xs text-[#516f90]">Campaign performance, deliverability, and audience health.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`ci-btn !text-xs ${period === p.id ? 'ci-btn-accent' : 'ci-btn-secondary'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="marketing-dash-kpi-grid">
        <KpiCard label="Total contacts" value={kpis.totalContacts ?? 0} />
        <KpiCard label="Active contacts" value={kpis.activeContacts ?? 0} />
        <KpiCard label="Campaigns sent" value={kpis.campaignsSent ?? 0} />
        <KpiCard label="Emails delivered" value={kpis.emailsDelivered ?? 0} />
        <KpiCard label="Open rate" value={kpis.openRate ?? 0} suffix="%" />
        <KpiCard label="Click rate" value={kpis.clickRate ?? 0} suffix="%" />
        <KpiCard label="Bounce rate" value={kpis.bounceRate ?? 0} suffix="%" />
        <KpiCard label="Unsubscribe rate" value={kpis.unsubscribeRate ?? 0} suffix="%" />
        {(data?.revenue?.revenue ?? 0) > 0 && (
          <KpiCard
            label="Attributed revenue"
            value={data.revenue.revenue}
            suffix={` · ${data.revenue.deals} deal${data.revenue.deals === 1 ? '' : 's'}`}
          />
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="marketing-dash-card">
          <h3 className="marketing-dash-card-title">Send trend</h3>
          {(data?.trend || []).length ? (
            <div className="marketing-dash-trend">
              {data.trend.map((row) => (
                <div key={row.date} className="marketing-dash-trend-row">
                  <span className="marketing-dash-trend-date">{row.date}</span>
                  <span>{row.sent} sent</span>
                  <span>{row.opens} opens</span>
                  <span>{row.clicks} clicks</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500">No sends in this period yet.</p>
          )}
        </div>

        <div className="marketing-dash-card">
          <h3 className="marketing-dash-card-title">Analytics rollup</h3>
          {(data?.analyticsTrend || []).length ? (
            <div className="marketing-dash-trend">
              {data.analyticsTrend.map((row) => (
                <div key={row.date} className="marketing-dash-trend-row">
                  <span className="marketing-dash-trend-date">{row.date}</span>
                  <span>{row.sent || 0} sent</span>
                  <span>{row.opens || 0} opens</span>
                  <span>{row.clicks || 0} clicks</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500">Event rollups populate as campaigns send.</p>
          )}
        </div>

        <div className="marketing-dash-card">
          <h3 className="marketing-dash-card-title">Deliverability</h3>
          <ul className="text-sm text-[#33475b] space-y-2">
            <li>
              <strong>{data?.deliverability?.bounceRate ?? 0}%</strong> bounce rate
            </li>
            <li>
              <strong>{kpis.suppressionCount ?? 0}</strong> suppressed contacts
            </li>
            <li>
              <strong>{data?.deliverability?.complaints ?? 0}</strong> spam complaints
            </li>
            <li>
              <strong>{kpis.pendingApprovals ?? 0}</strong> campaigns pending approval
            </li>
            <li>
              <strong>{kpis.scheduledCount ?? 0}</strong> scheduled campaigns
            </li>
          </ul>
        </div>
      </div>

      <div className="marketing-dash-card">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="marketing-dash-card-title mb-0">Recent campaigns</h3>
          <button
            type="button"
            className="crm-link-btn"
            onClick={() => onNavigate?.('marketing', { tab: 'reports' })}
          >
            All reports
          </button>
        </div>
        {(data?.recentCampaigns || []).length ? (
          <div className="overflow-x-auto">
            <table className="crm-table w-full text-sm">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Status</th>
                  <th>Sent</th>
                  <th>Open %</th>
                  <th>Click %</th>
                </tr>
              </thead>
              <tbody>
                {data.recentCampaigns.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <button
                        type="button"
                        className="crm-link-btn p-0 text-left"
                        onClick={() => onNavigate?.('marketing', { tab: 'reports', campaignId: c.id })}
                      >
                        {c.name}
                      </button>
                    </td>
                    <td>{c.status}</td>
                    <td>{c.sent}</td>
                    <td>{c.openRate}%</td>
                    <td>{c.clickRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-gray-500">No campaigns yet — create one under Campaigns.</p>
        )}
      </div>
    </div>
  )
}
