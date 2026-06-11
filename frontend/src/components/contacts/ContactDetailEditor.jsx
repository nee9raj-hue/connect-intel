import LeadPhoneCall from '../crm/LeadPhoneCall'

/**
 * Contact edit form — used in desktop split pane and mobile full-screen modal.
 */
export default function ContactDetailEditor({
  form,
  setField,
  selected,
  pipelineLeadForContact,
  notice,
  error,
  aiSearching,
  aiMatches,
  aiError,
  aiNotice,
  isSaved,
  selectedId,
  onOpenInPipeline,
  onToggleSaveLead,
  onLinkedinAiSearch,
  onApplyLinkedinMatch,
  showInlineSave = true,
  onSave,
  saving,
}) {
  const displayName =
    [form.firstName, form.lastName].filter(Boolean).join(' ') || 'Contact'
  const initials = (
    [form.firstName, form.lastName]
      .filter(Boolean)
      .join(' ')
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2) || 'C'
  ).toUpperCase()

  return (
    <div className="crm-detail-card crm-detail-card-wide !max-w-none !m-0 border-0 shadow-none rounded-none p-0">
      <div className="crm-contact-hero">
        <div className="crm-contact-avatar">{initials}</div>
        <div className="min-w-0 flex-1">
          <h2 className="crm-detail-title">{displayName}</h2>
          <p className="crm-detail-subtitle">
            {[form.title, form.company].filter(Boolean).join(' at ') || 'No company'}
          </p>
          <div className="crm-contact-meta">
            {form.email ? <span className="crm-contact-meta-pill">{form.email}</span> : null}
            {form.phone && pipelineLeadForContact?.id ? (
              <span className="crm-contact-meta-pill inline-flex items-center gap-1">
                <LeadPhoneCall
                  phone={form.phone}
                  leadId={pipelineLeadForContact.id}
                  showNumber
                />
              </span>
            ) : form.phone ? (
              <span className="crm-contact-meta-pill">{form.phone}</span>
            ) : null}
            {selected?.industry ? (
              <span className="crm-contact-meta-pill">{selected.industry}</span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {pipelineLeadForContact ? (
            <button type="button" onClick={onOpenInPipeline} className="crm-btn crm-btn-secondary">
              Open in pipeline
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleSaveLead}
              disabled={isSaved(selectedId)}
              className="crm-btn crm-btn-primary"
            >
              {isSaved(selectedId) ? 'In pipeline' : '+ Add to pipeline'}
            </button>
          )}
        </div>
      </div>

      {(notice || error) && (
        <p className={`crm-alert ${error ? 'crm-alert-error' : 'crm-alert-success'}`}>
          {error || notice}
        </p>
      )}

      <div className="crm-contact-section">
        <div className="crm-contact-section-head">
          <div>
            <p className="crm-field-label mb-1">Core details</p>
            <p className="text-xs text-[#7a8696]">
              Keep contact and company details clean for campaigns and pipeline.
            </p>
          </div>
        </div>
        <div className="crm-form-grid crm-form-grid-2">
          <input
            value={form.firstName}
            onChange={(e) => setField('firstName', e.target.value)}
            placeholder="First name"
            className="crm-input"
          />
          <input
            value={form.lastName}
            onChange={(e) => setField('lastName', e.target.value)}
            placeholder="Last name"
            className="crm-input"
          />
        </div>
        <div className="crm-form-grid mt-2.5">
          <input
            value={form.company}
            onChange={(e) => setField('company', e.target.value)}
            placeholder="Company"
            className="crm-input"
          />
          <input
            value={form.title}
            onChange={(e) => setField('title', e.target.value)}
            placeholder="Job title"
            className="crm-input"
          />
          <input
            type="email"
            value={form.email}
            onChange={(e) => setField('email', e.target.value)}
            placeholder="Email"
            className="crm-input"
          />
          <div className="flex items-center gap-2 min-w-0">
            <input
              value={form.phone}
              onChange={(e) => setField('phone', e.target.value)}
              placeholder="Phone"
              className="crm-input flex-1 min-w-0"
            />
            {form.phone && pipelineLeadForContact?.id ? (
              <LeadPhoneCall phone={form.phone} leadId={pipelineLeadForContact.id} iconOnly />
            ) : null}
          </div>
          <div className="crm-form-grid crm-form-grid-2">
            <input
              value={form.city}
              onChange={(e) => setField('city', e.target.value)}
              placeholder="City"
              className="crm-input"
            />
            <input
              value={form.state}
              onChange={(e) => setField('state', e.target.value)}
              placeholder="State"
              className="crm-input"
            />
          </div>
          <input
            value={form.industry}
            onChange={(e) => setField('industry', e.target.value)}
            placeholder="Industry"
            className="crm-input"
          />
          <input
            value={form.website}
            onChange={(e) => setField('website', e.target.value)}
            placeholder="Website"
            className="crm-input"
          />
        </div>
      </div>

      <div className="crm-contact-section mt-4 space-y-2">
        <div className="crm-contact-section-head">
          <div>
            <label className="crm-field-label">LinkedIn</label>
            <p className="text-xs text-[#7a8696]">
              Find or confirm the right profile before saving the contact.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <input
            value={form.linkedin}
            onChange={(e) => setField('linkedin', e.target.value)}
            placeholder="https://linkedin.com/in/…"
            className="crm-input flex-1 min-w-0"
          />
          {!form.linkedin.trim() && (
            <button
              type="button"
              onClick={onLinkedinAiSearch}
              disabled={aiSearching}
              className="crm-btn crm-btn-secondary shrink-0"
            >
              {aiSearching ? 'Searching…' : 'Search with AI'}
            </button>
          )}
        </div>
        {aiError && <p className="crm-alert crm-alert-error">{aiError}</p>}
        {aiNotice && !aiMatches.length && !aiError && (
          <p className="text-xs text-[#516f90]">{aiNotice}</p>
        )}
        {aiMatches.length > 0 && (
          <div className="rounded-lg border border-[#dfe3eb] bg-[#f5f8fa] p-3 space-y-2">
            <p className="text-xs font-semibold text-[#33475b]">AI matches — pick the best profile</p>
            {aiMatches.map((match, index) => {
              const label =
                match.fullName ||
                [match.firstName, match.lastName].filter(Boolean).join(' ') ||
                'LinkedIn profile'
              const confidence = String(match.confidence || '').toLowerCase()
              return (
                <div
                  key={match.id || match.linkedin || index}
                  className="bg-white border border-[#dfe3eb] rounded-lg p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#33475b]">{label}</p>
                      <p className="text-xs text-[#516f90] mt-0.5">
                        {[match.title, match.company].filter(Boolean).join(' · ') || '—'}
                      </p>
                      <p className="text-xs text-[#FF773D] truncate mt-1">{match.linkedin}</p>
                      {match.reason && (
                        <p className="text-xs text-[#7c98b6] mt-1 leading-snug">{match.reason}</p>
                      )}
                    </div>
                    {confidence && (
                      <span
                        className={`crm-status-pill ${
                          confidence === 'high'
                            ? 'crm-status-active'
                            : confidence === 'low'
                              ? 'crm-status-draft'
                              : 'crm-status-paused'
                        }`}
                      >
                        {confidence}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onApplyLinkedinMatch(match)}
                    className="crm-link-btn mt-2 p-0"
                  >
                    Use this profile
                  </button>
                </div>
              )
            })}
            {aiNotice && <p className="text-xs text-[#7c98b6]">{aiNotice}</p>}
          </div>
        )}
      </div>

      {showInlineSave ? (
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="crm-btn crm-btn-primary w-full mt-5"
        >
          {saving ? 'Saving…' : 'Save contact'}
        </button>
      ) : null}
    </div>
  )
}
