import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { formatCrmDate, getStatusMeta, getVisiblePipelineColumns } from '../../lib/crmConstants'
import LeadWorkspace from './LeadWorkspace'
import PipelineImportModal from './PipelineImportModal'
import BulkEmailModal from './BulkEmailModal'
import AddLeadModal from './AddLeadModal'

export default function PipelinePanel({ onNavigate }) {
  const {
    user,
    savedLeads,
    toggleSaveLead,
    pipelineLeadId,
    setPipelineLeadId,
    openPipelineLead,
    refreshSavedLeads,
    pipelineAssigneeFilter,
    setPipelineAssigneeFilter,
    teamMembers,
  } = useApp()

  const columns = useMemo(() => getVisiblePipelineColumns(user), [user])
  const [view, setView] = useState('board')
  const [filter, setFilter] = useState('all')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [importOpen, setImportOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)

  const selectedLead = useMemo(
    () => savedLeads.find((l) => l.id === pipelineLeadId) || null,
    [savedLeads, pipelineLeadId]
  )

  useEffect(() => {
    if (pipelineLeadId && !selectedLead) {
      setPipelineLeadId(null)
    }
  }, [pipelineLeadId, selectedLead, setPipelineLeadId])

  const assigneeName = useMemo(() => {
    if (!pipelineAssigneeFilter) return null
    const m = teamMembers.find((t) => t.userId === pipelineAssigneeFilter)
    return m?.name || 'Team member'
  }, [pipelineAssigneeFilter, teamMembers])

  const scopedLeads = useMemo(() => {
    if (!pipelineAssigneeFilter) return savedLeads
    return savedLeads.filter((l) => (l.assignedToUserId || l.savedByUserId) === pipelineAssigneeFilter)
  }, [savedLeads, pipelineAssigneeFilter])

  const filtered = useMemo(() => {
    const base = scopedLeads
    if (filter === 'all') return base
    return base.filter((l) => (l.crm?.status || 'new') === filter)
  }, [scopedLeads, filter])

  const byStatus = useMemo(() => {
    const map = Object.fromEntries(columns.map((s) => [s.id, []]))
    const hidden = []
    for (const lead of scopedLeads) {
      const st = lead.crm?.status || 'new'
      if (map[st]) map[st].push(lead)
      else hidden.push(lead)
    }
    if (hidden.length && map[columns[0]?.id]) {
      map[columns[0].id].push(...hidden)
    }
    return map
  }, [scopedLeads, columns])

  const stats = useMemo(
    () => ({
      total: scopedLeads.length,
      contacted: scopedLeads.filter((l) => l.crm?.lastEmailSentAt).length,
      replied: scopedLeads.filter((l) => l.crm?.responseReceived).length,
    }),
    [scopedLeads]
  )

  return (
    <div className="flex h-full min-h-0 relative">
      <div className={`flex-1 flex flex-col min-w-0 ${selectedLead ? 'hidden md:flex' : 'flex'}`}>
        <header className="shrink-0 bg-white border-b border-gray-200 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Pipeline</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {savedLeads.length === 0
                  ? 'Start building your pipeline — then use AI prospect search for new leads'
                  : `Mini CRM — ${columns.map((c) => c.label).join(', ')}`}
              </p>
              {assigneeName && (
                <p className="text-xs text-[#8a6600] mt-1 flex items-center gap-2">
                  Showing: <strong>{assigneeName}</strong>
                  <button
                    type="button"
                    className="underline"
                    onClick={() => setPipelineAssigneeFilter?.(null)}
                  >
                    Clear
                  </button>
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="text-xs font-semibold px-3 py-1.5 bg-gray-900 text-white rounded-md"
              >
                + Add lead
              </button>
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="text-xs font-medium px-3 py-1.5 border border-[#ffcb2b] bg-[#fffbeb] rounded-md hover:bg-[#fff6d6]"
              >
                Import CSV
              </button>
              {selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setBulkOpen(true)}
                  className="text-xs font-semibold px-3 py-1.5 bg-gray-900 text-white rounded-md"
                >
                  Email selected ({selectedIds.size})
                </button>
              )}
              <button
                type="button"
                onClick={() => onNavigate?.('search')}
                className="text-xs font-medium px-3 py-1.5 border border-gray-200 rounded-md hover:bg-gray-50"
              >
                AI prospect search
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
              {columns.map((s) => (
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
            <EmptyPipeline
              onNavigate={onNavigate}
              onImport={() => setImportOpen(true)}
              onAdd={() => setAddOpen(true)}
            />
          ) : view === 'board' ? (
            <div className="flex gap-3 min-h-[320px] overflow-x-auto pb-2">
              {columns.map((col) => (
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
                    <th className="w-10 px-2 py-3">
                      <input
                        type="checkbox"
                        checked={filtered.length > 0 && filtered.every((l) => selectedIds.has(l.id))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(new Set(filtered.map((l) => l.id)))
                          } else {
                            setSelectedIds(new Set())
                          }
                        }}
                        aria-label="Select all"
                      />
                    </th>
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
                        <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(lead.id)}
                            onChange={(e) => {
                              setSelectedIds((prev) => {
                                const next = new Set(prev)
                                if (e.target.checked) next.add(lead.id)
                                else next.delete(lead.id)
                                return next
                              })
                            }}
                            aria-label="Select lead"
                          />
                        </td>
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
        <LeadWorkspace
          lead={selectedLead}
          statusOptions={columns}
          onClose={() => setPipelineLeadId(null)}
        />
      )}

      <AddLeadModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={() => refreshSavedLeads()}
      />
      <PipelineImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          refreshSavedLeads()
          setImportOpen(false)
        }}
      />
      <BulkEmailModal
        open={bulkOpen}
        leadIds={[...selectedIds]}
        leads={savedLeads.filter((l) => selectedIds.has(l.id))}
        onClose={() => setBulkOpen(false)}
        onDone={() => {
          setBulkOpen(false)
          setSelectedIds(new Set())
          refreshSavedLeads()
        }}
      />
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

function EmptyPipeline({ onNavigate, onImport, onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center max-w-lg mx-auto px-4">
      <div className="w-full rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#8a6600] mb-2">Step 1 — CRM</p>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Build your pipeline first</h3>
        <p className="text-sm text-gray-500 leading-relaxed">
          Connect Intel is your team CRM. Add or import the leads you are already working, assign owners, and
          track follow-ups. When your pipeline is ready, use AI prospect search to find new opportunities.
        </p>
        <div className="flex flex-col gap-2 mt-6">
          <button
            type="button"
            onClick={() => onAdd?.()}
            className="px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-lg"
          >
            Add lead manually
          </button>
          <button
            type="button"
            onClick={onImport}
            className="px-5 py-2.5 border-2 border-[#ffcb2b] text-[#242424] text-sm font-semibold rounded-lg"
          >
            Import CSV / Excel
          </button>
        </div>
        <div className="mt-8 pt-6 border-t border-gray-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Step 2 — AI</p>
          <button
            type="button"
            onClick={() => onNavigate?.('search')}
            className="w-full px-5 py-2.5 border border-gray-200 text-gray-800 text-sm font-medium rounded-lg hover:bg-gray-50"
          >
            Search prospects with AI
          </button>
          <p className="text-[11px] text-gray-400 mt-2">50+ matches · 5 full previews · unlock with credits</p>
        </div>
      </div>
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
