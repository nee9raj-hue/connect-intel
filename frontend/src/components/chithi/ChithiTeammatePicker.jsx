import { useMemo, useState } from 'react'

export default function ChithiTeammatePicker({ members = [], onSelect, busy = false, loading = false, onCancel }) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = members || []
    if (!q) return list
    return list.filter((m) => {
      const hay = [m.name, m.email].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [members, query])

  return (
    <div className="chithi-picker rounded-xl border border-[#e5e9ee] bg-white shadow-sm overflow-hidden">
      <div className="px-2.5 py-2 border-b border-[#eef2f6] flex items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search teammates…"
          className="flex-1 text-[12px] border border-[#e5e9ee] rounded-lg px-2 py-1.5 bg-[#fafbfc]"
          autoFocus
        />
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-[11px] font-semibold text-[#6b7785] px-1">
            Cancel
          </button>
        )}
      </div>
      <ul className="max-h-52 overflow-y-auto py-1">
        {loading ? (
          <li className="px-3 py-3 text-[11px] text-[#6b7785]">Loading teammates…</li>
        ) : filtered.length === 0 ? (
          <li className="px-3 py-3 text-[11px] text-[#6b7785]">
            {query.trim()
              ? 'No teammates match your search.'
              : members.length === 0
                ? 'No teammates in your org.'
                : 'No teammates match your search.'}
          </li>
        ) : (
          filtered.map((m) => (
            <li key={m.userId}>
              <button
                type="button"
                disabled={busy}
                onClick={() => onSelect(m.userId)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[#f0f3f6] disabled:opacity-50 transition-colors"
              >
                <span className="w-8 h-8 rounded-full bg-[#ff7a59]/15 text-[#c45a3d] flex items-center justify-center text-xs font-bold shrink-0">
                  {(m.name || m.email || '?')[0]?.toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block text-[12px] font-semibold text-[#17191c] truncate">
                    {m.name || m.email}
                  </span>
                  {m.name && m.email ? (
                    <span className="block text-[10px] text-[#6b7785] truncate">{m.email}</span>
                  ) : null}
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
