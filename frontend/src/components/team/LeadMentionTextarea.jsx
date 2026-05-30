import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import { formatLeadMentionToken } from '../../lib/mentionTokens'

function detectCustomerMention(beforeCursor) {
  const hash = beforeCursor.lastIndexOf('#')
  if (hash < 0) return null
  const query = beforeCursor.slice(hash + 1)
  if (query.includes(' ') || query.includes('\n')) return null
  return { trigger: hash, query }
}

export function MentionBody({ body, onLeadClick, className = '' }) {
  if (!body) return null
  const parts = []
  let last = 0
  const text = String(body)
  const combined = /(@|#)\[([^\]]+)\]\((lead|user):([^)]+)\)/g
  for (const match of text.matchAll(combined)) {
    if (match[3] !== 'lead') continue
    if (match.index > last) {
      parts.push({ type: 'text', value: text.slice(last, match.index) })
    }
    parts.push({ type: 'lead', label: match[2], leadId: match[4] })
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) })

  return (
    <p className={`whitespace-pre-wrap ${className}`}>
      {parts.map((part, i) =>
        part.type === 'lead' ? (
          <button
            key={`${part.leadId}-${i}`}
            type="button"
            onClick={() => onLeadClick?.(part.leadId)}
            className="text-blue-700 font-semibold hover:underline"
          >
            #{part.label}
          </button>
        ) : (
          <span key={i}>{part.value}</span>
        )
      )}
    </p>
  )
}

export { formatLeadMentionToken } from '../../lib/mentionTokens'

export default function LeadMentionTextarea({
  value,
  onChange,
  placeholder,
  rows = 4,
  className = '',
  disabled = false,
}) {
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const textareaRef = useRef(null)
  const mentionStartRef = useRef(-1)

  const fetchLeads = useCallback(async (q) => {
    setLoading(true)
    try {
      const data = await api.searchTeamMentionLeads(q)
      setSuggestions(data.leads || [])
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    fetchLeads(mentionQuery)
  }, [open, mentionQuery, fetchLeads])

  const handleChange = (e) => {
    const next = e.target.value
    onChange(next)
    const cursor = e.target.selectionStart
    const before = next.slice(0, cursor)
    const hit = detectCustomerMention(before)
    if (hit) {
      mentionStartRef.current = hit.trigger
      setMentionQuery(hit.query)
      setOpen(true)
    } else {
      setOpen(false)
      mentionStartRef.current = -1
    }
  }

  const pickLead = (lead) => {
    const el = textareaRef.current
    const cursor = el?.selectionStart ?? value.length
    const start = mentionStartRef.current >= 0 ? mentionStartRef.current : cursor
    const token = formatLeadMentionToken(lead)
    const next = value.slice(0, start) + token + value.slice(cursor)
    onChange(next)
    setOpen(false)
    mentionStartRef.current = -1
    requestAnimationFrame(() => {
      el?.focus()
      const pos = start + token.length
      el?.setSelectionRange(pos, pos)
    })
  }

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        rows={rows}
        disabled={disabled}
        placeholder={placeholder}
        className={className}
      />
      {open && (
        <div className="absolute z-20 left-0 right-0 mt-1 max-h-44 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
          {loading && suggestions.length === 0 ? (
            <p className="text-xs text-gray-500 px-3 py-2">Loading customers…</p>
          ) : suggestions.length === 0 ? (
            <p className="text-xs text-gray-500 px-3 py-2">Type # then name, company, or mobile</p>
          ) : (
            suggestions.map((lead) => (
              <button
                key={lead.id}
                type="button"
                onClick={() => pickLead(lead)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-b border-gray-50 last:border-0"
              >
                <span className="font-medium text-blue-700 block truncate">
                  #{lead.name || lead.label}
                </span>
                {lead.company ? <span className="text-gray-600 block truncate">{lead.company}</span> : null}
                {lead.phone ? <span className="text-gray-500 block tabular-nums">{lead.phone}</span> : null}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
