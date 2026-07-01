import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { getDealStageMeta, getDealStagesForFreight } from '../../lib/crmConstants'
import { formatDealValue } from '../../lib/crmTimeline'
import LoadingExperience from '../ui/LoadingExperience'

export default function OpportunitiesPanel({ onNavigate }) {
  const { openPipelineLead, user } = useApp()
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [applied, setApplied] = useState('')
  const [dealStage, setDealStage] = useState('all')
  const [freightOrg, setFreightOrg] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const stageOptions = useMemo(() => {
    const stages = getDealStagesForFreight(freightOrg)
    return [
      { id: 'all', label: 'All open' },
      ...stages.map((s) => ({ id: s.id, label: s.label })),
      { id: 'won', label: 'Won' },
      { id: 'lost', label: 'Lost' },
    ]
  }, [freightOrg])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.getOpportunitiesHub({
        q: applied,
        dealStage,
        limit: 100,
      })
      setRows(res.opportunities || [])
      setTotal(res.total || 0)
      setFreightOrg(Boolean(res.freightOrg))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [applied, dealStage])

  useEffect(() => {
    load()
  }, [load])

  const openLead = (leadId) => {
    onNavigate?.('pipeline')
    openPipelineLead(leadId, 'overview')
  }

  return (
    <div className="panel-shell">
      <header className="shrink-0 bg-white border-b border-gray-200 px-5 py-4">
        <h1 className="text-lg font-semibold text-gray-900">Opportunities</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Deals across your pipeline — open any opportunity to work the lead record.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50/80">
        <input
          type="search"
          className="flex-1 min-w-[12rem] rounded-lg border border-gray-200 px-3 py-2 text-sm"
          placeholder="Search opportunities…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setApplied(search.trim())
          }}
          aria-label="Search opportunities"
        />
        <button type="button" className="dash-home__btn" onClick={() => setApplied(search.trim())}>
          Search
        </button>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Deal stage filter">
          {stageOptions.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`dash-home__filter-pill${dealStage === s.id ? ' is-active' : ''}`}
              onClick={() => setDealStage(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <LoadingExperience label="Loading opportunities…" />
        ) : error ? (
          <p className="p-4 text-sm text-red-600">{error}</p>
        ) : !rows.length ? (
          <p className="p-4 text-sm text-gray-500">
            No opportunities yet — add deals on pipeline leads or import accounts with deal value.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th scope="col" className="px-5 py-2 font-semibold">
                  Opportunity
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Company
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  Stage
                </th>
                <th scope="col" className="px-3 py-2 font-semibold text-right">
                  Value
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const deal = row.deal || {}
                const meta = getDealStageMeta(deal.stage, { freightOrg })
                return (
                  <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        className="font-medium text-left text-gray-900 hover:text-[#007c89]"
                        onClick={() => openLead(row.leadId)}
                      >
                        {deal.name || row.leadName || 'Untitled deal'}
                      </button>
                      <div className="text-xs text-gray-500">{row.leadName}</div>
                    </td>
                    <td className="px-3 py-3 text-gray-700">{row.company || '—'}</td>
                    <td className="px-3 py-3">
                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                        {meta?.label || deal.stage || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-gray-800">
                      {deal.amount != null
                        ? formatDealValue(deal.amount, deal.currency || user?.currency || 'INR')
                        : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {!loading && total > rows.length ? (
          <p className="px-5 py-2 text-xs text-gray-500">
            Showing {rows.length} of {total} opportunities
          </p>
        ) : null}
      </div>
    </div>
  )
}
