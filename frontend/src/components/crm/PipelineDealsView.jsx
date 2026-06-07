import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { getDealStageMeta } from '../../lib/crmConstants'
import {
  freightRouteLabel,
  formatDealValue,
  transportModeLabel,
} from '../../lib/freightDeals'

function formatWeight(kg) {
  if (kg == null || kg === '') return '—'
  const n = Number(kg)
  return Number.isFinite(n) ? `${n} kg` : '—'
}

/** Pipeline view — all freight deals across leads, filterable by deal stage. */
export default function PipelineDealsView({
  dealStage = 'all',
  onOpenLead,
  assigneeFilter = null,
}) {
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const stageMeta = useMemo(() => {
    if (dealStage === 'all') return { label: 'All open deals' }
    return getDealStageMeta(dealStage, { freightOrg: true })
  }, [dealStage])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.fetchPipelineDeals({ dealStage, limit: 200 })
      let list = data.deals || []
      if (assigneeFilter) {
        list = list.filter((r) => String(r.assigneeUserId || '') === String(assigneeFilter))
      }
      setRows(list)
      setTotal(data.total ?? list.length)
    } catch (e) {
      setError(e.message || 'Could not load deals')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [dealStage, assigneeFilter])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{stageMeta.label}</h2>
          <p className="text-xs text-gray-500">
            Shipment opportunities — value and gross weight from RFQ. Click a row to open the lead.
          </p>
        </div>
        <p className="text-xs text-gray-500 tabular-nums">{total} deal{total === 1 ? '' : 's'}</p>
      </div>

      {loading && (
        <p className="text-xs text-gray-500 py-8 text-center">Loading deals…</p>
      )}
      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}
      {!loading && !error && rows.length === 0 && (
        <p className="text-xs text-gray-500 py-10 text-center border rounded-xl bg-gray-50">
          No deals in this stage yet. Create one from a lead&apos;s Deals tab.
        </p>
      )}

      {!loading && rows.length > 0 && (
        <div className="border rounded-xl overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-left text-[10px] font-semibold uppercase text-gray-500">
                  <th className="px-3 py-2">Deal</th>
                  <th className="px-3 py-2">Lead / company</th>
                  <th className="px-3 py-2">Stage</th>
                  <th className="px-3 py-2">Mode</th>
                  <th className="px-3 py-2">Route</th>
                  <th className="px-3 py-2 text-right">Weight</th>
                  <th className="px-3 py-2 text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ deal, leadId, leadName, company }) => {
                  const meta = getDealStageMeta(deal.stage, { freightOrg: true })
                  const freight = deal.freight
                  return (
                    <tr
                      key={deal.id}
                      className="border-t border-gray-100 hover:bg-indigo-50/40 cursor-pointer"
                      onClick={() => onOpenLead?.(leadId, 'deals')}
                    >
                      <td className="px-3 py-2.5 font-medium text-gray-900 max-w-[160px] truncate">
                        {deal.name}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600 max-w-[140px]">
                        <p className="truncate">{leadName}</p>
                        {company && company !== leadName && (
                          <p className="truncate text-[10px] text-gray-400">{company}</p>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-semibold uppercase ${meta.color}`}
                        >
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">
                        {transportModeLabel(freight?.transportMode)}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600 max-w-[180px] truncate">
                        {freightRouteLabel(freight)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-800">
                        {formatWeight(freight?.grossWeightKg)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium text-gray-900">
                        {formatDealValue(deal.amount, deal.currency)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
