import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { DEFAULT_USAGE_POLICIES } from '../../lib/resourceProtection.js'
import TeamSettingsSection from './TeamSettingsSection'
import { SettingsGearIcon } from '../ui/icons'

function PolicyNumber({ label, hint, value, onChange, min, max, disabled }) {
  return (
    <label className="usage-policy-field">
      <span className="usage-policy-field__label">{label}</span>
      {hint ? <span className="usage-policy-field__hint">{hint}</span> : null}
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="usage-policy-field__input"
      />
    </label>
  )
}

function RoleLimitsGroup({ title, limits, onChange, disabled }) {
  return (
    <fieldset className="usage-policy-role">
      <legend>{title}</legend>
      <div className="usage-policy-role__grid">
        <PolicyNumber
          label="Email recipients"
          value={limits.emailMax}
          min={1}
          max={500}
          disabled={disabled}
          onChange={(v) => onChange({ ...limits, emailMax: v })}
        />
        <PolicyNumber
          label="Export records"
          value={limits.exportMax}
          min={100}
          max={100_000}
          disabled={disabled}
          onChange={(v) => onChange({ ...limits, exportMax: v })}
        />
        <PolicyNumber
          label="Bulk assign"
          value={limits.bulkAssignMax}
          min={10}
          max={10_000}
          disabled={disabled}
          onChange={(v) => onChange({ ...limits, bulkAssignMax: v })}
        />
      </div>
    </fieldset>
  )
}

export default function UsagePoliciesSettings({ user, onUserUpdated }) {
  const [policies, setPolicies] = useState(DEFAULT_USAGE_POLICIES)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getCrmSettings()
      const custom = data.settings?.usagePolicies
      setPolicies(
        custom
          ? {
              ...DEFAULT_USAGE_POLICIES,
              ...custom,
              roleLimits: {
                ...DEFAULT_USAGE_POLICIES.roleLimits,
                ...(custom.roleLimits || {}),
              },
            }
          : { ...DEFAULT_USAGE_POLICIES }
      )
    } catch (e) {
      setError(e.message || 'Could not load usage policies')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user?.isOrgAdmin && user?.accountType === 'company') load()
  }, [user?.isOrgAdmin, user?.accountType, load])

  const save = async () => {
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const data = await api.updateCrmSettings({ usagePolicies: policies })
      setPolicies({
        ...DEFAULT_USAGE_POLICIES,
        ...data.settings?.usagePolicies,
        roleLimits: {
          ...DEFAULT_USAGE_POLICIES.roleLimits,
          ...(data.settings?.usagePolicies?.roleLimits || {}),
        },
      })
      onUserUpdated?.({
        ...user,
        orgCrmSettings: data.settings,
      })
      setNotice('Usage policies saved. Changes apply immediately for your team.')
    } catch (e) {
      setError(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (!user?.isOrgAdmin || user?.accountType !== 'company') return null

  return (
    <TeamSettingsSection
      id="usage-policies"
      icon={SettingsGearIcon}
      title="Usage policies"
      description="Tune recommended workflows for email, exports, and bulk actions — no code changes required"
      defaultOpen={false}
    >
      {loading ? (
        <p className="text-sm text-[#516f90] pt-1">Loading policies…</p>
      ) : (
        <div className="usage-policies-form space-y-4 pt-1">
          {notice && (
            <p className="text-sm text-green-900 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              {notice}
            </p>
          )}
          {error && (
            <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2" role="alert">
              {error}
            </p>
          )}

          <p className="text-sm text-[#516f90] leading-relaxed">
            These settings guide teammates toward Marketing Hub for larger operations. Messaging stays friendly and
            success-oriented.
          </p>

          <div className="usage-policy-section">
            <h3 className="usage-policy-section__title">Pipeline email</h3>
            <div className="usage-policy-section__grid">
              <PolicyNumber
                label="Personal send (max)"
                hint="1-to-1 outreach from pipeline"
                value={policies.pipelineEmail?.allowMax ?? 10}
                min={1}
                max={50}
                disabled={saving}
                onChange={(v) =>
                  setPolicies((p) => ({
                    ...p,
                    pipelineEmail: { ...p.pipelineEmail, allowMax: v },
                  }))
                }
              />
              <PolicyNumber
                label="Guide to Marketing Hub"
                hint="Show campaign recommendation above"
                value={policies.pipelineEmail?.guideMax ?? 50}
                min={11}
                max={200}
                disabled={saving}
                onChange={(v) =>
                  setPolicies((p) => ({
                    ...p,
                    pipelineEmail: { ...p.pipelineEmail, guideMax: v },
                  }))
                }
              />
            </div>
          </div>

          <div className="usage-policy-section">
            <h3 className="usage-policy-section__title">Bulk assign &amp; edit</h3>
            <div className="usage-policy-section__grid">
              <PolicyNumber
                label="Confirm above"
                value={policies.bulkAssign?.confirmAbove ?? 100}
                min={1}
                max={1000}
                disabled={saving}
                onChange={(v) =>
                  setPolicies((p) => ({
                    ...p,
                    bulkAssign: { ...p.bulkAssign, confirmAbove: v },
                  }))
                }
              />
              <PolicyNumber
                label="Manager review above"
                value={policies.bulkAssign?.managerRequiredAbove ?? 500}
                min={101}
                max={10_000}
                disabled={saving}
                onChange={(v) =>
                  setPolicies((p) => ({
                    ...p,
                    bulkAssign: { ...p.bulkAssign, managerRequiredAbove: v },
                  }))
                }
              />
              <PolicyNumber
                label="Bulk edit review above"
                value={policies.bulkEdit?.reviewAbove ?? 100}
                min={1}
                max={1000}
                disabled={saving}
                onChange={(v) =>
                  setPolicies((p) => ({
                    ...p,
                    bulkEdit: { ...p.bulkEdit, reviewAbove: v },
                  }))
                }
              />
            </div>
          </div>

          <div className="usage-policy-section">
            <h3 className="usage-policy-section__title">Exports</h3>
            <div className="usage-policy-section__grid">
              <PolicyNumber
                label="Instant export max"
                value={policies.export?.instantMax ?? 500}
                min={1}
                max={5000}
                disabled={saving}
                onChange={(v) =>
                  setPolicies((p) => ({
                    ...p,
                    export: { ...p.export, instantMax: v },
                  }))
                }
              />
              <PolicyNumber
                label="Prepared export max"
                value={policies.export?.prepareMax ?? 5000}
                min={501}
                max={50_000}
                disabled={saving}
                onChange={(v) =>
                  setPolicies((p) => ({
                    ...p,
                    export: { ...p.export, prepareMax: v },
                  }))
                }
              />
            </div>
          </div>

          <div className="usage-policy-section">
            <h3 className="usage-policy-section__title">Role limits</h3>
            {(['rep', 'manager', 'admin']).map((role) => (
              <RoleLimitsGroup
                key={role}
                title={role === 'rep' ? 'Sales rep' : role === 'manager' ? 'Manager' : 'Admin'}
                limits={policies.roleLimits?.[role] || DEFAULT_USAGE_POLICIES.roleLimits[role]}
                disabled={saving}
                onChange={(next) =>
                  setPolicies((p) => ({
                    ...p,
                    roleLimits: { ...p.roleLimits, [role]: next },
                  }))
                }
              />
            ))}
          </div>

          <button
            type="button"
            className="crm-btn crm-btn-primary"
            disabled={saving}
            onClick={save}
          >
            {saving ? 'Saving…' : 'Save usage policies'}
          </button>
        </div>
      )}
    </TeamSettingsSection>
  )
}
