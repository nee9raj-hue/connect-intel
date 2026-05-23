import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { EMAIL_PURPOSES } from '../../lib/crmConstants'

export default function BulkEmailModal({ open, leadIds, leads, onClose, onDone }) {
  const { user, sendBulkEmail } = useApp()
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

  if (!open) return null

  const withEmail = leads.filter((l) => l.email && !l.email.includes('•'))

  const submit = async () => {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const data = await sendBulkEmail({
        leadIds,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-xl border border-gray-200 max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">Bulk email ({leadIds.length} selected)</h2>
          <button type="button" onClick={onClose} className="text-2xl text-gray-400 leading-none">
            ×
          </button>
        </div>
        <div className="p-5 space-y-3 text-sm">
          <p className="text-xs text-gray-500">
            {withEmail.length} of {leadIds.length} have email addresses. Sends from your company domain when DNS is
            verified.
          </p>

          <label className="flex items-center gap-2 text-xs font-medium">
            <input type="checkbox" checked={useAiPerLead} onChange={(e) => setUseAiPerLead(e.target.checked)} />
            AI draft per lead (uses agenda below)
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
              <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
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

          <button
            type="button"
            disabled={busy || (useAiPerLead && agenda.trim().length < 8)}
            onClick={submit}
            className="w-full py-2.5 bg-gray-900 text-white font-semibold rounded-lg disabled:opacity-50"
          >
            {busy ? 'Sending…' : `Send to ${withEmail.length} leads`}
          </button>
        </div>
      </div>
    </div>
  )
}
