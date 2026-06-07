import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { useApp } from '../../context/AppContext'
import { getDealStageMeta } from '../../lib/crmConstants'
import {
  dealCountsFromSummary,
  formatDealValue,
  freightRouteLabel,
  isFreightDealOrg,
  transportModeLabel,
} from '../../lib/freightDeals'
import { DashboardSection, DashboardListRow, DashboardKpiCard } from '../dashboard/dashboardUi'

function formatWeight(kg) {
  if (kg == null || kg === '') return '—'
  const n = Number(kg)
  return Number.isFinite(n) ? `${n} kg` : '—'
}

/** Home dashboard block — open freight RFQ deals with value and weight. */
export default function FreightDealsDashboard({ user, pipelineSummary, onNavigate }) {
  const { openPipelineLead } = useApp()
  const freightOrg = isFreightDealOrg(user)
  const [recentDeals, setRecentDeals] = useState([])
  const [loading, setLoading] = useState(false)

  const openCounts = useMemo(() => dealCountsFromSummary(pipelineSummary) || {}, [pipelineSummary])

  const loadRecent = useCallback(async () => {
    if (!freightOrg) return
    setLoading(true)
    try {
      const data = await api.fetchPipelineDeals({ dealStage: 'all', limit: 8 }, { silent: true })
      setRecentDeals(data.deals || [])
    } catch {
      setRecentDeals([])
    } finally {
      setLoading(false)
    }
  }, [freightOrg])

  useEffect(() => {
    loadRecent()
  }, [loadRecent])

  if (!freightOrg) return null

  const goDeals = (dealStage = 'all') => {
    onNavigate?.('pipeline', { view: 'deals', dealStage })
  }

  const openDeal = (leadId) => {
    onNavigate?.('pipeline', { view: 'deals' })
    openPipelineLead(leadId, 'deals')
  }

  const rfqCount = openCounts.rfq || 0
  const openPipelineValue = recentDeals.reduce((sum, r) => sum + (Number(r.deal?.amount) || 0), 0)
  const totalWeight = recentDeals.reduce(
    (sum, r) => sum + (Number(r.deal?.freight?.grossWeightKg) || 0),
    0
  )

  return (
    <DashboardSection
      title="Freight deals"
      subtitle="Open shipment RFQs and opportunities"
      actionLabel="View all deals"
      onAction={() => goDeals('all')}
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <DashboardKpiCard label="Open RFQs" value={rfqCount} onClick={() => goDeals('rfq')} />
        <DashboardKpiCard label="All open deals" value={openCounts.all || 0} onClick={() => goDeals('all')} />
        <DashboardKpiCard label="Recent pipeline value" value={formatDealValue(openPipelineValue || 0)} />
        <DashboardKpiCard
          label="Recent RFQ weight"
          value={totalWeight > 0 ? `${Math.round(totalWeight)} kg` : '—'}
        />
      </div>

      {loading && <p className="text-xs text-gray-500 py-4">Loading recent deals…</p>}

      {!loading && recentDeals.length === 0 && (
        <p className="text-xs text-gray-500 py-4 border rounded-lg bg-gray-50 px-3">
          No open freight deals yet. Open a lead → Deals tab → Create RFQ deal.
        </p>
      )}

      {!loading && recentDeals.length > 0 && (
        <ul className="space-y-1">
          {recentDeals.map(({ deal, leadId, leadName, company }) => {
            const meta = getDealStageMeta(deal.stage)
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
                onClick={() => openDeal(leadId)}
              />
            )
          })}
        </ul>
      )}
    </DashboardSection>
  )
}
