import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { useApp } from '../../context/AppContext'
import { getDealStageMeta } from '../../lib/crmConstants'
import {
  allDealCountsFromSummary,
  dealCountsFromSummary,
  formatDealValue,
  freightRouteLabel,
  isFreightDealOrg,
  sumDealAmounts,
  transportModeLabel,
} from '../../lib/freightDeals'
import { dashboardNavOptions } from '../../lib/dashboardNavigation'

function formatWeight(kg) {
  if (kg == null || kg === '') return '—'
  const n = Number(kg)
  return Number.isFinite(n) ? `${n} kg` : '—'
}

function DealRow({ deal, leadId, leadName, company, onOpenDeal }) {
  const meta = getDealStageMeta(deal.stage, { freightOrg: true })
  const freight = deal.freight
  const metaLine = [
    leadName,
    company && company !== leadName ? company : null,
    transportModeLabel(freight?.transportMode),
    formatWeight(freight?.grossWeightKg),
    freightRouteLabel(freight),
    formatDealValue(deal.amount, deal.currency),
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <button type="button" className="dash-v4-freight__deal" onClick={() => onOpenDeal(leadId)}>
      <div className="dash-v4-freight__deal-title">{deal.name}</div>
      <div className="dash-v4-freight__deal-meta">{metaLine}</div>
      <span className="dash-v4__badge dash-v4__badge--follow_up">{meta.label}</span>
    </button>
  )
}

/** Home dashboard block — freight deals by stage with counts and recent lists. */
export default function FreightDealsDashboard({ user, pipelineSummary, onNavigate }) {
  const { openPipelineLead } = useApp()
  const freightOrg = isFreightDealOrg(user)
  const [openDeals, setOpenDeals] = useState([])
  const [wonDeals, setWonDeals] = useState([])
  const [lostDeals, setLostDeals] = useState([])
  const [loading, setLoading] = useState(false)

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
  const openCount = openCounts.all ?? 0
  const wonCount = allCounts.won ?? 0
  const lostCount = allCounts.lost ?? 0
  const openValue = sumDealAmounts(openDeals)
  const wonValue = sumDealAmounts(wonDeals)
  const recentOpen = openDeals.slice(0, 6)
  const recentWon = wonDeals.slice(0, 5)
  const recentLost = lostDeals.slice(0, 5)
  const totalWeight = openDeals.reduce(
    (sum, r) => sum + (Number(r.deal?.freight?.grossWeightKg) || 0),
    0
  )

  return (
    <section className="dash-v4-freight">
      <div className="dash-v4__card">
        <div className="dash-v4__card-head">
          <div>
            <h3 className="dash-v4__card-title">Freight deals</h3>
            <p className="dash-v4__card-sub">Open RFQs, pipeline value, and closed deals</p>
          </div>
          <button type="button" className="dash-v4__link" onClick={() => goDeals('all')}>
            All open deals →
          </button>
        </div>

        <div className="dash-v4-freight__grid">
          <button type="button" className="dash-v4-freight__kpi" onClick={() => goDeals('rfq')}>
            <p className="dash-v4-freight__kpi-label">Open RFQs</p>
            <p className="dash-v4-freight__kpi-value">{rfqCount}</p>
          </button>
          <button type="button" className="dash-v4-freight__kpi" onClick={() => goDeals('all')}>
            <p className="dash-v4-freight__kpi-label">All open deals</p>
            <p className="dash-v4-freight__kpi-value">{openCount}</p>
          </button>
          <button type="button" className="dash-v4-freight__kpi" onClick={() => goDeals('won')}>
            <p className="dash-v4-freight__kpi-label">Won deals</p>
            <p className="dash-v4-freight__kpi-value">{wonCount}</p>
          </button>
          <button type="button" className="dash-v4-freight__kpi" onClick={() => goDeals('lost')}>
            <p className="dash-v4-freight__kpi-label">Lost deals</p>
            <p className="dash-v4-freight__kpi-value">{lostCount}</p>
          </button>
          <button type="button" className="dash-v4-freight__kpi" onClick={() => goDeals('all')}>
            <p className="dash-v4-freight__kpi-label">Open pipeline value</p>
            <p className="dash-v4-freight__kpi-value">{formatDealValue(openValue || 0)}</p>
          </button>
          <button
            type="button"
            className="dash-v4-freight__kpi"
            onClick={wonCount > 0 ? () => goDeals('won') : undefined}
            disabled={wonCount <= 0}
          >
            <p className="dash-v4-freight__kpi-label">Won value</p>
            <p className="dash-v4-freight__kpi-value">{wonValue > 0 ? formatDealValue(wonValue) : '—'}</p>
          </button>
        </div>

        {totalWeight > 0 ? (
          <p className="dash-v4__scope" style={{ marginBottom: 12 }}>
            Open RFQ gross weight (loaded deals): {Math.round(totalWeight)} kg
          </p>
        ) : null}

        {loading ? <p className="dash-v4__empty">Loading deals…</p> : null}

        {!loading ? (
          <div className="dash-v4__grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {[
              { title: 'Open deals', deals: recentOpen, total: openCount, stage: 'all', empty: 'No open freight deals yet.' },
              { title: 'Won deals', deals: recentWon, total: wonCount, stage: 'won', empty: 'No won deals yet.' },
              { title: 'Lost deals', deals: recentLost, total: lostCount, stage: 'lost', empty: 'No lost deals yet.' },
            ].map((col) => (
              <div key={col.title}>
                <div className="dash-v4__card-head" style={{ marginBottom: 8 }}>
                  <h4 className="dash-v4__card-title" style={{ fontSize: 13 }}>{col.title}</h4>
                  {col.deals.length < col.total ? (
                    <button type="button" className="dash-v4__link" onClick={() => goDeals(col.stage)}>
                      View all {col.total} →
                    </button>
                  ) : null}
                </div>
                {col.deals.length === 0 ? (
                  <p className="dash-v4__empty">{col.empty}</p>
                ) : (
                  col.deals.map(({ deal, leadId, leadName, company }) => (
                    <DealRow
                      key={deal.id}
                      deal={deal}
                      leadId={leadId}
                      leadName={leadName}
                      company={company}
                      onOpenDeal={openDeal}
                    />
                  ))
                )}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
