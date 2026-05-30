import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import { ASSISTANT_QUICK_PROMPTS } from '../../lib/assistantQuickPrompts'
import { applyAssistantAction } from '../../lib/assistantNavigation'
import useShouldShowConnectAssistant from '../../hooks/useShouldShowConnectAssistant'
import { useApp } from '../../context/AppContext'
import { SparkIcon } from '../ui/icons'

function MessageBubble({ message, onAction }) {
  const isUser = message.role === 'user'
  return (
    <div className={`connect-assistant-msg ${isUser ? 'connect-assistant-msg--user' : 'connect-assistant-msg--bot'}`}>
      <div className="connect-assistant-msg-body">{message.content}</div>
      {!isUser && message.actions?.length > 0 && (
        <div className="connect-assistant-msg-actions">
          {message.actions.map((action, i) => (
            <button
              key={`${action.type}-${i}`}
              type="button"
              className="connect-assistant-action-btn"
              onClick={() => onAction(action)}
            >
              {action.label || 'Open'}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ConnectAssistant({ onNavigate }) {
  const { user, openPipelineLead } = useApp()
  const showAssistant = useShouldShowConnectAssistant()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [threadId, setThreadId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  const loadHistory = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.getAssistantChat()
      setThreadId(data.threadId || null)
      setMessages(Array.isArray(data.messages) ? data.messages : [])
    } catch (e) {
      setError(e.message || 'Could not load assistant')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open && messages.length === 0 && !loading) loadHistory()
  }, [open, messages.length, loading, loadHistory])

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [open, messages, sending])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const handleAction = useCallback(
    (action) => {
      applyAssistantAction(action, { navigate: onNavigate, openPipelineLead })
    },
    [onNavigate, openPipelineLead]
  )

  const sendText = useCallback(
    async (text) => {
      const trimmed = String(text || '').trim()
      if (!trimmed || sending) return
      setSending(true)
      setError('')
      setInput('')
      const optimistic = {
        id: `tmp-${Date.now()}`,
        role: 'user',
        content: trimmed,
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, optimistic])
      try {
        const data = await api.sendAssistantMessage(trimmed)
        if (data.threadId) setThreadId(data.threadId)
        setMessages((prev) => {
          const withoutTmp = prev.filter((m) => m.id !== optimistic.id)
          return [
            ...withoutTmp,
            { ...optimistic, id: `u-${Date.now()}` },
            ...(data.message ? [data.message] : []),
          ]
        })
      } catch (e) {
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
        setInput(trimmed)
        setError(e.message || 'Send failed')
      } finally {
        setSending(false)
      }
    },
    [sending, threadId]
  )

  if (!user || user.isPlatformAdmin || !showAssistant) {
    return null
  }

  return (
    <>
      <button
        type="button"
        className={`connect-assistant-fab${open ? ' connect-assistant-fab--open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? 'Close CRM assistant' : 'Open CRM assistant'}
        title="CRM help"
      >
        {open ? <span aria-hidden>×</span> : <SparkIcon className="w-5 h-5" />}
      </button>

      {open && (
        <div className="connect-assistant-panel" role="dialog" aria-label="Connect Intel CRM assistant">
          <header className="connect-assistant-header">
            <div>
              <h2 className="connect-assistant-title">CRM assistant</h2>
              <p className="connect-assistant-sub">Pipeline, Gmail, imports, marketing &amp; navigation</p>
            </div>
            <button type="button" className="connect-assistant-close" onClick={() => setOpen(false)} aria-label="Close">
              ×
            </button>
          </header>

          <div className="connect-assistant-scroll" ref={scrollRef}>
            {loading && messages.length === 0 && (
              <p className="connect-assistant-muted">Loading…</p>
            )}
            {!loading && messages.length === 0 && (
              <div className="connect-assistant-welcome">
                <p>Ask how to use Connect Intel — leads, email, campaigns, Chithi, and team setup.</p>
                <div className="connect-assistant-chips">
                  {ASSISTANT_QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="connect-assistant-chip"
                      onClick={() => sendText(prompt)}
                      disabled={sending}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} onAction={handleAction} />
            ))}
            {sending && <p className="connect-assistant-muted connect-assistant-typing">Thinking…</p>}
          </div>

          {error && <p className="connect-assistant-error">{error}</p>}

          <footer className="connect-assistant-footer">
            <form
              className="connect-assistant-form"
              onSubmit={(e) => {
                e.preventDefault()
                sendText(input)
              }}
            >
              <input
                ref={inputRef}
                type="text"
                className="connect-assistant-input"
                placeholder="Ask about CRM features…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={sending}
                maxLength={2000}
                autoComplete="off"
              />
              <button type="submit" className="connect-assistant-send" disabled={sending || !input.trim()}>
                Send
              </button>
            </form>
          </footer>
        </div>
      )}
    </>
  )
}
