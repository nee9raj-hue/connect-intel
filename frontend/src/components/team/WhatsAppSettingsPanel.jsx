import { useApp } from '../../context/AppContext'
import OrgWhatsAppCloudSetup from './OrgWhatsAppCloudSetup'

export default function WhatsAppSettingsPanel({ onNavigate }) {
  const { user } = useApp()
  const isCompanyAdmin = user?.isOrgAdmin && user?.accountType === 'company'
  const isIndividual = user?.accountType === 'individual'
  const canConfigure = isCompanyAdmin || isIndividual

  return (
    <div className="panel-shell">
      <header className="shrink-0 bg-white border-b border-gray-200 px-5 py-4">
        <h1 className="text-lg font-semibold text-gray-900">WhatsApp Business API</h1>
        <p className="text-xs text-gray-500 mt-0.5 max-w-2xl leading-relaxed">
          Connect Meta Cloud API credentials here to send marketing campaigns and pipeline bulk messages
          automatically — without opening WhatsApp for each contact.
        </p>
      </header>

      <div className="panel-body-scroll p-5 max-w-xl space-y-4">
        {user?.whatsappAutoSendReady && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <strong>Auto-send is active.</strong> Start a WhatsApp campaign under Marketing or use bulk send in
            Pipeline.
          </div>
        )}

        {!canConfigure ? (
          <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-600 leading-relaxed">
            <p className="font-semibold text-gray-900 mb-2">Admin setup required</p>
            <p>
              Only your company admin can add WhatsApp API credentials. Ask them to open{' '}
              <strong>Workspace → WhatsApp API</strong> in the sidebar (or <strong>Team</strong> for invite and
              email settings).
            </p>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('team')}
                className="mt-3 text-xs font-semibold text-[#FF773D] underline"
              >
                Go to Team settings
              </button>
            )}
          </div>
        ) : (
          <section className="bg-white rounded-xl border-2 border-[#25D366]/35 p-5 space-y-3 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">API credentials</h2>
            <p className="text-xs text-gray-500 leading-relaxed">
              From{' '}
              <a
                href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#FF773D] underline"
              >
                Meta Business Manager
              </a>
              : WhatsApp app → <strong>Phone number ID</strong> and <strong>Permanent access token</strong>.
              For cold outreach, add an approved <strong>template name</strong> below.
            </p>
            <OrgWhatsAppCloudSetup scope="org" />
          </section>
        )}

        <section className="rounded-xl border border-gray-200 bg-white p-4 text-xs text-gray-600 leading-relaxed space-y-2">
          <p className="font-semibold text-gray-800">Where this is used</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Marketing → WhatsApp campaigns (automatic send on start)</li>
            <li>Pipeline → select leads → WhatsApp → Send all automatically</li>
          </ul>
          {isCompanyAdmin && onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('team')}
              className="text-[11px] font-semibold text-gray-700 underline pt-1"
            >
              Team & email (invites, Gmail, branding)
            </button>
          )}
        </section>
      </div>
    </div>
  )
}
