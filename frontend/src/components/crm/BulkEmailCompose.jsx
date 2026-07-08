import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { leadDisplayName, leadHasSendableEmail } from '../../lib/emailUtils'
import { bulkEmailChunkSize, INLINE_EMAIL_MAX_RECIPIENTS } from '../../lib/bulkEmailLimits.js'
import { RecipientEmailPreview } from './MarketingEmailComposeTools'
import CampaignMonitor from '../messaging/CampaignMonitor.jsx'
import { useCampaignSendProgress } from '../../hooks/useCampaignSendProgress.js'
import { saveActivePipelineEmailCampaign } from '../../lib/pipelineEmailCampaign.js'

const TERMINAL_CAMPAIGN = new Set(['completed', 'failed', 'cancelled', 'stopped', 'archived'])

export default function BulkEmailCompose({
  leadIds,
  leads,
  onDone,
  onRequestClose,
  compact = false,
  skippedCount = 0,
}) {
  const { user, sendBulkEmail, generateEmailDraft } = useApp()
  const [cc, setCc] = useState('')
  const [agenda, setAgenda] = useState('')
  const [personalizeEach, setPersonalizeEach] = useState(true)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [draftAi, setDraftAi] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sendProgress, setSendProgress] = useState(null)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [result, setResult] = useState(null)
  const [resumeCampaignId, setResumeCampaignId] = useState(null)
  const [backgroundCampaignId, setBackgroundCampaignId] = useState(null)
  const { progress: backgroundProgress } = useCampaignSendProgress(backgroundCampaignId, {
    enabled: Boolean(backgroundCampaignId),
  })
  const campaignSending =
    backgroundCampaignId &&
    backgroundProgress &&
    !backgroundProgress.done &&
    !TERMINAL_CAMPAIGN.has(String(backgroundProgress.sendStatus || '').toLowerCase())
  const [previewIndex, setPreviewIndex] = useState(0)
  const [showCc, setShowCc] = useState(false)
  const [draftSampleLeadId, setDraftSampleLeadId] = useState(null)

  const senderCompany = user?.organizationName || user?.company || ''

  const withEmail = useMemo(
    () => leads.filter((l) => leadIds.includes(l.id) && leadHasSendableEmail(l)),
    [leads, leadIds]
  )
  const missingEmail = Math.max(0, leadIds.length - withEmail.length)
  const sampleLead = withEmail[0]

  const recipientSummary = useMemo(() => {
    const parts = [`${withEmail.length} recipient${withEmail.length === 1 ? '' : 's'}`]
    if (withEmail.length > INLINE_EMAIL_MAX_RECIPIENTS) {
      parts.push('queued send — you can close this tab')
    } else {
      parts.push('sends from your work Gmail')
    }
    if (skippedCount > 0) {
      parts.push(`${skippedCount} skipped`)
    } else if (missingEmail > 0) {
      parts.push(`${missingEmail} skipped (no email)`)
    }
    return parts.join(' · ')
  }, [withEmail.length, skippedCount, missingEmail])

  const handleGenerate = async () => {
    if (!sampleLead) {
      setError('No selected leads have a valid email address')
      return
    }
    if (agenda.trim().length < 8) {
      setError('Describe your email goal in at least a few words')
      return
    }
    setGenerating(true)
    setError(null)
    setNotice(null)
    try {
      const data = await generateEmailDraft(sampleLead.id, {
        purpose: 'introduction',
        tone: 'professional',
        agenda: agenda.trim(),
        senderCompany: senderCompany.trim(),
        senderName: user?.name,
      })
      setSubject(data.draft.subject || '')
      setBody(data.draft.body || '')
      setDraftAi(Boolean(data.draft.aiGenerated))
      setDraftSampleLeadId(sampleLead.id)
      setPreviewIndex(0)
      setNotice(
        `Sample draft for ${leadDisplayName(sampleLead)} — review below.${
          personalizeEach
            ? ' Each recipient gets a personalized email at send time.'
            : ' Same text goes to everyone unless you edit it.'
        }`
      )
    } catch (e) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const submit = async () => {
    if (!withEmail.length) {
      setError('No selected leads have a valid email address')
      return
    }
    const useAiPerLead = personalizeEach
    if (useAiPerLead && agenda.trim().length < 8) {
      setError('Add a goal (agenda) for AI personalization')
      return
    }
    if (!useAiPerLead && !subject.trim()) {
      setError('Subject is required')
      return
    }
    if (!useAiPerLead && !body.trim()) {
      setError('Message body is required')
      return
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    setResult(null)
    setSendProgress(null)
    try {
      const data = await sendBulkEmail(
        {
          leadIds: withEmail.map((l) => l.id),
          resolvedRecipients: withEmail.map((l) => ({
            leadId: l.id,
            email: l.email,
            firstName: l.firstName,
            lastName: l.lastName,
            company: l.company,
            title: l.title,
          })),
          campaignId: resumeCampaignId || undefined,
          cc: cc.trim(),
          agenda: agenda.trim(),
          keyPoints: '',
          senderCompany: senderCompany.trim(),
          purpose: 'introduction',
          useAiPerLead,
          subject: subject.trim(),
          body: body.trim(),
          aiGenerated: draftAi || useAiPerLead,
        },
        { onProgress: setSendProgress }
      )
      setResult(data)
      setResumeCampaignId(null)
      if (data.queued === false && (data.sendable ?? 0) === 0 && !data.campaignId) {
        const reasons = Array.isArray(data.skipped) ? data.skipped : []
        const noConsent = reasons.filter((s) => s.reason === 'no_consent').length
        const noEmail = reasons.filter((s) => s.reason === 'no_email').length
        setError(
          noConsent > 0
            ? `Nothing sent — ${noConsent} recipient${noConsent === 1 ? '' : 's'} without email consent. Record consent on the lead(s) and try again.`
            : noEmail > 0
              ? `Nothing sent — ${noEmail} recipient${noEmail === 1 ? '' : 's'} without a sendable email.`
              : 'Nothing sent — no eligible recipients in this selection.'
        )
        return
      }
      if (data.timedOut) {
        setNotice(
          data.workerHint ||
            'Request timed out — send may still be processing. Check Pipeline progress or retry in a minute.'
        )
      }
      if (data.campaignId) {
        setBackgroundCampaignId(data.campaignId)
        saveActivePipelineEmailCampaign(data.campaignId)
        const sent = data.sentCount ?? 0
        const failed = data.failedCount ?? 0
        const pending = data.pendingSends ?? 0
        const isQueued = data.mode === 'queued'
        if (data.done || (sent > 0 && pending <= 0 && !isQueued)) {
          setNotice(
            `Done — ${sent} sent${failed ? `, ${failed} failed` : ''}. Check each lead timeline.`
          )
        } else if (isQueued) {
          setNotice(
            data.workerHint ||
              `Queued ${withEmail.length} emails. Track progress below or on Pipeline.`
          )
        } else if (sent > 0 || pending > 0) {
          setNotice(`${sent} sent — ${pending} remaining`)
        } else if (data.firstError) {
          setError(data.firstError)
        } else {
          setNotice(`Sending ${withEmail.length} email(s)…`)
        }
      } else {
        setBackgroundCampaignId(null)
      }
      if (!data.campaignId || data.done) {
        onDone?.(data)
      }
    } catch (e) {
      if (e.bulkEmailProgress?.campaignId) {
        setResumeCampaignId(e.bulkEmailProgress.campaignId)
        const sent = e.bulkEmailProgress.sentCount || 0
        if (sent > 0) {
          setNotice(`${sent} already sent — click Send again to continue`)
        }
      }
      setError(
        e.message?.includes('timed out')
          ? `${e.message} Progress saved — Send again to continue.`
          : e.message
      )
    } finally {
      setBusy(false)
      setSendProgress(null)
    }
  }

  const batchSize = bulkEmailChunkSize({ useAiPerLead: personalizeEach })
  const sendDisabled =
    busy ||
    campaignSending ||
    !withEmail.length ||
    (personalizeEach && agenda.trim().length < 8) ||
    (!personalizeEach && (!subject.trim() || !body.trim()))

  return (
    <div className={`flex flex-col min-h-0 text-sm ${compact ? 'h-full' : 'h-full'}`}>
      {!compact && (
        <div className="shrink-0 px-4 py-3 border-b border-[#dfe3eb] bg-white">
          <h2 className="text-sm font-semibold text-[#33475b]">Communications</h2>
          <p className="text-xs text-[#516f90] mt-0.5">{recipientSummary}</p>
        </div>
      )}

      {compact && (
        <p className="shrink-0 px-5 pt-4 pb-1 text-xs text-[#516f90]">{recipientSummary}</p>
      )}

      <div
        className={`flex-1 min-h-0 overflow-y-auto pipeline-scroll-area space-y-3 ${
          compact ? 'px-5 pb-3' : 'p-4'
        }`}
      >
        <p className="text-xs text-[#516f90] leading-relaxed">
          CRM trail email from your connected work Gmail — logged on each lead. For marketing campaigns
          and templates, use <strong>Marketing hub</strong>.
        </p>

        <div>
          <label className="text-xs font-semibold uppercase text-gray-400">Goal</label>
          <textarea
            value={agenda}
            onChange={(e) => setAgenda(e.target.value)}
            rows={3}
            placeholder="e.g. Follow up on USA commercial rates and request a 15-min call"
            className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !sampleLead || agenda.trim().length < 8}
            className="text-xs font-semibold px-3 py-2 bg-[#fff4ee] border border-[#ffd4b8] rounded-lg disabled:opacity-50"
          >
            {generating ? 'Generating…' : '✨ Generate sample draft'}
          </button>
          <label className="flex items-center gap-2 text-xs text-gray-600 ml-auto">
            <input
              type="checkbox"
              checked={personalizeEach}
              onChange={(e) => setPersonalizeEach(e.target.checked)}
            />
            Personalize each recipient with AI
          </label>
        </div>

        {personalizeEach && withEmail.length > batchSize && (
          <p className="text-xs text-[#516f90] bg-[#f5f8fa] rounded-lg px-2 py-1.5">
            {withEmail.length} leads — AI writes one email per person in batches of {batchSize}.
          </p>
        )}

        {notice && (
          <p className="text-xs text-green-800 bg-green-50 rounded-lg px-2 py-1.5">{notice}</p>
        )}

        <div>
          <label className="text-xs font-semibold uppercase text-gray-400">Subject</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={personalizeEach ? 'Optional preview — AI sets per recipient' : 'Subject'}
            className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase text-gray-400">Body</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            placeholder={
              personalizeEach
                ? 'Generate a sample above, or leave blank for AI at send time'
                : 'Message — use {{firstName}} for each recipient’s name'
            }
            className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        {!showCc ? (
          <button
            type="button"
            className="text-xs text-[#ff7a59] font-medium hover:underline"
            onClick={() => setShowCc(true)}
          >
            + Add Cc
          </button>
        ) : (
          <div>
            <label className="text-xs font-semibold uppercase text-gray-400">Cc (optional)</label>
            <input
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="colleague@company.com"
              className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        )}

        {withEmail.length > 0 && (
          <RecipientEmailPreview
            recipients={withEmail}
            previewIndex={previewIndex}
            onPreviewIndexChange={setPreviewIndex}
            subject={subject}
            body={body}
            personalizeEach={personalizeEach}
            sampleLead={
              draftSampleLeadId
                ? withEmail.find((l) => String(l.id) === String(draftSampleLeadId))
                : null
            }
          />
        )}

        {backgroundCampaignId ? (
          <CampaignMonitor
            campaignId={backgroundCampaignId}
            campaignName="Pipeline outreach"
            enabled
            className="mt-1"
            onDone={() => onDone?.(result)}
          />
        ) : null}
        {error && <p className="text-xs text-red-700 bg-red-50 rounded-lg px-2 py-1.5">{error}</p>}
        {busy && sendProgress && (
          <div className="text-xs text-[#33475b] bg-[#eaf0f6] rounded-lg px-2 py-2 space-y-1.5">
            <p>
              {sendProgress.phase === 'queuing'
                ? 'Queuing…'
                : `${sendProgress.sentSoFar ?? 0} of ${sendProgress.total} sent…`}
            </p>
            <div className="h-1.5 rounded-full bg-[#cbd6e2] overflow-hidden">
              <div
                className="h-full bg-[#FF773D] transition-all duration-300"
                style={{
                  width: `${Math.min(
                    100,
                    sendProgress.phase === 'queuing'
                      ? 8
                      : Math.round(
                          ((sendProgress.sentSoFar + (sendProgress.failedSoFar || 0)) / sendProgress.total) *
                            100
                        )
                  )}%`,
                }}
              />
            </div>
          </div>
        )}
        {result && result.background ? (
          <p className="text-xs text-green-800 bg-green-50 rounded-lg px-2 py-1.5">
            Queued — {(result.pendingSends ?? withEmail.length) === 1 ? '1 email' : `${result.pendingSends ?? withEmail.length} emails`} sending in background.
          </p>
        ) : result ? (
          <p className="text-xs text-green-800 bg-green-50 rounded-lg px-2 py-1.5 tabular-nums">
            {result.sentCount ?? 0} of {withEmail.length} sent
            {(result.pendingSends ?? 0) > 0 ? ` · ${result.pendingSends} remaining` : ''}
            {(result.failedCount ?? 0) > 0 ? ` · ${result.failedCount} failed` : ''}
            {result.done ? ' · Done' : ''}
          </p>
        ) : null}
      </div>

      <div
        className={`shrink-0 ${
          compact ? 'px-5 py-4 border-t border-[#dfe3eb] bg-[#f5f8fa]' : 'p-4 border-t border-[#dfe3eb] bg-white'
        }`}
      >
        {backgroundCampaignId && !busy ? (
          <button
            type="button"
            onClick={() => onRequestClose?.()}
            className="crm-btn crm-btn-secondary w-full py-2.5 mb-2"
          >
            Close — track on Pipeline
          </button>
        ) : null}
        <button
          type="button"
          disabled={sendDisabled}
          onClick={submit}
          className="crm-btn crm-btn-primary w-full py-2.5 disabled:opacity-50"
        >
          {busy && sendProgress
            ? sendProgress.phase === 'queuing'
              ? 'Queuing…'
              : `Sending · ${sendProgress.sentSoFar || 0} of ${sendProgress.total}…`
            : campaignSending
              ? `Sending · ${backgroundProgress.sent || 0} of ${backgroundProgress.total || withEmail.length}…`
              : `Send to ${withEmail.length} lead${withEmail.length === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  )
}
