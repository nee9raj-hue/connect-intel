import { useState } from 'react'

const MEMBERS = [
  { id: 1, name: 'Neeraj Kumar', email: 'neeraj@connectintel.net', role: 'admin', initials: 'NK', color: 'blue', emailStatus: 'reconnect', emailNote: 'Gmail reconnect needed' },
  { id: 2, name: 'Dakash Rantiya', email: 'dakash@xindus.net', role: 'admin', initials: 'DR', color: 'purple', emailStatus: 'error', emailNote: 'Token expired — 58 fails' },
  { id: 3, name: 'Sales Rep A', email: 'rep.a@xindus.net', role: 'member', initials: 'SA', color: 'teal', emailStatus: 'connected', emailNote: 'Gmail connected' },
  { id: 4, name: 'Sales Rep B', email: 'rep.b@xindus.net', role: 'member', initials: 'SB', color: 'amber', emailStatus: 'connected', emailNote: 'Gmail connected' },
]

const INVOICES = [
  { id: 'INV-2026-005', date: 'May 21, 2026', desc: 'Pro plan — May', amount: '₹4,999' },
  { id: 'INV-2026-004', date: 'Apr 21, 2026', desc: 'Pro plan — April', amount: '₹4,999' },
  { id: 'INV-2026-003', date: 'Mar 21, 2026', desc: 'Pro plan — March', amount: '₹4,999' },
  { id: 'INV-2026-002', date: 'Feb 21, 2026', desc: 'Pro plan — February', amount: '₹4,999' },
  { id: 'INV-2026-001', date: 'Jan 21, 2026', desc: 'Pro plan — January + setup', amount: '₹6,499' },
]

const CREDIT_OPTIONS = [
  { amount: '₹1,000', emails: '+200 emails' },
  { amount: '₹2,500', emails: '+600 emails' },
  { amount: '₹5,000', emails: '+1,500 emails', best: true },
  { amount: '₹10,000', emails: '+3,500 emails' },
]

const USAGE = [
  { label: 'Emails sent', used: 710, total: 1000, warn: false },
  { label: 'Contacts', used: 8200, total: 10000, warn: true },
  { label: 'Team seats', used: 4, total: 10, warn: false },
  { label: 'Campaigns', used: 11, total: 20, warn: false },
]

const avatarColors = {
  blue:   { bg: '#E6F1FB', color: '#185FA5' },
  purple: { bg: '#EEEDFE', color: '#3C3489' },
  teal:   { bg: '#E1F5EE', color: '#085041' },
  amber:  { bg: '#FAEEDA', color: '#633806' },
}

const statusDot = {
  connected: '#1D9E75',
  reconnect: '#EF9F27',
  error:     '#E24B4A',
}

export default function PlatformCustomersPanel() {
  const [tab, setTab] = useState('team')
  const [members, setMembers] = useState(MEMBERS)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [selectedCredit, setSelectedCredit] = useState('₹5,000')

  const removeMe = (id) => setMembers((m) => m.filter((x) => x.id !== id))

  return (
    <div className="panel-shell bg-[#f3f4f6]">
      <div className="panel-body-scroll">
        <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 780, margin: '0 auto', padding: '1.5rem 1rem', color: '#1a202c' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>Team & billing</h1>
          <p style={{ fontSize: 13, color: '#718096', margin: '4px 0 0' }}>Manage members, email connections, and your subscription</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <PrimaryBtn onClick={() => { setTab('team'); setTimeout(() => document.getElementById('inviteInput')?.focus(), 50) }}>+ Invite member</PrimaryBtn>
        </div>
      </div>

      <div style={{ display: 'flex', borderBottom: '0.5px solid #e2e8f0', marginBottom: '1.5rem', gap: 2 }}>
        {['team', 'billing', 'invoices'].map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 18px', fontSize: 14, cursor: 'pointer', border: 'none', background: 'none',
            borderBottom: tab === t ? '2px solid #1a202c' : '2px solid transparent',
            color: tab === t ? '#1a202c' : '#718096', fontWeight: tab === t ? 500 : 400,
            textTransform: 'capitalize', marginBottom: -1,
          }}>{t === 'team' ? 'Team members' : t === 'billing' ? 'Billing & usage' : 'Invoices'}</button>
        ))}
      </div>

      {tab === 'team' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: '1.5rem' }}>
            {[
              { label: 'Total members', value: members.length, sub: '2 admins · 2 reps' },
              { label: 'Email connected', value: members.filter(m => m.emailStatus === 'connected').length, sub: '1 needs reconnect' },
              { label: 'Emails sent (May)', value: 142, sub: 'across all members' },
              { label: 'Pending invites', value: 1, sub: 'expires in 6 days' },
            ].map((m) => (
              <MetricCard key={m.label} label={m.label} value={m.value} sub={m.sub} />
            ))}
          </div>

          <Card style={{ marginBottom: '1rem' }}>
            <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 2 }}>Invite a new member</p>
            <p style={{ fontSize: 12, color: '#718096', marginBottom: 12 }}>They will receive an email with a sign-in link.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input id="inviteInput" type="email" placeholder="colleague@xindus.net" value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                style={{ flex: 1, minWidth: 200, padding: '8px 12px', fontSize: 13, border: '0.5px solid #cbd5e0', borderRadius: 8, outline: 'none' }} />
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}
                style={{ padding: '8px 12px', fontSize: 13, border: '0.5px solid #cbd5e0', borderRadius: 8, background: '#fff' }}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <PrimaryBtn onClick={() => { alert(`Invite sent to ${inviteEmail}`); setInviteEmail('') }}>Send invite</PrimaryBtn>
            </div>
          </Card>

          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <p style={{ fontSize: 15, fontWeight: 500 }}>Members</p>
              <p style={{ fontSize: 12, color: '#718096' }}>{members.length} of 10 seats used</p>
            </div>
            <ProgressBar pct={members.length / 10 * 100} />
            {members.map((m, i) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: i < members.length - 1 ? '0.5px solid #e2e8f0' : 'none', flexWrap: 'wrap' }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 500, fontSize: 13, flexShrink: 0, background: avatarColors[m.color].bg, color: avatarColors[m.color].color }}>{m.initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {m.name}
                    <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6, background: m.role === 'admin' ? '#EBF4FF' : '#f7fafc', color: m.role === 'admin' ? '#2b6cb0' : '#718096', fontWeight: 500 }}>{m.role}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#718096', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: statusDot[m.emailStatus], flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: m.emailStatus === 'error' ? '#e53e3e' : '#718096' }}>{m.emailNote}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {m.emailStatus !== 'connected' && <SmallBtn>Reconnect Gmail</SmallBtn>}
                    {m.emailStatus === 'connected' && m.role !== 'admin' && (
                      <SmallBtn danger onClick={() => removeMe(m.id)}>Remove</SmallBtn>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </Card>
        </>
      )}

      {tab === 'billing' && (
        <>
          <Card style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 20, fontWeight: 500 }}>Pro plan</span>
                  <span style={{ background: '#E1F5EE', color: '#085041', padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500 }}>Active</span>
                </div>
                <p style={{ fontSize: 13, color: '#718096' }}>₹4,999 / month · renews on June 21, 2026</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <PrimaryBtn>Manage plan</PrimaryBtn>
              </div>
            </div>
            <div style={{ borderTop: '0.5px solid #e2e8f0', marginTop: '1rem', paddingTop: '1rem', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <InfoField label="Payment method" value="Visa ending 4242" />
              <InfoField label="Billing email" value="neeraj@connectintel.net" />
              <InfoField label="Next charge" value="₹4,999 on Jun 21" />
            </div>
          </Card>

          <Card style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <p style={{ fontSize: 15, fontWeight: 500 }}>Usage this month</p>
              <p style={{ fontSize: 12, color: '#718096' }}>May 1 – 28, 2026</p>
            </div>
            {USAGE.map((u) => (
              <div key={u.label} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: '#718096', width: 120, flexShrink: 0 }}>{u.label}</div>
                <div style={{ flex: 1, height: 6, background: '#edf2f7', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 3, background: u.warn ? '#EF9F27' : '#1D9E75', width: `${Math.round(u.used / u.total * 100)}%` }} />
                </div>
                <div style={{ fontSize: 12, color: '#a0aec0', width: 80, textAlign: 'right', flexShrink: 0 }}>{u.used.toLocaleString()} / {u.total.toLocaleString()}</div>
              </div>
            ))}
          </Card>

          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <p style={{ fontSize: 15, fontWeight: 500 }}>Add credits</p>
              <p style={{ fontSize: 12, color: '#718096' }}>Current balance: ₹0</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginBottom: '1rem' }}>
              {CREDIT_OPTIONS.map((opt) => (
                <button key={opt.amount} onClick={() => setSelectedCredit(opt.amount)} style={{
                  padding: '14px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  border: selectedCredit === opt.amount ? '2px solid #3182ce' : opt.best ? '2px solid #3182ce' : '0.5px solid #e2e8f0',
                  borderRadius: 8, background: selectedCredit === opt.amount ? '#EBF4FF' : '#fff', cursor: 'pointer',
                }}>
                  {opt.best && <span style={{ fontSize: 10, background: '#EBF4FF', color: '#2b6cb0', padding: '1px 6px', borderRadius: 4 }}>Best value</span>}
                  <span style={{ fontSize: 15, fontWeight: 500 }}>{opt.amount}</span>
                  <span style={{ fontSize: 11, color: '#718096' }}>{opt.emails}</span>
                </button>
              ))}
            </div>
            <PrimaryBtn style={{ width: '100%', justifyContent: 'center' }}>Recharge {selectedCredit}</PrimaryBtn>
          </Card>
        </>
      )}

      {tab === 'invoices' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <p style={{ fontSize: 15, fontWeight: 500 }}>Invoice history</p>
          </div>
          <Card>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Invoice', 'Date', 'Description', 'Amount', 'Status'].map((h) => (
                    <th key={h} style={{ textAlign: h === '' ? 'right' : 'left', padding: '8px 10px', fontSize: 12, fontWeight: 500, color: '#718096', borderBottom: '0.5px solid #e2e8f0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {INVOICES.map((inv) => (
                  <tr key={inv.id}>
                    <td style={{ padding: '10px 10px', borderBottom: '0.5px solid #e2e8f0', color: '#718096' }}>{inv.id}</td>
                    <td style={{ padding: '10px 10px', borderBottom: '0.5px solid #e2e8f0' }}>{inv.date}</td>
                    <td style={{ padding: '10px 10px', borderBottom: '0.5px solid #e2e8f0' }}>{inv.desc}</td>
                    <td style={{ padding: '10px 10px', borderBottom: '0.5px solid #e2e8f0', fontWeight: 500 }}>{inv.amount}</td>
                    <td style={{ padding: '10px 10px', borderBottom: '0.5px solid #e2e8f0' }}>
                      <span style={{ background: '#F0FFF4', color: '#276749', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 500 }}>Paid</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
        </div>
      </div>
    </div>
  )
}

function Card({ children, style }) {
  return <div style={{ background: '#fff', border: '0.5px solid #e2e8f0', borderRadius: 12, padding: '1rem 1.25rem', ...style }}>{children}</div>
}

function MetricCard({ label, value, sub }) {
  return (
    <div style={{ background: '#f7fafc', borderRadius: 8, padding: '1rem' }}>
      <div style={{ fontSize: 12, color: '#718096', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 500 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#a0aec0', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

function ProgressBar({ pct, warn, danger }) {
  const fill = danger ? '#E24B4A' : warn ? '#EF9F27' : '#1D9E75'
  return (
    <div style={{ height: 6, background: '#edf2f7', borderRadius: 3, overflow: 'hidden', margin: '8px 0 4px' }}>
      <div style={{ height: '100%', borderRadius: 3, background: fill, width: `${Math.round(pct)}%` }} />
    </div>
  )
}

function PrimaryBtn({ children, onClick, style }) {
  return (
    <button onClick={onClick} style={{ padding: '8px 16px', fontSize: 13, borderRadius: 8, border: 'none', background: '#1a202c', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, ...style }}>
      {children}
    </button>
  )
}

function OutlineBtn({ children, onClick }) {
  return (
    <button onClick={onClick} style={{ padding: '8px 16px', fontSize: 13, borderRadius: 8, border: '0.5px solid #e2e8f0', background: 'none', color: '#1a202c', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {children}
    </button>
  )
}

function SmallBtn({ children, onClick, danger }) {
  return (
    <button onClick={onClick} style={{ padding: '5px 10px', fontSize: 12, borderRadius: 6, border: '0.5px solid #e2e8f0', background: 'none', color: danger ? '#e53e3e' : '#718096', cursor: 'pointer' }}>
      {children}
    </button>
  )
}

function InfoField({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: '#718096', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13 }}>{value}</div>
    </div>
  )
}
