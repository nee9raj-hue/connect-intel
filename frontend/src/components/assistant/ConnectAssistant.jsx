import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import useIsMobile from '../../hooks/useIsMobile'
import { api } from '../../lib/api'
import { applyAssistantAction } from '../../lib/assistantNavigation'
import { CI_OPEN_AI_EVENT } from '../../lib/openConnectAI'
import { CrmAiIcon } from './ConnectAIFab'
import { renderAssistantMarkdown, sourceBadgeLabel } from './assistantMessageRender'

const CRM_PROMPTS = [
  'How many leads in my pipeline?',
  'CRM vs Marketing email?',
  'How do I connect work Gmail?',
  'Bulk email limits from Pipeline',
]

const RESEARCH_PROMPTS = [
  'Logistics managers at Innovist — names & LinkedIn',
  'Latest funding news for [company name]',
  'Amazon bestsellers in organic snacks India',
  'Who is the CEO of [company] — profile link',
]

const CAPABILITY_AREAS = [
  { id: 'crm', label: 'Pipeline & leads', prompt: 'How many leads in my pipeline and by stage?' },
  { id: 'marketing', label: 'Marketing vs CRM', prompt: 'CRM bulk email vs Marketing campaigns — differences?' },
  { id: 'setup', label: 'Gmail setup', prompt: 'How do I connect work Gmail step by step?' },
]

function MessageBubble({ msg, onAction }) {
  const isUser = msg.role === 'user'
  const badge = !isUser ? sourceBadgeLabel(msg.source) : null

  return (
    <div className={`ci-ai-msg ${isUser ? 'ci-ai-msg--user' : 'ci-ai-msg--bot'}`}>
      {!isUser && badge ? (
        <span className={`ci-ai-msg__badge ci-ai-msg__badge--${badge.tone}`}>{badge.label}</span>
      ) : null}
      <div className={`ci-ai-msg__bubble${isUser ? ' ci-ai-msg__bubble--user' : ''}`}>
        {isUser ? msg.content : <div className="ci-ai-md">{renderAssistantMarkdown(msg.content)}</div>}
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
        const webish = lastAssistant.source === 'web' || lastAssistant.source === 'web_error'
        if ((aiMode === 'research' && webish) || (aiMode === 'crm' && !webish)) {
          setSuggestions(lastAssistant.suggestions)
        }
      }
    } catch {
      /* first visit */
    }
  }, [aiMode])

  const switchMode = (mode) => {
    setAiMode(mode)
    setSuggestions(mode === 'research' ? RESEARCH_PROMPTS : CRM_PROMPTS)
  }

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
    setAiMode('crm')
    setSuggestions(CRM_PROMPTS)
    sendMessage(cap.prompt)
  }

  const modeHint =
    aiMode === 'research'
      ? webResearchAvailable
        ? 'Live web search — names, companies, LinkedIn, Amazon, news'
        : 'Web research needs server setup — CRM help still works'
      : 'Your pipeline counts, Gmail status, and product how-to'

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
              <p className="ci-ai-panel__sub">{modeHint}</p>
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

        <div className="ci-ai-mode-bar" role="tablist" aria-label="CRM AI mode">
          <button
            type="button"
            role="tab"
            aria-selected={aiMode === 'crm'}
            className={`ci-ai-mode-bar__btn${aiMode === 'crm' ? ' is-active' : ''}`}
            onClick={() => switchMode('crm')}
          >
            <span className="ci-ai-mode-bar__label">CRM help</span>
            <span className="ci-ai-mode-bar__hint">Your data & product</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={aiMode === 'research'}
            className={`ci-ai-mode-bar__btn ci-ai-mode-bar__btn--research${aiMode === 'research' ? ' is-active' : ''}`}
            onClick={() => switchMode('research')}
            title={webResearchAvailable ? 'Search the web' : 'Web research requires server setup'}
          >
            <span className="ci-ai-mode-bar__label">
              Web research
              {!webResearchAvailable ? <span className="ci-ai-mode-bar__dot" /> : null}
            </span>
            <span className="ci-ai-mode-bar__hint">LinkedIn · Amazon · news</span>
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
                Hi{user.name ? `, ${user.name.split(' ')[0]}` : ''} — ask something specific.
              </p>
              {aiMode === 'research' ? (
                <>
                  <p className="ci-ai-welcome__copy">
                    Name the **company**, **role**, or **product**. I return facts and links — not search tutorials.
                  </p>
                  <div className="ci-ai-capabilities">
                    {RESEARCH_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        className="ci-ai-capabilities__chip ci-ai-capabilities__chip--research"
                        disabled={loading}
                        onClick={() => sendMessage(prompt)}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="ci-ai-welcome__copy">
                    I use **your workspace numbers** and product rules — lead counts, Gmail, campaigns, consent.
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
                </>
              )}
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} onAction={handleAction} />
          ))}

          {loading && (
            <div className="ci-ai-thinking">
              <span className="ci-ai-thinking__dot" />
              {aiMode === 'research' ? 'Searching the web…' : 'Checking your CRM…'}
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
                  ? 'e.g. Supply chain managers at Innovist — names & LinkedIn URLs'
                  : 'e.g. How many leads in my pipeline by stage?'
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
