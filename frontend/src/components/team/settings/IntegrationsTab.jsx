import { useEffect, useState } from 'react'
import { api } from '../../../lib/api'
import { C } from './settingsTheme'
import { PrimaryButton, SettingsBadge, SettingsCard, TextButton } from './SettingsUi'

const INTEGRATIONS = [
  { id: 'google_calendar', name: 'Google Calendar', description: 'Sync meetings and follow-ups with Google Calendar.', connectKey: 'googleCalendar' },
  { id: 'whatsapp', name: 'WhatsApp Cloud API', description: 'Send and receive WhatsApp messages from Marketing Hub.', panel: 'whatsapp-settings' },
  { id: 'gmail', name: 'Gmail / Resend', description: 'Configure outbound email and invite delivery.', panel: 'my-email' },
  { id: 'google_oauth', name: 'Google OAuth', description: 'Sign in and connect Google workspace accounts.', connectKey: 'googleOAuth' },
  { id: 'zapier', name: 'Zapier', description: 'Automate workflows with 5,000+ apps.', roadmap: true },
  { id: 'slack', name: 'Slack', description: 'Get CRM notifications in Slack channels.', roadmap: true },
]

function IntegrationIcon({ name }) {
  return (
    <span
      style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        background: '#f0f0ee',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
        fontWeight: 500,
        color: C.textSecondary,
        flexShrink: 0,
      }}
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  )
}

export default function IntegrationsTab({ onNavigate }) {
  const [status, setStatus] = useState(null)
  const [extensionInfo, setExtensionInfo] = useState(null)

  useEffect(() => {
    api.getIntegrationStatus().then(setStatus).catch(() => setStatus(null))
    api.getExtensionBootstrap().then(setExtensionInfo).catch(() => setExtensionInfo(null))
  }, [])

  const isConnected = (item) => {
    if (!status) return false
    if (item.connectKey && status[item.connectKey]) return true
    if (item.id === 'whatsapp' && status.whatsappConfigured) return true
    if (item.id === 'gmail' && (status.gmailConnected || status.resendConfigured)) return true
    return false
  }

  const storeUrl = extensionInfo?.distribution?.chromeWebStoreUrl
  const extensionVersion = extensionInfo?.distribution?.extensionVersion || extensionInfo?.extensionVersion

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
      <SettingsCard>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
          <IntegrationIcon name="Chrome extension" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: C.text }}>Chrome extension</span>
              <SettingsBadge bg="#eaf3de" color="#27500a">
                v{extensionVersion || '1.0.0'}
              </SettingsBadge>
            </div>
          </div>
        </div>
        <p style={{ fontSize: 12, color: C.textSecondary, margin: '0 0 16px', lineHeight: 1.5 }}>
          Gmail lead match, trail sync, LinkedIn capture, and CRM compose for your team. Requires Connect Intel sign-in.
        </p>
        {storeUrl ? (
          <PrimaryButton onClick={() => window.open(storeUrl, '_blank', 'noopener,noreferrer')}>
            Install from Chrome Web Store
          </PrimaryButton>
        ) : (
          <>
            <p style={{ fontSize: 11, color: C.textMuted, margin: '0 0 12px' }}>
              Store listing pending — use Load unpacked from the repo <code>extension/</code> folder, or complete Web Store upload.
            </p>
            <TextButton onClick={() => window.open('https://connectintel.net', '_blank', 'noopener,noreferrer')}>
              Open Connect Intel
            </TextButton>
          </>
        )}
      </SettingsCard>

      {INTEGRATIONS.map((item) => {
        const connected = !item.roadmap && isConnected(item)
        const muted = item.roadmap
        return (
          <SettingsCard key={item.id} style={{ opacity: muted ? 0.65 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
              <IntegrationIcon name={item.name} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{item.name}</span>
                  {item.roadmap ? (
                    <SettingsBadge bg="#f0f0ee" color={C.textMuted}>Roadmap</SettingsBadge>
                  ) : (
                    <SettingsBadge
                      bg={connected ? '#eaf3de' : '#f0f0ee'}
                      color={connected ? '#27500a' : C.textMuted}
                    >
                      {connected ? 'Connected' : 'Not connected'}
                    </SettingsBadge>
                  )}
                </div>
              </div>
            </div>
            <p style={{ fontSize: 12, color: C.textSecondary, margin: '0 0 16px', lineHeight: 1.5 }}>{item.description}</p>
            {item.roadmap ? (
              <PrimaryButton disabled style={{ opacity: 0.5 }}>Coming soon</PrimaryButton>
            ) : item.panel ? (
              <PrimaryButton onClick={() => onNavigate?.(item.panel)}>
                {connected ? 'Configure' : 'Connect'}
              </PrimaryButton>
            ) : (
              <TextButton onClick={() => onNavigate?.('integrations')}>
                {connected ? 'Reconnect' : 'Connect'}
              </TextButton>
            )}
          </SettingsCard>
        )
      })}
    </div>
  )
}
