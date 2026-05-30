import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { isChithiSoundEnabled, setChithiSoundEnabled } from '../../lib/chithiSound'
import { formatDateTime } from '../../lib/crmUiConstants'
import useIsMobile from '../../hooks/useIsMobile'
import ChithiAppChrome from './ChithiAppChrome'
import ChithiComposer from './ChithiComposer'
import ChithiMessageBody from './ChithiMessageBody'
import ChithiNewChannelModal from './ChithiNewChannelModal'
import ChithiNewMessageModal from './ChithiNewMessageModal'
import ChithiPushToggle from './ChithiPushToggle'
import TeamTasksPanel from '../team/TeamTasksPanel'
import LoadingExperience from '../ui/LoadingExperience'
import { LOADING_MESSAGES } from '../../lib/loadingQuotes'

function resolveView(activePanel, panelOptions) {
  if (panelOptions?.tab === 'tasks' || activePanel === 'team-tasks') return 'tasks'
  if (panelOptions?.tab === 'meetings') return 'meetings'
  return 'chat'
}

const PENDING_DM_PREFIX = 'pending-dm:'

export default function ChithiPanel({ onNavigate, activePanel, panelOptions, isActive, onOpenCrmMenu }) {
  const { user, teamMembers, refreshTeam, markChithiSeen, chithiUnread, refreshChithiUnread, openPipelineLead } =
    useApp()
  const isMobile = useIsMobile()
  const isOrgAdmin = Boolean(user?.isOrgAdmin)
  const view = resolveView(activePanel, panelOptions)
  const soundOn = isChithiSoundEnabled()
  const [mobileScreen, setMobileScreen] = useState(() => (panelOptions?.channel ? 'chat' : 'list'))

  const [channels, setChannels] = useState([])
  const [channelId, setChannelId] = useState(null)
  const [messages, setMessages] = useState([])
  const [channelMeta, setChannelMeta] = useState(null)
  const [loadingChannels, setLoadingChannels] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [showDmModal, setShowDmModal] = useState(false)
  const [showChannelModal, setShowChannelModal] = useState(false)
  const [teamLoading, setTeamLoading] = useState(false)
  const [threadParentId, setThreadParentId] = useState(null)
  const [expandedThreads, setExpandedThreads] = useState(() => new Set())
  const [reactions, setReactions] = useState(['👍', '✅', '👀', '🎉'])
  const [slackSettings, setSlackSettings] = useState(null)
  const [slackWebhookInput, setSlackWebhookInput] = useState('')
  const feedEndRef = useRef(null)
  const seenMarkedRef = useRef(false)
  const sendLockRef = useRef(false)
  const messagesCacheRef = useRef(new Map())
  const teamFetchRef = useRef(false)

  const dmMembers = useMemo(
    () => (teamMembers || []).filter((m) => m.userId !== user?.id && m.status === 'active'),
    [teamMembers, user?.id]
  )

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === channelId) || null,
    [channels, channelId]
  )

  const loadChannels = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoadingChannels(true)
    setError(null)
    try {
      const data = await api.listChithiChannels()
      const list = data.channels || []
      setChannels((prev) => {
        const pending = prev.filter((c) => c.pending && c.id.startsWith(PENDING_DM_PREFIX))
        const merged = [...list]
        for (const p of pending) {
          if (!merged.some((c) => c.peerUserId === p.peerUserId)) merged.push(p)
        }
        return merged
      })
      setChannelId((prev) => {
        const fromUrl = panelOptions?.channel
        if (fromUrl && list.some((c) => c.id === fromUrl)) return fromUrl
        if (prev && (list.some((c) => c.id === prev) || prev.startsWith(PENDING_DM_PREFIX))) return prev
        const general = list.find((c) => c.type === 'public')
        return general?.id || list[0]?.id || null
      })
    } catch (e) {
      if (!silent) setError(e.message)
    } finally {
      if (!silent) setLoadingChannels(false)
    }
  }, [panelOptions?.channel])

  const loadMessages = useCallback(async (id, { silent = false } = {}) => {
    if (!id || id.startsWith(PENDING_DM_PREFIX)) {
      if (!id?.startsWith(PENDING_DM_PREFIX)) {
        setMessages([])
        setChannelMeta(null)
      }
      return
    }
    if (!silent) setLoadingMessages(true)
    try {
      const data = await api.listChithiMessages(id)
      const nextMessages = data.messages || []
      setMessages(nextMessages)
      setChannelMeta(data.channel || null)
      if (data.reactions?.length) setReactions(data.reactions)
      messagesCacheRef.current.set(id, {
        messages: nextMessages,
        channelMeta: data.channel || null,
        reactions: data.reactions,
      })
    } catch (e) {
      if (!silent) setError(e.message)
    } finally {
      if (!silent) setLoadingMessages(false)
    }
  }, [])

  useEffect(() => {
    if (!isMobile || view !== 'chat') return
    if (panelOptions?.channel) setMobileScreen('chat')
  }, [isMobile, view, panelOptions?.channel])

  useEffect(() => {
    if (!isActive || !isMobile || view !== 'chat') return
    if (!panelOptions?.channel) setMobileScreen('list')
  }, [isActive, isMobile, view, panelOptions?.channel])

  const mobileChromeScreen = isMobile && view === 'chat' ? mobileScreen : isMobile ? 'list' : null

  const backToChannelList = () => {
    setMobileScreen('list')
    setThreadParentId(null)
    setError(null)
  }

  useEffect(() => {
    refreshTeam?.()
    void loadChannels()
    if (isOrgAdmin) {
      api.getChithiSettings().then(setSlackSettings).catch(() => {})
    }
  }, [loadChannels, refreshTeam, isOrgAdmin])

  useEffect(() => {
    if (!isActive || view !== 'chat' || dmMembers.length > 0) return
    if (teamFetchRef.current) return
    teamFetchRef.current = true
    setTeamLoading(true)
    void refreshTeam?.().finally(() => {
      setTeamLoading(false)
      teamFetchRef.current = false
    })
  }, [isActive, view, dmMembers.length, refreshTeam])

  useEffect(() => {
    if (view !== 'chat' || !channelId) return
    const cached = messagesCacheRef.current.get(channelId)
    if (cached) {
      setMessages(cached.messages)
      setChannelMeta(cached.channelMeta)
      if (cached.reactions?.length) setReactions(cached.reactions)
      setLoadingMessages(false)
      void loadMessages(channelId, { silent: true })
    } else {
      void loadMessages(channelId)
    }
  }, [view, channelId, loadMessages])

  useEffect(() => {
    if (!isActive || user?.accountType !== 'company' || view !== 'chat') return
    if (seenMarkedRef.current) return
    seenMarkedRef.current = true
    void markChithiSeen?.()
  }, [isActive, user?.accountType, markChithiSeen, view])

  useEffect(() => {
    if (!isActive || view !== 'chat') return undefined
    const id = window.setInterval(() => {
      if (channelId) void loadMessages(channelId, { silent: true })
      void loadChannels({ silent: true })
      void refreshChithiUnread?.()
    }, 6_000)
    return () => window.clearInterval(id)
  }, [isActive, view, channelId, loadMessages, loadChannels, refreshChithiUnread])

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(t)
  }, [notice])

  const selectChannel = (id) => {
    setShowDmModal(false)
    setShowChannelModal(false)
    setChannelId(id)
    setThreadParentId(null)
    setError(null)
    if (isMobile) setMobileScreen('chat')
    const cached = messagesCacheRef.current.get(id)
    if (cached) {
      setMessages(cached.messages)
      setChannelMeta(cached.channelMeta)
      setLoadingMessages(false)
    }
  }

  const createChannel = async ({ name, topic }) => {
    if (!name?.trim()) return setError('Channel name is required')
    setBusy(true)
    try {
      const data = await api.createChithiChannel({
        name: name.trim(),
        topic: topic?.trim() || '',
      })
      setShowChannelModal(false)
      if (data.channel) mergeChannel(data.channel)
      else await loadChannels()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const saveSlackWebhook = async () => {
    setBusy(true)
    try {
      const data = await api.updateChithiSettings({ slackWebhookUrl: slackWebhookInput.trim() })
      setSlackSettings(data)
      setSlackWebhookInput('')
      setNotice('Slack webhook saved')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const toggleReaction = async (messageId, emoji) => {
    try {
      const data = await api.reactChithiMessage(messageId, emoji)
      setMessages((prev) => prev.map((m) => (m.id === data.message.id ? { ...m, ...data.message } : m)))
    } catch (e) {
      setError(e.message)
    }
  }

  const toggleThread = (id) => {
    setExpandedThreads((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const mergeChannel = (channel) => {
    if (!channel?.id) return
    setChannels((prev) => {
      if (prev.some((c) => c.id === channel.id)) return prev
      return [...prev, channel]
    })
    selectChannel(channel.id)
  }

  const startDm = async (peerUserId) => {
    if (!peerUserId) return setError('Choose a teammate')
    const member = dmMembers.find((m) => m.userId === peerUserId)
    const label = member?.name || member?.email || 'Teammate'
    const pendingId = `${PENDING_DM_PREFIX}${peerUserId}`

    setShowDmModal(false)
    setError(null)

    const pendingChannel = {
      id: pendingId,
      type: 'dm',
      slug: null,
      name: label,
      label,
      peerUserId,
      pending: true,
    }
    setChannels((prev) => {
      const without = prev.filter((c) => c.peerUserId !== peerUserId && c.id !== pendingId)
      return [...without, pendingChannel]
    })
    selectChannel(pendingId)
    setMessages([])
    setChannelMeta(null)
    setLoadingMessages(false)

    setBusy(true)
    try {
      const data = await api.openChithiDm(peerUserId)
      if (data.channel) {
        setChannels((prev) => {
          const without = prev.filter(
            (c) => c.id !== pendingId && c.peerUserId !== peerUserId && c.id !== data.channel.id
          )
          return [...without, data.channel]
        })
        selectChannel(data.channel.id)
        void loadMessages(data.channel.id, { silent: true })
      } else {
        setChannels((prev) => prev.filter((c) => c.id !== pendingId))
        await loadChannels()
      }
    } catch (e) {
      setChannels((prev) => prev.filter((c) => c.id !== pendingId))
      setChannelId((prev) => (prev === pendingId ? null : prev))
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const sendMessage = async () => {
    if (!channelId || sendLockRef.current) return
    const text = body.trim()
    if (!text) return setError('Write a message')
    sendLockRef.current = true
    setSending(true)
    setError(null)

    const tempId = `pending-${Date.now()}`
    const optimistic = {
      id: tempId,
      body: text,
      isMine: true,
      authorName: user?.name || 'You',
      createdAt: new Date().toISOString(),
      pending: true,
      threadParentId: threadParentId || null,
      reactions: {},
      source: 'chithi',
    }
    setMessages((prev) => [...prev, optimistic])
    setBody('')
    const replyThread = threadParentId
    setThreadParentId(null)

    try {
      const data = await api.sendChithiMessage(channelId, text, replyThread)
      setMessages((prev) => {
        const rest = prev.filter((m) => m.id !== tempId)
        const next = data.message ? [...rest, data.message] : rest
        if (channelId) {
          const cached = messagesCacheRef.current.get(channelId)
          messagesCacheRef.current.set(channelId, {
            messages: next,
            channelMeta: cached?.channelMeta || null,
            reactions: cached?.reactions,
          })
        }
        return next
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

  const openLead = (leadId) => {
    openPipelineLead(leadId, 'overview')
    onNavigate?.('pipeline')
  }

  if (user?.accountType !== 'company' || !user?.organizationId) {
    return (
      <div className="p-8 text-center text-sm text-gray-500">
        Chithi is available on company accounts with teammates.
      </div>
    )
  }

  if (view === 'tasks') {
    return (
      <div className="chithi-app flex flex-col min-h-0 h-full">
        <ChithiAppChrome
          view="tasks"
          onNavigate={onNavigate}
          chithiUnread={chithiUnread}
          mobileScreen={isMobile ? 'list' : null}
        />
        <div className="chithi-app__body flex-1 min-h-0 overflow-hidden">
          <TeamTasksPanel onNavigate={onNavigate} embedded chithiMode />
        </div>
      </div>
    )
  }

  if (view === 'meetings') {
    return (
      <div className="chithi-app flex flex-col min-h-0 h-full">
        <ChithiAppChrome
          view="meetings"
          onNavigate={onNavigate}
          chithiUnread={chithiUnread}
          mobileScreen={isMobile ? 'list' : null}
        />
        <div className="chithi-app__body flex-1 panel-body-scroll px-4 sm:px-6 py-6 max-w-lg">
          <p className="text-sm text-gray-600">
            Customer meetings and follow-ups live on the CRM calendar. Align with your team before calls.
          </p>
          <button
            type="button"
            className="mt-4 text-xs font-semibold px-3 py-2 bg-gray-900 text-white rounded-lg"
            onClick={() => onNavigate?.('crm-calendar', { upcomingOnly: true })}
          >
            Open upcoming meetings
          </button>
        </div>
      </div>
    )
  }

  const publicChannels = channels.filter((c) => c.type === 'public')
  const dmChannels = channels.filter((c) => c.type === 'dm')
  const dmPeerIds = new Set(dmChannels.map((c) => c.peerUserId).filter(Boolean))
  const quickDmMembers = dmMembers.filter((m) => !dmPeerIds.has(m.userId)).slice(0, 6)
  const topLevelMessages = messages.filter((m) => !m.threadParentId)
  const repliesFor = (parentId) => messages.filter((m) => m.threadParentId === parentId)

  const channelTitle =
    activeChannel?.type === 'dm'
      ? activeChannel.label
      : activeChannel?.label?.replace(/^#/, '') || 'general'

  return (
    <div className="chithi-app flex flex-col min-h-0 h-full">
      <ChithiAppChrome
        view="chat"
        onNavigate={onNavigate}
        chithiUnread={chithiUnread}
        channelLabel={channelTitle}
        mobileScreen={mobileChromeScreen}
        onMobileBack={backToChannelList}
        activeChannelType={activeChannel?.type}
      />
      <div
        className={`chithi-app__body flex flex-1 min-h-0${
          isMobile ? ` chithi-mobile-screen--${mobileScreen}` : ''
        }`}
      >
        <aside className="chithi-rail shrink-0 w-[220px] sm:w-[248px] flex flex-col">
          <div className="flex-1 overflow-y-auto py-2 px-1.5 min-h-0">
            <p className="chithi-rail__section-label px-2 py-1">Channels</p>
            {loadingChannels ? (
              <p className="px-3 py-2 chithi-rail__subtitle">Loading…</p>
            ) : (
              publicChannels.map((ch) => (
                <ChannelBtn
                  key={ch.id}
                  label={ch.label}
                  active={ch.id === channelId}
                  onClick={() => selectChannel(ch.id)}
                />
              ))
            )}

            <div className="flex items-center justify-between px-2 py-1 mt-3">
              <p className="chithi-rail__section-label !py-0">Direct messages</p>
              <button
                type="button"
                className="chithi-rail__icon-btn text-base leading-none w-6 h-6 flex items-center justify-center rounded-md hover:bg-[#eef2f6]"
                title="New direct message"
                aria-label="New direct message"
                onClick={() => setShowDmModal(true)}
              >
                +
              </button>
            </div>

            {quickDmMembers.length > 0 && (
              <div className="chithi-quick-dm px-2 pb-2">
                <p className="chithi-rail__subtitle !px-0 mb-1.5">Quick message</p>
                <div className="chithi-quick-dm__chips">
                  {quickDmMembers.map((m) => (
                    <button
                      key={m.userId}
                      type="button"
                      className="chithi-quick-dm__chip"
                      disabled={busy}
                      onClick={() => void startDm(m.userId)}
                      title={`Message ${m.name || m.email}`}
                    >
                      {(m.name || m.email || '?').split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {dmChannels.length === 0 && !loadingChannels ? (
              <p className="px-3 py-1 chithi-rail__subtitle">No DMs yet — start one below.</p>
            ) : (
              dmChannels.map((ch) => (
                <ChannelBtn
                  key={ch.id}
                  label={ch.pending ? `${ch.label}…` : ch.label}
                  active={ch.id === channelId}
                  onClick={() => selectChannel(ch.id)}
                />
              ))
            )}
          </div>

          <div className="chithi-rail__actions shrink-0 p-2 border-t border-[#e8ecf0] space-y-1.5 bg-[#f7f9fb]">
            <button
              type="button"
              className="chithi-rail__action-btn"
              onClick={() => setShowDmModal(true)}
            >
              New direct message
            </button>
            {isOrgAdmin && (
              <button
                type="button"
                className="chithi-rail__action-btn chithi-rail__action-btn--secondary"
                onClick={() => setShowChannelModal(true)}
              >
                New channel
              </button>
            )}
          </div>
        </aside>

        <div className="chithi-main flex-1 flex flex-col min-w-0 min-h-0">
          <div className="chithi-main__channel-bar shrink-0 px-4 py-2 border-b border-[#e8ecf0] bg-[#fafbfc]">
            <p className="text-sm font-semibold text-[#17191c] truncate">
              {activeChannel?.type === 'dm' ? activeChannel?.label : `#${channelTitle}`}
            </p>
            {channelMeta?.topic ? (
              <p className="text-[11px] text-[#6b7785] truncate">{channelMeta.topic}</p>
            ) : (
              <p className="text-[11px] text-[#6b7785]">
                {activeChannel?.type === 'dm'
                  ? 'Direct message · @ teammate · # customer'
                  : '@ teammate · # customer · threads · reactions'}
              </p>
            )}
          </div>

          {(error || notice) && (
            <div className="shrink-0 px-4 pt-2">
              {error && (
                <p className="text-xs text-red-800 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
              )}
              {notice && (
                <p className="text-xs text-green-900 bg-green-50 border border-green-100 rounded-lg px-3 py-2 mt-1">
                  {notice}
                </p>
              )}
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 chithi-feed">
            {loadingMessages && !messages.length ? (
              <LoadingExperience message={LOADING_MESSAGES.notes} compact fill={false} className="rounded-xl" />
            ) : !topLevelMessages.length ? (
              <p className="text-sm text-gray-500 py-8 text-center">
                {activeChannel?.pending
                  ? 'Opening chat…'
                  : activeChannel?.type === 'public'
                    ? 'Start the conversation. @ teammates and # customers from your pipeline.'
                    : 'No messages yet. Say hello to your teammate.'}
              </p>
            ) : (
              topLevelMessages.map((msg) => (
                <ChithiMessageBlock
                  key={msg.id}
                  msg={msg}
                  replies={repliesFor(msg.id)}
                  expanded={expandedThreads.has(msg.id)}
                  onToggleThread={() => toggleThread(msg.id)}
                  onReply={() => {
                    setThreadParentId(msg.id)
                    setExpandedThreads((prev) => new Set(prev).add(msg.id))
                  }}
                  reactions={reactions}
                  userId={user?.id}
                  onLeadClick={openLead}
                  onReact={toggleReaction}
                  isPublic={activeChannel?.type === 'public'}
                />
              ))
            )}
            <div ref={feedEndRef} />
          </div>

          <footer className="shrink-0 border-t border-[#e5e9ee] px-4 py-3 bg-[#fafbfc]">
            {threadParentId && (
              <div className="mb-2 flex items-center justify-between text-[11px] text-gray-600 bg-gray-100 rounded-lg px-2 py-1.5">
                <span>Replying in thread</span>
                <button type="button" className="font-semibold underline" onClick={() => setThreadParentId(null)}>
                  Cancel
                </button>
              </div>
            )}
            <ChithiComposer
              value={body}
              onChange={setBody}
              onSend={sendMessage}
              teamMembers={teamMembers}
              currentUserId={user?.id}
              placeholder={
                threadParentId
                  ? 'Reply in thread…'
                  : activeChannel?.type === 'public'
                    ? `Message ${activeChannel?.label || '#channel'} — @ teammate · # customer`
                    : 'Direct message — @ teammate · # customer'
              }
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white"
              disabled={sending || !channelId || channelId.startsWith(PENDING_DM_PREFIX)}
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] text-gray-500">Enter to send · Shift+Enter for new line</p>
              <button
                type="button"
                disabled={sending || !channelId || !body.trim() || channelId.startsWith(PENDING_DM_PREFIX)}
                onClick={sendMessage}
                className="text-xs font-semibold px-3 py-2 bg-[#ff7a59] text-white rounded-lg disabled:opacity-50 min-w-[72px]"
              >
                {sending ? 'Sending…' : threadParentId ? 'Reply' : 'Send'}
              </button>
            </div>
          </footer>

          <details className="shrink-0 mx-4 mb-3 rounded-lg border border-[#e5e9ee] bg-[#f9fafb] text-[11px] text-gray-600" open>
            <summary className="cursor-pointer px-3 py-2 font-semibold text-gray-800 select-none">
              Notifications & push alerts
            </summary>
            <div className="px-3 pb-2 space-y-2 leading-relaxed">
              <div className="rounded-lg border border-[#e5e9ee] bg-white px-2.5 py-2">
                <p className="font-semibold text-gray-800 mb-1">Phone push (PWA)</p>
                <ChithiPushToggle />
              </div>
              <p>Unread badge and sound while CRM is open. Email when teammates are away.</p>
              {isOrgAdmin && (
                <div className="pt-2 border-t border-gray-200 space-y-2">
                  <p className="font-semibold text-gray-800">Slack (off-CRM alerts)</p>
                  {slackSettings?.slackWebhookConfigured && (
                    <p className="text-gray-500">Connected: {slackSettings.slackWebhookPreview}</p>
                  )}
                  <input
                    type="url"
                    value={slackWebhookInput}
                    onChange={(e) => setSlackWebhookInput(e.target.value)}
                    placeholder="https://hooks.slack.com/services/…"
                    className="w-full text-[11px] border border-gray-200 rounded px-2 py-1.5"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={saveSlackWebhook}
                    className="text-[11px] font-semibold px-2 py-1 bg-gray-900 text-white rounded"
                  >
                    Save Slack webhook
                  </button>
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={soundOn}
                  onChange={(e) => setChithiSoundEnabled(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span>Sound for new Chithi messages</span>
              </label>
            </div>
          </details>
        </div>
      </div>

      <ChithiNewMessageModal
        open={showDmModal}
        onClose={() => setShowDmModal(false)}
        members={dmMembers}
        busy={busy}
        loading={teamLoading}
        onSelect={(id) => void startDm(id)}
      />
      {isOrgAdmin && (
        <ChithiNewChannelModal
          open={showChannelModal}
          onClose={() => setShowChannelModal(false)}
          busy={busy}
          onCreate={createChannel}
        />
      )}
    </div>
  )
}

function ChithiMessageBlock({
  msg,
  replies,
  expanded,
  onToggleThread,
  onReply,
  reactions,
  userId,
  onLeadClick,
  onReact,
  isPublic,
}) {
  const replyList = replies || []
  const showReplies = expanded && replyList.length > 0

  return (
    <article
      className={`chithi-msg mb-4 max-w-2xl ${msg.isMine ? 'chithi-msg--mine ml-auto' : ''} ${
        msg.pending ? 'chithi-msg--pending' : ''
      }`}
    >
      <p className="text-[11px] text-gray-500 mb-0.5">
        {msg.isMine ? 'You' : msg.authorName} · {msg.pending ? 'Sending…' : formatDateTime(msg.createdAt)}
      </p>
      <div
        className={`chithi-msg-bubble rounded-xl px-3 py-2 text-sm ${
          msg.isMine ? '' : 'bg-[#f3f4f6] text-gray-900'
        }`}
      >
        <ChithiMessageBody
          body={msg.body}
          onLeadClick={onLeadClick}
          className={msg.isMine ? 'text-inherit' : 'text-inherit'}
        />
      </div>
      {isPublic && msg.source === 'chithi' && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {reactions.map((emoji) => {
            const list = msg.reactions?.[emoji] || []
            const active = list.includes(userId)
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => onReact(msg.id, emoji)}
                className={`text-[11px] px-1.5 py-0.5 rounded-full border ${
                  active ? 'bg-[#fff4ee] border-[#ffd4b8]' : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                {emoji}
                {list.length > 0 && <span className="ml-0.5 tabular-nums text-gray-600">{list.length}</span>}
              </button>
            )
          })}
          <button type="button" onClick={onReply} className="text-[11px] text-gray-500 hover:text-gray-800 px-1">
            Reply
          </button>
          {(msg.threadReplyCount > 0 || replyList.length > 0) && (
            <button type="button" onClick={onToggleThread} className="text-[11px] font-semibold text-gray-700 px-1">
              {showReplies ? 'Hide' : 'View'} {msg.threadReplyCount || replyList.length} repl
              {(msg.threadReplyCount || replyList.length) === 1 ? 'y' : 'ies'}
            </button>
          )}
        </div>
      )}
      {showReplies && (
        <div className="mt-2 ml-3 pl-3 border-l-2 border-gray-200 space-y-2">
          {replyList.map((r) => (
            <div key={r.id} className="text-sm">
              <p className="text-[10px] text-gray-500">
                {r.isMine ? 'You' : r.authorName} · {formatDateTime(r.createdAt)}
              </p>
              <div className="rounded-lg px-2 py-1.5 bg-gray-50 text-gray-900">
                <ChithiMessageBody body={r.body} onLeadClick={onLeadClick} />
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  )
}

function ChannelBtn({ label, active, onClick, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`chithi-rail__channel ${active ? 'is-active' : ''}`}
    >
      <span className="flex-1 truncate">{label}</span>
      {badge > 0 && (
        <span className="chithi-rail__channel-badge">{badge > 99 ? '99+' : badge}</span>
      )}
    </button>
  )
}

