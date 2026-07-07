import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { formatDateTime } from '../../lib/crmUiConstants'
import LoadingExperience from '../ui/LoadingExperience'

export default function CompaniesPanel({ onNavigate }) {
  const { openPipelineLead } = useApp()
  const [companies, setCompanies] = useState([])
  const [total, setTotal] = useState(0)
  const [hierarchyEnabled, setHierarchyEnabled] = useState(false)
  const [search, setSearch] = useState('')
  const [applied, setApplied] = useState('')
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [parentSaving, setParentSaving] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.getCompaniesHub({ q: applied })
      setCompanies(res.companies || [])
      setTotal(res.total || 0)
      setHierarchyEnabled(Boolean(res.hierarchyEnabled))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [applied])

  useEffect(() => {
    load()
  }, [load])

  const openCompany = async (company) => {
    setDetailLoading(true)
    try {
      const res = await api.getCompanyDetail(company.id)
      setDetail(res.company)
      setHierarchyEnabled(Boolean(res.hierarchyEnabled ?? hierarchyEnabled))
    } catch (e) {
      setError(e.message)
    } finally {
      setDetailLoading(false)
    }
  }

  const openLead = (leadId) => {
    onNavigate?.('pipeline')
    openPipelineLead(leadId, 'overview')
  }

  const parentOptions = detail
    ? companies.filter((c) => c.id !== detail.id)
    : []

  const saveParent = async (parentCompanyId) => {
    if (!detail?.id || !hierarchyEnabled) return
    setParentSaving(true)
    setError(null)
    try {
      await api.patchCompanyParent(detail.id, parentCompanyId || null)
      await load()
      const res = await api.getCompanyDetail(detail.id)
      setDetail(res.company)
    } catch (e) {
      setError(e.message)
    } finally {
      setParentSaving(false)
    }
  }

  return (
    <div className="panel-shell">
      <header className="shrink-0 bg-white border-b border-gray-200 px-5 py-4">
        <h1 className="text-lg font-semibold text-gray-900">Accounts</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Company accounts aggregated from your pipeline — contacts, deals, parent/child hierarchy, and activity rolled up by name.
        </p>
      </header>

      <div className="panel-body-scroll p-5 space-y-4">
        <div className="flex flex-wrap gap-2 max-w-xl">
          <input
            className="ci-input flex-1 min-w-[12rem]"
            placeholder="Search companies…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setApplied(search.trim())}
          />
          <button type="button" className="ci-btn ci-btn-accent" onClick={() => setApplied(search.trim())}>
            Search
          </button>
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}

        {loading ? (
          <LoadingExperience label="Loading companies…" />
        ) : (
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="crm-content-card overflow-hidden">
              <p className="text-xs text-gray-500 px-4 py-2 border-b">{total} account{total === 1 ? '' : 's'}</p>
              {!companies.length ? (
                <p className="p-4 text-sm text-gray-500">No companies yet — add company names on pipeline leads.</p>
              ) : (
                <ul className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
                  {companies.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => openCompany(c)}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${detail?.id === c.id ? 'bg-orange-50' : ''}`}
                      >
                        <p className="font-semibold text-sm text-gray-900">{c.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {c.parentName && <span>Under {c.parentName} · </span>}
                          {c.leadCount} contact{c.leadCount === 1 ? '' : 's'}
                          {c.childCount > 0 && ` · ${c.childCount} child account${c.childCount === 1 ? '' : 's'}`}
                          {c.openDeals > 0 && ` · ${c.openDeals} open deal${c.openDeals === 1 ? '' : 's'}`}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="crm-content-card p-4 min-h-[200px]">
              {detailLoading ? (
                <LoadingExperience label="Loading account…" fill={false} />
              ) : !detail ? (
                <p className="text-sm text-gray-500">Select a company to see contacts and deal rollup.</p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">{detail.name}</h2>
                    {detail.domain && <p className="text-xs text-gray-500">{detail.domain}</p>}
                    {detail.parentName && (
                      <p className="text-xs text-gray-600 mt-1">
                        Parent account:{' '}
                        <button
                          type="button"
                          className="text-orange-700 underline"
                          onClick={() => {
                            const parent = companies.find((c) => c.id === detail.parentCompanyId)
                            if (parent) openCompany(parent)
                          }}
                        >
                          {detail.parentName}
                        </button>
                      </p>
                    )}
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-600">
                      <span>{detail.leadCount} contacts</span>
                      <span>{detail.openDeals} open deals</span>
                      <span>{detail.wonDeals} won</span>
                      {detail.lastActivityAt && (
                        <span>Last activity {formatDateTime(detail.lastActivityAt)}</span>
                      )}
                    </div>
                  </div>

                  {hierarchyEnabled && (
                    <div>
                      <h3 className="text-xs font-semibold uppercase text-gray-400 mb-2">Parent account</h3>
                      <select
                        className="ci-input w-full text-sm"
                        disabled={parentSaving}
                        value={detail.parentCompanyId || ''}
                        onChange={(e) => saveParent(e.target.value || null)}
                      >
                        <option value="">None (top-level account)</option>
                        {parentOptions.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-gray-500 mt-1">
                        Group subsidiaries under a parent account (constitution P1 hierarchy).
                      </p>
                    </div>
                  )}

                  {(detail.children || []).length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold uppercase text-gray-400 mb-2">Child accounts</h3>
                      <ul className="space-y-1">
                        {detail.children.map((child) => (
                          <li key={child.id}>
                            <button
                              type="button"
                              onClick={() => {
                                const row = companies.find((c) => c.id === child.id) || child
                                openCompany(row)
                              }}
                              className="text-sm text-orange-700 hover:underline"
                            >
                              {child.name}
                              {child.leadCount != null && ` (${child.leadCount} contacts)`}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <h3 className="text-xs font-semibold uppercase text-gray-400 mb-2">Contacts</h3>
                    <ul className="space-y-2 max-h-[45vh] overflow-y-auto">
                      {(detail.leads || []).map((lead) => (
                        <li key={lead.id}>
                          <button
                            type="button"
                            onClick={() => openLead(lead.id)}
                            className="w-full text-left border border-gray-100 rounded-lg px-3 py-2 hover:border-orange-200"
                          >
                            <p className="text-sm font-medium text-gray-900">{lead.name || lead.email}</p>
                            <p className="text-xs text-gray-500">
                              {lead.status}
                              {lead.leadScore != null && ` · score ${lead.leadScore}`}
                            </p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
