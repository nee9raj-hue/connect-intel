import { useState } from 'react'
import { api } from '../../lib/api'
import GuidanceCard, { GuidanceModal } from '../guardrails/GuidanceCard.jsx'

const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
]

export default function SaveReportModal({
  open,
  filterSummary,
  serverFilters,
  advancedFilters,
  module = 'pipeline',
  canShareOrg = false,
  userEmail = '',
  onClose,
  onSaved,
}) {
  const [name, setName] = useState('')
  const [scope, setScope] = useState('personal')
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [scheduleCadence, setScheduleCadence] = useState('daily')
  const [scheduleWeekday, setScheduleWeekday] = useState(1)
  const [recipientEmails, setRecipientEmails] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  if (!open) return null

  const buildSchedule = () => {
    if (!scheduleEnabled) return { enabled: false }
    const emails = recipientEmails
      .split(/[,;\s]+/)
      .map((email) => email.trim())
      .filter(Boolean)
    if (!emails.length && userEmail) emails.push(userEmail)
    return {
      enabled: true,
      cadence: scheduleCadence,
      weekday: scheduleCadence === 'weekly' ? Number(scheduleWeekday) : null,
      recipientEmails: emails,
    }
  }

  const submit = async () => {
    if (!name.trim()) {
      setError('Give your report a name')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const data = await api.saveReportDefinition({
        name: name.trim(),
        module,
        scope: canShareOrg && scope === 'org' ? 'org' : 'personal',
        serverFilters,
        advancedFilters,
        schedule: buildSchedule(),
      })
      onSaved?.(data.report)
      setName('')
      setScope('personal')
      setScheduleEnabled(false)
      setScheduleCadence('daily')
      setScheduleWeekday(1)
      setRecipientEmails('')
    } catch (e) {
      setError(e.message || 'Could not save report')
    } finally {
      setBusy(false)
    }
  }

  return (
    <GuidanceModal open onClose={busy ? undefined : onClose}>
      <GuidanceCard
        icon="↓"
        title="Save as report"
        message={
          module === 'deals'
            ? 'Save your current deal filters as a reusable export. Run it anytime to download a full CSV from the server — not just loaded rows.'
            : 'Save your current pipeline filters as a reusable export. Run it anytime to download a full CSV from the server — not just loaded rows.'
        }
        hint={filterSummary || 'Pipeline filters applied'}
        primaryLabel={busy ? 'Saving…' : 'Save report'}
        onPrimary={busy ? undefined : submit}
        secondaryLabel="Cancel"
        onSecondary={busy ? undefined : onClose}
      />
      <div className="ci-create-audience-form">
        <label className="ci-create-audience-form__label">
          Report name
          <input
            type="text"
            value={name}
            disabled={busy}
            placeholder="e.g. Mumbai hot leads weekly"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            className="ci-create-audience-form__input"
          />
        </label>
        {canShareOrg ? (
          <label className="ci-create-audience-form__label">
            Visibility
            <select
              value={scope}
              disabled={busy}
              onChange={(e) => setScope(e.target.value)}
              className="ci-create-audience-form__input"
            >
              <option value="personal">Only me</option>
              <option value="org">Team (org-wide)</option>
            </select>
          </label>
        ) : null}
        <label className="ci-create-audience-form__label flex items-center gap-2">
          <input
            type="checkbox"
            checked={scheduleEnabled}
            disabled={busy}
            onChange={(e) => {
              setScheduleEnabled(e.target.checked)
              if (e.target.checked && !recipientEmails && userEmail) {
                setRecipientEmails(userEmail)
              }
            }}
          />
          Email CSV on a schedule
        </label>
        {scheduleEnabled ? (
          <>
            <label className="ci-create-audience-form__label">
              Cadence
              <select
                value={scheduleCadence}
                disabled={busy}
                onChange={(e) => setScheduleCadence(e.target.value)}
                className="ci-create-audience-form__input"
              >
                <option value="daily">Daily (09:00 UTC)</option>
                <option value="weekly">Weekly (09:00 UTC)</option>
              </select>
            </label>
            {scheduleCadence === 'weekly' ? (
              <label className="ci-create-audience-form__label">
                Weekday
                <select
                  value={scheduleWeekday}
                  disabled={busy}
                  onChange={(e) => setScheduleWeekday(Number(e.target.value))}
                  className="ci-create-audience-form__input"
                >
                  {WEEKDAY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="ci-create-audience-form__label">
              Recipient emails
              <input
                type="text"
                value={recipientEmails}
                disabled={busy}
                placeholder={userEmail || 'you@company.com'}
                onChange={(e) => setRecipientEmails(e.target.value)}
                className="ci-create-audience-form__input"
              />
            </label>
          </>
        ) : null}
        {error ? <p className="ci-create-audience-form__error">{error}</p> : null}
      </div>
    </GuidanceModal>
  )
}
