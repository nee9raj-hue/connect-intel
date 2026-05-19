import { useApp } from '../../context/AppContext'

export default function ResultsTable({ leads, selected, onSelectAll, onSelect, onSave }) {
  const { isSaved } = useApp()
  const allSelected = leads.length > 0 && selected.length === leads.length

  if (!leads.length) return null

  return (
    <div className="flex-1 overflow-auto bg-white">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
          <tr>
            <th className="w-10 px-4 py-3">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onSelectAll}
                className="rounded border-gray-300"
              />
            </th>
            <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
              Name
            </th>
            <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
              Title
            </th>
            <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
              Company
            </th>
            <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
              Email
            </th>
            <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
              Location
            </th>
            <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
              Industry
            </th>
            <th className="text-left px-3 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">
              Score
            </th>
            <th className="w-28 px-3 py-3" />
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr
              key={lead.id}
              className="border-b border-gray-100 hover:bg-amber-50/30 transition-colors group"
            >
              <td className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={selected.includes(lead.id)}
                  onChange={() => onSelect(lead.id)}
                  className="rounded border-gray-300"
                />
              </td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-2.5">
                  <Avatar name={`${lead.firstName} ${lead.lastName}`} />
                  <div>
                    <div className="font-medium text-gray-900">
                      {lead.firstName} {lead.lastName}
                    </div>
                    <div className="text-xs text-gray-400">{lead.employees} employees</div>
                  </div>
                </div>
              </td>
              <td className="px-3 py-3 text-gray-700 max-w-[160px] truncate">{lead.title}</td>
              <td className="px-3 py-3">
                <div className="font-medium text-gray-900">{lead.company}</div>
                <div className="text-xs text-gray-400">{lead.companyDomain}</div>
              </td>
              <td className="px-3 py-3">
                <EmailCell email={lead.email} status={lead.emailStatus} />
              </td>
              <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{lead.location}</td>
              <td className="px-3 py-3 text-gray-600">{lead.industry}</td>
              <td className="px-3 py-3">
                <ScoreBadge score={lead.score} />
              </td>
              <td className="px-3 py-3">
                <button
                  onClick={() => onSave(lead)}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-md border transition-colors ${
                    isSaved(lead.id)
                      ? 'border-green-500 text-green-600 bg-green-50'
                      : 'border-gray-200 text-gray-600 hover:border-gray-400 opacity-0 group-hover:opacity-100'
                  } ${isSaved(lead.id) ? 'opacity-100' : ''}`}
                >
                  {isSaved(lead.id) ? '✓ Saved' : '+ Save'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Avatar({ name }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
  const colors = [
    'bg-blue-100 text-blue-700',
    'bg-purple-100 text-purple-700',
    'bg-amber-100 text-amber-700',
    'bg-teal-100 text-teal-700',
  ]
  const color = colors[name.charCodeAt(0) % colors.length]
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${color}`}>
      {initials}
    </div>
  )
}

function EmailCell({ email, status }) {
  const statusColors = {
    verified: 'bg-green-100 text-green-700',
    likely: 'bg-amber-100 text-amber-700',
    unverified: 'bg-gray-100 text-gray-500',
  }
  return (
    <div>
      <div className="text-gray-800 font-mono text-xs">{email}</div>
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${statusColors[status] || statusColors.unverified}`}>
        {status}
      </span>
    </div>
  )
}

function ScoreBadge({ score }) {
  const color =
    score >= 85 ? 'bg-green-100 text-green-700' : score >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-xs font-bold ${color}`}>
      {score}
    </span>
  )
}
