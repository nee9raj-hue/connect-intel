import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import CrmGmailConnectCard from '../team/CrmGmailConnectCard'
import MarketingSuppressionPanel from './MarketingSuppressionPanel'

function DnsRecordBlock({ title, type, name, value }) {
  const copy = () => {
    void navigator.clipboard.writeText(value)
  }
  return (
    <div className="mhub-v3-dns-block">
      <h4>{title}</h4>
      <div className="mhub-v3-dns-row">
        <span style={{ color: '#999', minWidth: 48 }}>Type:</span>
        <code>{type}</code>
      </div>
      <div className="mhub-v3-dns-row">
        <span style={{ color: '#999', minWidth: 48 }}>Name:</span>
        <code>{name}</code>
        <button type="button" className="mhub-v3-copy-btn" onClick={() => navigator.clipboard.writeText(name)}>
          Copy
        </button>
      </div>
      <div className="mhub-v3-dns-row">
        <span style={{ color: '#999', minWidth: 48 }}>Value:</span>
        <code>{value}</code>
        <button type="button" className="mhub-v3-copy-btn" onClick={copy}>
          Copy
        </button>
      </div>
    </div>
  )
}

export default function MarketingDomainsPanel({ user, permissions }) {
  const isAdmin = Boolean(user?.isOrgAdmin)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)
  const [error, setError] = useState(null)
  const [gmailStatus, setGmailStatus] = useState(null)
  const [orgEmail, setOrgEmail] = useState(null)
  const [siteTracking, setSiteTracking] = useState(null)

  const load = useCallback(async () => {
    try {
      const [gmail, domain, tracking] = await Promise.all([
        api.getCrmGmailStatus().catch(() => null),
        api.getOrgEmailDomain().catch(() => null),
        api.getMarketingSiteTracking().catch(() => null),
      ])
      setGmailStatus(gmail)
      setOrgEmail(domain)
      setSiteTracking(tracking)
    } catch {
      /* optional */
    }
  }, [])

  useEffect(() => {
    if (user?.accountType === 'company') load()
  }, [user, load])

  const handleVerify = async () => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const data = await api.setupOrgEmailDomain({ action: 'verify' })
      setOrgEmail(data)
      if (data.verified) {
        setNotice('Domain verified — teammates can send without connecting Gmail individually.')
      } else {
        setNotice('DNS not verified yet. Changes can take up to 48 hours to propagate.')
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const handleAutoSetup = async () => {
    setBusy(true)
    setError(null)
    try {
      const data = await api.setupOrgEmailDomain({ action: 'auto_setup' })
      setOrgEmail(data)
      setNotice(data.justCreated ? `Domain ${data.domain} registered — add DNS records below.` : 'Domain setup refreshed.')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const gmailConnected = Boolean(gmailStatus?.connected)
  const dnsVerified = Boolean(orgEmail?.verified || orgEmail?.userCanSend)
  const domain = orgEmail?.domain || user?.orgEmailDomain || 'yourcompany.com'
  const dkimRecord = orgEmail?.records?.find((r) => /dkim/i.test(r.purpose || ''))
  const spfRecord = orgEmail?.records?.find((r) => /spf|mx|send/i.test(r.purpose || r.type || ''))

  if (user?.accountType !== 'company') {
    return (
      <div className="mhub-v3-page" style={{ maxWidth: 720 }}>
        <section className="mhub-v3-card mhub-v3-domain-section">
          <h3>Work email</h3>
          <p>Connect your work Gmail to send CRM and campaign email from your mailbox.</p>
          <div style={{ marginTop: 12 }}>
            <CrmGmailConnectCard compact />
          </div>
        </section>
        <section className="mhub-v3-card mhub-v3-domain-section">
          <MarketingSuppressionPanel user={user} permissions={permissions} />
        </section>
      </div>
    )
  }

  return (
    <div className="mhub-v3-page" style={{ maxWidth: 720 }}>
      <section className="mhub-v3-card mhub-v3-domain-section">
        <h3>Work email</h3>
        <p>Send campaigns using your connected Google Workspace email.</p>

        <p className={`mhub-v3-status-dot${gmailConnected ? ' is-ok' : ''}`} style={{ marginBottom: 8 }}>
          {gmailConnected ? 'Connected' : 'Not connected'}
          {gmailConnected ? ` · ${gmailStatus.mailbox}` : ''}
        </p>

        {gmailConnected && (
          <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>Replies sync to CRM: ✓</p>
        )}

        {gmailStatus?.verificationPending && (
          <div className="mhub-v3-info-banner">
            Google verification pending — reconnect actions paused.
          </div>
        )}

        {!gmailConnected && (
          <div style={{ marginBottom: 12 }}>
            <CrmGmailConnectCard compact />
          </div>
        )}

        <p style={{ fontSize: 12, color: '#999', lineHeight: 1.5 }}>
          Note: Work email is for individual sends. For team-wide sending, set up company DNS below.
        </p>
      </section>

      {isAdmin && siteTracking?.snippet && (
        <section className="mhub-v3-card mhub-v3-domain-section">
          <h3>Website tracking</h3>
          <p>
            Install the Connect Intel pixel on your site to capture page views and UTM attribution. Form
            submissions on your landing pages automatically attach first/last touch UTM to leads.
          </p>
          <p style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
            Page views (30d): <strong>{siteTracking.pageviews30d ?? 0}</strong>
          </p>
          <textarea
            readOnly
            value={siteTracking.snippet}
            rows={3}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, marginBottom: 8 }}
          />
          <button
            type="button"
            className="mhub-v3-btn mhub-v3-btn--secondary"
            onClick={() => navigator.clipboard.writeText(siteTracking.snippet)}
          >
            Copy snippet
          </button>
        </section>
      )}

      {isAdmin && (
        <section className="mhub-v3-card mhub-v3-domain-section">
          <h3>Company domain DNS setup</h3>
          <p>
            Register <strong>{domain}</strong> so any teammate @{domain} can send without connecting Gmail individually.
          </p>

          <p className={`mhub-v3-status-dot${dnsVerified ? ' is-ok' : ' is-warn'}`} style={{ marginBottom: 12 }}>
            {dnsVerified ? 'Verified' : 'Not verified'}
          </p>

          {error && <p style={{ fontSize: 12, color: '#dc2626', marginBottom: 8 }}>{error}</p>}
          {notice && <p style={{ fontSize: 12, color: '#27500a', marginBottom: 8 }}>{notice}</p>}

          {!orgEmail?.configured && (
            <button type="button" className="mhub-v3-btn mhub-v3-btn--primary" disabled={busy} onClick={handleAutoSetup} style={{ marginBottom: 12 }}>
              {busy ? 'Working…' : 'Register sending domain'}
            </button>
          )}

          <p style={{ fontSize: 12, color: '#666', marginBottom: 10 }}>Add these records at your domain host:</p>

          {dkimRecord ? (
            <DnsRecordBlock title="DKIM" type={dkimRecord.type} name={dkimRecord.host} value={dkimRecord.value} />
          ) : (
            <DnsRecordBlock
              title="DKIM"
              type="TXT"
              name={`resend._domainkey.${domain}`}
              value="(generated after domain registration)"
            />
          )}

          {spfRecord ? (
            <DnsRecordBlock title="SPF / MX" type={spfRecord.type} name={spfRecord.host} value={spfRecord.value} />
          ) : orgEmail?.records?.length ? (
            orgEmail.records.map((r, i) => (
              <DnsRecordBlock key={i} title={r.purpose || r.type} type={r.type} name={r.host} value={r.value} />
            ))
          ) : (
            <DnsRecordBlock
              title="SPF"
              type="MX"
              name="send"
              value="feedback-smtp.us-east-1.amazonses.com"
            />
          )}

          <button
            type="button"
            className="mhub-v3-btn mhub-v3-btn--primary"
            disabled={busy || !orgEmail?.configured}
            onClick={handleVerify}
            style={{ marginTop: 8 }}
          >
            {busy ? 'Checking…' : 'Check DNS verification'}
          </button>

          <p style={{ fontSize: 11, color: '#999', marginTop: 12 }}>
            DNS changes can take up to 48 hours to propagate.
          </p>
        </section>
      )}

      {!isAdmin && !dnsVerified && !gmailConnected && (
        <p className="mhub-v3-empty">Ask your admin to connect work email or finish DNS domain setup.</p>
      )}

      <section className="mhub-v3-card mhub-v3-domain-section">
        <MarketingSuppressionPanel user={user} permissions={permissions} />
      </section>
    </div>
  )
}
