import { C } from './settingsTheme'
import { PrimaryButton, SettingsBadge, TextButton } from './SettingsUi'
import { openChromeWebStore } from '../../../lib/chromeExtension'

export default function ChromeExtensionInstallCard({
  version = '1.2.0',
  storeUrl = null,
  onOpenIntegrations,
  compact = false,
}) {
  const description = compact
    ? 'Gmail lead match, LinkedIn capture, and CRM compose.'
    : 'Gmail lead match, trail sync, LinkedIn and contact-page capture, and CRM compose for your team. Requires Connect Intel sign-in in the same Chrome profile.'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: compact ? 8 : 12 }}>
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
          aria-hidden
        >
          CI
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: C.text }}>Chrome extension</span>
            <SettingsBadge bg="#eaf3de" color="#27500a">
              v{version}
            </SettingsBadge>
          </div>
        </div>
      </div>

      <p style={{ fontSize: 12, color: C.textSecondary, margin: '0 0 16px', lineHeight: 1.5 }}>
        {description}
      </p>

      {storeUrl ? (
        <PrimaryButton onClick={() => openChromeWebStore(storeUrl)}>
          Install from Chrome Web Store
        </PrimaryButton>
      ) : (
        <>
          <p style={{ fontSize: 11, color: C.textMuted, margin: '0 0 12px', lineHeight: 1.5 }}>
            Web Store listing pending — developers can load unpacked from the repo{' '}
            <code>extension/</code> folder (chrome://extensions → Developer mode → Load unpacked).
            After publish, set <code>CHROME_EXTENSION_STORE_URL</code> on Vercel.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {onOpenIntegrations ? (
              <TextButton onClick={onOpenIntegrations}>Team integrations</TextButton>
            ) : null}
            <TextButton onClick={() => window.open('https://connectintel.net', '_blank', 'noopener,noreferrer')}>
              Open Connect Intel
            </TextButton>
          </div>
        </>
      )}
    </div>
  )
}
