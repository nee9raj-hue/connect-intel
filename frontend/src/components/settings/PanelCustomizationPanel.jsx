import { useMemo } from 'react'
import usePanelPreferences from '../../hooks/usePanelPreferences'
import { useApp } from '../../context/AppContext'
import {
  PANEL_PREF_GROUPS,
  PANEL_PREF_STEP_LABELS,
  PANEL_PREF_STEPS,
} from '../../lib/panelPreferences'
import TeamSettingsSection from '../team/TeamSettingsSection'
import { SettingsGearIcon } from '../ui/icons'

function ScaleStepper({ label, hint, value, onChange, disabled = false }) {
  return (
    <div className="panel-pref-stepper">
      <div className="panel-pref-stepper__head">
        <p className="panel-pref-stepper__label">{label}</p>
        {hint ? <p className="panel-pref-stepper__hint">{hint}</p> : null}
      </div>
      <div className="panel-pref-stepper__control" role="group" aria-label={label}>
        {PANEL_PREF_STEPS.map((step) => {
          const active = value === step
          const stepLabel = PANEL_PREF_STEP_LABELS[String(step)] || String(step)
          return (
            <button
              key={step}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              title={step === 0 ? 'Default size' : stepLabel}
              onClick={() => onChange(step)}
              className={`panel-pref-stepper__btn ${active ? 'is-active' : ''}`}
            >
              {step === 0 ? 'Default' : stepLabel}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function GroupPreview({ groupId, fontStep, iconStep }) {
  const sampleSize = 0.8125 + fontStep * 0.04
  const iconSize = 1 + iconStep * 0.08
  return (
    <div className="panel-pref-preview" data-group={groupId}>
      <span
        className="panel-pref-preview__icon"
        style={{ width: `${iconSize}rem`, height: `${iconSize}rem` }}
        aria-hidden
      />
      <span className="panel-pref-preview__text" style={{ fontSize: `${sampleSize}rem` }}>
        Aa
      </span>
    </div>
  )
}

export default function PanelCustomizationPanel() {
  const { user } = useApp()
  const { preferences, isDefault, setGroupPreference, resetToDefault } = usePanelPreferences(user?.id)

  const summary = useMemo(() => {
    if (isDefault) return 'Using Connect Intel default sizes.'
    const changed = PANEL_PREF_GROUPS.filter(({ id }) => {
      const g = preferences[id]
      return g.fontStep !== 0 || g.iconStep !== 0
    }).map((g) => g.label)
    return changed.length ? `Customized: ${changed.join(', ')}.` : 'Using Connect Intel default sizes.'
  }, [isDefault, preferences])

  return (
    <div className="panel-shell hs-canvas">
      <header className="crm-page-header shrink-0">
        <div className="crm-page-header-top">
          <div className="min-w-0">
            <h1 className="crm-page-title">Display & layout</h1>
            <p className="crm-page-subtitle">
              Adjust text and icon sizes for each part of your workspace — like iPhone display settings.
            </p>
          </div>
          <div className="crm-page-actions">
            <button
              type="button"
              className="crm-btn crm-btn-secondary crm-btn-sm"
              onClick={resetToDefault}
              disabled={isDefault}
            >
              Reset to default
            </button>
          </div>
        </div>
      </header>

      <div className="panel-body-scroll">
        <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-4">
          <p className="text-sm text-[#516f90] bg-white border border-[#cbd6e2] rounded-lg px-3 py-2.5">
            {summary} Your choices are saved on this device for your account only.
          </p>

          <TeamSettingsSection
            id="panel-text-icons"
            icon={SettingsGearIcon}
            title="Text & icon sizes"
            description="Group-wise controls — default matches our standard HubSpot-style layout"
            defaultOpen
          >
            <div className="space-y-5 pt-1">
              {PANEL_PREF_GROUPS.map((group) => {
                const current = preferences[group.id]
                return (
                  <article key={group.id} className="panel-pref-group">
                    <div className="panel-pref-group__head">
                      <div>
                        <h3 className="panel-pref-group__title">{group.label}</h3>
                        <p className="panel-pref-group__desc">{group.description}</p>
                      </div>
                      <GroupPreview
                        groupId={group.id}
                        fontStep={current.fontStep}
                        iconStep={current.iconStep}
                      />
                    </div>
                    <ScaleStepper
                      label="Text size"
                      hint="Smaller ← → Larger"
                      value={current.fontStep}
                      onChange={(fontStep) => setGroupPreference(group.id, { fontStep })}
                    />
                    <ScaleStepper
                      label="Icon size"
                      hint="Smaller ← → Larger"
                      value={current.iconStep}
                      onChange={(iconStep) => setGroupPreference(group.id, { iconStep })}
                    />
                  </article>
                )
              })}
            </div>
          </TeamSettingsSection>

          <TeamSettingsSection
            id="panel-more-soon"
            icon={SettingsGearIcon}
            title="More customization"
            description="Additional layout options will appear here"
            defaultOpen={false}
          >
            <p className="text-sm text-[#516f90] leading-relaxed pt-1">
              We&apos;re building more ways to tailor your panel — density, sidebar width, and quick-nav
              shortcuts. Your display settings above will always stay separate from team admin controls.
            </p>
          </TeamSettingsSection>
        </div>
      </div>
    </div>
  )
}
