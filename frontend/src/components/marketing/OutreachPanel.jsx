import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'

function parseRows(text) {
  const lines = String(text || '').trim().split(/\r?\n/).filter(Boolean)
  if (!lines.length) return []
  const separator = lines[0].includes('\t') ? '\t' : ','
  const header = lines[0].toLowerCase().split(separator).map((v) => v.trim())
  const index = (names) => header.findIndex((item) => names.includes(item))
  const emailAt = index(['email', 'email address'])
  const firstAt = index(['first name', 'firstname', 'name'])
  const lastAt = index(['last name', 'lastname'])
  const companyAt = index(['company', 'company name', 'organisation', 'organization'])
  const titleAt = index(['title', 'designation', 'job title'])
  const phoneAt = index(['phone', 'mobile'])
  if (emailAt < 0) throw new Error('Include an Email column in the first row')
  return lines.slice(1).map((line) => {
    const cells = line.split(separator).map((v) => v.trim())
    return { email: cells[emailAt], firstName: cells[firstAt], lastName: cells[lastAt], company: cells[companyAt], title: cells[titleAt], phone: cells[phoneAt] }
  })
}

export default function OutreachPanel({ user }) {
  const [data, setData] = useState({ prospects: [], mailboxes: [] })
  const [paste, setPaste] = useState('First Name,Last Name,Email,Company,Title\n')
  const [mailbox, setMailbox] = useState('')
  const [dailyCap, setDailyCap] = useState(40)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  const load = async () => setData(await api.getOutreach())
  useEffect(() => { load().catch((e) => setError(e.message)) }, [])
  const counts = useMemo(() => data.prospects.reduce((all, row) => ({ ...all, [row.status]: (all[row.status] || 0) + 1 }), {}), [data.prospects])

  const run = async (work) => {
    setBusy(true); setError(null); setMessage(null)
    try { await work(); await load() } catch (e) { setError(e.message || 'Could not save outreach data') } finally { setBusy(false) }
  }

  return <div className="mhub-v3-page" style={{ maxWidth: 1120 }}>
    <section className="mhub-v3-card mhub-v3-domain-section">
      <h2 style={{ margin: 0 }}>Outreach</h2>
      <p>Fresh prospects stay outside CRM until a marketer qualifies and transfers them. Sender mailboxes are pooled automatically once connected.</p>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13 }}>
        <span><strong>{data.prospects.length}</strong> prospects</span><span><strong>{counts.qualified || 0}</strong> qualified</span><span><strong>{counts.transferred || 0}</strong> moved to CRM</span><span><strong>{data.mailboxes.length}</strong> sender mailboxes</span>
      </div>
    </section>

    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(280px, .75fr)', gap: 16 }}>
      <section className="mhub-v3-card mhub-v3-domain-section">
        <h3>Import prospects</h3>
        <p>Paste CSV or spreadsheet rows. Required: <strong>Email</strong>. Supported: First Name, Last Name, Company, Title, Phone.</p>
        <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={9} style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, marginBottom: 10 }} />
        <button className="mhub-v3-btn mhub-v3-btn--primary" disabled={busy} onClick={() => run(async () => { const result = await api.importOutreachProspects(parseRows(paste)); setMessage(`${result.created} prospects added${result.skipped ? `; ${result.skipped} duplicates or invalid rows skipped` : ''}`) })}>{busy ? 'Importing...' : 'Import prospects'}</button>
      </section>
      <section className="mhub-v3-card mhub-v3-domain-section">
        <h3>Sender pool</h3>
        <p>Add the mailboxes you will create on new outreach domains. Sending remains off until each mailbox is connected.</p>
        <input value={mailbox} onChange={(e) => setMailbox(e.target.value)} placeholder="hello@outreach-domain.in" style={{ width: '100%', marginBottom: 8 }} />
        <label style={{ display: 'block', fontSize: 12, marginBottom: 10 }}>Daily cap <input type="number" min="1" max="200" value={dailyCap} onChange={(e) => setDailyCap(e.target.value)} style={{ width: 70, marginLeft: 8 }} /></label>
        <button className="mhub-v3-btn mhub-v3-btn--secondary" disabled={busy} onClick={() => run(async () => { await api.addOutreachMailbox({ email: mailbox, dailyCap }); setMailbox(''); setMessage('Mailbox added. Connect it after its Google Workspace account is ready.') })}>Add mailbox</button>
        <div style={{ marginTop: 14, fontSize: 12 }}>{data.mailboxes.length ? data.mailboxes.map((row) => <div key={row.id} style={{ padding: '6px 0', borderTop: '1px solid #eee' }}>{row.email} · {row.dailyCap}/day · <strong>{row.status === 'awaiting_connection' ? 'Setup pending' : row.status}</strong></div>) : 'No sender mailboxes yet.'}</div>
      </section>
    </div>

    {error ? <p style={{ color: '#b42318' }}>{error}</p> : null}{message ? <p style={{ color: '#27500a' }}>{message}</p> : null}
    <section className="mhub-v3-card mhub-v3-domain-section">
      <h3>Prospect queue</h3>
      {!data.prospects.length ? <p>No prospects yet.</p> : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}><thead><tr><th style={{ textAlign: 'left' }}>Prospect</th><th style={{ textAlign: 'left' }}>Company</th><th style={{ textAlign: 'left' }}>Status</th><th /></tr></thead><tbody>{data.prospects.map((row) => <tr key={row.id} style={{ borderTop: '1px solid #eee' }}><td style={{ padding: '10px 4px' }}><strong>{[row.firstName, row.lastName].filter(Boolean).join(' ') || row.email}</strong><br /><span style={{ color: '#666' }}>{row.email}</span></td><td>{row.company || '—'}</td><td><select value={row.status} disabled={busy || row.status === 'transferred'} onChange={(e) => run(async () => { await api.updateOutreachProspect({ id: row.id, status: e.target.value }); setMessage('Prospect status updated') })}>{['new', 'contacted', 'replying', 'qualified', 'not_a_fit', 'transferred'].map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}</select></td><td>{row.status === 'qualified' ? <button className="mhub-v3-btn mhub-v3-btn--primary" disabled={busy} onClick={() => run(async () => { const result = await api.transferOutreachProspect(row.id); setMessage(result.message) })}>Move to CRM</button> : null}</td></tr>)}</tbody></table></div>}
    </section>
  </div>
}
