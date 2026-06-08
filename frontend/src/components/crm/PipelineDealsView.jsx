import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { getDealStageMeta } from '../../lib/crmConstants'
import {
  freightRouteLabel,
  formatDealValue,
  transportModeLabel,
  freightCustomerTypeLabel,
} from '../../lib/freightDeals'

function formatWeight(kg) {
  if (kg == null || kg === '') return '—'
  const n = Number(kg)
  return Number.isFinite(n) ? `${n} kg` : '—'
}

function dealRowKey({ leadId, deal }) {
  return `${leadId}:${deal.id}`
}

/** Pipeline view — all freight deals across leads, filterable by deal stage. */
export default function PipelineDealsView({
  dealStage = 'all',
  onOpenLead,
  assigneeFilter = null,
}) {
  const { patchLead } = useApp()
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(() => new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [notice, setNotice] = useState(null)

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
      setSelected((prev) => {
        const valid = new Set(list.map(dealRowKey))
        const next = new Set()
        for (const key of prev) {
          if (valid.has(key)) next.add(key)
        }
        return next
      })
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

  const allSelected = rows.length > 0 && rows.every((row) => selected.has(dealRowKey(row)))

  const toggleRow = (row, checked) => {
    const key = dealRowKey(row)
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })
  }

  const toggleAll = (checked) => {
    if (checked) setSelected(new Set(rows.map(dealRowKey)))
    else setSelected(new Set())
  }

  const selectedRows = useMemo(
    () => rows.filter((row) => selected.has(dealRowKey(row))),
    [rows, selected]
  )

  const runBulk = async (action, { confirmDelete = false, lostReason = '' } = {}) => {
    if (!selectedRows.length || bulkBusy) return
    if (confirmDelete) {
      const ok = window.confirm(
        `Delete ${selectedRows.length} deal${selectedRows.length === 1 ? '' : 's'}? This cannot be undone.`
      )
      if (!ok) return
    }
    setBulkBusy(true)
    setNotice(null)
    setError(null)
    let okCount = 0
    let failCount = 0
    try {
      for (const { deal, leadId } of selectedRows) {
        try {
          await patchLead(leadId, {
            deal: {
              action,
              dealId: deal.id,
              ...(action === 'lost' && lostReason ? { lostReason } : {}),
            },
          })
          okCount += 1
        } catch {
          failCount += 1
        }
      }
      const verb =
        action === 'won' ? 'marked won' : action === 'lost' ? 'marked lost' : 'deleted'
      setNotice(
        failCount
          ? `${okCount} ${verb}, ${failCount} failed`
          : `${okCount} deal${okCount === 1 ? '' : 's'} ${verb}`
      )
      setSelected(new Set())
      await load()
    } catch (e) {
      setError(e.message || 'Bulk update failed')
    } finally {
      setBulkBusy(false)
    }
  }

  const markBulkLost = () => {
    const reason = window.prompt('Lost reason (optional — applies to all selected):', '') ?? null
    if (reason === null) return
    void runBulk('lost', { lostReason: reason.trim() })
  }

  return (
    <div className="pipeline-deals-view space-y-3 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">{stageMeta.label}</h2>
          <p className="text-xs text-gray-500">
            Select deals for bulk actions, or click a row to open the lead.
          </p>
        </div>
        <p className="text-xs text-gray-500 tabular-nums shrink-0">
          {total} deal{total === 1 ? '' : 's'}
        </p>
      </div>

      {selected.size > 0 && (
        <div className="pipeline-bulk-hs-bar" role="toolbar" aria-label="Bulk deal actions">
          <span className="pipeline-bulk-hs-bar__count">
            {selected.size} deal{selected.size === 1 ? '' : 's'} selected
          </span>
          <div className="pipeline-bulk-hs-bar__actions">
            <button
              type="button"
              className="pipeline-bulk-hs-bar__btn"
              disabled={bulkBusy}
              onClick={() => runBulk('won')}
            >
              Mark won
            </button>
            <button
              type="button"
              className="pipeline-bulk-hs-bar__btn"
              disabled={bulkBusy}
              onClick={markBulkLost}
            >
              Mark lost
            </button>
            <button
              type="button"
              className="pipeline-bulk-hs-bar__btn"
              disabled={bulkBusy}
              onClick={() => runBulk('delete', { confirmDelete: true })}
            >
              Delete
            </button>
          </div>
          <span className="pipeline-bulk-hs-bar__spacer" />
          <button
            type="button"
            className="pipeline-bulk-hs-bar__clear"
            disabled={bulkBusy}
            onClick={() => setSelected(new Set())}
          >
            Clear
          </button>
        </div>
      )}

      {notice && (
        <p className="text-xs text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2" role="status">
          {notice}
        </p>
      )}

      {loading && <p className="text-xs text-gray-500 py-8 text-center">Loading deals…</p>}
      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}
      {!loading && !error && rows.length === 0 && (
        <p className="text-xs text-gray-500 py-10 text-center border rounded-xl bg-gray-50">
          No deals in this stage yet. Create one from a lead&apos;s Deals tab.
        </p>
      )}

      {!loading && rows.length > 0 && (
        <div className="pipeline-deals-table-wrap">
          <table className="pipeline-deals-table">
            <colgroup>
              <col className="pipeline-deals-col-check" />
              <col className="pipeline-deals-col-deal" />
              <col className="pipeline-deals-col-lead" />
              <col className="pipeline-deals-col-type" />
              <col className="pipeline-deals-col-stage" />
              <col className="pipeline-deals-col-mode" />
              <col className="pipeline-deals-col-route" />
              <col className="pipeline-deals-col-weight" />
              <col className="pipeline-deals-col-freight" />
              <col className="pipeline-deals-col-invoice" />
            </colgroup>
            <thead>
              <tr>
                <th className="pipeline-deals-th pipeline-deals-th-check">
                  <input
                    type="checkbox"
                    className="pipeline-hs-checkbox"
                    checked={allSelected}
                    aria-label="Select all deals"
                    onChange={(e) => toggleAll(e.target.checked)}
                  />
                </th>
                <th className="pipeline-deals-th">Deal</th>
                <th className="pipeline-deals-th">Lead / company</th>
                <th className="pipeline-deals-th">Type</th>
                <th className="pipeline-deals-th">Stage</th>
                <th className="pipeline-deals-th">Mode</th>
                <th className="pipeline-deals-th">Route / lanes</th>
                <th className="pipeline-deals-th pipeline-deals-th-num">Weight</th>
                <th className="pipeline-deals-th pipeline-deals-th-num">Freight</th>
                <th className="pipeline-deals-th pipeline-deals-th-num">Invoice</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const { deal, leadId, leadName, company } = row
                const key = dealRowKey(row)
                const meta = getDealStageMeta(deal.stage, { freightOrg: true })
                const freight = deal.freight
                const isChecked = selected.has(key)
                return (
                  <tr
                    key={key}
                    className={`pipeline-deals-row ${isChecked ? 'is-checked' : ''}`}
                    onClick={() => onOpenLead?.(leadId, 'deals')}
                  >
                    <td
                      className="pipeline-deals-td pipeline-deals-td-check"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        className="pipeline-hs-checkbox"
                        checked={isChecked}
                        aria-label={`Select ${deal.name}`}
                        onChange={(e) => toggleRow(row, e.target.checked)}
                      />
                    </td>
                    <td className="pipeline-deals-td pipeline-deals-td-deal">
                      <span className="pipeline-deals-primary" title={deal.name}>
                        {deal.name}
                      </span>
                    </td>
                    <td className="pipeline-deals-td">
                      <p className="truncate" title={leadName}>
                        {leadName}
                      </p>
                      {company && company !== leadName && (
                        <p className="truncate text-[10px] text-gray-400" title={company}>
                          {company}
                        </p>
                      )}
                    </td>
                    <td className="pipeline-deals-td whitespace-nowrap">
                      {freightCustomerTypeLabel(freight?.customerType)}
                    </td>
                    <td className="pipeline-deals-td">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-semibold uppercase ${meta.color}`}
                      >
                        {meta.label}
                      </span>
                    </td>
                    <td className="pipeline-deals-td whitespace-nowrap">
                      {transportModeLabel(freight?.transportMode)}
                    </td>
                    <td className="pipeline-deals-td pipeline-deals-td-route" title={freightRouteLabel(freight)}>
                      {freightRouteLabel(freight)}
                    </td>
                    <td className="pipeline-deals-td pipeline-deals-td-num tabular-nums">
                      {formatWeight(freight?.grossWeightKg)}
                    </td>
                    <td className="pipeline-deals-td pipeline-deals-td-num tabular-nums font-medium">
                      {formatDealValue(deal.amount, deal.currency)}
                    </td>
                    <td className="pipeline-deals-td pipeline-deals-td-num tabular-nums text-gray-600">
                      {formatDealValue(freight?.invoiceAmount, deal.currency)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
