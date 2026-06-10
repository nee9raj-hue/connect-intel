import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { LineChart } from './MarketingSimpleCharts'
import MarketingListsPanel from './MarketingListsPanel'
import MarketingSegmentsPanel from './MarketingSegmentsPanel'

const SUB_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'lists', label: 'Lists' },
  { id: 'segments', label: 'Segments' },
]

export default function MarketingAudiencesHub(props) {
  const {
    initialTab = 'overview',
    audienceStats = {},
    user,
    teamMembers,
    lists,
    setLists,
    segments,
    savedLeads,
    orgLeadTags,
    campaigns,
    onReload,
    onLaunchCampaign,
    busy,
    setBusy,
    setError,
    setNotice,
    refreshTeam,
  } = props

  const [subTab, setSubTab] = useState(initialTab === 'studio' ? 'overview' : initialTab)
  const [growth, setGrowth] = useState([])
  const [previewCount, setPreviewCount] = useState(null)
  const [segmentFilters, setSegmentFilters] = useState([{ field: 'lead_status', op: 'is', value: 'new' }])

  useEffect(() => {
    if (subTab !== 'overview') return undefined
    let cancelled = false
    api
      .getMarketingAnalytics('30d', 'audience')
      .then((res) => {
        if (!cancelled) setGrowth(res.growth_chart || [])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [subTab])

  useEffect(() => {
    if (subTab !== 'segments') return undefined
    const t = setTimeout(async () => {
      try {
        const res = await api.previewMarketingAudience({ filters: segmentFilters })
        setPreviewCount(res.count ?? res)
      } catch {
        setPreviewCount(null)
      }
    }, 500)
    return () => clearTimeout(t)
  }, [subTab, segmentFilters])

  if (subTab === 'lists') {
    return (
      <div className="mhub-v3-page">
        <nav className="mhub-v3-periods" style={{ marginBottom: 12 }}>
          {SUB_TABS.map((t) => (
            <button key={t.id} type="button" className={`mhub-v3-period${subTab === t.id ? ' is-active' : ''}`} onClick={() => setSubTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        <MarketingListsPanel
          lists={lists}
          setLists={setLists}
          savedLeads={savedLeads}
          user={user}
          teamMembers={teamMembers}
          orgLeadTags={orgLeadTags}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          setNotice={setNotice}
          onReload={onReload}
          onLaunchCampaign={onLaunchCampaign}
        />
      </div>
    )
  }

  if (subTab === 'segments') {
    return (
      <div className="mhub-v3-page">
        <nav className="mhub-v3-periods" style={{ marginBottom: 12 }}>
          {SUB_TABS.map((t) => (
            <button key={t.id} type="button" className={`mhub-v3-period${subTab === t.id ? ' is-active' : ''}`} onClick={() => setSubTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="mhub-v3-card" style={{ marginBottom: 12 }}>
          <p className="mhub-v3-eyebrow">Live segment preview</p>
          {segmentFilters.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input className="mhub-v3-input" value={f.field} onChange={(e) => {
                const next = [...segmentFilters]
                next[i] = { ...next[i], field: e.target.value }
                setSegmentFilters(next)
              }} />
              <select className="mhub-v3-input" value={f.op} onChange={(e) => {
                const next = [...segmentFilters]
                next[i] = { ...next[i], op: e.target.value }
                setSegmentFilters(next)
              }}>
                <option value="is">is</option>
                <option value="contains">contains</option>
              </select>
              <input className="mhub-v3-input" value={f.value} onChange={(e) => {
                const next = [...segmentFilters]
                next[i] = { ...next[i], value: e.target.value }
                setSegmentFilters(next)
              }} />
            </div>
          ))}
          <p style={{ fontSize: 12 }}>Live count: <strong>{previewCount ?? '…'}</strong> contacts match</p>
        </div>
        <MarketingSegmentsPanel
          segments={segments}
          lists={lists}
          savedLeads={savedLeads}
          user={user}
          campaigns={campaigns}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          onReload={onReload}
          onLaunchCampaign={onLaunchCampaign}
        />
      </div>
    )
  }

  return (
    <div className="mhub-v3-page">
      <nav className="mhub-v3-periods" style={{ marginBottom: 12 }}>
        {SUB_TABS.map((t) => (
          <button key={t.id} type="button" className={`mhub-v3-period${subTab === t.id ? ' is-active' : ''}`} onClick={() => setSubTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
      <div className="mhub-v3-stat-row" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
        {[
          { label: 'Active contacts', value: audienceStats.activeContacts ?? 0 },
          { label: 'Total contacts', value: audienceStats.totalContacts ?? 0 },
          { label: 'Lists', value: audienceStats.listCount ?? lists?.length ?? 0 },
          { label: 'Segments', value: audienceStats.segmentCount ?? segments?.length ?? 0 },
          { label: 'Growth', value: '0%' },
          { label: 'Suppressions', value: 0 },
        ].map((s) => (
          <div key={s.label} className="mhub-v3-stat">
            <span className="mhub-v3-stat__label">{s.label}</span>
            <span className="mhub-v3-stat__value">{s.value}</span>
          </div>
        ))}
      </div>
      <div className="mhub-v3-card">
        <h3 className="mhub-v3-card__title">Audience health</h3>
        <LineChart data={growth} valueKey="events" labelKey="date" />
      </div>
    </div>
  )
}
