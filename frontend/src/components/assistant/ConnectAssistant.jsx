import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import useIsMobile from '../../hooks/useIsMobile'
import { api } from '../../lib/api'
import { applyAssistantAction } from '../../lib/assistantNavigation'
import { ASSISTANT_QUICK_PROMPTS } from '../../lib/assistantQuickPrompts'
function AssistantIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3c4.97 0 9 3.58 9 8 0 2.65-1.35 5.01-3.47 6.5L17 21l-4.2-2.1c-.52.08-1.05.12-1.6.12-4.97 0-9-3.58-9-8s4.03-8 9-8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="11" r="1" fill="currentColor" />
      <circle cx="12" cy="11" r="1" fill="currentColor" />
      <circle cx="15" cy="11" r="1" fill="currentColor" />
    </svg>
  )
}

function renderSimpleMarkdown(text) {
  const parts = String(text || '').split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return part
  })
}

function MessageBubble({ msg, onAction }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-[#242424] text-white rounded-br-md'
            : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md shadow-sm'
        }`}
      >
        {isUser ? msg.content : renderSimpleMarkdown(msg.content)}
        {!isUser && msg.actions?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {msg.actions.map((action, i) => (
              <button
                key={`${action.type}-${action.panel || action.url || 'esc'}-${i}`}
                type="button"
                onClick={() => onAction(action)}
                className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                  action.type === 'escalate'
                    ? 'bg-amber-100 border-amber-300 text-amber-950 hover:bg-amber-200'
                    : 'bg-[#fffbeb] border-[#ffe48a] text-[#5b4a00] hover:bg-[#fff4c2]'
                }`}
              >
                {action.label || 'Open'}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ticketStatusClass(status) {
  if (status === 'resolved' || status === 'closed') return 'text-green-700 bg-green-50 border-green-100'
  if (status === 'in_progress') return 'text-blue-700 bg-blue-50 border-blue-100'
  return 'text-amber-800 bg-amber-50 border-amber-100'
}

export default function ConnectAssistant({ onNavigate, fabAboveMobilePill = false }) {
  const { user, openPipelineLead, pipelineLeadId } = useApp()
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [myTickets, setMyTickets] = useState([])
  const [threadId, setThreadId] = useState(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [escalating, setEscalating] = useState(false)
  const [status, setStatus] = useState(null)
  const [suggestions, setSuggestions] = useState(ASSISTANT_QUICK_PROMPTS)
  const [showRaiseForm, setShowRaiseForm] = useState(false)
  const [concernText, setConcernText] = useState('')
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const loadHistory = useCallback(async () => {
    try {
      const data = await api.getAssistantChat()
      setMessages(data.messages || [])
      setThreadId(data.threadId || null)
      setMyTickets(data.myTickets || [])
      const lastAssistant = [...(data.messages || [])].reverse().find((m) => m.role === 'assistant')
      if (lastAssistant?.suggestions?.length) {
        setSuggestions(lastAssistant.suggestions)
      }
    } catch {
      // first visit
    }
  }, [])

  useEffect(() => {
    if (!open || !user) return
    loadHistory()
    const t = setTimeout(() => inputRef.current?.focus(), 150)
    return () => clearTimeout(t)
  }, [open, user, loadHistory])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, open, showRaiseForm])

  const handleEscalate = useCallback(
    async (overrideMessage) => {
      if (escalating) return
      setEscalating(true)
      setStatus(null)
      try {
        const lastUser = [...messages].reverse().find((m) => m.role === 'user')
        const body =
          overrideMessage ||
          concernText.trim() ||
          lastUser?.content ||
          input ||
          'Customer raised a concern via Connect Intel Assistant'

        const data = await api.escalateAssistantSupport({
          message: body,
          threadId,
        })

        setShowRaiseForm(false)
        setConcernText('')
        setMyTickets(data.myTickets || [])

        const ticketLine = data.ticketNumber
          ? `Ticket **${data.ticketNumber}** is registered.`
          : 'Your request is registered.'

        const assistantNote =
          data.message ||
          `${ticketLine} Our support team will respond within **24–48 business hours** at **${user.email}**. Quote your ticket number in any follow-up.`

        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            role: 'assistant',
            content: assistantNote,
            createdAt: new Date().toISOString(),
          },
        ])
        setStatus(null)
      } catch (err) {
        setStatus(err.message || 'Could not create support ticket')
      } finally {
        setEscalating(false)
      }
    },
    [escalating, messages, concernText, input, threadId, user?.email]
  )

  const handleAction = useCallback(
    (action) => {
      const ok = applyAssistantAction(action, {
        navigate: onNavigate,
        openPipelineLead,
        onEscalate: () => {
          setShowRaiseForm(true)
          const lastUser = [...messages].reverse().find((m) => m.role === 'user')
          if (lastUser?.content) setConcernText(lastUser.content)
        },
      })
      if (ok && action.type !== 'escalate') setOpen(false)
    },
    [onNavigate, openPipelineLead, messages]
  )

  const sendMessage = useCallback(
    async (text) => {
      const trimmed = String(text || '').trim()
      if (!trimmed || loading) return

      const optimistic = {
        id: `local-${Date.now()}`,
        role: 'user',
        content: trimmed,
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, optimistic])
      setInput('')
      setLoading(true)
      setStatus(null)

      try {
        const data = await api.sendAssistantMessage(trimmed)
        await loadHistory()
        if (data.suggestions?.length) setSuggestions(data.suggestions)
        if (data.myTickets?.length) setMyTickets(data.myTickets)
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
        setStatus(err.message || 'Could not reach assistant')
      } finally {
        setLoading(false)
      }
    },
    [loading, loadHistory]
  )

  if (!user || user.isPlatformAdmin) return null
  if (isMobile && pipelineLeadId) return null

  const showWelcome = open && messages.length === 0 && !loading
  const activeTickets = myTickets.filter((t) => !['resolved', 'closed'].includes(t.status))

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/20 md:bg-transparent md:pointer-events-none"
          aria-hidden
          onClick={() => setOpen(false)}
        />
      )}

      <div
        className={`fixed z-[70] flex flex-col bg-white border border-gray-200 shadow-2xl transition-all duration-200
          bottom-0 right-0 left-0 max-h-[min(88dvh,680px)] rounded-t-2xl
          md:bottom-20 md:right-4 md:left-auto md:w-[400px] md:max-h-[min(76dvh,600px)] md:rounded-2xl
          ${open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none md:scale-95'}`}
        role="dialog"
        aria-label="Connect Intel Assistant"
        aria-hidden={!open}
      >
        <header className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 bg-[#242424] text-white rounded-t-2xl md:rounded-t-2xl">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">Connect Intel Assistant</p>
            <p className="text-xs text-gray-300 truncate">Help · tickets · 24–48h support SLA</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-200"
            aria-label="Close assistant"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3 bg-[#f6f7f9]">
          {activeTickets.length > 0 && (
            <div className="rounded-xl bg-white border border-gray-200 px-3 py-2 shadow-sm">
              <p className="text-xs font-semibold uppercase text-gray-500">Your open tickets</p>
              <ul className="mt-1 space-y-1">
                {activeTickets.slice(0, 3).map((t) => (
                  <li key={t.id} className="text-xs flex items-center justify-between gap-2">
                    <span className="font-mono font-semibold text-gray-900">{t.ticketNumber}</span>
                    <span className={`px-1.5 py-0.5 rounded border text-xs ${ticketStatusClass(t.status)}`}>
                      {t.status.replace('_', ' ')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {showWelcome && (
            <div className="rounded-xl bg-white border border-gray-200 px-3 py-3 text-sm text-gray-700 shadow-sm">
              <p className="font-medium text-gray-900">Hi{user.name ? `, ${user.name.split(' ')[0]}` : ''}!</p>
              <p className="mt-1 text-gray-600">
                Ask how to use the product, or describe a problem. For bugs, billing, or access issues we can open a
                support ticket — you'll get a ticket number and a reply within <strong>24–48 business hours</strong>.
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} onAction={handleAction} />
          ))}

          {loading && (
            <div className="text-xs text-gray-500 flex items-center gap-2 px-1">
              <span className="inline-block w-2 h-2 rounded-full bg-[#ffcb2b] animate-pulse" />
              Thinking…
            </div>
          )}

          {showRaiseForm && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-2">
              <p className="text-xs font-semibold text-amber-950">Raise a support concern</p>
              <p className="text-xs text-amber-900">
                Describe the issue. We respond within 24–48 business hours at {user.email}. No live phone support.
              </p>
              <textarea
                value={concernText}
                onChange={(e) => setConcernText(e.target.value)}
                rows={3}
                className="w-full text-sm border border-amber-200 rounded-lg px-2 py-1.5 bg-white"
                placeholder="What went wrong? Include steps if you can…"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={escalating || !concernText.trim()}
                  onClick={() => handleEscalate()}
                  className="flex-1 text-xs font-semibold py-2 rounded-lg bg-[#ffcb2b] text-[#242424] disabled:opacity-40"
                >
                  {escalating ? 'Creating ticket…' : 'Submit ticket'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRaiseForm(false)}
                  className="text-xs px-3 py-2 rounded-lg border border-amber-200 text-amber-900"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {suggestions.length > 0 && !showRaiseForm && (
          <div className="shrink-0 px-3 pb-1 flex gap-1.5 overflow-x-auto no-scrollbar">
            {suggestions.slice(0, 4).map((s) => (
              <button
                key={s}
                type="button"
                disabled={loading}
                onClick={() => sendMessage(s)}
                className="shrink-0 text-xs px-2.5 py-1 rounded-full border border-gray-200 bg-white text-gray-600 hover:border-[#ffcb2b] hover:text-gray-900 disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {status && (
          <p className="shrink-0 px-3 text-xs text-amber-800 bg-amber-50 border-t border-amber-100 py-1.5">{status}</p>
        )}

        <footer className="shrink-0 border-t border-gray-200 bg-white p-3 space-y-2 rounded-b-2xl">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              sendMessage(input)
            }}
            className="flex gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask or describe an issue…"
              className="flex-1 min-w-0 text-sm rounded-xl border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#ffcb2b]/50"
              disabled={loading}
              maxLength={2000}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="shrink-0 px-3 py-2.5 rounded-xl bg-[#ffcb2b] text-[#242424] text-sm font-semibold hover:bg-[#f0bc00] disabled:opacity-40"
            >
              Send
            </button>
          </form>
          <button
            type="button"
            onClick={() => {
              setShowRaiseForm(true)
              const lastUser = [...messages].reverse().find((m) => m.role === 'user')
              if (lastUser?.content && !concernText) setConcernText(lastUser.content)
            }}
            disabled={escalating}
            className="w-full text-xs text-center font-medium text-amber-900 hover:text-amber-950 py-1 disabled:opacity-50"
          >
            Raise a concern · get a ticket number (24–48h response)
          </button>
        </footer>
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`fixed z-[70] right-3 md:right-6 flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-full shadow-lg border-2 transition-transform
          ${fabAboveMobilePill ? 'bottom-[4.75rem]' : 'bottom-4'}
          md:bottom-6
          ${open ? 'bg-gray-800 border-gray-700 text-white scale-95' : 'bg-[#ffcb2b] border-[#f0bc00] text-[#242424] hover:scale-105'}`}
        aria-expanded={open}
        aria-label={open ? 'Close assistant' : 'Open Connect Intel Assistant'}
      >
        {open ? (
          <span className="text-lg leading-none">✕</span>
        ) : (
          <>
            <AssistantIcon className="w-7 h-7" />
            {activeTickets.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                {activeTickets.length}
              </span>
            )}
          </>
        )}
      </button>
    </>
  )
}
