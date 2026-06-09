import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { formatDateTime } from '../../lib/crmUiConstants'
import { getStatusMeta } from '../../lib/crmConstants'
import { HubMetricTiles } from './MarketingHubCharts'
import MarketingListsPanel from './MarketingListsPanel'
import MarketingSegmentsPanel from './MarketingSegmentsPanel'

function InsightBreakdown({ title, rows, labelKey }) {
  if (!rows?.length) return null
  const max = Math.max(...rows.map((r) => r.count), 1)
  return (
    <section className="audience-studio__breakdown">
      <h4>{title}</h4>
      <ul className="audience-studio__breakdown-list">
        {rows.map((row) => {
          const label =
            labelKey === 'status'
              ? getStatusMeta(row.status)?.label || row.status
              : row[labelKey] || '—'
          return (
            <li key={`${labelKey}-${label}`}>
              <span className="audience-studio__breakdown-label">{label}</span>
              <span className="audience-studio__breakdown-bar-wrap">
                <span
                  className="audience-studio__breakdown-bar"
                  style={{ width: `${Math.round((row.count / max) * 100)}%` }}
                />
              </span>
              <span className="audience-studio__breakdown-count">{row.count.toLocaleString()}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function AudienceInsightPanel({ audience, insights, insightsLoading, teamMembers, onRefresh, refreshing }) {
  if (!audience) {
    return (
      <div className="audience-studio__empty-insight">
        <p>Select an audience on the left to see insights, growth, and deliverability.</p>
      </div>
    )
  }

  const engaged =
    insights?.engagedCount != null
      ? insights.engagedCount
      : Math.round((audience.contactCount || 0) * 0.22)

  return (
    <div className="audience-studio__insight">
      <header className="audience-studio__insight-head">
        <div>
          <span className={`audience-studio__type audience-studio__type--${audience.audienceType}`}>
            {audience.sourceType === 'segment' ? 'Dynamic' : 'Static'} list
          </span>
          <h2>{audience.name}</h2>
          {audience.description ? <p>{audience.description}</p> : null}
        </div>
        <div className="audience-studio__insight-actions">
          <button
            type="button"
            className="mkt-btn mkt-btn--ghost mkt-btn--sm"
            disabled={refreshing}
            onClick={onRefresh}
          >
            {refreshing ? 'Refreshing…' : 'Refresh audience'}
          </button>
          <time className="audience-studio__updated">
            Updated {audience.lastRefreshed ? formatDateTime(audience.lastRefreshed) : 'recently'}
          </time>
        </div>
      </header>
      <HubMetricTiles
        tiles={[
          { label: 'Total contacts', value: (audience.contactCount || 0).toLocaleString() },
          {
            label: 'Growth',
            value: `${(audience.growthPct || 0) >= 0 ? '+' : ''}${audience.growthPct || 0}%`,
          },
          { label: 'Engaged', value: engaged.toLocaleString() },
          {
            label: 'Deliverable',
            value: (
              insights?.deliverableCount ??
              audience.deliverableCount ??
              audience.contactCount ??
              0
            ).toLocaleString(),
          },
        ]}
      />
      <section className="audience-studio__segments-preview">
        <h3>Segmentation preview</h3>
        {insightsLoading ? (
          <p className="mhub-hint">Loading breakdown…</p>
        ) : insights?.sampleSize ? (
          <div className="audience-studio__breakdown-grid">
            <InsightBreakdown title="By stage" rows={insights.byStage} labelKey="status" />
            <InsightBreakdown title="By country" rows={insights.byCountry} labelKey="country" />
            <InsightBreakdown
              title="By owner"
              rows={(insights.byOwner || []).map((row) => {
                if (row.ownerId === '__unassigned__') return { ...row, owner: 'Unassigned' }
                const member = teamMembers?.find((m) => m.id === row.ownerId)
                return { ...row, owner: member?.name || 'Team member' }
              })}
              labelKey="owner"
            />
          </div>
        ) : (
          <p className="mhub-hint">
            Stage, owner, and country breakdowns appear after the audience has contacts. Dynamic segments
            refresh on a schedule or when you click Refresh.
          </p>
        )}
      </section>
    </div>
  )
}

function RecommendationCard({ item, busy, onCreate }) {
  return (
    <article className="audience-studio__rec">
      <div>
        <h4>{item.title}</h4>
        <p>{item.message}</p>
        <span className="audience-studio__rec-detail">{item.detail}</span>
      </div>
      <button type="button" className="mkt-btn mkt-btn--primary mkt-btn--sm" disabled={busy} onClick={() => onCreate(item)}>
        Create audience
      </button>
    </article>
  )
}

export default function AudienceStudio({
  initialTab = 'studio',
  audienceStats,
  user,
  teamMembers,
  lists,
  setLists,
  savedLeads,
  refreshTeam,
  orgLeadTags,
  segments,
  campaigns,
  onReload,
  onLaunchCampaign,
  busy,
  setBusy,
  setError,
  setNotice,
}) {
  const [subTab, setSubTab] = useState(initialTab === 'lists' || initialTab === 'segments' ? initialTab : 'studio')
  const [audiences, setAudiences] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [summary, setSummary] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [loadingAudiences, setLoadingAudiences] = useState(true)
  const [insights, setInsights] = useState(null)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const loadAudiences = useCallback(async () => {
    setLoadingAudiences(true)
    try {
      const data = await api.getMarketingAudiences()
      setAudiences(data.audiences || [])
      setRecommendations(data.recommendations || [])
      setSummary(data.summary || null)
      if (!selectedId && data.audiences?.[0]) setSelectedId(data.audiences[0].id)
    } catch (e) {
      setError?.(e.message || 'Could not load audiences')
    } finally {
      setLoadingAudiences(false)
    }
  }, [selectedId, setError])

  useEffect(() => {
    if (subTab === 'studio') loadAudiences()
  }, [subTab, loadAudiences])

  const selected = useMemo(
    () => audiences.find((a) => a.id === selectedId) || audiences[0] || null,
    [audiences, selectedId]
  )

  const loadInsights = useCallback(
    async (audienceId) => {
      if (!audienceId) {
        setInsights(null)
        return
      }
      setInsightsLoading(true)
      try {
        const data = await api.getMarketingAudiences({ insightsFor: audienceId })
        setInsights(data.insights || null)
      } catch {
        setInsights(null)
      } finally {
        setInsightsLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    if (subTab === 'studio' && selected?.id) loadInsights(selected.id)
  }, [subTab, selected?.id, loadInsights])

  const refreshSelected = async () => {
    if (!selected) return
    setRefreshing(true)
    setError(null)
    try {
      const payload = selected.segmentId
        ? { segmentId: selected.segmentId }
        : { listId: selected.listId }
      const data = await api.refreshAudienceSnapshot(payload)
      if (data.audience) {
        setAudiences((prev) => prev.map((a) => (a.id === data.audience.id ? data.audience : a)))
      }
      setInsights(data.insights || null)
      setNotice?.('Audience refreshed')
      onReload?.()
    } catch (e) {
      setError(e.message || 'Could not refresh audience')
    } finally {
      setRefreshing(false)
    }
  }

  const createFromRecommendation = async (item) => {
    setBusy(true)
    setError(null)
    try {
      await api.createAudienceFromRecommendation({
        name: item.suggestedName,
        filterJson: item.filterJson,
        channel: 'email',
      })
      setNotice?.(`Audience “${item.suggestedName}” created`)
      await loadAudiences()
      onReload?.()
    } catch (e) {
      setError(e.message || 'Could not create audience')
    } finally {
      setBusy(false)
    }
  }

  const stats = summary || audienceStats || {}

  return (
    <div className="audience-studio mhub-tab-pad">
      <header className="audience-studio__page-head">
        <div>
          <h2>Audience Studio</h2>
          <p>Build reusable audiences first — campaigns second.</p>
        </div>
        <div className="mhub-subnav">
          {[
            { id: 'studio', label: 'Audiences' },
            { id: 'lists', label: 'Static lists' },
            { id: 'segments', label: 'Dynamic lists' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              className={`mhub-subnav__btn${subTab === t.id ? ' is-active' : ''}`}
              onClick={() => setSubTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {subTab === 'studio' ? (
        <>
          <section className="audience-studio__hero-metrics">
            <HubMetricTiles
              tiles={[
                { label: 'Total contacts', value: (stats.totalContacts ?? 0).toLocaleString() },
                {
                  label: 'Growth',
                  value: `${(stats.growthPct ?? 0) >= 0 ? '+' : ''}${stats.growthPct ?? 0}%`,
                },
                { label: 'Engaged', value: (stats.engaged ?? 0).toLocaleString() },
                { label: 'Deliverable', value: (stats.deliverable ?? stats.totalContacts ?? 0).toLocaleString() },
              ]}
            />
          </section>

          {recommendations.length > 0 ? (
            <section className="audience-studio__recs">
              <h3>Smart list recommendations</h3>
              <div className="audience-studio__recs-grid">
                {recommendations.map((item) => (
                  <RecommendationCard key={item.id} item={item} busy={busy} onCreate={createFromRecommendation} />
                ))}
              </div>
            </section>
          ) : null}

          <div className="audience-studio__layout">
            <aside className="audience-studio__sidebar">
              <div className="audience-studio__sidebar-head">
                <h3>Lists</h3>
                <span>{audiences.length}</span>
              </div>
              {loadingAudiences ? (
                <p className="mhub-hint">Loading audiences…</p>
              ) : (
                <ul className="audience-studio__list">
                  {audiences.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        className={`audience-studio__list-item${selectedId === a.id ? ' is-active' : ''}`}
                        onClick={() => setSelectedId(a.id)}
                      >
                        <strong>{a.name}</strong>
                        <span>{(a.contactCount || 0).toLocaleString()} contacts</span>
                        <span className="audience-studio__list-growth">
                          {(a.growthPct || 0) >= 0 ? '+' : ''}
                          {a.growthPct || 0}%
                        </span>
                      </button>
                    </li>
                  ))}
                  {!audiences.length ? (
                    <li className="audience-studio__list-empty">No audiences yet — save a selection from Pipeline.</li>
                  ) : null}
                </ul>
              )}
            </aside>
            <main className="audience-studio__main">
              <AudienceInsightPanel
                audience={selected}
                insights={insights}
                insightsLoading={insightsLoading}
                teamMembers={teamMembers}
                onRefresh={refreshSelected}
                refreshing={refreshing}
              />
              {selected ? (
                <footer className="audience-studio__actions">
                  <button
                    type="button"
                    className="mkt-btn mkt-btn--primary"
                    onClick={() =>
                      onLaunchCampaign?.({
                        listId: selected.listId,
                        segmentId: selected.segmentId,
                        audienceName: selected.name,
                      })
                    }
                  >
                    Launch campaign
                  </button>
                </footer>
              ) : null}
            </main>
          </div>
        </>
      ) : null}

      {subTab === 'lists' ? (
        <MarketingListsPanel
          user={user}
          teamMembers={teamMembers}
          refreshTeam={refreshTeam}
          savedLeads={savedLeads}
          lists={lists}
          setLists={setLists}
          onListsReload={onReload}
          orgLeadTags={orgLeadTags}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          setNotice={setNotice}
        />
      ) : null}

      {subTab === 'segments' ? (
        <MarketingSegmentsPanel
          user={user}
          teamMembers={teamMembers}
          segments={segments}
          campaigns={campaigns}
          onReload={onReload}
          orgLeadTags={orgLeadTags}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          setNotice={setNotice}
        />
      ) : null}
    </div>
  )
}
