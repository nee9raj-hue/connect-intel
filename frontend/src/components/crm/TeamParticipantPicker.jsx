export default function TeamParticipantPicker({ members, primaryUserId, value, onChange, label = 'Also with (team)' }) {
  if (!members?.length) return null

  const selected = new Set(value || [])

  const toggle = (userId) => {
    if (userId === primaryUserId) return
    const next = new Set(selected)
    if (next.has(userId)) next.delete(userId)
    else next.add(userId)
    onChange([...next])
  }

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase text-gray-400 mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-2">
        {members.map((m) => {
          const isPrimary = m.userId === primaryUserId
          const checked = isPrimary || selected.has(m.userId)
          return (
            <label
              key={m.userId}
              className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border cursor-pointer ${
                checked ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'
              } ${isPrimary ? 'opacity-80 cursor-default' : ''}`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                disabled={isPrimary}
                onChange={() => toggle(m.userId)}
              />
              {m.name}
              {isPrimary && <span className="opacity-70">(owner)</span>}
            </label>
          )
        })}
      </div>
    </div>
  )
}
