import { useState } from 'react'
import { HubMetricTiles } from './MarketingHubCharts'
import MarketingListsPanel from './MarketingListsPanel'
import MarketingSegmentsPanel from './MarketingSegmentsPanel'

export default function MarketingAudiencesHub({
  initialTab = 'overview',
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
  busy,
  setBusy,
  setError,
  setNotice,
}) {
  const [subTab, setSubTab] = useState(initialTab === 'segments' ? 'segments' : initialTab === 'lists' ? 'lists' : 'overview')

  const stats = audienceStats || {}

  return (
    <div className="mhub-audiences-page mhub-tab-pad">
      <header className="mhub-audiences-page__head">
        <div>
          <h2>Audiences</h2>
          <p>Insights first — contacts second</p>
        </div>
        <div className="mhub-subnav">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'lists', label: 'Lists' },
            { id: 'segments', label: 'Segments' },
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

      {subTab === 'overview' ? (
        <div className="mhub-audiences-overview">
          <section className="mhub-section">
            <div className="mhub-section__head">
              <h2>Audience health</h2>
            </div>
            <HubMetricTiles
              tiles={[
                { label: 'Active contacts', value: stats.activeContacts ?? 0 },
                { label: 'Total contacts', value: stats.totalContacts ?? 0 },
                { label: 'Lists', value: stats.listCount ?? 0 },
                { label: 'Segments', value: stats.segmentCount ?? 0 },
                { label: 'Growth', value: `${stats.growthPct >= 0 ? '+' : ''}${stats.growthPct ?? 0}%` },
                { label: 'Suppressions', value: stats.suppressionCount ?? 0 },
              ]}
            />
          </section>
          <p className="mhub-hint">
            Use <strong>Lists → + List → Smart list</strong> for one-click audiences split into 200-contact
            send batches. Use <strong>Segments</strong> for live audiences that refresh in campaigns.
          </p>
        </div>
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
