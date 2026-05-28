import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import { formatPhoneDisplay } from '../../lib/phoneUtils'
import useIsMobile from '../../hooks/useIsMobile'

function MsgTick({ status }) {
  if (status === 'read') return <span className="text-blue-300 ml-1">✓✓</span>
  if (status === 'delivered') return <span className="text-green-200 ml-1">✓✓</span>
  if (status === 'sent') return <span className="text-green-200 ml-1">✓</span>
  return null
}

export default function WhatsAppInboxPanel({ onNavigate }) {
  const [configured, setConfigured] = useState(true)
  const [setupMessage, setSetupMessage] = useState('')
  const [threads, setThreads] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [stats, setStats] = useState({ unread: 0, total: 0 })
  const [selected, setSelected] = useState(null)
  const [thread, setThread] = useState(null)
  const [reply, setReply] = useState('')
  const [loading, setLoading] = useState(true)
  const [threadLoading, setThreadLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [tagging, setTagging] = useState(false)
  const [error, setError] = useState(null)
  const [filterPhone, setFilterPhone] = useState('')
  const [filterCampaign, setFilterCampaign] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const messagesEndRef = useRef(null)
  const selectedRef = useRef(null)
  const isMobile = useIsMobile()

  useEffect(() => {
    selectedRef.current = selected
  }, [selected])

  const loadThreads = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterPhone) params.set('phone', filterPhone)
      if (filterCampaign) params.set('campaignId', filterCampaign)
      if (filterTag) params.set('tag', filterTag)
      const q = params.toString()
      const data = await api.getWhatsAppInbox(q ? `?${q}` : '')
      setConfigured(data.configured !== false)
      setSetupMessage(data.message || '')
      setThreads(data.threads || [])
      setCampaigns(data.campaigns || [])
      setStats(data.stats || { unread: 0, total: 0 })
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [filterPhone, filterCampaign, filterTag])

  useEffect(() => {
    loadThreads()
    const t = setInterval(loadThreads, 15_000)
    return () => clearInterval(t)
  }, [loadThreads])

  useEffect(() => {
    if (!selected) return
    const t = setInterval(async () => {
      if (!selectedRef.current) return
      try {
        const data = await api.getWhatsAppThread(selectedRef.current)
        setThread(data.thread)
      } catch {
        /* ignore poll errors */
      }
    }, 10_000)
    return () => clearInterval(t)
  }, [selected])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread?.messages?.length])

  const openThread = async (id) => {
    setSelected(id)
    setThreadLoading(true)
    setError(null)
    setThread(null)
    try {
      const data = await api.getWhatsAppThread(id)
      setThread(data.thread)
      setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, unread: false } : t)))
    } catch (err) {
      setError(err.message)
    } finally {
      setThreadLoading(false)
    }
  }

  const closeThread = () => {
    setSelected(null)
    setThread(null)
  }

  const showThreadList = !isMobile || !selected
  const showThreadDetail = !isMobile || Boolean(selected)

  const sendReply = async () => {
    if (!reply.trim() || !selected) return
    setSending(true)
    try {
      await api.replyWhatsAppInbox(selected, reply.trim())
      setReply('')
      const data = await api.getWhatsAppThread(selected)
      setThread(data.thread)
      await loadThreads()
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  const toggleInterested = async () => {
    if (!thread) return
    setTagging(true)
    const newTag = thread.leadTag === 'interested' ? null : 'interested'
    try {
      const data = await api.tagWhatsAppThread(selected, newTag)
      setThread(data.thread)
      setThreads((prev) =>
        prev.map((t) => (t.id === selected ? { ...t, leadTag: newTag } : t))
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setTagging(false)
    }
  }

  const openLead = () => {
    if (!thread?.leadId) return
    onNavigate?.('pipeline', { leadId: thread.leadId })
  }

  if (!configured) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-3 max-w-xl">
        <h3 className="text-sm font-semibold text-amber-950">WhatsApp Business API required</h3>
        <p className="text-xs text-amber-900 leading-relaxed">
          {setupMessage ||
            'Connect Meta WhatsApp Cloud API under Integrations to use the team inbox. Pipeline wa.me sends still log on each lead.'}
        </p>
        <button
          type="button"
          onClick={() => onNavigate?.('integrations')}
          className="text-xs font-semibold px-3 py-2 bg-[#ffcb2b] text-[#242424] rounded-lg"
        >
          Open Integrations
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 leading-relaxed">
        Team inbox for WhatsApp Cloud API — replies send from your connected business number. Inbound
        messages appear when you configure the Meta webhook (see Integrations).
      </p>

      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
        <span>
          <strong>{stats.total}</strong> conversations
        </span>
        {stats.unread > 0 && (
          <span className="bg-green-500 text-white font-bold px-2 py-0.5 rounded-full">
            {stats.unread} unread
          </span>
        )}
      </div>

      <div className="crm-workspace--master-detail crm-split-shell flex flex-col flex-1 min-h-[min(70dvh,520px)] md:min-h-0">
        {isMobile && !selected ? (
          <p className="crm-mobile-split-hint">Tap a conversation to open the thread.</p>
        ) : null}
        <div className="flex flex-1 min-h-0 flex-col md:flex-row md:gap-4 md:h-[calc(100vh-280px)] md:min-h-[420px]">
        <div
          className={`crm-split-sidebar md:w-72 md:shrink-0 border border-gray-200 rounded-xl overflow-hidden flex flex-col bg-white min-h-0 ${showThreadList ? '' : 'hidden'}`}
        >
          <div className="px-3 py-2.5 border-b border-gray-100 flex flex-col gap-1.5">
            <input
              className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-400"
              placeholder="Filter by phone…"
              value={filterPhone}
              onChange={(e) => setFilterPhone(e.target.value)}
            />
            <div className="flex gap-1.5">
              <select
                className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                value={filterCampaign}
                onChange={(e) => {
                  setFilterCampaign(e.target.value)
                  setFilterTag('')
                }}
              >
                <option value="">All conversations</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setFilterTag(filterTag === 'interested' ? '' : 'interested')
                  setFilterCampaign('')
                }}
                title="Interested leads"
                className={`shrink-0 px-2 py-1.5 rounded-lg text-xs font-semibold border ${
                  filterTag === 'interested'
                    ? 'bg-yellow-400 border-yellow-400 text-white'
                    : 'border-gray-200 text-gray-400 hover:border-yellow-400'
                }`}
              >
                ⭐
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {loading && <p className="p-4 text-center text-xs text-gray-400">Loading…</p>}
            {!loading && threads.length === 0 && (
              <p className="p-6 text-center text-xs text-gray-400 leading-relaxed">
                No conversations yet. Send from Pipeline, bulk WhatsApp, or marketing campaigns — replies
                appear here after webhook setup.
              </p>
            )}
            {threads.map((t) => {
              const title = t.leadName || formatPhoneDisplay(t.leadPhone) || t.leadPhone
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => openThread(t.id)}
                  className={`w-full text-left px-3 py-3 hover:bg-gray-50 ${
                    selected === t.id ? 'bg-green-50 border-l-2 border-green-500' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-xs shrink-0">
                      {title[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between gap-1">
                        <p className={`text-xs font-semibold truncate ${t.unread ? 'text-gray-900' : 'text-gray-600'}`}>
                          {title}
                        </p>
                        {t.unread && <span className="w-2 h-2 bg-green-500 rounded-full shrink-0 mt-1" />}
                      </div>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{t.lastSnippet || '—'}</p>
                      <p className="text-[10px] text-gray-300 mt-0.5">{formatPhoneDisplay(t.leadPhone)}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div
          className={`crm-split-main flex-1 border border-gray-200 rounded-xl overflow-hidden flex flex-col bg-white min-w-0 min-h-0 ${showThreadDetail ? '' : 'hidden'}`}
        >
          {isMobile && selected ? (
            <button type="button" className="crm-mobile-back shrink-0 mx-3 mt-2" onClick={closeThread}>
              ← Back to chats
            </button>
          ) : null}
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-sm text-gray-400 gap-2">
              <span className="text-3xl">💬</span>
              Select a conversation
            </div>
          ) : threadLoading ? (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400">Loading…</div>
          ) : thread ? (
            <>
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {thread.leadName || formatPhoneDisplay(thread.leadPhone)}
                  </p>
                  <p className="text-xs text-gray-400">{formatPhoneDisplay(thread.leadPhone)}</p>
                </div>
                {thread.leadId && (
                  <button
                    type="button"
                    onClick={openLead}
                    className="text-xs font-medium px-2.5 py-1 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    Open in Pipeline
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleInterested}
                  disabled={tagging}
                  className={`text-xs font-medium px-2.5 py-1 rounded-lg border ${
                    thread.leadTag === 'interested'
                      ? 'bg-yellow-50 border-yellow-300 text-yellow-800'
                      : 'border-gray-200 text-gray-500'
                  }`}
                >
                  {thread.leadTag === 'interested' ? '⭐ Interested' : '☆ Mark interested'}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 bg-gray-50">
                {(thread.messages || []).map((msg, i) => (
                  <div
                    key={msg.id || i}
                    className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-3 py-2 rounded-2xl text-xs shadow-sm ${
                        msg.direction === 'outbound'
                          ? 'bg-green-500 text-white rounded-br-sm'
                          : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm'
                      }`}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.body}</p>
                      <div
                        className={`flex items-center justify-end gap-1 mt-1 ${
                          msg.direction === 'outbound' ? 'text-green-100' : 'text-gray-400'
                        }`}
                      >
                        <span className="text-[10px]">
                          {msg.sentAt
                            ? new Date(msg.sentAt).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : ''}
                        </span>
                        {msg.direction === 'outbound' && <MsgTick status={msg.status} />}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="px-4 py-3 border-t border-gray-100 flex gap-2 bg-white">
                <textarea
                  className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-green-400"
                  rows={2}
                  placeholder="Reply via WhatsApp API…"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      if (!sending && reply.trim()) sendReply()
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={sendReply}
                  disabled={sending || !reply.trim()}
                  className="px-4 py-2 bg-green-500 text-white text-sm font-semibold rounded-xl hover:bg-green-600 disabled:opacity-50 shrink-0 self-end"
                >
                  {sending ? '…' : 'Send'}
                </button>
              </div>
            </>
          ) : null}
        </div>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      )}
    </div>
  )
}
