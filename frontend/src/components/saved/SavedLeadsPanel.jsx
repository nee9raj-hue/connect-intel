import { useApp } from '../../context/AppContext'
import { formatCrmDate, getStatusMeta } from '../../lib/crmConstants'

export default function SavedLeadsPanel({ onNavigate }) {
  const { savedLeads, toggleSaveLead, openPipelineLead } = useApp()

  const exportCSV = () => {
    if (!savedLeads.length) return
    const hdr = [
      'First Name',
      'Last Name',
      'Title',
      'Company',
      'Email',
      'Status',
      'Last Email',
      'Response',
    ]
    const rows = savedLeads.map((l) => [
      l.firstName,
      l.lastName,
      l.title,
      l.company,
      l.email,
      l.crm?.status,
      l.crm?.lastEmailSentAt,
      l.crm?.responseReceived ? 'yes' : 'no',
    ])
    const csv = [hdr, ...rows].map((r) => r.map((v) => `"${v || ''}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `saved-leads-${Date.now()}.csv`
    a.click()
  }

  const openInPipeline = (leadId) => {
    openPipelineLead(leadId)
    onNavigate?.('pipeline')
  }

  return (
    <div className="panel-shell bg-[#f6f7f9]">
      <header className="shrink-0 px-4 sm:px-6 py-4 border-b border-gray-200 bg-white">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {savedLeads.length} saved lead{savedLeads.length !== 1 ? 's' : ''}
          </h2>
          <p className="text-sm text-gray-500">Quick list — open Pipeline to email and track status</p>
        </div>
        <div className="flex gap-2">
          {savedLeads.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => onNavigate?.('pipeline')}
                className="px-4 py-2 text-sm font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-800"
              >
                Open pipeline
              </button>
              <button
                type="button"
                onClick={exportCSV}
                className="px-4 py-2 text-sm font-semibold border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Export CSV
              </button>
            </>
          )}
        </div>
      </div>
      </header>

      <div className="panel-body-scroll p-4 sm:p-6">
      {savedLeads.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <div className="text-4xl mb-3">★</div>
          <h3 className="font-semibold text-gray-900 mb-1">No saved leads yet</h3>
          <p className="text-sm text-gray-500 mb-4">Save leads from People Search, then work them in Pipeline</p>
          <button
            type="button"
            onClick={() => onNavigate?.('search')}
            className="px-4 py-2 text-sm font-semibold bg-[#ffcb2b] text-[#242424] rounded-lg"
          >
            Find people
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Name', 'Company', 'Status', 'Last email', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {savedLeads.map((lead) => {
                const meta = getStatusMeta(lead.crm?.status)
                return (
                  <tr key={lead.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">
                      {lead.firstName} {lead.lastName}
                      <div className="text-xs text-gray-500 font-normal">{lead.title}</div>
                    </td>
                    <td className="px-4 py-3">{lead.company}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${meta.color}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {formatCrmDate(lead.crm?.lastEmailSentAt)}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => openInPipeline(lead.id)}
                        className="text-xs font-semibold text-[#8a6600] hover:underline"
                      >
                        Work in pipeline
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleSaveLead(lead)}
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
  )
}
