import { useApp } from '../../context/AppContext'
import ResultsTable from './ResultsTable'

export const FULL_DETAIL_PREVIEW_COUNT = 10

export default function SearchResultsView({
  leads,
  selected,
  onSelectAll,
  onSelect,
  onSave,
  onWorkOnLead,
  onRevealField,
  revealingKey,
  fullPreviewCount = FULL_DETAIL_PREVIEW_COUNT,
  allSelected,
}) {
  const detailed = leads.slice(0, fullPreviewCount)
  const compact = leads.slice(fullPreviewCount)

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-[#fafafa]">
      {detailed.length > 0 && (
        <section className="bg-white border-b border-gray-200">
          <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-white/95 backdrop-blur border-b border-gray-100">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Full contact details</h2>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Email and phone shown for the top {detailed.length} matches
              </p>
            </div>
            <span className="text-[11px] font-semibold text-[#5b4a00] bg-[#fff6d6] px-2.5 py-1 rounded-full border border-[#ffe48a]">
              {detailed.length} unlocked preview{detailed.length === 1 ? '' : 's'}
            </span>
          </div>
          <ResultsTable
            leads={detailed}
            selected={selected}
            allSelected={allSelected}
            onSelectAll={onSelectAll}
            onSelect={onSelect}
            onSave={onSave}
            onWorkOnLead={onWorkOnLead}
            onRevealField={onRevealField}
            revealingKey={revealingKey}
            embedded
          />
        </section>
      )}

      {compact.length > 0 && (
        <section>
          <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-gray-50/95 backdrop-blur border-b border-gray-200">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">More matches</h2>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Company and role visible · contact details hidden until unlock
              </p>
            </div>
            <span className="text-[11px] font-medium text-gray-600 bg-white px-2.5 py-1 rounded-full border border-gray-200">
              {compact.length} summarized
            </span>
          </div>
          <CompactResultsList
            leads={compact}
            selected={selected}
            onSelect={onSelect}
            onSave={onSave}
            onWorkOnLead={onWorkOnLead}
            onRevealField={onRevealField}
            revealingKey={revealingKey}
          />
        </section>
      )}
    </div>
  )
}

function CompactResultsList({
  leads,
  selected,
  onSelect,
  onSave,
  onWorkOnLead,
  onRevealField,
  revealingKey,
}) {
  const { isSaved } = useApp()

  return (
    <ul className="divide-y divide-gray-100 bg-white">
      {leads.map((lead) => {
        const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'Contact'
        const masked = lead.access?.emailLocked || lead.access?.phoneLocked
        return (
          <li
            key={lead.id}
            className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50/80 transition-colors group"
          >
            <input
              type="checkbox"
              checked={selected.includes(lead.id)}
              onChange={() => onSelect(lead.id)}
              className="rounded mt-1 shrink-0"
            />
            <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-[11px] font-bold text-gray-500 shrink-0">
              {name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2) || '?'}
            </div>
            <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-x-4 gap-y-1">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                <p className="text-[12px] text-gray-600 truncate">{lead.title || '—'}</p>
                <p className="text-[12px] font-medium text-gray-800 truncate mt-0.5">{lead.company}</p>
              </div>
              <div className="min-w-0 text-[12px] text-gray-500">
                <p className="truncate">{lead.location || [lead.city, lead.state].filter(Boolean).join(', ') || '—'}</p>
                {lead.industry && <p className="truncate text-gray-400">{lead.industry}</p>}
                {(lead.access?.emailLocked || lead.access?.phoneLocked) && (
                  <p className="text-[11px] text-amber-700/90 mt-1 font-medium">
                    Tap email or phone in full-detail rows · ₹1 each
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 md:justify-end flex-wrap">
                <ScorePill score={lead.score} />
                {isSaved(lead.id) && onWorkOnLead && (
                  <button
                    type="button"
                    onClick={() => onWorkOnLead(lead)}
                    className="text-[11px] font-semibold px-2 py-1 rounded border border-[#8a6600]/30 text-[#8a6600] bg-[#fffbeb]"
                  >
                    Pipeline
                  </button>
                )}
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
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function ScorePill({ score }) {
  const n = score || 0
  const cls =
    n >= 85 ? 'bg-green-100 text-green-800' : n >= 70 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${cls}`}>{n}</span>
  )
}
