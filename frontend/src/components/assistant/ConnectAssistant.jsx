import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import useIsMobile from '../../hooks/useIsMobile'
import { api } from '../../lib/api'
import { applyAssistantAction } from '../../lib/assistantNavigation'
import { getContextualSuggestions, COPILOT_TABS, PROGRESS_STEPS, pushRecentSearch, loadRecentSearches } from '../../lib/copilotSuggestions'
import { CI_OPEN_AI_EVENT } from '../../lib/openConnectAI'
import { CrmAiIcon } from './ConnectAIFab'
import CopilotCompanyCard from './CopilotCompanyCard'
import {
  renderAssistantMarkdown,
  sourceBadgesFromMessage,
  confidenceLabel,
} from './assistantMessageRender'

function MessageBubble({ msg, onAction }) {
  const isUser = msg.role === 'user'
  const badges = !isUser ? sourceBadgesFromMessage(msg) : []
  const conf = !isUser ? confidenceLabel(msg.confidence) : null

  return (
    <div className={`ci-ai-msg ${isUser ? 'ci-ai-msg--user' : 'ci-ai-msg--bot'}`}>
      {!isUser && (badges.length > 0 || conf) ? (
        <div className="ci-ai-msg__meta">
          {badges.map((b) => (
            <span key={b.label} className={`ci-ai-msg__badge ci-ai-msg__badge--${b.tone}`}>
              {b.label}
            </span>
          ))}
          {conf ? (
            <span className={`ci-ai-msg__confidence ci-ai-msg__confidence--${conf.tone}`}>
              {conf.label}
            </span>
          ) : null}
        </div>
      ) : null}
      {!isUser && msg.companyCard ? (
        <CopilotCompanyCard card={msg.companyCard} onAction={onAction} />
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
  pipelineLeadId,
}) {
  const { user, openPipelineLead, openPipelineEmailDraft } = useApp()
  const isMobile = useIsMobile()
  const [messages, setMessages] = useState([])
  const [myTickets, setMyTickets] = useState([])
  const [threadId, setThreadId] = useState(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [escalating, setEscalating] = useState(false)
  const [status, setStatus] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [webResearchAvailable, setWebResearchAvailable] = useState(false)
  const [showRaiseForm, setShowRaiseForm] = useState(false)
  const [concernText, setConcernText] = useState('')
  const [activeTab, setActiveTab] = useState('copilot')
  const [progressStep, setProgressStep] = useState('')
  const [recentSearches, setRecentSearches] = useState([])
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const uiContext = {
    panel: activePanel || null,
    tab: panelOptions?.tab || null,
    leadId: pipelineLeadId || null,
    copilotTab: activeTab,
  }

  const contextualPrompts = getContextualSuggestions(uiContext)

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
      } else {
        setSuggestions(getContextualSuggestions(uiContext))
      }
    } catch {
      /* first visit */
    }
  }, [uiContext.panel, uiContext.leadId, uiContext.copilotTab])

  useEffect(() => {
    if (open) setRecentSearches(loadRecentSearches())
  }, [open])

  useEffect(() => {
    if (!loading) {
      setProgressStep('')
      return undefined
    }
    const steps = PROGRESS_STEPS[activeTab] || PROGRESS_STEPS.copilot
    let i = 0
    setProgressStep(steps[0])
    const id = setInterval(() => {
      i = Math.min(i + 1, steps.length - 1)
      setProgressStep(steps[i])
    }, 1400)
    return () => clearInterval(id)
  }, [loading, activeTab])

  useEffect(() => {
    setSuggestions(getContextualSuggestions(uiContext))
  }, [activeTab, uiContext.panel, uiContext.leadId])

  useEffect(() => {
    if (open && messages.length === 0) {
      setSuggestions(contextualPrompts)
    }
  }, [open, contextualPrompts, messages.length])

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
    async (action) => {
      if (action.type === 'open_email_draft' && action.leadId) {
        openPipelineEmailDraft(action.leadId, action.payload || {})
        onOpenChange?.(false)
        return
      }

      if (action.type === 'create_lead' && action.payload) {
        try {
          const data = await api.addManualLead(action.payload)
          const leadId = data?.lead?.id || data?.entry?.lead?.id || data?.id
          if (leadId && openPipelineLead) {
            openPipelineLead(leadId, 'overview')
            onOpenChange?.(false)
            return
          }
        } catch (err) {
          setStatus(err.message || 'Could not create lead')
          return
        }
      }

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
    [onNavigate, openPipelineLead, openPipelineEmailDraft, messages, onOpenChange]
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
        pushRecentSearch(trimmed)
        setRecentSearches(loadRecentSearches())
        const data = await api.sendAssistantMessage(trimmed, uiContext)
        await loadHistory()
        if (data.suggestions?.length) setSuggestions(data.suggestions)
        if (data.myTickets?.length) setMyTickets(data.myTickets)
      } catch (err) {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
        setStatus(err.message || 'Could not reach Connect Copilot')
      } finally {
        setLoading(false)
      }
    },
    [loading, loadHistory, uiContext]
  )

  const tabMeta = COPILOT_TABS.find((t) => t.id === activeTab) || COPILOT_TABS[0]
  const copilotSub = pipelineLeadId
    ? 'Lead context on · CRM + web research'
    : `${tabMeta.hint}${webResearchAvailable ? ' · web live' : ''}`

  const inputPlaceholder = {
    copilot: 'Ask anything — CRM data, company research, emails, pipeline…',
    market: 'Find exporters, research companies, market news…',
    crm: 'Search pipeline, counts, follow-ups, stalled deals…',
    actions: 'Draft email, schedule meeting, create task…',
  }[activeTab]

  if (!user || user.isPlatformAdmin) return null

  const showWelcome = open && messages.length === 0 && !loading
  const activeTickets = myTickets.filter((t) => !['resolved', 'closed'].includes(t.status))

  return (
    <>
      {open && (
        <button
          type="button"
          className="ci-ai-backdrop"
          aria-label="Close Connect Copilot"
          onClick={() => onOpenChange?.(false)}
        />
      )}

      <aside
        className={`ci-ai-panel connect-assistant-panel${open ? ' is-open' : ''}${isMobile ? ' ci-ai-panel--mobile' : ''}`}
        role="dialog"
        aria-label="Connect Copilot"
        aria-hidden={!open}
      >
        <header className="ci-ai-panel__head">
          <div className="ci-ai-panel__brand">
            <span className="ci-ai-panel__icon" aria-hidden>
              <CrmAiIcon className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <p className="ci-ai-panel__title">Connect Copilot</p>
              <p className="ci-ai-panel__sub">{copilotSub}</p>
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

        <nav className="ci-ai-tabs" aria-label="Copilot modes">
          {COPILOT_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`ci-ai-tabs__btn${activeTab === tab.id ? ' is-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              title={tab.hint}
            >
              {tab.label}
            </button>
          ))}
        </nav>

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
                Hi{user.name ? `, ${user.name.split(' ')[0]}` : ''} — your sales copilot.
              </p>
              <p className="ci-ai-welcome__copy">
                {tabMeta.hint}. I check **CRM first**, then enrich from **web sources** — with one-click actions.
              </p>
              {recentSearches.length > 0 ? (
                <div className="ci-ai-recent">
                  <p className="ci-ai-recent__label">Recent</p>
                  <div className="ci-ai-capabilities">
                    {recentSearches.slice(0, 3).map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        className="ci-ai-capabilities__chip ci-ai-capabilities__chip--muted"
                        disabled={loading}
                        onClick={() => sendMessage(prompt)}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="ci-ai-capabilities">
                {contextualPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="ci-ai-capabilities__chip"
                    disabled={loading}
                    onClick={() => sendMessage(prompt)}
                  >
                    {prompt}
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
              <span>{progressStep || 'Working…'}</span>
              <div className="ci-ai-thinking__bar" aria-hidden>
                <span className="ci-ai-thinking__bar-fill" />
              </div>
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
              placeholder={inputPlaceholder}
              className="ci-ai-compose__input"
              disabled={loading}
              maxLength={2000}
            />
            <button type="submit" disabled={loading || !input.trim()} className="ci-ai-compose__send">
              {loading ? 'Working…' : 'Send'}
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
      aria-label="Open Connect Copilot"
      title="Connect Copilot (⌘/)"
    >
      <CrmAiIcon className="w-4 h-4" />
      {!compact && <span>Copilot</span>}
      {!compact && <kbd className="ci-ai-trigger__kbd">⌘/</kbd>}
    </button>
  )
}
