import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { EMAIL_PURPOSES } from '../../lib/crmConstants'
import { leadHasSendableEmail } from '../../lib/emailUtils'

export default function BulkEmailCompose({ leadIds, leads, onDone, compact = false }) {
  const { user, sendBulkEmail } = useApp()
  const [cc, setCc] = useState('')
  const [agenda, setAgenda] = useState('')
  const [keyPoints, setKeyPoints] = useState('')
  const [senderCompany, setSenderCompany] = useState(user?.organizationName || user?.company || '')
  const [purpose, setPurpose] = useState('introduction')
  const [useAiPerLead, setUseAiPerLead] = useState(true)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const withEmail = leads.filter((l) => leadIds.includes(l.id) && leadHasSendableEmail(l))
  const missingEmail = leadIds.length - withEmail.length

  const submit = async () => {
    if (!withEmail.length) {
      setError('No selected leads have a valid email address')
      return
    }
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const data = await sendBulkEmail({
        leadIds: withEmail.map((l) => l.id),
        cc: cc.trim(),
        agenda: agenda.trim(),
        keyPoints: keyPoints.trim(),
        senderCompany: senderCompany.trim(),
        purpose,
        useAiPerLead,
        subject: subject.trim(),
        body: body.trim(),
      })
      setResult(data)
      onDone?.(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`flex flex-col ${compact ? '' : 'h-full'} text-sm`}>
      <div className={`shrink-0 ${compact ? 'pb-3' : 'px-4 py-3 border-b border-gray-200 bg-white'}`}>
        <h2 className="text-sm font-semibold text-gray-900">Compose</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          {withEmail.length} recipient{withEmail.length === 1 ? '' : 's'}
          {missingEmail > 0 ? ` · ${missingEmail} skipped (no email)` : ''}
        </p>
      </div>

      <div className={`flex-1 overflow-y-auto space-y-3 ${compact ? '' : 'p-4'}`}>
        <div>
          <label className="text-[10px] font-semibold uppercase text-gray-400">Cc (optional)</label>
          <input
            value={cc}
            onChange={(e) => setCc(e.target.value)}
            placeholder="manager@company.com, colleague@company.com"
            className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <p className="text-[10px] text-gray-400 mt-0.5">Same Cc on every email in this batch</p>
        </div>

        <label className="flex items-center gap-2 text-xs font-medium">
          <input type="checkbox" checked={useAiPerLead} onChange={(e) => setUseAiPerLead(e.target.checked)} />
          AI draft per lead
        </label>

        {useAiPerLead ? (
          <>
            <input
              value={senderCompany}
              onChange={(e) => setSenderCompany(e.target.value)}
              placeholder="Your company name"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            <textarea
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              rows={3}
              placeholder="Agenda (required for AI)"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            <textarea
              value={keyPoints}
              onChange={(e) => setKeyPoints(e.target.value)}
              rows={2}
              placeholder="Key points (optional)"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              {EMAIL_PURPOSES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </>
        ) : (
          <>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject (same for all)"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              placeholder="Message body (same for all)"
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono text-xs"
            />
          </>
        )}

        {error && <p className="text-xs text-red-700 bg-red-50 rounded-lg px-2 py-1.5">{error}</p>}
        {result && (
          <p className="text-xs text-green-800 bg-green-50 rounded-lg px-2 py-1.5">
            Sent {result.sentCount}, failed {result.failedCount}, skipped {result.skippedCount}
          </p>
        )}
      </div>

      <div className={`shrink-0 ${compact ? 'pt-3' : 'p-4 border-t border-gray-200 bg-white'}`}>
        <button
          type="button"
          disabled={busy || !withEmail.length || (useAiPerLead && agenda.trim().length < 8)}
          onClick={submit}
          className="w-full py-2.5 bg-gray-900 text-white font-semibold rounded-lg disabled:opacity-50 text-sm"
        >
          {busy ? 'Sending…' : `Send to ${withEmail.length} lead${withEmail.length === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  )
}
