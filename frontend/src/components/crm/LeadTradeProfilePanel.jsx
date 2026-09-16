import { useEffect, useMemo, useState } from 'react'
import {
  TRADE_PROFILE_CARGO_CLASSES,
  TRADE_PROFILE_COMMODITY_SUGGESTIONS,
  TRADE_PROFILE_MARKET_SUGGESTIONS,
  TRADE_PROFILE_ORIGIN_FOOTPRINT,
  TRADE_PROFILE_SALES_CHANNELS,
  TRADE_PROFILE_TRANSPORT_MODES,
  emptyTradeProfile,
  formatChoiceLabels,
  getLeadTradeProfile,
  hasTradeProfileDisplayData,
  normalizeTradeProfile,
} from '../../../../lib/leadTradeProfile.js'
import { formatCrmDate } from '../../lib/crmConstants'
import {
  LwBtn,
  LwChip,
  LwEmpty,
  LwField,
  LwFormStack,
  LwInfoGrid,
  LwInput,
  LwSection,
  LwSubmitBtn,
} from './leadWorkspaceUi'
import { PencilIcon, PlusIcon, RouteIcon, TrashIcon } from '../ui/icons'

function toggleId(list, id) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}

function ChipMulti({ options, value, onChange }) {
  return (
    <div className="lw-chip-row">
      {options.map((opt) => (
        <LwChip key={opt.id} active={value.includes(opt.id)} onClick={() => onChange(toggleId(value, opt.id))}>
          {opt.label}
        </LwChip>
      ))}
    </div>
  )
}

function ChipSingle({ options, value, onChange, allowClear = true }) {
  return (
    <div className="lw-chip-row">
      {options.map((opt) => (
        <LwChip
          key={opt.id}
          active={value === opt.id}
          onClick={() => onChange(allowClear && value === opt.id ? null : opt.id)}
        >
          {opt.label}
        </LwChip>
      ))}
    </div>
  )
}

function uniqueList(list) {
  return normalizeTradeProfile({ commodities: list }).commodities
}

function TagEditor({ values, suggestions = [], placeholder, onChange }) {
  const [draft, setDraft] = useState('')
  const add = (raw) => {
    const parts = String(raw || '')
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (!parts.length) return
    onChange(uniqueList([...values, ...parts]))
    setDraft('')
  }
  return (
    <div className="lw-profile-tags">
      {suggestions.length ? (
        <div className="lw-chip-row">
          {suggestions.map((tag) => (
            <LwChip
              key={tag}
              active={values.some((v) => v.toLowerCase() === tag.toLowerCase())}
              onClick={() => {
                const exists = values.some((v) => v.toLowerCase() === tag.toLowerCase())
                onChange(exists ? values.filter((v) => v.toLowerCase() !== tag.toLowerCase()) : uniqueList([...values, tag]))
              }}
            >
              {tag}
            </LwChip>
          ))}
        </div>
      ) : null}
      <div className="lw-chip-row lw-profile-tags__selected">
        {values.map((tag) => (
          <span key={tag} className="lw-erp-pill">
            {tag}
            <button type="button" className="lw-profile-tag-x" onClick={() => onChange(values.filter((v) => v !== tag))} aria-label={`Remove ${tag}`}>
              ×
            </button>
          </span>
        ))}
      </div>
      <LwInput
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            add(draft)
          }
        }}
        onBlur={() => add(draft)}
      />
    </div>
  )
}

function yesNoLabel(value) {
  if (value === true) return 'Yes'
  if (value === false) return 'No'
  return '—'
}

export default function LeadTradeProfilePanel({ lead, patchLead, busy, onNotice, onError }) {
  const saved = useMemo(() => getLeadTradeProfile(lead), [lead])
  const hasSaved = hasTradeProfileDisplayData(saved)
  const [editing, setEditing] = useState(!hasSaved)
  const [form, setForm] = useState(() => ({ ...emptyTradeProfile(), ...saved }))

  useEffect(() => {
    const next = getLeadTradeProfile(lead)
    setForm({ ...emptyTradeProfile(), ...next })
    setEditing(!hasTradeProfileDisplayData(next))
  }, [lead.id])

  const patchForm = (partial) => setForm((current) => ({ ...current, ...partial }))

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    onError?.(null)
    try {
      const payload = normalizeTradeProfile(form)
      await patchLead(lead.id, { tradeProfile: payload })
      onNotice?.('Trade profile saved')
      setEditing(false)
    } catch (err) {
      onError?.(err.message || 'Could not save trade profile')
    }
  }

  if (!editing && hasSaved) {
    const channels = formatChoiceLabels(saved.salesChannels, TRADE_PROFILE_SALES_CHANNELS)
    const modes = formatChoiceLabels(saved.transportModes, TRADE_PROFILE_TRANSPORT_MODES)
    const cargo = formatChoiceLabels(saved.cargoClasses, TRADE_PROFILE_CARGO_CLASSES)
    const footprint = formatChoiceLabels(
      saved.originFootprint ? [saved.originFootprint] : [],
      TRADE_PROFILE_ORIGIN_FOOTPRINT
    )[0]
    const cadence = saved.laneCadence.filter((row) => row.shipmentsPerMonth)
    return (
      <div className="lw-erp">
        <LwSection
          icon={RouteIcon}
          title="Trade profile"
          action={
            <LwBtn variant="secondary" icon={PencilIcon} onClick={() => setEditing(true)} disabled={busy}>
              Edit
            </LwBtn>
          }
        >
          <p className="lw-erp-subcopy">
            How this account ships — used to decide lanes, product, and service offering.
          </p>
          {saved.updatedAt ? (
            <p className="lw-erp-subcopy">
              Updated {formatCrmDate(saved.updatedAt)}
              {saved.updatedByName ? ` · ${saved.updatedByName}` : ''}
            </p>
          ) : null}
          <div className="lw-erp-pills">
            {channels.map((label) => (
              <span key={label} className="lw-erp-pill lw-erp-pill--ok">{label}</span>
            ))}
            {modes.map((label) => (
              <span key={label} className="lw-erp-pill">{label}</span>
            ))}
            {cargo.map((label) => (
              <span key={label} className="lw-erp-pill">{label}</span>
            ))}
          </div>
        </LwSection>

        <LwSection icon={RouteIcon} title="Cargo">
          <LwInfoGrid
            items={[
              { label: 'Commodities', value: saved.commodities.join(', ') || '—' },
              { label: 'Typical size', value: saved.typicalShipmentSize || '—' },
              { label: 'Cargo class', value: cargo.join(', ') || '—' },
            ]}
          />
        </LwSection>

        <LwSection icon={RouteIcon} title="Network">
          <LwInfoGrid
            items={[
              { label: 'Origin footprint', value: footprint || '—' },
              { label: 'Split deliveries', value: yesNoLabel(saved.splitDeliveries) },
              { label: 'Destination markets', value: saved.destinationMarkets.join(', ') || '—' },
            ]}
          />
          {cadence.length ? (
            <ul className="lw-erp-ledger lw-profile-cadence">
              {cadence.map((row) => (
                <li key={row.market}>
                  <span className="lw-erp-ledger__date">{row.market}</span>
                  <span className="lw-erp-ledger__desc">Lane cadence</span>
                  <span className="lw-erp-ledger__amt">{row.shipmentsPerMonth} / month</span>
                </li>
              ))}
            </ul>
          ) : (
            <LwEmpty>No country cadence recorded yet.</LwEmpty>
          )}
        </LwSection>
      </div>
    )
  }

  return (
    <div className="lw-erp">
      <LwSection icon={RouteIcon} title="Trade profile">
        <p className="lw-erp-subcopy">
          Capture how this customer ships so the team can choose the right service, not just log history.
        </p>
        <LwFormStack onSubmit={submit}>
          <LwField label="Commodities">
            <TagEditor
              values={form.commodities}
              suggestions={TRADE_PROFILE_COMMODITY_SUGGESTIONS}
              placeholder="Add a commodity and press Enter"
              onChange={(commodities) => patchForm({ commodities })}
            />
          </LwField>

          <LwField label="Sales channel">
            <ChipMulti
              options={TRADE_PROFILE_SALES_CHANNELS}
              value={form.salesChannels}
              onChange={(salesChannels) => patchForm({ salesChannels })}
            />
          </LwField>

          <LwField label="Transport">
            <ChipMulti
              options={TRADE_PROFILE_TRANSPORT_MODES}
              value={form.transportModes}
              onChange={(transportModes) => patchForm({ transportModes })}
            />
          </LwField>

          <LwField label="Cargo class">
            <ChipMulti
              options={TRADE_PROFILE_CARGO_CLASSES}
              value={form.cargoClasses}
              onChange={(cargoClasses) => patchForm({ cargoClasses })}
            />
          </LwField>

          <LwField label="Typical shipment size" htmlFor="trade-size">
            <LwInput
              id="trade-size"
              value={form.typicalShipmentSize}
              placeholder="e.g. 40 kg carton, 2 CBM LCL"
              onChange={(e) => patchForm({ typicalShipmentSize: e.target.value })}
            />
          </LwField>

          <LwField label="Origin footprint">
            <ChipSingle
              options={TRADE_PROFILE_ORIGIN_FOOTPRINT}
              value={form.originFootprint}
              onChange={(originFootprint) => patchForm({ originFootprint })}
            />
          </LwField>

          <LwField label="OK with split / multi-drop deliveries?">
            <ChipSingle
              options={[
                { id: 'yes', label: 'Yes' },
                { id: 'no', label: 'No' },
              ]}
              value={form.splitDeliveries === true ? 'yes' : form.splitDeliveries === false ? 'no' : null}
              onChange={(id) =>
                patchForm({ splitDeliveries: id === 'yes' ? true : id === 'no' ? false : null })
              }
            />
          </LwField>

          <LwField label="Destination markets">
            <TagEditor
              values={form.destinationMarkets}
              suggestions={TRADE_PROFILE_MARKET_SUGGESTIONS}
              placeholder="Add a country and press Enter"
              onChange={(destinationMarkets) => patchForm({ destinationMarkets })}
            />
          </LwField>

          <LwField label="Lane cadence">
            <p className="lw-erp-subcopy">Shipments per month into each market.</p>
            <ul className="lw-profile-cadence-edit">
              {(form.laneCadence.length ? form.laneCadence : [{ market: '', shipmentsPerMonth: '' }]).map(
                (row, index) => (
                  <li key={`${row.market}-${index}`} className="lw-profile-cadence-edit__row">
                    <LwInput
                      list="trade-profile-markets"
                      value={row.market}
                      placeholder="Country"
                      onChange={(e) => {
                        const laneCadence = [...(form.laneCadence.length ? form.laneCadence : [{ market: '', shipmentsPerMonth: null }])]
                        laneCadence[index] = { ...laneCadence[index], market: e.target.value }
                        patchForm({ laneCadence })
                      }}
                    />
                    <LwInput
                      type="number"
                      min="1"
                      max="999"
                      value={row.shipmentsPerMonth ?? ''}
                      placeholder="/ month"
                      onChange={(e) => {
                        const laneCadence = [...(form.laneCadence.length ? form.laneCadence : [{ market: '', shipmentsPerMonth: null }])]
                        const n = e.target.value === '' ? null : Number(e.target.value)
                        laneCadence[index] = { ...laneCadence[index], shipmentsPerMonth: n }
                        patchForm({ laneCadence })
                      }}
                    />
                    {form.laneCadence.length > 1 ? (
                      <LwBtn
                        variant="ghost"
                        icon={TrashIcon}
                        onClick={() =>
                          patchForm({ laneCadence: form.laneCadence.filter((_, i) => i !== index) })
                        }
                      />
                    ) : null}
                  </li>
                )
              )}
            </ul>
            <datalist id="trade-profile-markets">
              {form.destinationMarkets.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <LwBtn
              variant="secondary"
              icon={PlusIcon}
              onClick={() =>
                patchForm({
                  laneCadence: [...(form.laneCadence.length ? form.laneCadence : []), { market: '', shipmentsPerMonth: null }],
                })
              }
            >
              Add market
            </LwBtn>
          </LwField>

          <div className="lw-btn-row">
            {hasSaved ? (
              <LwBtn
                variant="secondary"
                onClick={() => {
                  setForm({ ...emptyTradeProfile(), ...saved })
                  setEditing(false)
                }}
                disabled={busy}
              >
                Cancel
              </LwBtn>
            ) : null}
            <LwSubmitBtn disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</LwSubmitBtn>
          </div>
        </LwFormStack>
      </LwSection>
    </div>
  )
}
