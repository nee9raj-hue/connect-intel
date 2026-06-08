import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { formatDateTime } from '../../lib/crmUiConstants'
import useIsMobile from '../../hooks/useIsMobile'
import ChithiAppChrome from './ChithiAppChrome'
import ChithiComposer from './ChithiComposer'
import ChithiMessageBody from './ChithiMessageBody'
import ChithiNewChannelModal from './ChithiNewChannelModal'
import ChithiNewMessageModal from './ChithiNewMessageModal'
import ChithiV2Home from './ChithiV2Home'
import ChithiV2ContextPanel from './ChithiV2ContextPanel'
import LoadingExperience from '../ui/LoadingExperience'
import { LOADING_MESSAGES } from '../../lib/loadingQuotes'

const PENDING_DM_PREFIX = 'pending-dm:'

function avatarInitials(name) {
  const parts = String(name || '?').trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?'
}

function groupMessages(messages) {
  const groups = []
  let current = null
  for (const msg of messages) {
    const day = msg.createdAt?.slice(0, 10)
    const key = `${msg.authorUserId || msg.authorName}-${day}`
    if (!current || current.key !== key) {
      current = { key, authorName: msg.authorName, isMine: msg.isMine, messages: [msg] }
      groups.push(current)
    } else {
      current.messages.push(msg)
    }
  }
  return groups
}

export default function ChithiV2Workspace({ onNavigate, panelOptions, isActive, onOpenCrmMenu }) {
  const { user, teamMembers, refreshTeam, markChithiSeen, chithiUnread, refreshChithiUnread, openPipelineLead } =
    useApp()
  const isMobile = useIsMobile()
  const isOrgAdmin = Boolean(user?.isOrgAdmin)
  const isTablet = useIsMobile(1024)

  const [mobileScreen, setMobileScreen] = useState(() => (panelOptions?.channel ? 'chat' : 'list'))
  const [channels, setChannels] = useState([])
  const [channelId, setChannelId] = useState(null)
  const [showHome, setShowHome] = useState(!panelOptions?.channel)
  const [messages, setMessages] = useState([])
  const [channelMeta, setChannelMeta] = useState(null)
  const [workspace, setWorkspace] = useState(null)
  const [context, setContext] = useState(null)
  const [contextLoading, setContextLoading] = useState(false)
  const [loadingChannels, setLoadingChannels] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiReply, setAiReply] = useState('')
  const [showDmModal, setShowDmModal] = useState(false)
  const [showChannelModal, setShowChannelModal] = useState(false)
  const [threadParentId, setThreadParentId] = useState(null)
  const [expandedThreads, setExpandedThreads] = useState(() => new Set())
  const [reactions, setReactions] = useState(['👍', '✅', '👀', '🎉'])
  const [showContext, setShowContext] = useState(!isMobile)
  const feedEndRef = useRef(null)
  const sendLockRef = useRef(false)
  const messagesCacheRef = useRef(new Map())

  const dmMembers = useMemo(
    () => (teamMembers || []).filter((m) => m.userId !== user?.id && m.status === 'active'),
    [teamMembers, user?.id]
  )

  const activeChannel = useMemo(() => channels.find((c) => c.id === channelId) || null, [channels, channelId])

  const loadWorkspace = useCallback(async () => {
    try {
      const data = await api.getChithiWorkspace()
      setWorkspace(data.workspace)
    } catch {
      /* ignore */
    }
  }, [])

  const loadChannels = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoadingChannels(true)
    try {
      const data = await api.listChithiChannels()
      const list = data.channels || []
      setChannels((prev) => {
        const pending = prev.filter((c) => c.pending && c.id?.startsWith(PENDING_DM_PREFIX))
        const merged = [...list]
        for (const p of pending) {
          if (!merged.some((c) => c.peerUserId === p.peerUserId)) merged.push(p)
        }
        return merged
      })
      if (panelOptions?.channel && list.some((c) => c.id === panelOptions.channel)) {
        setChannelId(panelOptions.channel)
        setShowHome(false)
      }
    } catch (e) {
      if (!silent) setError(e.message)
    } finally {
      if (!silent) setLoadingChannels(false)
    }
  }, [panelOptions?.channel])

  const loadContext = useCallback(async (id) => {
    if (!id || id.startsWith(PENDING_DM_PREFIX)) {
      setContext(null)
      return
    }
    setContextLoading(true)
    try {
      const data = await api.getChithiContext(id)
      setContext(data.context)
    } catch {
      setContext(null)
    } finally {
      setContextLoading(false)
    }
  }, [])

  const loadMessages = useCallback(async (id, { silent = false } = {}) => {
    if (!id || id.startsWith(PENDING_DM_PREFIX)) return
    if (!silent) setLoadingMessages(true)
    try {
      const data = await api.listChithiMessages(id)
      setMessages(data.messages || [])
      setChannelMeta(data.channel || null)
      if (data.reactions?.length) setReactions(data.reactions)
      messagesCacheRef.current.set(id, { messages: data.messages, channelMeta: data.channel })
    } catch (e) {
      if (!silent) setError(e.message)
    } finally {
      if (!silent) setLoadingMessages(false)
    }
  }, [])

  useEffect(() => {
    refreshTeam?.()
    void loadChannels()
    void loadWorkspace()
  }, [loadChannels, loadWorkspace, refreshTeam])

  useEffect(() => {
    if (!channelId || showHome) return
    void loadMessages(channelId)
    void loadContext(channelId)
  }, [channelId, showHome, loadMessages, loadContext])

  useEffect(() => {
    if (!isActive) return
    void markChithiSeen?.()
    const id = window.setInterval(() => {
      if (channelId && !showHome) void loadMessages(channelId, { silent: true })
      void loadChannels({ silent: true })
      void loadWorkspace()
      void refreshChithiUnread?.()
    }, 6_000)
    return () => window.clearInterval(id)
  }, [isActive, channelId, showHome, loadMessages, loadChannels, loadWorkspace, markChithiSeen, refreshChithiUnread])

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const selectChannel = (id) => {
    setShowHome(false)
    setChannelId(id)
    setThreadParentId(null)
    setError(null)
    if (isMobile) setMobileScreen('chat')
    const cached = messagesCacheRef.current.get(id)
    if (cached) {
      setMessages(cached.messages)
      setChannelMeta(cached.channelMeta)
    }
  }

  const openCustomerChannel = async (leadId, label) => {
    setBusy(true)
    try {
      const data = await api.openChithiEntityChannel({ roomType: 'customer', leadId, label })
      if (data.channel) {
        setChannels((prev) => (prev.some((c) => c.id === data.channel.id) ? prev : [...prev, data.channel]))
        selectChannel(data.channel.id)
      }
      await loadChannels({ silent: true })
      await loadWorkspace()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const openDealRoom = async (leadId, dealId) => {
    setBusy(true)
    try {
      const data = await api.openChithiEntityChannel({ roomType: 'deal', leadId, dealId })
      if (data.channel) {
        setChannels((prev) => (prev.some((c) => c.id === data.channel.id) ? prev : [...prev, data.channel]))
        selectChannel(data.channel.id)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const sendMessage = async () => {
    if (!channelId || sendLockRef.current) return
    const text = body.trim()
    if (!text) return
    sendLockRef.current = true
    setSending(true)
    const tempId = `pending-${Date.now()}`
    const optimistic = {
      id: tempId,
      body: text,
      isMine: true,
      authorName: user?.name || 'You',
      createdAt: new Date().toISOString(),
      pending: true,
      messageType: 'user',
    }
    setMessages((prev) => [...prev, optimistic])
    setBody('')
    const replyThread = threadParentId
    setThreadParentId(null)
    try {
      const data = await api.sendChithiMessage(channelId, text, replyThread)
      setMessages((prev) => {
        const rest = prev.filter((m) => m.id !== tempId)
        return data.message ? [...rest, data.message] : rest
      })
      void refreshChithiUnread?.()
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setBody(text)
      if (replyThread) setThreadParentId(replyThread)
      setError(e.message)
    } finally {
      setSending(false)
      sendLockRef.current = false
    }
  }

  const runSearch = async (q) => {
    setSearchQuery(q)
    if (q.trim().length < 2) {
      setSearchResults(null)
      return
    }
    try {
      const data = await api.searchChithi(q)
      setSearchResults(data.results)
    } catch {
      setSearchResults(null)
    }
  }

  const askAi = async (prompt) => {
    setAiBusy(true)
    setAiReply('')
    try {
      const data = await api.sendAssistantMessage(prompt)
      setAiReply(data.reply || data.message || 'No response')
    } catch (e) {
      setAiReply(e.message || 'Assistant unavailable')
    } finally {
      setAiBusy(false)
    }
  }

  const startDm = async (peerUserId) => {
    const member = dmMembers.find((m) => m.userId === peerUserId)
    const label = member?.name || member?.email || 'Teammate'
    const pendingId = `${PENDING_DM_PREFIX}${peerUserId}`
    setShowDmModal(false)
    setChannels((prev) => [
      ...prev.filter((c) => c.peerUserId !== peerUserId),
      { id: pendingId, type: 'dm', label, peerUserId, pending: true },
    ])
    selectChannel(pendingId)
    setMessages([])
    setBusy(true)
    try {
      const data = await api.openChithiDm(peerUserId)
      if (data.channel) {
        setChannels((prev) => [...prev.filter((c) => c.id !== pendingId), data.channel])
        selectChannel(data.channel.id)
        void loadMessages(data.channel.id, { silent: true })
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const channelGroups = useMemo(() => {
    const customer = channels.filter((c) => c.roomType === 'customer')
    const deals = channels.filter((c) => c.roomType === 'deal')
    const team = channels.filter((c) => c.roomType === 'team' || (c.type === 'public' && !c.roomType))
    const dms = channels.filter((c) => c.type === 'dm')
    return { customer, deals, team, dms }
  }, [channels])

  const topLevelMessages = messages.filter((m) => !m.threadParentId)
  const messageGroups = groupMessages(topLevelMessages)
  const repliesFor = (parentId) => messages.filter((m) => m.threadParentId === parentId)

  const channelTitle = showHome
    ? 'Home'
    : activeChannel?.type === 'dm'
      ? activeChannel.label
      : activeChannel?.label || 'Conversation'

  const mobileChromeScreen = isMobile ? mobileScreen : null

  return (
    <div className="chithi2-app">
      <ChithiAppChrome
        view="chat"
        onNavigate={onNavigate}
        chithiUnread={chithiUnread}
        channelLabel={channelTitle}
        mobileScreen={mobileChromeScreen}
        onMobileBack={() => {
          if (showHome) onOpenCrmMenu?.()
          else {
            setMobileScreen('list')
            setShowHome(true)
            setChannelId(null)
          }
        }}
        activeChannelType={activeChannel?.roomType || activeChannel?.type}
      />

      <div className={`chithi2-body${isMobile ? ` chithi2-body--mobile-${mobileScreen}` : ''}`}>
        <aside className="chithi2-rail">
          <div className="chithi2-rail__search">
            <input
              type="search"
              placeholder="Search messages, customers, deals…"
              onFocus={() => setSearchOpen(true)}
              readOnly
            />
          </div>
          <button
            type="button"
            className={`chithi2-rail__home${showHome ? ' is-active' : ''}`}
            onClick={() => {
              setShowHome(true)
              setChannelId(null)
              if (isMobile) setMobileScreen('list')
            }}
          >
            <span>🏠</span> Home
            {(chithiUnread?.total || 0) > 0 ? (
              <em className="chithi2-badge">{chithiUnread.total > 99 ? '99+' : chithiUnread.total}</em>
            ) : null}
          </button>

          <RailSection title="Customer channels" channels={channelGroups.customer} activeId={channelId} onSelect={selectChannel} />
          <RailSection title="Deal rooms" channels={channelGroups.deals} activeId={channelId} onSelect={selectChannel} />
          <RailSection title="Team" channels={channelGroups.team} activeId={channelId} onSelect={selectChannel} />
          <RailSection title="Direct messages" channels={channelGroups.dms} activeId={channelId} onSelect={selectChannel} />

          <div className="chithi2-rail__foot">
            <button type="button" className="chithi2-btn chithi2-btn--sm" onClick={() => setShowDmModal(true)}>
              + Message
            </button>
            <button type="button" className="chithi2-btn chithi2-btn--sm chithi2-btn--ghost" onClick={() => setAiOpen(true)}>
              ✦ Ask Chithi
            </button>
            {isOrgAdmin ? (
              <button type="button" className="chithi2-btn chithi2-btn--sm chithi2-btn--ghost" onClick={() => setShowChannelModal(true)}>
                + Channel
              </button>
            ) : null}
          </div>
        </aside>

        <main className="chithi2-main">
          {showHome ? (
            <ChithiV2Home
              workspace={workspace}
              onSelectChannel={selectChannel}
              onOpenCustomerChannel={openCustomerChannel}
              onNavigate={onNavigate}
              onOpenTasks={() => onNavigate?.('chithi', { tab: 'tasks' })}
              onNewDm={() => setShowDmModal(true)}
            />
          ) : (
            <>
              <header className="chithi2-main__head">
                <div>
                  <h2>{channelTitle}</h2>
                  <p>{channelMeta?.topic || activeChannel?.topic || 'Collaborate with CRM context'}</p>
                </div>
                <div className="chithi2-main__tools">
                  {!isMobile && (
                    <button type="button" className="chithi2-btn chithi2-btn--ghost" onClick={() => setShowContext((v) => !v)}>
                      {showContext ? 'Hide context' : 'Show context'}
                    </button>
                  )}
                </div>
              </header>

              {error ? <p className="chithi2-alert">{error}</p> : null}

              <div className="chithi2-feed">
                {loadingMessages && !messages.length ? (
                  <LoadingExperience message={LOADING_MESSAGES.notes} compact fill={false} />
                ) : !messageGroups.length ? (
                  <p className="chithi2-empty">Start the conversation — CRM activity posts here automatically.</p>
                ) : (
                  messageGroups.map((group) => (
                    <div key={group.key} className={`chithi2-msg-group${group.isMine ? ' is-mine' : ''}`}>
                      <div className="chithi2-avatar">{avatarInitials(group.authorName)}</div>
                      <div className="chithi2-msg-group__body">
                        <header>
                          <strong>{group.isMine ? 'You' : group.authorName}</strong>
                          <time>{formatDateTime(group.messages[0]?.createdAt)}</time>
                        </header>
                        {group.messages.map((msg) => (
                          <MessageBlock
                            key={msg.id}
                            msg={msg}
                            replies={repliesFor(msg.id)}
                            expanded={expandedThreads.has(msg.id)}
                            onToggleThread={() =>
                              setExpandedThreads((prev) => {
                                const next = new Set(prev)
                                if (next.has(msg.id)) next.delete(msg.id)
                                else next.add(msg.id)
                                return next
                              })
                            }
                            onReply={() => {
                              setThreadParentId(msg.id)
                              setExpandedThreads((prev) => new Set(prev).add(msg.id))
                            }}
                            reactions={reactions}
                            userId={user?.id}
                            onLeadClick={(id) => {
                              openPipelineLead(id, 'overview')
                              onNavigate?.('pipeline')
                            }}
                            onReact={async (messageId, emoji) => {
                              try {
                                const data = await api.reactChithiMessage(messageId, emoji)
                                setMessages((prev) =>
                                  prev.map((m) => (m.id === data.message.id ? { ...m, ...data.message } : m))
                                )
                              } catch (e) {
                                setError(e.message)
                              }
                            }}
                            isPublic={activeChannel?.type === 'public'}
                          />
                        ))}
                      </div>
                    </div>
                  ))
                )}
                <div ref={feedEndRef} />
              </div>

              <footer className="chithi2-composer">
                {threadParentId ? (
                  <div className="chithi2-thread-bar">
                    <span>Replying in thread</span>
                    <button type="button" onClick={() => setThreadParentId(null)}>
                      Cancel
                    </button>
                  </div>
                ) : null}
                <ChithiComposer
                  value={body}
                  onChange={setBody}
                  onSend={sendMessage}
                  teamMembers={teamMembers}
                  currentUserId={user?.id}
                  placeholder="@sales @marketing · #customer · #deal"
                  rows={2}
                  className="chithi2-composer__input"
                  disabled={sending || !channelId}
                />
                <button
                  type="button"
                  className="chithi2-btn chithi2-btn--primary"
                  disabled={sending || !body.trim()}
                  onClick={sendMessage}
                >
                  {sending ? 'Sending…' : 'Send'}
                </button>
              </footer>
            </>
          )}
        </main>

        {showContext && !isMobile && !isTablet && (
          <ChithiV2ContextPanel
            context={context}
            loading={contextLoading}
            onNavigate={onNavigate}
            onOpenLead={(leadId) => {
              openPipelineLead(leadId, 'overview')
              onNavigate?.('pipeline')
            }}
            onOpenDeal={openDealRoom}
          />
        )}
      </div>

      {searchOpen ? (
        <div className="chithi2-overlay" role="dialog">
          <div className="chithi2-search">
            <header>
              <input
                autoFocus
                type="search"
                placeholder="Search everything…"
                value={searchQuery}
                onChange={(e) => void runSearch(e.target.value)}
              />
              <button type="button" onClick={() => setSearchOpen(false)}>
                Close
              </button>
            </header>
            <div className="chithi2-search__results">
              {searchResults?.messages?.map((m) => (
                <button key={m.id} type="button" onClick={() => { selectChannel(m.channelId); setSearchOpen(false) }}>
                  <span>Message</span>
                  <p>{m.body}</p>
                </button>
              ))}
              {searchResults?.customers?.map((c) => (
                <button key={c.leadId} type="button" onClick={() => { void openCustomerChannel(c.leadId, c.label); setSearchOpen(false) }}>
                  <span>Customer</span>
                  <p>{c.label}</p>
                </button>
              ))}
              {searchResults?.deals?.map((d) => (
                <button key={d.dealId} type="button" onClick={() => { void openDealRoom(d.leadId, d.dealId); setSearchOpen(false) }}>
                  <span>Deal</span>
                  <p>{d.name}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {aiOpen ? (
        <div className="chithi2-overlay" role="dialog">
          <div className="chithi2-ai">
            <header>
              <h3>Ask Chithi</h3>
              <button type="button" onClick={() => setAiOpen(false)}>
                Close
              </button>
            </header>
            <div className="chithi2-ai__prompts">
              {[
                'Summarize activity on this account',
                'What are the pending follow-ups?',
                'Which deals are at risk?',
              ].map((p) => (
                <button key={p} type="button" disabled={aiBusy} onClick={() => void askAi(p)}>
                  {p}
                </button>
              ))}
            </div>
            {aiReply ? <div className="chithi2-ai__reply">{aiReply}</div> : null}
          </div>
        </div>
      ) : null}

      <ChithiNewMessageModal open={showDmModal} onClose={() => setShowDmModal(false)} members={dmMembers} busy={busy} onSelect={(id) => void startDm(id)} />
      {isOrgAdmin ? (
        <ChithiNewChannelModal
          open={showChannelModal}
          onClose={() => setShowChannelModal(false)}
          busy={busy}
          onCreate={async ({ name, topic }) => {
            setBusy(true)
            try {
              const data = await api.createChithiChannel({ name, topic })
              if (data.channel) setChannels((prev) => [...prev, data.channel])
              setShowChannelModal(false)
            } catch (e) {
              setError(e.message)
            } finally {
              setBusy(false)
            }
          }}
        />
      ) : null}
    </div>
  )
}

function RailSection({ title, channels, activeId, onSelect }) {
  if (!channels?.length) return null
  return (
    <div className="chithi2-rail__section">
      <p>{title}</p>
      {channels.map((ch) => (
        <button
          key={ch.id}
          type="button"
          className={`chithi2-rail__channel${activeId === ch.id ? ' is-active' : ''}`}
          onClick={() => onSelect(ch.id)}
        >
          <span className="chithi2-rail__channel-label">{ch.label}</span>
        </button>
      ))}
    </div>
  )
}

function MessageBlock({ msg, replies, expanded, onToggleThread, onReply, reactions, userId, onLeadClick, onReact, isPublic }) {
  if (msg.messageType === 'activity') {
    return (
      <article className="chithi2-activity-msg">
        <span className="chithi2-activity-msg__badge">CRM</span>
        <p>{msg.body}</p>
        <time>{formatDateTime(msg.createdAt)}</time>
      </article>
    )
  }

  const replyList = replies || []
  return (
    <article className={`chithi2-msg${msg.pending ? ' is-pending' : ''}`}>
      <div className="chithi2-msg__bubble">
        <ChithiMessageBody body={msg.body} onLeadClick={onLeadClick} />
      </div>
      {isPublic && msg.source === 'chithi' && (
        <div className="chithi2-msg__meta">
          {reactions.map((emoji) => {
            const list = msg.reactions?.[emoji] || []
            return (
              <button key={emoji} type="button" onClick={() => onReact(msg.id, emoji)}>
                {emoji} {list.length || ''}
              </button>
            )
          })}
          <button type="button" onClick={onReply}>
            Thread
          </button>
          {(msg.threadReplyCount > 0 || replyList.length > 0) && (
            <button type="button" onClick={onToggleThread}>
              {msg.threadReplyCount || replyList.length} replies
            </button>
          )}
        </div>
      )}
      {expanded && replyList.length > 0 && (
        <div className="chithi2-thread">
          {replyList.map((r) => (
            <div key={r.id} className="chithi2-thread__reply">
              <strong>{r.authorName}</strong>
              <ChithiMessageBody body={r.body} onLeadClick={onLeadClick} />
            </div>
          ))}
        </div>
      )}
    </article>
  )
}
