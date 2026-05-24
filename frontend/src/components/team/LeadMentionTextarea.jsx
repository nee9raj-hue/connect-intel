import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'

const MENTION_TOKEN_RE = /@\[([^\]]+)\]\(lead:([^)]+)\)/g

export function formatLeadMentionToken(lead) {
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim()
  const company = String(lead.company || lead.label || '').trim()
  const label = lead.label || (name && company ? `${name} · ${company}` : name || company || 'Customer')
  return `@[${label}](lead:${lead.id}) `
}

export function MentionBody({ body, onLeadClick, className = '' }) {
  if (!body) return null
  const parts = []
  let last = 0
  for (const match of String(body).matchAll(MENTION_TOKEN_RE)) {
    if (match.index > last) {
      parts.push({ type: 'text', value: body.slice(last, match.index) })
    }
    parts.push({ type: 'lead', label: match[1], leadId: match[2] })
    last = match.index + match[0].length
  }
  if (last < body.length) parts.push({ type: 'text', value: body.slice(last) })

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
            {part.label}
          </button>
        ) : (
          <span key={i}>{part.value}</span>
        )
      )}
    </p>
  )
}

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
    fetchLeads('')
  }, [open, fetchLeads])

  const handleChange = (e) => {
    const next = e.target.value
    onChange(next)
    const cursor = e.target.selectionStart
    const before = next.slice(0, cursor)
    const at = before.lastIndexOf('@')
    if (at >= 0 && !before.slice(at + 1).includes(' ') && !before.slice(at + 1).includes('\n')) {
      mentionStartRef.current = at
      setOpen(true)
      fetchLeads(before.slice(at + 1))
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
            <p className="text-xs text-gray-500 px-3 py-2">Type @ then search pipeline customers</p>
          ) : (
            suggestions.map((lead) => (
              <button
                key={lead.id}
                type="button"
                onClick={() => pickLead(lead)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-b border-gray-50 last:border-0"
              >
                <span className="font-medium text-gray-900">{lead.label}</span>
                {lead.email && <span className="text-gray-500 ml-2">{lead.email}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
