import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../lib/api'
import { formatLeadMentionToken, formatUserMentionToken } from '../../lib/mentionTokens'

function detectMention(beforeCursor) {
  const at = beforeCursor.lastIndexOf('@')
  const hash = beforeCursor.lastIndexOf('#')
  const trigger = Math.max(at, hash)
  if (trigger < 0) return null
  const kind = hash > at ? 'lead' : 'user'
  const query = beforeCursor.slice(trigger + 1)
  if (query.includes(' ') || query.includes('\n')) return null
  return { kind, trigger, query }
}

export default function ChithiComposer({
  value,
  onChange,
  onSend,
  placeholder,
  rows = 3,
  className = '',
  disabled = false,
  teamMembers = [],
  currentUserId,
}) {
  const [leadSuggestions, setLeadSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [mentionKind, setMentionKind] = useState(null)
  const [loading, setLoading] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const textareaRef = useRef(null)
  const mentionStartRef = useRef(-1)

  const memberSuggestions = useMemo(() => {
    const q = mentionQuery.trim().toLowerCase()
    return (teamMembers || [])
      .filter((m) => m.userId !== currentUserId && m.status === 'active')
      .filter((m) => {
        if (!q) return true
        const hay = [m.name, m.email].filter(Boolean).join(' ').toLowerCase()
        return hay.includes(q)
      })
      .slice(0, 8)
  }, [teamMembers, currentUserId, mentionQuery])

  const fetchLeads = useCallback(async (q) => {
    setLoading(true)
    try {
      const data = await api.searchTeamMentionLeads(q)
      setLeadSuggestions(data.leads || [])
    } catch {
      setLeadSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open || mentionKind !== 'lead') return
    fetchLeads(mentionQuery)
  }, [open, mentionKind, mentionQuery, fetchLeads])

  const handleChange = (e) => {
    const next = e.target.value
    onChange(next)
    const cursor = e.target.selectionStart
    const before = next.slice(0, cursor)
    const hit = detectMention(before)
    if (hit) {
      mentionStartRef.current = hit.trigger
      setMentionKind(hit.kind)
      setMentionQuery(hit.query)
      setOpen(true)
    } else {
      setOpen(false)
      setMentionKind(null)
      mentionStartRef.current = -1
    }
  }

  const insertToken = (token) => {
    const el = textareaRef.current
    const cursor = el?.selectionStart ?? value.length
    const start = mentionStartRef.current >= 0 ? mentionStartRef.current : cursor
    const next = value.slice(0, start) + token + value.slice(cursor)
    onChange(next)
    setOpen(false)
    setMentionKind(null)
    mentionStartRef.current = -1
    requestAnimationFrame(() => {
      el?.focus()
      const pos = start + token.length
      el?.setSelectionRange(pos, pos)
    })
  }

  const showMembers = mentionKind === 'user'
  const showLeads = mentionKind === 'lead'
  const hasSuggestions =
    (showMembers && memberSuggestions.length > 0) || (showLeads && leadSuggestions.length > 0)

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
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            onSend?.()
            return
          }
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            onSend?.()
          }
        }}
      />
      {open && (
        <div className="absolute z-20 left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg text-xs">
          {loading && showLeads && !hasSuggestions ? (
            <p className="text-gray-500 px-3 py-2">Searching customers…</p>
          ) : !hasSuggestions ? (
            <p className="text-gray-500 px-3 py-2">
              {showMembers
                ? 'Type @ to mention a teammate'
                : showLeads
                  ? 'Type # then name, company, or mobile'
                  : 'Use @ for teammates · # for customers'}
            </p>
          ) : (
            <>
              {showMembers &&
                memberSuggestions.map((m) => (
                  <button
                    key={m.userId}
                    type="button"
                    onClick={() => insertToken(formatUserMentionToken(m))}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                  >
                    <span className="font-medium text-[#ff7a59]">@{m.name || m.email}</span>
                  </button>
                ))}
              {showLeads &&
                leadSuggestions.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => insertToken(formatLeadMentionToken(lead))}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                  >
                    <span className="font-medium text-blue-700 block truncate">
                      #{lead.name || lead.label}
                    </span>
                    {lead.company ? (
                      <span className="text-gray-600 block truncate">{lead.company}</span>
                    ) : null}
                    {lead.phone ? (
                      <span className="text-gray-500 block tabular-nums">{lead.phone}</span>
                    ) : null}
                  </button>
                ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
