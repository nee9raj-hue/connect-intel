import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { formatDateTime } from '../../lib/crmUiConstants'
import { MH } from './marketingTheme'

const STEPS = ['Recipients', 'Email', 'Review & send']

export default function MarketingBulkEmailTab({ lists = [], onNavigate }) {
  const [step, setStep] = useState(0)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [sendId, setSendId] = useState(null)
  const [recipientInfo, setRecipientInfo] = useState(null)

  const [source, setSource] = useState('paste')
  const [csvText, setCsvText] = useState('')
  const [emailsText, setEmailsText] = useState('')
  const [manualEmail, setManualEmail] = useState('')
  const [listId, setListId] = useState('')

  const [form, setForm] = useState({
    name: '',
    fromName: '',
    fromEmail: '',
    subject: '',
    previewText: '',
    body: '',
    captureAsLead: true,
    captureStage: 'new',
    sendNow: true,
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getMarketingBulkSends()
      setHistory(res.sends || [])
    } catch {
      setHistory([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const attachRecipients = async () => {
    setError(null)

    if (source === 'paste' && !emailsText.trim()) {
      setError('Paste at least one email address.')
      return
    }
    if (source === 'csv' && !csvText.trim()) {
      setError('Paste CSV content or switch to paste emails.')
      return
    }
    if (source === 'manual' && !manualEmail.trim().includes('@')) {
      setError('Enter a valid email address.')
      return
    }
    if (source === 'list' && !listId) {
      setError('Select a CRM list.')
      return
    }

    setBusy(true)
    try {
      let id = sendId
      if (!id) {
        const created = await api.createMarketingBulkSend({
          name: form.name || 'Bulk send',
          subject: form.subject || 'Draft',
        })
        id = created.send?.id
        setSendId(id)
      }
      const res = await api.attachBulkRecipients(id, {
        source,
        csvText: source === 'csv' ? csvText : undefined,
        emailsText: source === 'paste' ? emailsText : undefined,
        manualEmail: source === 'manual' ? manualEmail : undefined,
        listId: source === 'list' ? listId : undefined,
      })
      if (!res.recipientCount) {
        setError('No valid emails found. Check your input and try again.')
        return
      }
      setRecipientInfo(res)
      setStep(1)
    } catch (e) {
      setError(e.message || 'Could not add recipients')
    } finally {
      setBusy(false)
    }
  }

  const saveEmail = async () => {
    if (!form.name.trim() || !form.subject.trim()) {
      setError('Campaign name and subject are required')
      return
    }
    setBusy(true)
    setError(null)
    try {
      let id = sendId
      if (!id) {
        const created = await api.createMarketingBulkSend(form)
        id = created.send?.id
        setSendId(id)
      } else {
        await api.updateMarketingBulkSend({ ...form, id })
      }
      setStep(2)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const send = async () => {
    if (!sendId) {
      setError('No recipients loaded — go back to step 1.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api.sendMarketingBulkSend(sendId)
      setStep(0)
      setSendId(null)
      setRecipientInfo(null)
      setEmailsText('')
      setManualEmail('')
      setCsvText('')
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mhub-v3-page">
      <div className="mhub-v3-bulk-layout">
        <div className="mhub-v3-card mhub-v3-bulk-wizard">
          <div className="mhub-v3-bulk-steps">
            {STEPS.map((s, i) => (
              <span key={s} className={i === step ? 'is-active' : i < step ? ' is-done' : ''}>
                {i + 1}. {s}
              </span>
            ))}
          </div>

          {step === 0 && (
            <div>
              <p style={{ fontSize: 13, marginBottom: 12 }}>How do you want to add recipients?</p>

              <label className="mhub-v3-radio-block">
                <input
                  type="radio"
                  name="bulk-src"
                  checked={source === 'manual'}
                  onChange={() => setSource('manual')}
                />
                <span>
                  <strong>Add email manually</strong>
                  <input
                    type="email"
                    className="mhub-v3-input"
                    placeholder="name@company.com"
                    value={manualEmail}
                    onFocus={() => setSource('manual')}
                    onChange={(e) => {
                      setSource('manual')
                      setManualEmail(e.target.value)
                    }}
                  />
                </span>
              </label>

              <label className="mhub-v3-radio-block">
                <input
                  type="radio"
                  name="bulk-src"
                  checked={source === 'paste'}
                  onChange={() => setSource('paste')}
                />
                <span>
                  <strong>Paste emails</strong>
                  <textarea
                    className="mhub-v3-input"
                    rows={4}
                    placeholder="One email per line or comma-separated"
                    value={emailsText}
                    onFocus={() => setSource('paste')}
                    onChange={(e) => {
                      setSource('paste')
                      setEmailsText(e.target.value)
                    }}
                  />
                </span>
              </label>

              <label className="mhub-v3-radio-block">
                <input
                  type="radio"
                  name="bulk-src"
                  checked={source === 'csv'}
                  onChange={() => setSource('csv')}
                />
                <span>
                  <strong>Upload CSV file</strong>
                  <textarea
                    className="mhub-v3-input"
                    rows={5}
                    placeholder="email,first_name,last_name,company"
                    value={csvText}
                    onFocus={() => setSource('csv')}
                    onChange={(e) => {
                      setSource('csv')
                      setCsvText(e.target.value)
                    }}
                  />
                </span>
              </label>

              <label className="mhub-v3-radio-block">
                <input
                  type="radio"
                  name="bulk-src"
                  checked={source === 'list'}
                  onChange={() => setSource('list')}
                />
                <span>
                  <strong>Use CRM audience</strong>
                  <select
                    className="mhub-v3-input"
                    value={listId}
                    onFocus={() => setSource('list')}
                    onChange={(e) => {
                      setSource('list')
                      setListId(e.target.value)
                    }}
                  >
                    <option value="">Select list…</option>
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.leadIds?.length || l.memberCount || 0})
                      </option>
                    ))}
                  </select>
                </span>
              </label>

              {recipientInfo ? (
                <p style={{ fontSize: 12, color: '#22a06b' }}>
                  ✓ {recipientInfo.recipientCount} emails loaded
                  {recipientInfo.duplicatesRemoved
                    ? ` · ${recipientInfo.duplicatesRemoved} duplicates removed`
                    : ''}
                </p>
              ) : null}

              <button
                type="button"
                className="mhub-v3-btn mhub-v3-btn--primary"
                disabled={busy}
                onClick={attachRecipients}
              >
                Continue →
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="mhub-v3-form-stack">
              <input
                className="mhub-v3-input"
                placeholder="Campaign name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
              <input
                className="mhub-v3-input"
                placeholder="From name"
                value={form.fromName}
                onChange={(e) => setForm((p) => ({ ...p, fromName: e.target.value }))}
              />
              <input
                className="mhub-v3-input"
                placeholder="From email"
                value={form.fromEmail}
                onChange={(e) => setForm((p) => ({ ...p, fromEmail: e.target.value }))}
              />
              <input
                className="mhub-v3-input"
                placeholder="Subject"
                value={form.subject}
                onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
              />
              <input
                className="mhub-v3-input"
                placeholder="Preview text"
                value={form.previewText}
                onChange={(e) => setForm((p) => ({ ...p, previewText: e.target.value }))}
              />
              <textarea
                className="mhub-v3-input"
                rows={6}
                placeholder="Email body (use {{first_name}} etc.)"
                value={form.body}
                onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="mhub-v3-btn" onClick={() => setStep(0)}>
                  ← Back
                </button>
                <button type="button" className="mhub-v3-btn mhub-v3-btn--primary" disabled={busy} onClick={saveEmail}>
                  Review →
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="mhub-v3-card" style={{ background: '#f8f8f7', marginBottom: 12 }}>
                <p style={{ fontSize: 12, margin: '4px 0' }}>
                  <strong>Recipients:</strong> {recipientInfo?.recipientCount || 0}
                </p>
                <p style={{ fontSize: 12, margin: '4px 0' }}>
                  <strong>Subject:</strong> {form.subject}
                </p>
                <p style={{ fontSize: 12, margin: '4px 0' }}>
                  <strong>From:</strong> {form.fromEmail || '—'}
                </p>
              </div>
              <label style={{ display: 'flex', gap: 8, fontSize: 12, marginBottom: 12 }}>
                <input
                  type="checkbox"
                  checked={form.captureAsLead}
                  onChange={(e) => setForm((p) => ({ ...p, captureAsLead: e.target.checked }))}
                />
                Convert replies/clicks to leads in pipeline
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="mhub-v3-btn" onClick={() => setStep(1)}>
                  ← Back
                </button>
                <button type="button" className="mhub-v3-btn mhub-v3-btn--primary" disabled={busy} onClick={send}>
                  Send to {recipientInfo?.recipientCount || 0} contacts
                </button>
              </div>
            </div>
          )}
          {error ? <p style={{ color: MH.danger, fontSize: 12, marginTop: 8 }}>{error}</p> : null}
        </div>

        <div className="mhub-v3-card">
          <h3 className="mhub-v3-card__title">Send history</h3>
          {loading ? <p className="mhub-v3-empty">Loading…</p> : null}
          {!loading && !history.length ? <p className="mhub-v3-empty">No bulk sends yet.</p> : null}
          <table className="mhub-v3-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Recipients</th>
                <th>Sent</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.recipientCount || 0}</td>
                  <td>{row.sentAt ? formatDateTime(row.sentAt) : '—'}</td>
                  <td>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
