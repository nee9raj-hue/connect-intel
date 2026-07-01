import { useApp } from '../../../context/AppContext'
import { C } from './settingsTheme'
import { PrimaryButton, SettingsBadge, SettingsCard } from './SettingsUi'
import { AI_PROSPECTING_IN_CRM_ENABLED, BILLING_IN_CRM_UI_ENABLED } from '../../../lib/crmProductFlags'

function UsageBar({ label, used, total }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
        <span style={{ color: C.textSecondary }}>{label}</span>
        <span style={{ color: C.textMuted }}>
          {used.toLocaleString()} / {total.toLocaleString()} used
        </span>
      </div>
      <div style={{ height: 6, background: '#e8e8e6', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: C.accent, borderRadius: 3 }} />
      </div>
    </div>
  )
}

const PLACEHOLDER_INVOICES = []

function CrmWorkspaceTab() {
  const { user, teamMembers } = useApp()
  const seatLimit = user?.seatLimit ?? 20
  const orgName = user?.organizationName || user?.company || 'Your workspace'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SettingsCard>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 18, fontWeight: 500 }}>CRM included</span>
          <SettingsBadge bg="#eaf3de" color="#27500a">
            Active
          </SettingsBadge>
        </div>
        <p style={{ fontSize: 13, color: C.textSecondary, margin: 0, lineHeight: 1.5 }}>
          <strong>{orgName}</strong> is on Connect Intel CRM at no charge during go-live — pipeline, contacts,
          calendar, team invites, and imports. Paid plans and invoices will appear here when billing opens.
        </p>
      </SettingsCard>

      <SettingsCard>
        <p style={{ fontSize: 14, fontWeight: 500, margin: '0 0 16px' }}>Workspace usage</p>
        <UsageBar label="Team seats" used={teamMembers.length} total={seatLimit} />
        <p style={{ fontSize: 12, color: C.textMuted, margin: 0, lineHeight: 1.5 }}>
          Invite teammates from the Team members tab. AI lead search and marketing add-ons are separate products.
        </p>
      </SettingsCard>
    </div>
  )
}

export default function BillingTab() {
  const { user, teamMembers } = useApp()

  if (!BILLING_IN_CRM_UI_ENABLED) {
    return <CrmWorkspaceTab />
  }

  const planName = user?.subscriptionPlan || user?.planName || 'Pro plan'
  const planStatus = user?.subscriptionStatus || 'active'
  const searchesTotal = user?.searchesTotal ?? 100
  const searchesLeft = user?.searchesLeft ?? 0
  const searchesUsed = Math.max(0, searchesTotal - searchesLeft)
  const seatLimit = user?.seatLimit ?? 20
  const emailsSent = user?.emailsSentThisMonth ?? user?.marketingEmailsSent ?? 0
  const emailLimit = user?.emailLimit ?? 10000

  const statusBadge = {
    active: { bg: '#eaf3de', color: '#27500a', label: 'Active' },
    trial: { bg: '#e6f1fb', color: '#0c447c', label: 'Trial' },
    past_due: { bg: '#faeeda', color: '#633806', label: 'Past due' },
  }[planStatus] || { bg: '#eaf3de', color: '#27500a', label: 'Active' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SettingsCard>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 18, fontWeight: 500 }}>{planName}</span>
              <SettingsBadge bg={statusBadge.bg} color={statusBadge.color}>
                {statusBadge.label}
              </SettingsBadge>
            </div>
            <p style={{ fontSize: 12, color: C.textSecondary, margin: 0 }}>
              {user?.renewalDate ? `Renews ${user.renewalDate}` : 'Renewal date on file with billing'}
              {user?.planAmount ? ` · ${user.planAmount}` : ''}
            </p>
          </div>
          <PrimaryButton onClick={() => window.open('https://billing.stripe.com', '_blank', 'noopener')}>
            Manage subscription
          </PrimaryButton>
        </div>
      </SettingsCard>

      <SettingsCard>
        <p style={{ fontSize: 14, fontWeight: 500, margin: '0 0 16px' }}>Usage</p>
        {AI_PROSPECTING_IN_CRM_ENABLED ? (
          <UsageBar label="AI searches" used={searchesUsed} total={searchesTotal} />
        ) : null}
        <UsageBar label="Team seats" used={teamMembers.length} total={seatLimit} />
        <UsageBar label="Emails sent" used={emailsSent} total={emailLimit} />
      </SettingsCard>

      <SettingsCard style={{ padding: 0, overflow: 'hidden' }}>
        <p style={{ fontSize: 14, fontWeight: 500, padding: '16px 16px 8px', margin: 0 }}>Invoice history</p>
        {PLACEHOLDER_INVOICES.length === 0 ? (
          <p style={{ fontSize: 12, color: C.textMuted, padding: '8px 16px 20px', margin: 0 }}>
            Invoices will appear here once billing is connected to your workspace.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f9f9f7', color: C.textMuted, fontSize: 11, textTransform: 'uppercase' }}>
                <th style={{ textAlign: 'left', padding: '8px 16px' }}>Date</th>
                <th style={{ textAlign: 'left', padding: '8px 16px' }}>Amount</th>
                <th style={{ textAlign: 'left', padding: '8px 16px' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '8px 16px' }}>PDF</th>
              </tr>
            </thead>
            <tbody>
              {PLACEHOLDER_INVOICES.map((inv) => (
                <tr key={inv.id} style={{ borderTop: `0.5px solid ${C.border}` }}>
                  <td style={{ padding: '10px 16px' }}>{inv.date}</td>
                  <td style={{ padding: '10px 16px' }}>{inv.amount}</td>
                  <td style={{ padding: '10px 16px' }}>{inv.status}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <a href={inv.pdfUrl} style={{ color: C.accent, fontSize: 12 }}>
                      Download
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SettingsCard>
    </div>
  )
}
