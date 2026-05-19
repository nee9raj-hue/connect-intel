import { useApp } from '../../context/AppContext'

export default function SavedLeadsPanel() {
  const { savedLeads, toggleSaveLead } = useApp()

  const exportCSV = () => {
    if (!savedLeads.length) return
    const hdr = ['First Name', 'Last Name', 'Title', 'Company', 'Email', 'Phone', 'Location', 'Score']
    const rows = savedLeads.map((l) => [
      l.firstName,
      l.lastName,
      l.title,
      l.company,
      l.email,
      l.phone,
      l.location,
      l.score,
    ])
    const csv = [hdr, ...rows].map((r) => r.map((v) => `"${v || ''}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `saved-leads-${Date.now()}.csv`
    a.click()
  }

  return (
    <div className="p-6 h-[calc(100vh-3.5rem)] overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {savedLeads.length} saved lead{savedLeads.length !== 1 ? 's' : ''}
          </h2>
          <p className="text-sm text-gray-500">Leads you've saved from search results</p>
        </div>
        {savedLeads.length > 0 && (
          <button
            onClick={exportCSV}
            className="px-4 py-2 text-sm font-semibold border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Export CSV
          </button>
        )}
      </div>

      {savedLeads.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
          <div className="text-4xl mb-3">★</div>
          <h3 className="font-semibold text-gray-900 mb-1">No saved leads yet</h3>
          <p className="text-sm text-gray-500">Save leads from People Search to build your list</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Name', 'Title', 'Company', 'Email', 'Location', 'Score', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {savedLeads.map((lead) => (
                <tr key={lead.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    {lead.firstName} {lead.lastName}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{lead.title}</td>
                  <td className="px-4 py-3">{lead.company}</td>
                  <td className="px-4 py-3 font-mono text-xs">{lead.email}</td>
                  <td className="px-4 py-3 text-gray-600">{lead.location}</td>
                  <td className="px-4 py-3 font-bold">{lead.score}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleSaveLead(lead)}
                      className="text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
