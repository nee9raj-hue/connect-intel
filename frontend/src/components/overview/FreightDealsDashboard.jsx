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
import { DashboardSection, DashboardListRow, DashboardKpiCard } from '../dashboard/dashboardUi'

function formatWeight(kg) {
  if (kg == null || kg === '') return '—'
  const n = Number(kg)
  return Number.isFinite(n) ? `${n} kg` : '—'
}

function DealListBlock({ title, deals, emptyHint, freightOrg, onOpenDeal, onViewAll, viewAllLabel }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
        {onViewAll && deals.length > 0 ? (
          <button
            type="button"
            onClick={onViewAll}
            className="text-[10px] font-semibold text-indigo-700 hover:underline"
          >
            {viewAllLabel || 'View all'}
          </button>
        ) : null}
      </div>
      {deals.length === 0 ? (
        <p className="text-xs text-gray-500 py-3 border rounded-lg bg-gray-50 px-3">{emptyHint}</p>
      ) : (
        <ul className="space-y-1">
          {deals.map(({ deal, leadId, leadName, company }) => {
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
              <DashboardListRow
                key={deal.id}
                title={deal.name}
                meta={metaLine}
                badge={meta.label}
                onClick={() => onOpenDeal(leadId)}
              />
            )
          })}
        </ul>
      )}
    </div>
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
    onNavigate?.('pipeline', { view: 'deals', dealStage })
  }

  const openDeal = (leadId) => {
    onNavigate?.('pipeline', { view: 'deals' })
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
    <DashboardSection
      title="Freight deals"
      subtitle="Open RFQs, pipeline value, and closed deals"
      actionLabel="All open deals"
      onAction={() => goDeals('all')}
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-3">
        <DashboardKpiCard label="Open RFQs" value={rfqCount} onClick={() => goDeals('rfq')} />
        <DashboardKpiCard label="All open deals" value={openCount} onClick={() => goDeals('all')} />
        <DashboardKpiCard label="Won deals" value={wonCount} onClick={() => goDeals('won')} />
        <DashboardKpiCard label="Lost deals" value={lostCount} onClick={() => goDeals('lost')} />
        <DashboardKpiCard label="Open pipeline value" value={formatDealValue(openValue || 0)} />
        <DashboardKpiCard
          label="Won value"
          value={wonValue > 0 ? formatDealValue(wonValue) : '—'}
          onClick={wonCount > 0 ? () => goDeals('won') : undefined}
        />
      </div>

      {totalWeight > 0 && (
        <p className="text-[11px] text-gray-500 mb-3">
          Open RFQ gross weight (loaded deals): {Math.round(totalWeight)} kg
        </p>
      )}

      {loading && <p className="text-xs text-gray-500 py-4">Loading deals…</p>}

      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <DealListBlock
            title="Open deals"
            deals={recentOpen}
            freightOrg={freightOrg}
            onOpenDeal={openDeal}
            onViewAll={openCount > recentOpen.length ? () => goDeals('all') : undefined}
            viewAllLabel={`View all ${openCount}`}
            emptyHint="No open freight deals yet. Open a lead → Deals tab → Create deal."
          />
          <DealListBlock
            title="Won deals"
            deals={recentWon}
            freightOrg={freightOrg}
            onOpenDeal={openDeal}
            onViewAll={wonCount > recentWon.length ? () => goDeals('won') : undefined}
            viewAllLabel={`View all ${wonCount}`}
            emptyHint="No won deals yet."
          />
          <DealListBlock
            title="Lost deals"
            deals={recentLost}
            freightOrg={freightOrg}
            onOpenDeal={openDeal}
            onViewAll={lostCount > recentLost.length ? () => goDeals('lost') : undefined}
            viewAllLabel={`View all ${lostCount}`}
            emptyHint="No lost deals yet."
          />
        </div>
      )}
    </DashboardSection>
  )
}
