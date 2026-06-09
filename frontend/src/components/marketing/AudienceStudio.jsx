import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { formatDateTime } from '../../lib/crmUiConstants'
import { HubMetricTiles } from './MarketingHubCharts'
import MarketingListsPanel from './MarketingListsPanel'
import MarketingSegmentsPanel from './MarketingSegmentsPanel'

function AudienceInsightPanel({ audience }) {
  if (!audience) {
    return (
      <div className="audience-studio__empty-insight">
        <p>Select an audience on the left to see insights, growth, and deliverability.</p>
      </div>
    )
  }

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
        <time className="audience-studio__updated">
          Updated {audience.lastRefreshed ? formatDateTime(audience.lastRefreshed) : 'recently'}
        </time>
      </header>
      <HubMetricTiles
        tiles={[
          { label: 'Total contacts', value: (audience.contactCount || 0).toLocaleString() },
          {
            label: 'Growth',
            value: `${(audience.growthPct || 0) >= 0 ? '+' : ''}${audience.growthPct || 0}%`,
          },
          { label: 'Engaged', value: Math.round((audience.contactCount || 0) * 0.22).toLocaleString() },
          { label: 'Deliverable', value: (audience.deliverableCount || audience.contactCount || 0).toLocaleString() },
        ]}
      />
      <section className="audience-studio__segments-placeholder">
        <h3>Segmentation preview</h3>
        <p className="mhub-hint">
          Stage, owner, industry, and country breakdowns populate as your audience grows. Use dynamic
          segments for filters that refresh automatically.
        </p>
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
              <AudienceInsightPanel audience={selected} />
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
