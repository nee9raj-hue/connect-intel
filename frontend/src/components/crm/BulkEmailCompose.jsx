import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { EMAIL_PURPOSES } from '../../lib/crmConstants'
import { leadDisplayName, leadHasSendableEmail } from '../../lib/emailUtils'
import { bulkEmailChunkSize } from '../../lib/bulkEmailLimits.js'

const COMPOSE_TABS = [
  { id: 'ai', label: '✨ AI draft' },
  { id: 'manual', label: 'Manual' },
]

export default function BulkEmailCompose({ leadIds, leads, onDone, compact = false }) {
  const { user, sendBulkEmail, generateEmailDraft } = useApp()
  const [composeTab, setComposeTab] = useState('ai')
  const [cc, setCc] = useState('')
  const [agenda, setAgenda] = useState('')
  const [keyPoints, setKeyPoints] = useState('')
  const [senderCompany, setSenderCompany] = useState(user?.organizationName || user?.company || '')
  const [purpose, setPurpose] = useState('introduction')
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

  const withEmail = leads.filter((l) => leadIds.includes(l.id) && leadHasSendableEmail(l))
  const missingEmail = leadIds.length - withEmail.length
  const sampleLead = withEmail[0]

  const handleGenerate = async () => {
    if (!sampleLead) {
      setError('No selected leads have a valid email address')
      return
    }
    if (agenda.trim().length < 8) {
      setError('Describe your email goal (agenda) in a few words before generating a draft')
      return
    }
    setGenerating(true)
    setError(null)
    setNotice(null)
    try {
      const data = await generateEmailDraft(sampleLead.id, {
        purpose,
        tone: 'professional',
        agenda: agenda.trim(),
        keyPoints: keyPoints.trim(),
        senderCompany: senderCompany.trim(),
        senderName: user?.name,
      })
      setSubject(data.draft.subject || '')
      setBody(data.draft.body || '')
      setDraftAi(Boolean(data.draft.aiGenerated))
      const name = leadDisplayName(sampleLead)
      const sampleFirst = sampleLead.firstName?.trim() || '(no first name on this lead)'
      setNotice(
        data.draft.notice ||
          `Sample draft for ${name} (first name: ${sampleFirst}) — review below. ${
            personalizeEach
              ? 'On send, AI writes a separate email per lead using each person’s first name when available.'
              : 'Same text will go to everyone unless you edit it.'
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
    const useAiPerLead = composeTab === 'ai' && personalizeEach
    if (composeTab === 'ai' && useAiPerLead && agenda.trim().length < 8) {
      setError('Add an agenda (at least a short sentence) for AI personalization')
      return
    }
    if (!useAiPerLead && !subject.trim()) {
      setError('Subject line is required before sending')
      return
    }
    if (!useAiPerLead && !body.trim()) {
      setError('Message body is required before sending')
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
          campaignId: resumeCampaignId || undefined,
          cc: cc.trim(),
          agenda: agenda.trim(),
          keyPoints: keyPoints.trim(),
          senderCompany: senderCompany.trim(),
          purpose,
          useAiPerLead,
          subject: subject.trim(),
          body: body.trim(),
          aiGenerated: draftAi || useAiPerLead,
        },
        { onProgress: setSendProgress }
      )
      setResult(data)
      setResumeCampaignId(null)
      onDone?.(data)
    } catch (e) {
      if (e.bulkEmailProgress?.campaignId) {
        setResumeCampaignId(e.bulkEmailProgress.campaignId)
        const sent = e.bulkEmailProgress.sentCount || 0
        if (sent > 0) {
          setNotice(`${sent} email${sent === 1 ? '' : 's'} already sent — click Send again to continue.`)
        }
      }
      setError(
        e.message?.includes('timed out')
          ? `${e.message} Progress is saved — click Send again to continue from where it stopped.`
          : e.message
      )
    } finally {
      setBusy(false)
      setSendProgress(null)
    }
  }

  const useAiPerLead = composeTab === 'ai' && personalizeEach
  const batchSize = bulkEmailChunkSize({ useAiPerLead })
  const batchCount = Math.max(1, Math.ceil(withEmail.length / batchSize))

  const sendDisabled =
    busy ||
    !withEmail.length ||
    (composeTab === 'ai' && personalizeEach && agenda.trim().length < 8) ||
    (composeTab === 'manual' && (!subject.trim() || !body.trim())) ||
    (composeTab === 'ai' && !personalizeEach && (!subject.trim() || !body.trim()))

  return (
    <div className={`flex flex-col min-h-0 text-sm ${compact ? 'h-full' : 'h-full'}`}>
      {!compact && (
        <div className="shrink-0 px-4 py-3 border-b border-[#dfe3eb] bg-white">
          <h2 className="text-sm font-semibold text-[#33475b]">Compose</h2>
          <p className="text-xs text-[#516f90] mt-0.5">
            {withEmail.length} recipient{withEmail.length === 1 ? '' : 's'}
            {missingEmail > 0 ? ` · ${missingEmail} skipped (no email)` : ''}
          </p>
        </div>
      )}

      {compact && (
        <p className="shrink-0 px-5 pt-4 pb-1 text-xs text-[#516f90]">
          {withEmail.length} recipient{withEmail.length === 1 ? '' : 's'}
          {missingEmail > 0 ? ` · ${missingEmail} skipped (no email)` : ''}
        </p>
      )}

      <div
        className={`flex-1 min-h-0 overflow-y-auto pipeline-scroll-area space-y-3 ${
          compact ? 'px-5 pb-3' : 'p-4'
        }`}
      >
        <div className="flex gap-1 p-0.5 bg-gray-100 rounded-lg">
          {COMPOSE_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setComposeTab(t.id)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md ${
                composeTab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div>
          <label className="text-xs font-semibold uppercase text-gray-400">Cc (optional)</label>
          <input
            value={cc}
            onChange={(e) => setCc(e.target.value)}
            placeholder="manager@company.com, colleague@company.com"
            className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-400 mt-0.5">Same Cc on every email in this batch</p>
        </div>

        {composeTab === 'ai' ? (
          <>
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase text-gray-400">What should these emails say?</h3>
              <input
                value={senderCompany}
                onChange={(e) => setSenderCompany(e.target.value)}
                placeholder="Your company name"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
              <textarea
                value={agenda}
                onChange={(e) => setAgenda(e.target.value)}
                rows={3}
                placeholder="Agenda (required): e.g. Introduce our organic snacks to boutique buyers; ask for a 15-min call"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
              <textarea
                value={keyPoints}
                onChange={(e) => setKeyPoints(e.target.value)}
                rows={2}
                placeholder="Key points (optional): pricing, certifications, trade show, etc."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </section>

            <div className="flex gap-2">
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
              >
                {EMAIL_PURPOSES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating || !sampleLead || agenda.trim().length < 8}
                className="text-xs font-semibold px-3 py-1.5 bg-[#fff4ee] border border-[#ffd4b8] rounded-lg disabled:opacity-50 whitespace-nowrap"
              >
                {generating ? 'Drafting…' : '✨ Generate draft'}
              </button>
            </div>

            <label className="flex items-start gap-2 text-xs text-gray-600 leading-snug">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={personalizeEach}
                onChange={(e) => setPersonalizeEach(e.target.checked)}
              />
              Personalize with AI for each recipient at send time (recommended)
            </label>
            {personalizeEach && withEmail.length > batchSize && (
              <p className="text-xs text-[#516f90] bg-[#f5f8fa] rounded-lg px-2 py-1.5">
                AI writes a unique email per lead, then sends from your mailbox — up to {batchSize} per step (
                {batchCount} step{batchCount === 1 ? '' : 's'} for {withEmail.length} recipients). Progress is
                saved; you can retry if a step is interrupted.
              </p>
            )}

            {notice && (
              <p className="text-xs text-green-800 bg-green-50 rounded-lg px-2 py-1.5">{notice}</p>
            )}

            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject (preview / same for all if not personalizing)"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              placeholder={
                personalizeEach
                  ? 'Generate a sample draft above, or leave blank to let AI write each email at send'
                  : 'Message body — Dear {{firstName}} or Dear [Name] is replaced per recipient'
              }
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-xs"
            />
          </>
        ) : (
          <>
            <p className="text-xs text-gray-500">
              Same template for every lead — use <code className="text-[11px]">{'{{firstName}}'}</code> or{' '}
              <code className="text-[11px]">[Name]</code> and each recipient gets their own first name (up to 200
              with email). Sends via your connected work or company email.
            </p>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject (same for all)"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              placeholder="Message body (same for all)"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-xs"
            />
          </>
        )}

        {error && <p className="text-xs text-red-700 bg-red-50 rounded-lg px-2 py-1.5">{error}</p>}
        {busy && sendProgress && (
          <div className="text-xs text-[#33475b] bg-[#eaf0f6] rounded-lg px-2 py-2 space-y-1.5">
            <p>
              Sending step {sendProgress.chunk} of {sendProgress.totalChunks}
              {sendProgress.sentSoFar > 0 ? ` · ${sendProgress.sentSoFar} of ${sendProgress.total} sent` : ''}
              {sendProgress.failedSoFar > 0 ? ` · ${sendProgress.failedSoFar} failed` : ''}…
            </p>
            <div className="h-1.5 rounded-full bg-[#cbd6e2] overflow-hidden">
              <div
                className="h-full bg-[#00a4bd] transition-all duration-300"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round(
                      ((sendProgress.sentSoFar + (sendProgress.failedSoFar || 0)) / sendProgress.total) * 100
                    )
                  )}%`,
                }}
              />
            </div>
          </div>
        )}
        {result && (
          <p className="text-xs text-green-800 bg-green-50 rounded-lg px-2 py-1.5">
            Sent {result.sentCount}, failed {result.failedCount}, skipped {result.skippedCount}
          </p>
        )}
      </div>

      <div
        className={`shrink-0 ${
          compact ? 'px-5 py-4 border-t border-[#dfe3eb] bg-[#f5f8fa]' : 'p-4 border-t border-[#dfe3eb] bg-white'
        }`}
      >
        <button
          type="button"
          disabled={sendDisabled}
          onClick={submit}
          className="crm-btn crm-btn-primary w-full py-2.5 disabled:opacity-50"
        >
          {busy && sendProgress
            ? `Sending ${sendProgress.chunk}/${sendProgress.totalChunks}…`
            : `Send to ${withEmail.length} lead${withEmail.length === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  )
}
