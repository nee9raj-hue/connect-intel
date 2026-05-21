import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { CRM_STATUSES, formatCrmDate, getStatusMeta } from '../../lib/crmConstants'
import LeadWorkspace from './LeadWorkspace'

export default function PipelinePanel({ onNavigate }) {
  const {
    savedLeads,
    toggleSaveLead,
    pipelineLeadId,
    setPipelineLeadId,
    openPipelineLead,
  } = useApp()
  const [view, setView] = useState('board')
  const [filter, setFilter] = useState('all')

  const selectedLead = useMemo(
    () => savedLeads.find((l) => l.id === pipelineLeadId) || null,
    [savedLeads, pipelineLeadId]
  )

  useEffect(() => {
    if (pipelineLeadId && !selectedLead) {
      setPipelineLeadId(null)
    }
  }, [pipelineLeadId, selectedLead, setPipelineLeadId])

  const filtered = useMemo(() => {
    if (filter === 'all') return savedLeads
    return savedLeads.filter((l) => (l.crm?.status || 'new') === filter)
  }, [savedLeads, filter])

  const byStatus = useMemo(() => {
    const map = Object.fromEntries(CRM_STATUSES.map((s) => [s.id, []]))
    for (const lead of savedLeads) {
      const st = lead.crm?.status || 'new'
      if (map[st]) map[st].push(lead)
    }
    return map
  }, [savedLeads])

  const stats = useMemo(
    () => ({
      total: savedLeads.length,
      contacted: savedLeads.filter((l) => l.crm?.lastEmailSentAt).length,
      replied: savedLeads.filter((l) => l.crm?.responseReceived).length,
    }),
    [savedLeads]
  )

  return (
    <div className="flex h-full min-h-0">
      <div className="flex-1 flex flex-col min-w-0">
        <header className="shrink-0 bg-white border-b border-gray-200 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Pipeline</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Mini CRM — work saved leads, track status, and send AI-assisted email
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigate?.('search')}
                className="text-xs font-medium px-3 py-1.5 border border-gray-200 rounded-md hover:bg-gray-50"
              >
                + Find people
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-4">
            <div className="flex gap-2 text-xs">
              <MiniStat label="Saved" value={stats.total} />
              <MiniStat label="Emailed" value={stats.contacted} />
              <MiniStat label="Replied" value={stats.replied} />
            </div>
            <div className="flex gap-1 ml-auto">
              {[
                { id: 'board', label: 'Board' },
                { id: 'list', label: 'List' },
              ].map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setView(v.id)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold ${
                    view === v.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {view === 'list' && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label="All" />
              {CRM_STATUSES.map((s) => (
                <FilterChip
                  key={s.id}
                  active={filter === s.id}
                  onClick={() => setFilter(s.id)}
                  label={s.label}
                />
              ))}
            </div>
          )}
        </header>

        <div className="flex-1 overflow-auto p-4">
          {savedLeads.length === 0 ? (
            <EmptyPipeline onNavigate={onNavigate} />
          ) : view === 'board' ? (
            <div className="flex gap-3 min-h-[320px] overflow-x-auto pb-2">
              {CRM_STATUSES.map((col) => (
                <KanbanColumn
                  key={col.id}
                  column={col}
                  leads={byStatus[col.id] || []}
                  selectedId={pipelineLeadId}
                  onSelect={openPipelineLead}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Name', 'Company', 'Status', 'Last email', 'Response', ''].map((h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((lead) => {
                    const meta = getStatusMeta(lead.crm?.status)
                    return (
                      <tr
                        key={lead.id}
                        className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                          pipelineLeadId === lead.id ? 'bg-[#fffbeb]' : ''
                        }`}
                        onClick={() => openPipelineLead(lead.id)}
                      >
                        <td className="px-4 py-3 font-medium">
                          {lead.firstName} {lead.lastName}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{lead.company}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${meta.color}`}>
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {formatCrmDate(lead.crm?.lastEmailSentAt)}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {lead.crm?.responseReceived ? (
                            <span className="text-green-700 font-medium">Yes</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleSaveLead(lead)
                            }}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selectedLead && (
        <LeadWorkspace lead={selectedLead} onClose={() => setPipelineLeadId(null)} />
      )}
    </div>
  )
}

function KanbanColumn({ column, leads, selectedId, onSelect }) {
  return (
    <div className="w-[220px] shrink-0 flex flex-col bg-gray-100/80 rounded-xl border border-gray-200/80">
      <div className="px-3 py-2.5 border-b border-gray-200/60 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700">{column.label}</span>
        <span className="text-[10px] font-bold text-gray-500 bg-white px-1.5 py-0.5 rounded">{leads.length}</span>
      </div>
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-220px)]">
        {leads.length === 0 ? (
          <p className="text-[10px] text-gray-400 text-center py-4">No leads</p>
        ) : (
          leads.map((lead) => (
            <button
              key={lead.id}
              type="button"
              onClick={() => onSelect(lead.id)}
              className={`w-full text-left p-2.5 rounded-lg border bg-white hover:border-[#ffcb2b]/60 transition-colors ${
                selectedId === lead.id ? 'border-[#ffcb2b] ring-1 ring-[#ffcb2b]/30' : 'border-gray-200'
              }`}
            >
              <div className="text-xs font-semibold text-gray-900 truncate">
                {lead.firstName} {lead.lastName}
              </div>
              <div className="text-[10px] text-gray-500 truncate mt-0.5">{lead.company}</div>
              {lead.crm?.lastEmailSentAt && (
                <div className="text-[10px] text-gray-400 mt-1">
                  Emailed {formatCrmDate(lead.crm.lastEmailSentAt)}
                </div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  )
}

function EmptyPipeline({ onNavigate }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto">
      <p className="text-4xl mb-3">◎</p>
      <h3 className="font-semibold text-gray-900 mb-1">Your pipeline is empty</h3>
      <p className="text-sm text-gray-500 leading-relaxed">
        Save leads from People Search, then manage status, notes, and email outreach here.
      </p>
      <button
        type="button"
        onClick={() => onNavigate?.('search')}
        className="mt-5 px-5 py-2.5 bg-[#ffcb2b] text-[#242424] text-sm font-semibold rounded-lg hover:bg-[#f0bc00]"
      >
        Go to People Search
      </button>
    </div>
  )
}

function MiniStat({ label, value }) {
  return (
    <span className="px-2.5 py-1 rounded-md bg-gray-100 text-gray-700 font-medium">
      {label}: <strong>{value}</strong>
    </span>
  )
}

function FilterChip({ active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs font-medium ${
        active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  )
}
