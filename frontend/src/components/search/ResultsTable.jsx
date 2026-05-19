import { useApp } from '../../context/AppContext'

export default function ResultsTable({ leads, selected, onSelectAll, onSelect, onSave }) {
  const { isSaved } = useApp()
  const allSelected = leads.length > 0 && selected.length === leads.length

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-[13px]">
        <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
          <tr className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
            <th className="w-10 py-2.5 pl-4">
              <input type="checkbox" checked={allSelected} onChange={onSelectAll} className="rounded" />
            </th>
            <th className="py-2.5 pr-2 min-w-[180px]">Name</th>
            <th className="py-2.5 pr-2 min-w-[140px]">Job title</th>
            <th className="py-2.5 pr-2 min-w-[160px]">Company</th>
            <th className="py-2.5 pr-2 w-24">Contact</th>
            <th className="py-2.5 pr-2">Location</th>
            <th className="py-2.5 pr-2 w-16 text-center">Score</th>
            <th className="py-2.5 pr-4 w-20" />
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr
              key={lead.id}
              className="border-b border-gray-100 hover:bg-[#fffbeb]/40 group"
            >
              <td className="py-2.5 pl-4">
                <input
                  type="checkbox"
                  checked={selected.includes(lead.id)}
                  onChange={() => onSelect(lead.id)}
                  className="rounded"
                />
              </td>
              <td className="py-2.5 pr-2">
                <div className="flex items-center gap-2">
                  <Avatar name={`${lead.firstName} ${lead.lastName}`} />
                  <div>
                    <div className="font-medium text-gray-900">
                      {lead.firstName} {lead.lastName}
                    </div>
                    {lead.source && (
                      <span className="text-[10px] text-gray-400 capitalize">{lead.source}</span>
                    )}
                  </div>
                </div>
              </td>
              <td className="py-2.5 pr-2 text-gray-700">{lead.title}</td>
              <td className="py-2.5 pr-2">
                <div className="font-medium text-gray-900">{lead.company}</div>
                <div className="text-[11px] text-gray-400">{lead.companyDomain}</div>
              </td>
              <td className="py-2.5 pr-2">
                <ContactIcons email={lead.email} status={lead.emailStatus} phone={lead.phone} />
              </td>
              <td className="py-2.5 pr-2 text-gray-600 whitespace-nowrap">{lead.location}</td>
              <td className="py-2.5 pr-2 text-center">
                <ScoreBadge score={lead.score} />
              </td>
              <td className="py-2.5 pr-4">
                <button
                  type="button"
                  onClick={() => onSave(lead)}
                  className={`text-[11px] font-semibold px-2 py-1 rounded border ${
                    isSaved(lead.id)
                      ? 'border-green-500 text-green-700 bg-green-50'
                      : 'border-gray-200 text-gray-600 opacity-0 group-hover:opacity-100 hover:border-gray-400'
                  } ${isSaved(lead.id) ? 'opacity-100' : ''}`}
                >
                  {isSaved(lead.id) ? 'Saved' : '+ Save'}
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
  return (
    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-[11px] font-bold text-gray-600 shrink-0">
      {initials}
    </div>
  )
}

function ContactIcons({ email, status, phone }) {
  const emailOk = status === 'verified'
  return (
    <div className="flex items-center gap-1.5">
      <span
        title={email}
        className={`w-7 h-7 rounded flex items-center justify-center text-[10px] font-bold ${
          emailOk ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
        }`}
      >
        ✉
      </span>
      <span
        title={phone}
        className={`w-7 h-7 rounded flex items-center justify-center text-[10px] ${
          phone ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-300'
        }`}
      >
        📞
      </span>
    </div>
  )
}

function ScoreBadge({ score }) {
  const n = score || 0
  const cls =
    n >= 85 ? 'bg-green-100 text-green-800' : n >= 70 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'
  return <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-bold ${cls}`}>{n}</span>
}
