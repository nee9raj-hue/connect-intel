import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { ACTIVITY_LABELS, formatDateTime } from '../../lib/crmUiConstants'
import { canonicalActivityPeriod, REP_REVIEW_PERIODS } from '../../lib/crmActivityScope'
import { readPanelCache, writePanelCache, repReviewCacheKey } from '../../lib/panelCache'
import { DashboardSegmented } from '../dashboard/dashboardUi'
import { RollupStrip } from './TeamReviewTables'
import '../../styles/dashboard-home.css'

function relTime(iso) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 3600000) return `${Math.max(1, Math.round(diff / 60000))}m ago`
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`
  return formatDateTime(iso)
}

function groupActivitiesByLead(activities = []) {
  const map = new Map()
  for (const act of activities) {
    const leadId = act.leadId || 'unknown'
    if (!map.has(leadId)) {
      map.set(leadId, {
        leadId,
        leadName: act.leadName || 'Lead',
        company: act.company || '',
        activities: [],
        lastAt: act.createdAt,
      })
    }
    const row = map.get(leadId)
    row.activities.push(act)
    if (new Date(act.createdAt) > new Date(row.lastAt)) row.lastAt = act.createdAt
  }
  return [...map.values()].sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt))
}

export default function RepReviewPanel({ onNavigate, panelOptions = {}, isActive = true }) {
  const { user, openPipelineLead } = useApp()
  const repUserId = panelOptions?.userId ? String(panelOptions.userId) : ''
  const [period, setPeriod] = useState(() =>
    canonicalActivityPeriod(panelOptions?.period || '7d')
  )
  const [selectedLeadId, setSelectedLeadId] = useState(null)
  const [review, setReview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const isManager = user?.isOrgAdmin || user?.orgRole === 'org_admin' || user?.orgRole === 'manager'
  const canView = isManager || String(user?.id) === repUserId

  useEffect(() => {
    if (panelOptions?.userId) setSelectedLeadId(null)
    if (panelOptions?.period) setPeriod(canonicalActivityPeriod(panelOptions.period))
  }, [panelOptions?.userId, panelOptions?.period])

  const load = useCallback(async () => {
    if (!repUserId || !canView) return
    const periodNorm = canonicalActivityPeriod(period)
    const cacheKey = repReviewCacheKey(user?.organizationId, repUserId, periodNorm)
    const cached = readPanelCache(cacheKey)
    if (cached?.data?.review) {
      setReview(cached.data.review)
      setLoading(false)
      if (!cached.stale) return
    } else {
      setLoading(true)
    }
    setError(null)
    try {
      const payload = await api.getCrmRepReview(repUserId, periodNorm)
      setReview(payload)
      writePanelCache(cacheKey, { review: payload })
    } catch (e) {
      setError(e.message || 'Could not load rep review')
    } finally {
      setLoading(false)
    }
  }, [repUserId, period, canView, user?.organizationId])

  useEffect(() => {
    if (!isActive || !repUserId) return undefined
    load()
  }, [isActive, repUserId, load])

  const activities = review?.activities || []
  const leadGroups = useMemo(() => groupActivitiesByLead(activities), [activities])

  const visibleActivities = useMemo(() => {
    if (!selectedLeadId) return activities
    return activities.filter((a) => String(a.leadId) === String(selectedLeadId))
  }, [activities, selectedLeadId])

  const repName = review?.rep?.name || 'Team member'
  const rollup = review?.rollup
  const comparison = review?.comparison
  const rep = review?.rep

  const headerStats = useMemo(
    () => [
      { label: 'Open leads', value: rep?.open ?? '—' },
      { label: 'Follow-up', value: rep?.followups ?? '—' },
      { label: 'Emails', value: rollup?.emails ?? 0 },
      { label: 'Calls', value: rollup?.calls ?? 0 },
      { label: 'Activities', value: rollup?.activitiesTotal ?? 0 },
      { label: 'Leads touched', value: rollup?.contactsOpened ?? rollup?.leadsTouched ?? 0 },
    ],
    [rep, rollup]
  )

  const goBack = useCallback(() => {
    onNavigate?.(panelOptions?.returnTo || 'overview', {})
  }, [onNavigate, panelOptions?.returnTo])

  const openLead = useCallback(
    (leadId) => {
      if (!leadId) return
      openPipelineLead(leadId)
      onNavigate?.('pipeline', { returnTo: 'crm-rep-review', userId: repUserId, period })
    },
    [openPipelineLead, onNavigate, repUserId, period]
  )

  if (!isActive) {
    return <div className="panel-shell rep-review-page hidden" aria-hidden />
  }

  if (!repUserId) {
    return (
      <div className="panel-shell rep-review-page">
        <div className="panel-body-scroll rep-review-page__inner">
          <p className="ti3-error">No rep selected.</p>
          <button type="button" className="dash-home__btn" onClick={goBack}>
            ← Back to dashboard
          </button>
        </div>
      </div>
    )
  }

  if (!canView) {
    return (
      <div className="panel-shell rep-review-page">
        <div className="panel-body-scroll rep-review-page__inner">
          <p className="ti3-error">You can only view your own activity report.</p>
          <button type="button" className="dash-home__btn" onClick={goBack}>
            ← Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="panel-shell rep-review-page team-intel-page--v3">
      <div className="ti3-scroll panel-body-scroll rep-review-page__scroll">
        <div className="rep-review-page__inner">
        <header className="rep-review-page__header">
          <button type="button" className="rep-review-page__back" onClick={goBack}>
            ← Team review
          </button>
          <div className="rep-review-page__title-block">
            <p className="dash-home__eyebrow">Rep review</p>
            <h1>{repName}</h1>
            <p className="rep-review-page__sub">
              {review?.periodLabel || period}
              {loading ? ' · loading…' : ` · ${leadGroups.length} customers with activity`}
            </p>
          </div>
          <DashboardSegmented
            value={canonicalActivityPeriod(period)}
            onChange={(v) => setPeriod(canonicalActivityPeriod(v))}
            options={REP_REVIEW_PERIODS}
          />
        </header>

        {error ? <p className="ti3-error">{error}</p> : null}

        <div className="rep-review-page__header-stats">
          {headerStats.map((s) => (
            <div key={s.label} className="rep-review-page__stat">
              <span className="rep-review-page__stat-label">{s.label}</span>
              <span className="rep-review-page__stat-value">{s.value}</span>
            </div>
          ))}
        </div>

        <RollupStrip rollup={rollup} comparison={comparison} />

        <div className="rep-review-page__layout">
          <aside className="rep-review-page__leads" aria-label="Customers">
            <div className="rep-review-page__leads-head">
              <h2>Customers</h2>
              <button
                type="button"
                className={`rep-review-page__lead-all${!selectedLeadId ? ' is-active' : ''}`}
                onClick={() => setSelectedLeadId(null)}
              >
                All ({activities.length})
              </button>
            </div>
            {loading && !leadGroups.length ? (
              <p className="dash-home__empty">Loading…</p>
            ) : !leadGroups.length ? (
              <p className="dash-home__empty">No logged activity for this period.</p>
            ) : (
              <ul className="rep-review-page__lead-list">
                {leadGroups.map((group) => (
                  <li key={group.leadId}>
                    <button
                      type="button"
                      className={`rep-review-page__lead-item${
                        String(selectedLeadId) === String(group.leadId) ? ' is-active' : ''
                      }`}
                      onClick={() => setSelectedLeadId(group.leadId)}
                    >
                      <strong>{group.leadName}</strong>
                      {group.company ? <span>{group.company}</span> : null}
                      <span className="rep-review-page__lead-meta">
                        {group.activities.length} · {relTime(group.lastAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <main className="rep-review-page__detail" aria-label="Activity detail">
            <header className="rep-review-page__detail-head">
              <h2>
                {selectedLeadId
                  ? leadGroups.find((g) => String(g.leadId) === String(selectedLeadId))?.leadName ||
                    'Customer activity'
                  : 'All activity'}
              </h2>
              <p>{visibleActivities.length} events</p>
            </header>

            <div className="dash-home-team__table-wrap">
              <table className="dash-home-team__table dash-home-team__table--activity">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Customer</th>
                    <th>Type</th>
                    <th>Activity</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {visibleActivities.map((act) => (
                    <tr key={act.id || `${act.leadId}-${act.createdAt}`}>
                      <td className="is-muted is-nowrap">{relTime(act.createdAt)}</td>
                      <td>
                        <button
                          type="button"
                          className="dash-home-team__lead-btn"
                          onClick={() => openLead(act.leadId)}
                        >
                          <strong>{act.leadName || 'Lead'}</strong>
                          {act.company ? <span>{act.company}</span> : null}
                        </button>
                      </td>
                      <td>{ACTIVITY_LABELS[act.type] || act.type || 'Note'}</td>
                      <td className="dash-home-team__activity-body">{act.summary || '—'}</td>
                      <td className="is-action">
                        <button
                          type="button"
                          className="dash-home-team__row-action"
                          onClick={() => openLead(act.leadId)}
                        >
                          Open →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!loading && !visibleActivities.length ? (
                <p className="dash-home__empty rep-review-page__empty-table">No activity to show.</p>
              ) : null}
            </div>
          </main>
        </div>
        </div>
      </div>
    </div>
  )
}
