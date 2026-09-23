import { formatDealValue } from '../../lib/crmTimeline'
import { getDealStageMeta } from '../../lib/crmConstants'
import {
  courierContractProjection,
  courierDestinationLabel,
  courierTermLabel,
} from '../../lib/freightDeal'
import { courierCompetitorLabel } from './CourierContractFields'

function formatKg(value) {
  if (value == null) return '—'
  return `${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 1 })} kg`
}

function formatCount(value) {
  if (value == null) return '—'
  return Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function gapText(projection) {
  const gap = projection.priceGapPct
  if (gap == null) return '—'
  if (gap > 0) return `${gap.toLocaleString('en-IN', { maximumFractionDigits: 1 })}% cheaper`
  if (gap < 0) return `${Math.abs(gap).toLocaleString('en-IN', { maximumFractionDigits: 1 })}% premium`
  return 'Matched'
}

export function courierRowProjection(row) {
  return courierContractProjection(row?.deal?.freight?.courier)
}

export default function CourierDealsBoard({
  rows,
  selected,
  allSelected,
  onToggleRow,
  onToggleAll,
  onOpenLead,
}) {
  const totals = rows.reduce(
    (sum, row) => {
      const projection = courierRowProjection(row)
      sum.kg += projection.monthlyWeightKg || 0
      sum.shipments += projection.monthlyShipments || 0
      sum.revenue += projection.monthlyRevenue || 0
      sum.contract += projection.contractValue || 0
      return sum
    },
    { kg: 0, shipments: 0, revenue: 0, contract: 0 }
  )

  return (
    <div className="space-y-3">
      <div className="courier-board-metrics px-3 md:px-4" aria-label="Courier book totals">
        <article>
          <span>Monthly volume</span>
          <strong>{formatKg(totals.kg)}</strong>
        </article>
        <article>
          <span>Monthly shipments</span>
          <strong>{formatCount(totals.shipments)}</strong>
        </article>
        <article>
          <span>Monthly revenue</span>
          <strong>{formatDealValue(totals.revenue)}</strong>
        </article>
        <article>
          <span>Contract value</span>
          <strong>{formatDealValue(totals.contract)}</strong>
        </article>
      </div>
      <div className="pipeline-deals-table-wrap mx-3 md:mx-4 mb-3">
        <table className="pipeline-deals-table">
          <thead>
            <tr>
              <th className="pipeline-deals-th pipeline-deals-th-check">
                <input
                  type="checkbox"
                  className="pipeline-hs-checkbox"
                  checked={allSelected}
                  aria-label="Select all courier deals"
                  onChange={(e) => onToggleAll(e.target.checked)}
                />
              </th>
              <th className="pipeline-deals-th">Deal</th>
              <th className="pipeline-deals-th">Account</th>
              <th className="pipeline-deals-th">Destinations</th>
              <th className="pipeline-deals-th pipeline-deals-th-num">Shipments / mo</th>
              <th className="pipeline-deals-th pipeline-deals-th-num">Kg / mo</th>
              <th className="pipeline-deals-th pipeline-deals-th-num">Revenue / mo</th>
              <th className="pipeline-deals-th pipeline-deals-th-num">Contract</th>
              <th className="pipeline-deals-th">Competitor</th>
              <th className="pipeline-deals-th">Term</th>
              <th className="pipeline-deals-th">Stage</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const { deal, leadId, leadName, company } = row
              const key = `${leadId}:${deal.id}`
              const courier = deal.freight?.courier
              const projection = courierRowProjection(row)
              const meta = getDealStageMeta(deal.stage, { freightOrg: true })
              const destinations = (courier?.destinationCountries || []).map(courierDestinationLabel).join(', ')
              const competitor = courierCompetitorLabel(courier)
              return (
                <tr
                  key={key}
                  className={`pipeline-deals-row ${selected.has(key) ? 'is-checked' : ''}`}
                  onClick={() => onOpenLead?.(leadId, 'deals')}
                >
                  <td className="pipeline-deals-td pipeline-deals-td-check" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="pipeline-hs-checkbox"
                      checked={selected.has(key)}
                      aria-label={`Select ${deal.name}`}
                      onChange={(e) => onToggleRow(row, e.target.checked)}
                    />
                  </td>
                  <td className="pipeline-deals-td">
                    <span className="pipeline-deals-primary">{deal.name}</span>
                  </td>
                  <td className="pipeline-deals-td">
                    <p className="truncate">{company || leadName}</p>
                  </td>
                  <td className="pipeline-deals-td">{destinations || '—'}</td>
                  <td className="pipeline-deals-td pipeline-deals-td-num tabular-nums">
                    {formatCount(projection.monthlyShipments)}
                  </td>
                  <td className="pipeline-deals-td pipeline-deals-td-num tabular-nums">
                    {formatKg(projection.monthlyWeightKg)}
                  </td>
                  <td className="pipeline-deals-td pipeline-deals-td-num tabular-nums">
                    {formatDealValue(projection.monthlyRevenue)}
                  </td>
                  <td className="pipeline-deals-td pipeline-deals-td-num tabular-nums font-semibold">
                    {formatDealValue(projection.contractValue)}
                  </td>
                  <td className="pipeline-deals-td">
                    <p className="truncate">{competitor || '—'}</p>
                    <p className="text-[10px] text-gray-500">{gapText(projection)}</p>
                  </td>
                  <td className="pipeline-deals-td whitespace-nowrap">{courierTermLabel(courier?.contractTerm)}</td>
                  <td className="pipeline-deals-td">
                    <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-semibold uppercase ${meta.color}`}>
                      {meta.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
