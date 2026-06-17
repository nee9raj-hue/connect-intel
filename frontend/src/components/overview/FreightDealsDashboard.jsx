import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { useApp } from '../../context/AppContext'
import { getDealStageMeta } from '../../lib/crmConstants'
import {
  allDealCountsFromSummary,
  dealCountsFromSummary,
  formatDealValue,
  formatFreightGross,
  freightCustomerTypeLabel,
  freightRouteLabel,
  isFreightDealOrg,
  sumDealAmounts,
  transportModeLabel,
} from '../../lib/freightDeals'
import { dashboardNavOptions } from '../../lib/dashboardNavigation'
import '../../styles/dashboard-home.css'

const OPEN_STAGES = [
  { id: 'rfq', label: 'RFQ' },
  { id: 'quoted', label: 'Quoted' },
  { id: 'negotiation', label: 'Negotiation' },
  { id: 'booked', label: 'Booked' },
]

const TABS = [
  { id: 'open', label: 'Open deals', stage: 'all' },
  { id: 'won', label: 'Won', stage: 'won' },
  { id: 'lost', label: 'Lost', stage: 'lost' },
]


function StageBadge({ stage }) {
  const meta = getDealStageMeta(stage, { freightOrg: true })
  return (
    <span className={`dash-home-freight__stage dash-home-freight__stage--${stage || 'rfq'}`}>
      {meta.label}
    </span>
  )
}

function DealsTable({ rows, onOpenDeal, emptyLabel }) {
  if (!rows.length) {
    return (
      <div className="dash-home-freight__empty">
        <p>{emptyLabel}</p>
        <span>Create deals from a lead&apos;s Deals tab or open the pipeline.</span>
      </div>
    )
  }

  return (
    <div className="dash-home-freight__table-wrap">
      <table className="dash-home-freight__table">
        <thead>
          <tr>
            <th>Deal</th>
            <th>Customer</th>
            <th>Route</th>
            <th>Mode</th>
            <th className="is-num">Gross</th>
            <th className="is-num">Value</th>
            <th>Stage</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ deal, leadId, leadName, company }) => {
            const freight = deal.freight
            const route = freightRouteLabel(freight)
            return (
              <tr key={deal.id}>
                <td>
                  <button type="button" className="dash-home-freight__deal-btn" onClick={() => onOpenDeal(leadId)}>
                    <span className="dash-home-freight__deal-name">{deal.name}</span>
                    <span className="dash-home-freight__deal-type">{freightCustomerTypeLabel(freight?.customerType)}</span>
                  </button>
                </td>
                <td>
                  <span className="dash-home-freight__customer">{leadName || '—'}</span>
                  {company && company !== leadName ? (
                    <span className="dash-home-freight__company">{company}</span>
                  ) : null}
                </td>
                <td>
                  <span className="dash-home-freight__route" title={route}>
                    {route}
                  </span>
                </td>
                <td>
                  <span className="dash-home-freight__mode">{transportModeLabel(freight?.transportMode)}</span>
                </td>
                <td className="is-num">{formatFreightGross(freight)}</td>
                <td className="is-num is-value">{formatDealValue(deal.amount, deal.currency)}</td>
                <td>
                  <StageBadge stage={deal.stage} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Home dashboard — freight deals snapshot with KPIs and drill-down table. */
export default function FreightDealsDashboard({ user, pipelineSummary, onNavigate }) {
  const { openPipelineLead } = useApp()
  const freightOrg = isFreightDealOrg(user)
  const [openDeals, setOpenDeals] = useState([])
  const [wonDeals, setWonDeals] = useState([])
  const [lostDeals, setLostDeals] = useState([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('open')

  const openCounts = useMemo(() => dealCountsFromSummary(pipelineSummary) || {}, [pipelineSummary])
  const allCounts = useMemo(() => allDealCountsFromSummary(pipelineSummary) || {}, [pipelineSummary])

  const loadDeals = useCallback(async () => {
    if (!freightOrg) return
    setLoading(true)
    try {
      const [openRes, wonRes, lostRes] = await Promise.all([
        api.fetchPipelineDeals({ dealStage: 'all', limit: 120 }, { silent: true }),
        api.fetchPipelineDeals({ dealStage: 'won', limit: 8 }, { silent: true }),
        api.fetchPipelineDeals({ dealStage: 'lost', limit: 8 }, { silent: true }),
      ])
      setOpenDeals(openRes.deals || [])
      setWonDeals(wonRes.deals || [])
      setLostDeals(lostRes.deals || [])
    } catch {
      setOpenDeals([])
      setWonDeals([])
      setLostDeals([])
    } finally {
      setLoading(false)
    }
  }, [freightOrg])

  useEffect(() => {
    loadDeals()
  }, [loadDeals])

  if (!freightOrg) return null

  const goDeals = (dealStage = 'all') => {
    onNavigate?.(
      'pipeline',
      dashboardNavOptions({ panel: 'pipeline', view: 'deals', dealStage, returnTo: 'overview' }, user)
    )
  }

  const openDeal = (leadId) => {
    onNavigate?.(
      'pipeline',
      dashboardNavOptions({ panel: 'pipeline', view: 'deals', returnTo: 'overview' }, user)
    )
    openPipelineLead(leadId, 'deals')
  }

  const rfqCount = openCounts.rfq ?? 0
  const openCount = openCounts.all ?? openDeals.length
  const wonCount = allCounts.won ?? wonDeals.length
  const lostCount = allCounts.lost ?? lostDeals.length
  const openValue = sumDealAmounts(openDeals)
  const wonValue = sumDealAmounts(wonDeals)
  const openVolume = openDeals.reduce(
    (acc, r) => {
      const f = r.deal?.freight
      const v = Number(f?.grossWeightKg) || 0
      if (!v) return acc
      if (f?.transportMode === 'ocean') acc.cbm += v
      else acc.kg += v
      return acc
    },
    { kg: 0, cbm: 0 }
  )
  const volumeParts = []
  if (openVolume.kg > 0) volumeParts.push(`${Math.round(openVolume.kg).toLocaleString()} kg`)
  if (openVolume.cbm > 0) volumeParts.push(`${openVolume.cbm.toLocaleString()} CBM`)

  const tabRows =
    tab === 'won' ? wonDeals.slice(0, 8) : tab === 'lost' ? lostDeals.slice(0, 8) : openDeals.slice(0, 10)

  const tabEmpty =
    tab === 'won'
      ? 'No won deals yet.'
      : tab === 'lost'
        ? 'No lost deals yet.'
        : 'No open freight deals yet.'

  const tabTotal = tab === 'won' ? wonCount : tab === 'lost' ? lostCount : openCount

  const kpis = [
    { id: 'rfq', label: 'Open RFQs', value: rfqCount, action: () => goDeals('rfq') },
    { id: 'open', label: 'All open', value: openCount, action: () => goDeals('all'), highlight: openCount > 0 },
    { id: 'won', label: 'Won deals', value: wonCount, action: () => goDeals('won') },
    { id: 'lost', label: 'Lost deals', value: lostCount, action: () => goDeals('lost') },
    {
      id: 'value',
      label: 'Open pipeline',
      value: formatDealValue(openValue || 0),
      action: () => goDeals('all'),
      isText: true,
    },
    {
      id: 'won-value',
      label: 'Won value',
      value: wonValue > 0 ? formatDealValue(wonValue) : '—',
      action: wonCount > 0 ? () => goDeals('won') : undefined,
      isText: true,
      disabled: wonCount <= 0,
    },
  ]

  return (
    <section className="dash-home-freight" aria-label="Freight deals">
      <div className="dash-home__inner">
        <div className="dash-home__panel dash-home-freight__panel">
          <div className="dash-home-freight__head">
            <div>
              <p className="dash-home__eyebrow">Shipment pipeline</p>
              <h2 className="dash-home-freight__title">Freight deals</h2>
              <p className="dash-home-freight__sub">
                RFQs, quotes, and booked lanes — {openCount} open
                {volumeParts.length ? ` · ${volumeParts.join(' · ')} in flight` : ''}
              </p>
            </div>
            <button type="button" className="dash-home__btn dash-home__btn--primary" onClick={() => goDeals('all')}>
              Open deals pipeline
            </button>
          </div>

          <div className="dash-home-freight__kpi-row">
            {kpis.map((kpi) => (
              <button
                key={kpi.id}
                type="button"
                className={`dash-home-freight__kpi${kpi.highlight ? ' is-active' : ''}`}
                onClick={kpi.action}
                disabled={kpi.disabled}
              >
                <span className="dash-home-freight__kpi-label">{kpi.label}</span>
                <span className={`dash-home-freight__kpi-value${kpi.isText ? ' is-text' : ''}`}>{kpi.value}</span>
              </button>
            ))}
          </div>

          <div className="dash-home-freight__stages">
            {OPEN_STAGES.map((stage) => {
              const count = openCounts[stage.id] ?? 0
              return (
                <button
                  key={stage.id}
                  type="button"
                  className={`dash-home-freight__stage-pill dash-home-freight__stage-pill--${stage.id}`}
                  onClick={() => goDeals(stage.id)}
                >
                  <span>{stage.label}</span>
                  <strong>{count}</strong>
                </button>
              )
            })}
          </div>

          <div className="dash-home-freight__table-head">
            <div className="dash-home-freight__tabs" role="tablist">
              {TABS.map((t) => {
                const count = t.id === 'open' ? openCount : t.id === 'won' ? wonCount : lostCount
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.id}
                    className={`dash-home-freight__tab${tab === t.id ? ' is-active' : ''}`}
                    onClick={() => setTab(t.id)}
                  >
                    {t.label}
                    <span className="dash-home-freight__tab-count">{count}</span>
                  </button>
                )
              })}
            </div>
            {tabRows.length < tabTotal ? (
              <button type="button" className="dash-home__link" onClick={() => goDeals(TABS.find((t) => t.id === tab)?.stage)}>
                View all {tabTotal} →
              </button>
            ) : null}
          </div>

          {loading ? (
            <div className="dash-home-freight__loading">
              <span className="dash-home-freight__loading-bar" />
              <span className="dash-home-freight__loading-bar" />
              <span className="dash-home-freight__loading-bar" />
            </div>
          ) : (
            <DealsTable rows={tabRows} onOpenDeal={openDeal} emptyLabel={tabEmpty} />
          )}
        </div>
      </div>
    </section>
  )
}
