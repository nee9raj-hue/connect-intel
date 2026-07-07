import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import useIsMobile from '../../hooks/useIsMobile'
import { api } from '../../lib/api'
import { applyAssistantAction } from '../../lib/assistantNavigation'
import { ASSISTANT_QUICK_PROMPTS } from '../../lib/assistantQuickPrompts'
import { CI_OPEN_AI_EVENT } from '../../lib/openConnectAI'

const CAPABILITY_AREAS = [
  { id: 'crm', label: 'CRM & Pipeline', prompt: 'How does Pipeline bulk email work?' },
  { id: 'marketing', label: 'Marketing Hub', prompt: 'CRM vs Marketing email?' },
  { id: 'setup', label: 'Gmail & setup', prompt: 'How do I connect work Gmail?' },
  { id: 'team', label: 'Team', prompt: 'How do I invite a teammate?' },
]

function SparklesIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2l1.4 4.2L17.6 8 13.4 9.4 12 13.6 10.6 9.4 6.4 8l4.2-1.8L12 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M5 14l.9 2.7L8.6 18l-2.7.9L5 21.6 3.4 18.9.7 18l2.7-.9L5 14Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M19 12l.7 2.1 2.1.7-2.1.7L19 17.6l-.7-2.1-2.1-.7 2.1-.7L19 12Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
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
    <div className={`ci-ai-msg ${isUser ? 'ci-ai-msg--user' : 'ci-ai-msg--bot'}`}>
      <div className={`ci-ai-msg__bubble${isUser ? ' ci-ai-msg__bubble--user' : ''}`}>
        {isUser ? msg.content : renderSimpleMarkdown(msg.content)}
        {!isUser && msg.actions?.length > 0 && (
          <div className="ci-ai-msg__actions">
            {msg.actions.map((action, i) => (
              <button
                key={`${action.type}-${action.panel || action.url || 'esc'}-${i}`}
                type="button"
                onClick={() => onAction(action)}
                className={`ci-ai-msg__action${action.type === 'escalate' ? ' ci-ai-msg__action--escalate' : ''}`}
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
  if (status === 'resolved' || status === 'closed') return 'ci-ai-ticket--done'
  if (status === 'in_progress') return 'ci-ai-ticket--progress'
  return 'ci-ai-ticket--open'
}

export default function ConnectAssistant({
  open,
  onOpenChange,
  onNavigate,
  activePanel,
  panelOptions,
}) {
  const { user, openPipelineLead } = useApp()
  const isMobile = useIsMobile()
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

  const uiContext = {
    panel: activePanel || null,
    tab: panelOptions?.tab || null,
  }

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
      /* first visit */
    }
  }, [])

  useEffect(() => {
    const onGlobalOpen = () => onOpenChange?.(true)
    window.addEventListener(CI_OPEN_AI_EVENT, onGlobalOpen)
    return () => window.removeEventListener(CI_OPEN_AI_EVENT, onGlobalOpen)
  }, [onOpenChange])

  useEffect(() => {
    if (!open || !user) return
    loadHistory()
    const t = setTimeout(() => inputRef.current?.focus(), 120)
    return () => clearTimeout(t)
  }, [open, user, loadHistory])

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, open, showRaiseForm])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onOpenChange?.(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

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
          'Customer raised a concern via Connect Intel AI'

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
          `${ticketLine} Our support team will respond within **24–48 business hours** at **${user.email}**.`

        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            role: 'assistant',
            content: assistantNote,
            createdAt: new Date().toISOString(),
          },
        ])
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
      if (ok && action.type !== 'escalate') onOpenChange?.(false)
    },
    [onNavigate, openPipelineLead, messages, onOpenChange]
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
        const data = await api.sendAssistantMessage(trimmed, uiContext)
        await loadHistory()
        if (data.suggestions?.length) setSuggestions(data.suggestions)
        if (data.myTickets?.length) setMyTickets(data.myTickets)
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
        setStatus(err.message || 'Could not reach Connect Intel AI')
      } finally {
        setLoading(false)
      }
    },
    [loading, loadHistory, uiContext]
  )

  if (!user || user.isPlatformAdmin) return null

  const showWelcome = open && messages.length === 0 && !loading
  const activeTickets = myTickets.filter((t) => !['resolved', 'closed'].includes(t.status))

  return (
    <>
      {open && (
        <button
          type="button"
          className="ci-ai-backdrop"
          aria-label="Close Connect Intel AI"
          onClick={() => onOpenChange?.(false)}
        />
      )}

      <aside
        className={`ci-ai-panel connect-assistant-panel${open ? ' is-open' : ''}${isMobile ? ' ci-ai-panel--mobile' : ''}`}
        role="dialog"
        aria-label="Connect Intel AI"
        aria-hidden={!open}
      >
        <header className="ci-ai-panel__head">
          <div className="ci-ai-panel__brand">
            <span className="ci-ai-panel__icon" aria-hidden>
              <SparklesIcon className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <p className="ci-ai-panel__title">Connect Intel AI</p>
              <p className="ci-ai-panel__sub">CRM & Marketing expert · constitution-aligned</p>
            </div>
          </div>
          <button
            type="button"
            className="ci-ai-panel__close"
            onClick={() => onOpenChange?.(false)}
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div className="ci-ai-panel__body">
          {activeTickets.length > 0 && (
            <div className="ci-ai-tickets">
              <p className="ci-ai-tickets__label">Open support tickets</p>
              <ul>
                {activeTickets.slice(0, 3).map((t) => (
                  <li key={t.id}>
                    <span className="font-mono font-semibold">{t.ticketNumber}</span>
                    <span className={`ci-ai-ticket ${ticketStatusClass(t.status)}`}>
                      {t.status.replace('_', ' ')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {showWelcome && (
            <div className="ci-ai-welcome">
              <p className="ci-ai-welcome__hi">
                Hi{user.name ? `, ${user.name.split(' ')[0]}` : ''} — I know your CRM and Marketing Hub.
              </p>
              <p className="ci-ai-welcome__copy">
                Ask how anything works, your Pipeline counts, Gmail status, campaigns, forms, or consent rules. I
                follow Connect Intel&apos;s constitution — no spam, no bypassing opt-in.
              </p>
              <div className="ci-ai-capabilities">
                {CAPABILITY_AREAS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="ci-ai-capabilities__chip"
                    disabled={loading}
                    onClick={() => sendMessage(c.prompt)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} onAction={handleAction} />
          ))}

          {loading && (
            <div className="ci-ai-thinking">
              <span className="ci-ai-thinking__dot" />
              Thinking…
            </div>
          )}

          {showRaiseForm && (
            <div className="ci-ai-escalate">
              <p className="ci-ai-escalate__title">Raise a support ticket</p>
              <p className="ci-ai-escalate__copy">
                Bugs, billing, or access issues — we reply within 24–48 business hours at {user.email}.
              </p>
              <textarea
                value={concernText}
                onChange={(e) => setConcernText(e.target.value)}
                rows={3}
                className="ci-ai-escalate__input"
                placeholder="Describe the issue…"
              />
              <div className="ci-ai-escalate__actions">
                <button
                  type="button"
                  disabled={escalating || !concernText.trim()}
                  onClick={() => handleEscalate()}
                  className="ci-ai-escalate__submit"
                >
                  {escalating ? 'Creating…' : 'Submit ticket'}
                </button>
                <button type="button" onClick={() => setShowRaiseForm(false)} className="ci-ai-escalate__cancel">
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {suggestions.length > 0 && !showRaiseForm && (
          <div className="ci-ai-suggestions">
            {suggestions.slice(0, 5).map((s) => (
              <button
                key={s}
                type="button"
                disabled={loading}
                onClick={() => sendMessage(s)}
                className="ci-ai-suggestions__chip"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {status && <p className="ci-ai-status">{status}</p>}

        <footer className="ci-ai-panel__foot">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              sendMessage(input)
            }}
            className="ci-ai-compose"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about CRM, Marketing, your data…"
              className="ci-ai-compose__input"
              disabled={loading}
              maxLength={2000}
            />
            <button type="submit" disabled={loading || !input.trim()} className="ci-ai-compose__send">
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
            className="ci-ai-support-link"
          >
            Need human support? Open a ticket (24–48h)
          </button>
        </footer>
      </aside>
    </>
  )
}

/** Header / shell trigger button */
export function ConnectAIButton({ onClick, compact = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`ci-ai-trigger${compact ? ' ci-ai-trigger--compact' : ''}`}
      aria-label="Open Connect Intel AI"
      title="Connect Intel AI (⌘/)"
    >
      <SparklesIcon className={compact ? 'w-4 h-4' : 'w-4 h-4'} />
      {!compact && <span>Ask AI</span>}
      {!compact && <kbd className="ci-ai-trigger__kbd">⌘/</kbd>}
    </button>
  )
}
