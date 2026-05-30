import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { listWorkspaceFeatureDefinitions } from '../../lib/workspaceFeatures'
import TeamSettingsSection from './TeamSettingsSection'

export default function OrgWorkspaceSettings({ user, onUserUpdated }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [preset, setPreset] = useState('general_crm')
  const [features, setFeatures] = useState({})
  const [presetOptions, setPresetOptions] = useState([])
  const [overrides, setOverrides] = useState({})

  const featureDefs = useMemo(() => listWorkspaceFeatureDefinitions(), [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getOrgWorkspaceSettings()
      setPreset(data.preset || 'general_crm')
      setFeatures(data.features || {})
      setOverrides(data.overrides || {})
      setPresetOptions(data.presetOptions || [])
    } catch (e) {
      setError(e.message || 'Could not load workspace settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user?.isOrgAdmin && user?.accountType === 'company') load()
  }, [user?.isOrgAdmin, user?.accountType, load])

  const applyPreset = async (presetId) => {
    setPreset(presetId)
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const data = await api.updateOrgWorkspaceSettings({ workspacePreset: presetId })
      setFeatures(data.settings?.features || {})
      setOverrides(data.settings?.overrides || {})
      onUserUpdated?.(data.user)
      setNotice('Workspace preset updated. Dashboard and menu items adjust automatically.')
    } catch (e) {
      setError(e.message || 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  const toggleFeature = async (key, enabled) => {
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const data = await api.updateOrgWorkspaceSettings({
        workspaceFeatures: { [key]: enabled },
      })
      setFeatures(data.settings?.features || {})
      setOverrides(data.settings?.overrides || {})
      onUserUpdated?.(data.user)
      setNotice('Module setting saved.')
    } catch (e) {
      setError(e.message || 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  const resetOverrides = async () => {
    setSaving(true)
    setError(null)
    try {
      const patch = {}
      for (const def of featureDefs) {
        patch[def.key] = null
      }
      const data = await api.updateOrgWorkspaceSettings({ workspaceFeatures: patch })
      setFeatures(data.settings?.features || {})
      setOverrides({})
      onUserUpdated?.(data.user)
      setNotice('Custom toggles cleared — using preset defaults again.')
    } catch (e) {
      setError(e.message || 'Reset failed')
    } finally {
      setSaving(false)
    }
  }

  if (!user?.isOrgAdmin || user?.accountType !== 'company') return null

  return (
    <TeamSettingsSection
      id="workspace-modules"
      icon={ModulesIcon}
      title="Workspace modules"
      description="Choose optional modules for your company. Core CRM (pipeline, contacts, email, marketing) stays on for everyone."
      defaultOpen
    >
      {loading ? (
        <p className="text-sm text-[#516f90]">Loading workspace settings…</p>
      ) : (
        <>
          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
              {error}
            </p>
          )}
          {notice && (
            <p className="text-sm text-green-900 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-3">
              {notice}
            </p>
          )}

          <label className="block mb-4">
            <span className="text-xs font-semibold text-[#516f90] uppercase tracking-wide">
              Industry preset
            </span>
            <select
              value={preset}
              disabled={saving}
              onChange={(e) => applyPreset(e.target.value)}
              className="mt-1 block w-full max-w-md text-sm border border-[#cbd6e2] rounded-md px-3 py-2 bg-white"
            >
              {presetOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-[#7c98b6] leading-relaxed">
              {presetOptions.find((o) => o.id === preset)?.description ||
                'Pick the closest match — you can still toggle individual modules below.'}
            </p>
          </label>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#516f90] uppercase tracking-wide">Modules</p>
            {featureDefs.map((def) => {
              const enabled = Boolean(features[def.key])
              const customized = overrides[def.key] !== undefined
              return (
                <label
                  key={def.key}
                  className={`flex gap-3 items-start p-3 rounded-lg border cursor-pointer ${
                    enabled ? 'border-[#cbd6e2] bg-white' : 'border-[#eaf0f6] bg-[#f5f8fa]'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={enabled}
                    disabled={saving}
                    onChange={(e) => toggleFeature(def.key, e.target.checked)}
                  />
                  <span className="min-w-0">
                    <span className="text-sm font-semibold text-[#33475b]">
                      {def.label}
                      {customized ? (
                        <span className="ml-2 text-[10px] font-medium text-[#0091ae] uppercase">
                          Custom
                        </span>
                      ) : null}
                    </span>
                    <span className="block text-xs text-[#7c98b6] mt-0.5 leading-relaxed">
                      {def.description}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>

          <button
            type="button"
            disabled={saving || !Object.keys(overrides).length}
            onClick={resetOverrides}
            className="mt-3 text-xs font-semibold text-[#0091ae] hover:underline disabled:opacity-40"
          >
            Reset to preset defaults
          </button>
        </>
      )}
    </TeamSettingsSection>
  )
}

function ModulesIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}
