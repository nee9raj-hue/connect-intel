import { useApp } from '../../context/AppContext'
import { getSourceLabel } from '../../lib/productCopy'

export default function ResultsTable({
  leads,
  selected,
  onSelectAll,
  onSelect,
  onSave,
  onWorkOnLead,
  onUnlock,
  unlockingLeadId,
}) {
  const { isSaved } = useApp()
  const allSelected = leads.length > 0 && selected.length === leads.length

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
      <table className="w-full text-[13px]">
        <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10 shadow-sm">
          <tr className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
            <th className="w-10 py-2.5 pl-4">
              <input type="checkbox" checked={allSelected} onChange={onSelectAll} className="rounded" />
            </th>
            <th className="py-2.5 pr-2 min-w-[160px]">Name</th>
            <th className="py-2.5 pr-2 min-w-[120px]">Job title</th>
            <th className="py-2.5 pr-2 min-w-[140px]">Company</th>
            <th className="py-2.5 pr-2 min-w-[200px]">Email</th>
            <th className="py-2.5 pr-2 min-w-[130px]">Phone</th>
            <th className="py-2.5 pr-2">Location</th>
            <th className="py-2.5 pr-2 w-14 text-center">Score</th>
            <th className="py-2.5 pr-4 w-[160px]" />
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr
              key={lead.id}
              className="border-b border-gray-100 hover:bg-[#fffbeb]/40 group"
            >
              <td className="py-2.5 pl-4 align-top">
                <input
                  type="checkbox"
                  checked={selected.includes(lead.id)}
                  onChange={() => onSelect(lead.id)}
                  className="rounded"
                />
              </td>
              <td className="py-2.5 pr-2 align-top">
                <div className="flex items-center gap-2">
                  <Avatar name={`${lead.firstName} ${lead.lastName}`} />
                  <div>
                    <div className="font-medium text-gray-900">
                      {[lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'Contact not named'}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {lead.source && <SourceBadge source={lead.source} />}
                      {lead.access?.previewUnlocked && !lead.access?.previouslyUnlocked && (
                        <MiniBadge tone="amber">Preview</MiniBadge>
                      )}
                    </div>
                  </div>
                </div>
              </td>
              <td className="py-2.5 pr-2 text-gray-700 align-top">{lead.title}</td>
              <td className="py-2.5 pr-2 align-top">
                <div className="font-medium text-gray-900">{lead.company}</div>
                {lead.companyDomain && (
                  <div className="text-[11px] text-gray-400">{lead.companyDomain}</div>
                )}
              </td>
              <td className="py-2.5 pr-2 align-top">
                <ContactValue
                  value={lead.email}
                  href={lead.email && lead.access?.isUnlocked !== false ? `mailto:${lead.email}` : undefined}
                  missingLabel="Missing email"
                  mono
                />
              </td>
              <td className="py-2.5 pr-2 align-top">
                <ContactValue
                  value={lead.phone}
                  href={lead.phone && lead.access?.isUnlocked !== false ? `tel:${lead.phone}` : undefined}
                  missingLabel="Missing phone"
                />
              </td>
              <td className="py-2.5 pr-2 text-gray-600 whitespace-nowrap align-top">{lead.location}</td>
              <td className="py-2.5 pr-2 text-center align-top">
                <ScoreBadge score={lead.score} />
              </td>
              <td className="py-2.5 pr-4 align-top">
                <div className="flex items-center justify-end gap-2 flex-wrap">
                  {lead.access?.unlockable && !lead.access?.isUnlocked && (
                    <button
                      type="button"
                      onClick={() => onUnlock?.(lead)}
                      disabled={unlockingLeadId === lead.id}
                      className="text-[11px] font-semibold px-2.5 py-1.5 rounded border border-[#ffcb2b] bg-[#fffbdf] text-[#8a6600] hover:bg-[#fff4bf] disabled:opacity-60"
                    >
                      {unlockingLeadId === lead.id
                        ? 'Unlocking…'
                        : `Unlock Rs ${(lead.access.unlockPricePaise || 0) / 100}`}
                    </button>
                  )}
                  {isSaved(lead.id) && onWorkOnLead && (
                    <button
                      type="button"
                      onClick={() => onWorkOnLead(lead)}
                      className="text-[11px] font-semibold px-2 py-1.5 rounded border border-[#8a6600]/30 text-[#8a6600] bg-[#fffbeb] hover:bg-[#fff4bf]"
                    >
                      Pipeline
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onSave(lead)}
                    className={`text-[11px] font-semibold px-2 py-1.5 rounded border ${
                      isSaved(lead.id)
                        ? 'border-green-500 text-green-700 bg-green-50'
                        : 'border-gray-200 text-gray-600 opacity-0 group-hover:opacity-100 hover:border-gray-400'
                    } ${isSaved(lead.id) ? 'opacity-100' : ''}`}
                  >
                    {isSaved(lead.id) ? 'Saved' : '+ Save'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ContactValue({ value, href, missingLabel, mono = false }) {
  if (!value) {
    return <span className="text-[11px] text-red-600 font-medium">{missingLabel}</span>
  }

  const className = `text-[12px] text-gray-800 break-all ${mono ? 'font-mono' : ''}`

  if (href && !value.includes('•')) {
    return (
      <a href={href} className={`${className} hover:text-[#8a6600] hover:underline`}>
        {value}
      </a>
    )
  }

  return <span className={className}>{value}</span>
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

function SourceBadge({ source }) {
  const label = getSourceLabel(source)
  const tone =
    source === 'database' || source === 'demo' || source === 'demo-india'
      ? 'bg-blue-50 text-blue-700 border-blue-200'
      : source === 'claude' || source === 'ai-discovery'
        ? 'bg-violet-50 text-violet-700 border-violet-200'
        : 'bg-gray-50 text-gray-600 border-gray-200'

  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${tone}`}>
      {label}
    </span>
  )
}

function MiniBadge({ children, tone = 'gray' }) {
  const classes = {
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    gray: 'bg-gray-50 text-gray-600 border-gray-200',
  }

  return <span className={`text-[10px] px-1.5 py-0.5 rounded border ${classes[tone]}`}>{children}</span>
}

function ScoreBadge({ score }) {
  const n = score || 0
  const cls =
    n >= 85 ? 'bg-green-100 text-green-800' : n >= 70 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'
  return <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-bold ${cls}`}>{n}</span>
}
