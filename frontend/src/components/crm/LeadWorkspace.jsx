import { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import {
  CRM_STATUSES,
  EMAIL_PURPOSES,
  buildMailto,
  formatCrmDate,
  getStatusMeta,
} from '../../lib/crmConstants'

export default function LeadWorkspace({ lead, onClose, statusOptions = CRM_STATUSES }) {
  const { user, teamMembers, assignLead, updateSavedLeadCrm, generateEmailDraft, logCrmEmailSend } = useApp()
  const [notes, setNotes] = useState(lead.crm?.notes || '')
  const [status, setStatus] = useState(lead.crm?.status || 'new')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [purpose, setPurpose] = useState('introduction')
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [draftAi, setDraftAi] = useState(false)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    setNotes(lead.crm?.notes || '')
    setStatus(lead.crm?.status || 'new')
    setSubject('')
    setBody('')
    setError(null)
    setNotice(null)
  }, [lead.id])

  const saveNotes = async () => {
    try {
      await updateSavedLeadCrm(lead.id, { notes })
    } catch (e) {
      setError(e.message)
    }
  }

  const changeStatus = async (next) => {
    setStatus(next)
    try {
      await updateSavedLeadCrm(lead.id, { status: next })
    } catch (e) {
      setError(e.message)
      setStatus(lead.crm?.status || 'new')
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    setNotice(null)
    try {
      const data = await generateEmailDraft(lead.id, { purpose, tone: 'professional' })
      setSubject(data.draft.subject || '')
      setBody(data.draft.body || '')
      setDraftAi(Boolean(data.draft.aiGenerated))
      if (data.draft.notice) setNotice(data.draft.notice)
    } catch (e) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      setError('Add a subject and message first')
      return
    }
    setSending(true)
    setError(null)
    try {
      await logCrmEmailSend(lead.id, {
        subject: subject.trim(),
        body: body.trim(),
        aiGenerated: draftAi,
      })
      const mailto = buildMailto(lead, subject.trim(), body.trim())
      if (mailto) {
        window.open(mailto, '_blank', 'noopener,noreferrer')
      } else {
        setNotice('Email logged. Unlock or add a valid email on this lead to open your mail app.')
      }
      setSubject('')
      setBody('')
      setDraftAi(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setSending(false)
    }
  }

  const markResponse = async (received) => {
    try {
      await updateSavedLeadCrm(lead.id, {
        responseReceived: received,
        lastResponseAt: received ? new Date().toISOString() : null,
        status: received ? 'replied' : status,
      })
      if (received) setStatus('replied')
    } catch (e) {
      setError(e.message)
    }
  }

  const crm = lead.crm || {}
  const statusMeta = getStatusMeta(status)

  return (
    <aside className="w-[400px] shrink-0 border-l border-gray-200 bg-white flex flex-col h-full">
      <div className="shrink-0 px-4 py-3 border-b border-gray-100 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-semibold text-gray-900 truncate">
            {[lead.firstName, lead.lastName].filter(Boolean).join(' ')}
          </h2>
          <p className="text-xs text-gray-500 truncate">
            {lead.title} · {lead.company}
          </p>
          <span className={`inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded border ${statusMeta.color}`}>
            {statusMeta.label}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-700 text-lg leading-none px-1"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Pipeline</h3>
          <select
            value={status}
            onChange={(e) => changeStatus(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
          >
            {statusOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </section>

        {user?.isOrgAdmin && user?.accountType === 'company' && teamMembers.length > 0 && (
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">
              Assign to teammate
            </h3>
            <select
              value={lead.assignedToUserId || ''}
              onChange={async (e) => {
                try {
                  await assignLead(lead.id, e.target.value || null)
                } catch (err) {
                  setError(err.message)
                }
              }}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
            >
              <option value="">Unassigned (all admins)</option>
              {teamMembers
                .filter((m) => m.role !== 'org_admin')
                .map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name} ({m.email})
                  </option>
                ))}
            </select>
          </section>
        )}

        <section className="grid grid-cols-2 gap-2 text-xs">
          <Stat label="Last email sent" value={formatCrmDate(crm.lastEmailSentAt)} />
          <Stat label="Last response" value={formatCrmDate(crm.lastResponseAt)} />
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Response</h3>
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(crm.responseReceived)}
                onChange={(e) => markResponse(e.target.checked)}
                className="rounded"
              />
              Received
            </label>
          </div>
        </section>

        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Notes</h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            rows={3}
            placeholder="Call notes, next steps…"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none"
          />
        </section>

        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">
            Email outreach
          </h3>
          <div className="flex gap-2 mb-2">
            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5"
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
              disabled={generating}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#fff6d6] border border-[#ffe48a] text-[#5b4a00] hover:bg-[#ffefb0] disabled:opacity-60"
            >
              {generating ? '…' : '✨ AI draft'}
            </button>
          </div>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mb-2"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            placeholder="Write your message…"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none font-mono text-[12px] leading-relaxed"
          />
          <p className="text-[10px] text-gray-400 mt-1.5">
            Send opens your email app and logs the outreach in Connect Intel.
          </p>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending}
            className="mt-2 w-full py-2.5 text-sm font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-60"
          >
            {sending ? 'Logging…' : 'Send & log email'}
          </button>
        </section>

        {crm.emails?.length > 0 && (
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">
              Email history
            </h3>
            <ul className="space-y-2">
              {crm.emails.slice(0, 8).map((email) => (
                <li key={email.id} className="text-xs border border-gray-100 rounded-lg p-2.5 bg-gray-50">
                  <div className="font-medium text-gray-800 truncate">{email.subject}</div>
                  <div className="text-gray-500 mt-0.5">
                    {formatCrmDate(email.sentAt)}
                    {email.aiGenerated ? ' · AI draft' : ''}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {error && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-2 py-1.5">{error}</p>
        )}
        {notice && (
          <p className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5">{notice}</p>
        )}
      </div>

      <div className="shrink-0 px-4 py-2 border-t border-gray-100 text-[10px] text-gray-400">
        {lead.email || 'No email on file'} · {lead.location || '—'}
      </div>
    </aside>
  )
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-2">
      <div className="text-gray-400">{label}</div>
      <div className="font-medium text-gray-800 mt-0.5">{value}</div>
    </div>
  )
}
