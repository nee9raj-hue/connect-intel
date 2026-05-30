const MESSAGE_MENTION_RE = /(@|#)\[([^\]]+)\]\((lead|user):([^)]+)\)/g

export default function ChithiMessageBody({ body, onLeadClick, className = '' }) {
  if (!body) return null
  const parts = []
  let last = 0
  const text = String(body)
  for (const match of text.matchAll(MESSAGE_MENTION_RE)) {
    if (match.index > last) {
      parts.push({ type: 'text', value: text.slice(last, match.index) })
    }
    parts.push({
      type: match[3] === 'lead' ? 'lead' : 'user',
      label: match[2],
      id: match[4],
    })
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) })

  return (
    <p className={`whitespace-pre-wrap ${className}`}>
      {parts.map((part, i) => {
        if (part.type === 'lead') {
          return (
            <button
              key={`lead-${part.id}-${i}`}
              type="button"
              onClick={() => onLeadClick?.(part.id)}
              className="text-blue-600 font-semibold hover:underline chithi-mention-lead"
            >
              #{part.label}
            </button>
          )
        }
        if (part.type === 'user') {
          return (
            <span key={`user-${part.id}-${i}`} className="font-semibold text-[#ff7a59] chithi-mention-user">
              @{part.label}
            </span>
          )
        }
        return <span key={i}>{part.value}</span>
      })}
    </p>
  )
}

export { formatUserMentionToken } from '../../lib/mentionTokens'
