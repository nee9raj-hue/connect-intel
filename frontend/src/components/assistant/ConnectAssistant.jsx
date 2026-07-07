import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import useIsMobile from '../../hooks/useIsMobile'
import { api } from '../../lib/api'
import { applyAssistantAction } from '../../lib/assistantNavigation'
import { CI_OPEN_AI_EVENT } from '../../lib/openConnectAI'
import { CrmAiIcon } from './ConnectAIFab'

const CRM_PROMPTS = [
  'CRM vs Marketing email?',
  'How many leads in my pipeline?',
  'How do I connect work Gmail?',
  'Bulk email from Pipeline',
]

const RESEARCH_PROMPTS = [
  'Research this company on the web',
  'Find LinkedIn profile for a contact',
  'Amazon best sellers in this category',
  'Latest news about a prospect company',
]

const CAPABILITY_AREAS = [
  { id: 'crm', label: 'CRM help', prompt: 'How does Pipeline bulk email work?' },
  { id: 'marketing', label: 'Marketing', prompt: 'CRM vs Marketing email?' },
  { id: 'research', label: 'Web research', prompt: 'Research a company on LinkedIn' },
  { id: 'setup', label: 'Gmail setup', prompt: 'How do I connect work Gmail?' },
]

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
  const [suggestions, setSuggestions] = useState(CRM_PROMPTS)
  const [aiMode, setAiMode] = useState('crm')
  const [webResearchAvailable, setWebResearchAvailable] = useState(false)
  const [showRaiseForm, setShowRaiseForm] = useState(false)
  const [concernText, setConcernText] = useState('')
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const uiContext = {
    panel: activePanel || null,
    tab: panelOptions?.tab || null,
    mode: aiMode,
  }

  const loadHistory = useCallback(async () => {
    try {
      const data = await api.getAssistantChat()
      setMessages(data.messages || [])
      setThreadId(data.threadId || null)
      setMyTickets(data.myTickets || [])
      setWebResearchAvailable(Boolean(data.webResearchAvailable))
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
        setStatus(err.message || 'Could not reach CRM AI')
      } finally {
        setLoading(false)
      }
    },
    [loading, loadHistory, uiContext, aiMode]
  )

  const onCapabilityClick = (cap) => {
    if (cap.id === 'research') {
      setAiMode('research')
      setSuggestions(RESEARCH_PROMPTS)
      sendMessage(cap.prompt)
      return
    }
    setAiMode('crm')
    setSuggestions(CRM_PROMPTS)
    sendMessage(cap.prompt)
  }

  if (!user || user.isPlatformAdmin) return null

  const showWelcome = open && messages.length === 0 && !loading
  const activeTickets = myTickets.filter((t) => !['resolved', 'closed'].includes(t.status))

  return (
    <>
      {open && (
        <button
          type="button"
          className="ci-ai-backdrop"
          aria-label="Close CRM AI"
          onClick={() => onOpenChange?.(false)}
        />
      )}

      <aside
        className={`ci-ai-panel connect-assistant-panel${open ? ' is-open' : ''}${isMobile ? ' ci-ai-panel--mobile' : ''}`}
        role="dialog"
        aria-label="CRM AI"
        aria-hidden={!open}
      >
        <header className="ci-ai-panel__head">
          <div className="ci-ai-panel__brand">
            <span className="ci-ai-panel__icon" aria-hidden>
              <CrmAiIcon className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <p className="ci-ai-panel__title">CRM AI</p>
              <p className="ci-ai-panel__sub">Product expert · live web research</p>
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

        <div className="ci-ai-mode-bar">
          <button
            type="button"
            className={`ci-ai-mode-bar__btn${aiMode === 'crm' ? ' is-active' : ''}`}
            onClick={() => {
              setAiMode('crm')
              setSuggestions(CRM_PROMPTS)
            }}
          >
            CRM help
          </button>
          <button
            type="button"
            className={`ci-ai-mode-bar__btn${aiMode === 'research' ? ' is-active' : ''}`}
            onClick={() => {
              setAiMode('research')
              setSuggestions(RESEARCH_PROMPTS)
            }}
            title={webResearchAvailable ? 'Search the web' : 'Web research requires server setup'}
          >
            Web research
            {!webResearchAvailable ? <span className="ci-ai-mode-bar__dot" /> : null}
          </button>
        </div>

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
                Hi{user.name ? `, ${user.name.split(' ')[0]}` : ''} — I&apos;m your CRM AI.
              </p>
              <p className="ci-ai-welcome__copy">
                **CRM help** uses your workspace data and product knowledge (constitution-aligned).
                **Web research** searches LinkedIn, Amazon, news, and the open web for B2B context.
              </p>
              <div className="ci-ai-capabilities">
                {CAPABILITY_AREAS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="ci-ai-capabilities__chip"
                    disabled={loading}
                    onClick={() => onCapabilityClick(c)}
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
              placeholder={
                aiMode === 'research'
                  ? 'Research company, LinkedIn, Amazon, news…'
                  : 'Ask about CRM, Marketing, your data…'
              }
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
      aria-label="Open CRM AI"
      title="CRM AI (⌘/)"
    >
      <CrmAiIcon className="w-4 h-4" />
      {!compact && <span>CRM AI</span>}
      {!compact && <kbd className="ci-ai-trigger__kbd">⌘/</kbd>}
    </button>
  )
}
