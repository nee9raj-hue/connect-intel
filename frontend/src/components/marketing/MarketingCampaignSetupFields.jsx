import { FOLLOW_UP_STARTER } from './MarketingTemplateBuilder'
import { marketingOptionLabel } from './MarketingCreatorBadge'

/**
 * Shared campaign setup fields (channel, name, list, template, optional sequence).
 */
export default function MarketingCampaignSetupFields({
  campaignForm,
  setCampaignForm,
  lists,
  templates,
  applyTemplate,
  compact = false,
  showSequenceControls = true,
  user,
  onNavigate,
}) {
  const channelLists = lists.filter((l) => (l.channel || 'email') === campaignForm.channel)

  return (
    <div className={`space-y-3 ${compact ? '' : 'pt-1'}`}>
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'email', label: 'Email' },
          { id: 'whatsapp', label: 'WhatsApp' },
        ].map((ch) => (
          <button
            key={ch.id}
            type="button"
            onClick={() =>
              setCampaignForm((p) => ({
                ...p,
                channel: ch.id,
                listId: '',
              }))
            }
            className={`ci-btn !text-xs flex-1 min-w-[7rem] ${
              campaignForm.channel === ch.id ? 'ci-btn-accent' : 'ci-btn-secondary'
            }`}
          >
            {ch.label}
          </button>
        ))}
      </div>

      <input
        value={campaignForm.name}
        onChange={(e) => setCampaignForm((p) => ({ ...p, name: e.target.value }))}
        placeholder="Campaign name"
        className="ci-input w-full"
      />

      {campaignForm.channel === 'email' && (
        <input
          value={campaignForm.subject}
          onChange={(e) => setCampaignForm((p) => ({ ...p, subject: e.target.value }))}
          placeholder="Email subject — {{firstName}}, quick update"
          className="ci-input w-full"
        />
      )}

      <select
        value={campaignForm.listId}
        onChange={(e) => setCampaignForm((p) => ({ ...p, listId: e.target.value }))}
        className="ci-input w-full"
      >
        <option value="">Choose audience list…</option>
        {channelLists.map((l) => (
          <option key={l.id} value={l.id}>
            {marketingOptionLabel(l)} ({l.leadIds?.length || 0})
          </option>
        ))}
      </select>

      {!channelLists.length && (
        <p className="text-xs text-amber-800 leading-relaxed">
          No {campaignForm.channel === 'whatsapp' ? 'WhatsApp' : 'email'} lists yet — create one under
          Lists.
        </p>
      )}

      <select
        value={campaignForm.templateId}
        onChange={(e) => applyTemplate(e.target.value)}
        className="ci-input w-full"
      >
        <option value="">Start fresh</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {marketingOptionLabel(t)}
            {t.blocks?.length ? ' (designed)' : ''}
          </option>
        ))}
      </select>

      {showSequenceControls && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            {campaignForm.channel === 'email' && (
              <label className="flex items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={campaignForm.useSequence}
                  onChange={(e) => {
                    const checked = e.target.checked
                    setCampaignForm((p) => ({
                      ...p,
                      useSequence: checked,
                      step2Blocks:
                        checked && !p.step2Blocks?.length
                          ? FOLLOW_UP_STARTER.blocks.map((b) => ({
                              ...b,
                              id: `blk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                            }))
                          : p.step2Blocks,
                      step2Subject:
                        checked && !p.step2Subject ? FOLLOW_UP_STARTER.subject : p.step2Subject,
                    }))
                  }}
                />
                Add follow-up email
              </label>
            )}
            {campaignForm.channel === 'whatsapp' && (
              <label className="flex items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={campaignForm.useSequence}
                  onChange={(e) =>
                    setCampaignForm((p) => ({ ...p, useSequence: e.target.checked }))
                  }
                />
                Add follow-up WhatsApp
              </label>
            )}
            {campaignForm.useSequence && (
              <label className="flex items-center gap-2 text-xs text-gray-600">
                After
                <input
                  value={campaignForm.step2Delay}
                  onChange={(e) =>
                    setCampaignForm((p) => ({ ...p, step2Delay: e.target.value }))
                  }
                  type="number"
                  min={1}
                  max={30}
                  className="w-14 text-sm border border-gray-200 rounded-lg px-2 py-1"
                />
                days
              </label>
            )}
          </div>

          {campaignForm.channel === 'whatsapp' &&
            !user?.whatsappAutoSendReady &&
            user?.isOrgAdmin && (
              <p className="text-xs text-amber-950 leading-relaxed rounded-lg border border-amber-100 bg-amber-50/80 p-2.5">
                Connect WhatsApp Business API for auto-send.{' '}
                <button
                  type="button"
                  onClick={() => onNavigate?.('whatsapp-settings')}
                  className="font-semibold underline text-[#FF773D]"
                >
                  WhatsApp settings
                </button>
              </p>
            )}
        </>
      )}
    </div>
  )
}
