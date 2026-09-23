import { useState } from 'react'
import { formatDealValue } from '../../lib/crmTimeline'
import {
  COURIER_BILLING_OPTIONS,
  COURIER_COMMODITY_OPTIONS,
  COURIER_COMPETITOR_OPTIONS,
  COURIER_DESTINATION_OPTIONS,
  COURIER_SLAB_OPTIONS,
  COURIER_TERM_OPTIONS,
  CSB_TYPE_OPTIONS,
  WEIGHT_SLAB_OPTIONS,
  courierContractProjection,
  courierDestinationLabel,
  courierCommodityLabels,
  emptyCourierProfile,
  syncCourierLanes,
} from '../../lib/freightDeal'

function FieldLabel({ children }) {
  return <p className="courier-label">{children}</p>
}

function toggleId(list, id) {
  const set = new Set(list || [])
  if (set.has(id)) set.delete(id)
  else set.add(id)
  return [...set]
}

function numOrNull(value) {
  if (value === '' || value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function formatKg(value) {
  if (value == null || value === '') return '—'
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return `${n.toLocaleString('en-IN', { maximumFractionDigits: 1 })} kg`
}

function formatCount(value) {
  if (value == null || value === '') return '—'
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function formatPct(value) {
  if (value == null || !Number.isFinite(Number(value))) return null
  const n = Math.abs(Number(value))
  return `${n.toLocaleString('en-IN', { maximumFractionDigits: 1 })}%`
}

function Pill({ active, disabled, onClick, children }) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
      className={`courier-pill ${active ? 'is-active' : ''}`}
    >
      {children}
    </button>
  )
}

function Section({ id, title, hint, open, onToggle, children }) {
  return (
    <section className={`courier-section ${open ? 'is-open' : ''}`}>
      <button type="button" className="courier-section__toggle" aria-expanded={open} onClick={() => onToggle(id)}>
        <span>
          <strong>{title}</strong>
          {hint ? <small>{hint}</small> : null}
        </span>
        <span className="courier-section__chev" aria-hidden>
          {open ? 'Hide' : 'Show'}
        </span>
      </button>
      {open ? <div className="courier-section__body">{children}</div> : null}
    </section>
  )
}

function NumberField({ label, value, onChange, placeholder, step = '0.01', disabled }) {
  return (
    <label className="courier-field">
      <FieldLabel>{label}</FieldLabel>
      <input
        type="number"
        min={0}
        step={step}
        value={value ?? ''}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(numOrNull(e.target.value))}
      />
    </label>
  )
}

/** Long-term courier contract — one capture, then won or lost on the deals list. */
export default function CourierContractFields({ courier, onChange, disabled = false }) {
  const profile = courier || emptyCourierProfile()
  const projection = courierContractProjection(profile)
  const [open, setOpen] = useState({
    customs: true,
    lanes: true,
    volume: true,
    compete: true,
  })

  const patch = (next) => onChange({ ...profile, ...next })
  const toggleSection = (id) => setOpen((current) => ({ ...current, [id]: !current[id] }))

  const setCountries = (id) => {
    const nextIds = toggleId(profile.destinationCountries, id)
    onChange(syncCourierLanes(profile, nextIds))
  }

  const updateLane = (countryId, field, value) => {
    const lanes = (profile.lanes || []).map((lane) =>
      lane.countryId === countryId ? { ...lane, [field]: value } : lane
    )
    patch({ lanes })
  }

  const gap = projection.priceGapPct
  const gapLabel =
    gap == null
      ? null
      : gap > 0
        ? `Competitive advantage: ${formatPct(gap)} cheaper`
        : gap < 0
          ? `Premium pricing (+${formatPct(gap)})`
          : 'Matched to competitor rate'

  return (
    <div className="courier-contract">
      <div className="courier-calc" aria-live="polite">
        <div>
          <span>Monthly volume</span>
          <strong>{formatKg(projection.monthlyWeightKg)}</strong>
        </div>
        <div>
          <span>Monthly shipments</span>
          <strong>{formatCount(projection.monthlyShipments)}</strong>
        </div>
        <div>
          <span>Monthly revenue</span>
          <strong>{formatDealValue(projection.monthlyRevenue)}</strong>
        </div>
        <div>
          <span>Contract value · {projection.months} mo</span>
          <strong>{formatDealValue(projection.contractValue)}</strong>
        </div>
        <div>
          <span>12-month run-rate</span>
          <strong>{formatDealValue(projection.annualRunRate)}</strong>
        </div>
      </div>
      {gapLabel ? (
        <p className={`courier-gap ${gap > 0 ? 'is-cheaper' : gap < 0 ? 'is-premium' : ''}`}>{gapLabel}</p>
      ) : null}
      {projection.marginPct != null ? (
        <p className="courier-margin">
          Gross margin {formatPct(projection.marginPct)}
          {projection.monthlyMargin != null ? ` · ${formatDealValue(projection.monthlyMargin)} / month` : ''}
        </p>
      ) : null}

      <Section
        id="customs"
        title="Customs"
        hint="CSB, commodity, drawback"
        open={open.customs}
        onToggle={toggleSection}
      >
        <FieldLabel>CSB type</FieldLabel>
        <div className="courier-pills" role="radiogroup" aria-label="CSB type">
          {CSB_TYPE_OPTIONS.map((opt) => (
            <Pill
              key={opt.id}
              active={profile.csbType === opt.id}
              disabled={disabled}
              onClick={() => patch({ csbType: profile.csbType === opt.id ? '' : opt.id })}
            >
              {opt.label}
              <em>{opt.hint}</em>
            </Pill>
          ))}
        </div>
        <FieldLabel>Commodity</FieldLabel>
        <div className="courier-pills">
          {COURIER_COMMODITY_OPTIONS.map((opt) => (
            <Pill
              key={opt.id}
              active={(profile.commodities || []).includes(opt.id)}
              disabled={disabled}
              onClick={() => patch({ commodities: toggleId(profile.commodities, opt.id) })}
            >
              {opt.label}
            </Pill>
          ))}
        </div>
        {(profile.commodities || []).includes('other') ? (
          <label className="courier-field">
            <FieldLabel>Other commodity</FieldLabel>
            <input
              value={profile.commodityOther || ''}
              disabled={disabled}
              placeholder="Type the commodity"
              onChange={(e) => patch({ commodityOther: e.target.value })}
            />
          </label>
        ) : null}
        <FieldLabel>AD code / GST drawback</FieldLabel>
        <div className="courier-pills" role="radiogroup" aria-label="AD code required">
          <Pill active={profile.adCodeRequired === true} disabled={disabled} onClick={() => patch({ adCodeRequired: true })}>
            Yes
          </Pill>
          <Pill active={profile.adCodeRequired !== true} disabled={disabled} onClick={() => patch({ adCodeRequired: false })}>
            No
          </Pill>
        </div>
      </Section>

      <Section
        id="lanes"
        title="Lanes and weight"
        hint="Where the volume goes"
        open={open.lanes}
        onToggle={toggleSection}
      >
        <FieldLabel>Destination countries</FieldLabel>
        <div className="courier-pills">
          {COURIER_DESTINATION_OPTIONS.map((opt) => (
            <Pill
              key={opt.id}
              active={(profile.destinationCountries || []).includes(opt.id)}
              disabled={disabled}
              onClick={() => setCountries(opt.id)}
            >
              {opt.label}
            </Pill>
          ))}
        </div>
        <FieldLabel>Weight slabs</FieldLabel>
        <div className="courier-pills">
          {COURIER_SLAB_OPTIONS.map((opt) => (
            <Pill
              key={opt.id}
              active={(profile.weightSlabs || []).includes(opt.id)}
              disabled={disabled}
              onClick={() => patch({ weightSlabs: toggleId(profile.weightSlabs, opt.id) })}
            >
              {opt.label}
              <em>{opt.hint}</em>
            </Pill>
          ))}
        </div>
        <NumberField
          label="Average package weight (kg)"
          value={profile.avgShipmentWeightKg}
          disabled={disabled}
          placeholder="e.g. 2.5"
          onChange={(avgShipmentWeightKg) => patch({ avgShipmentWeightKg })}
        />
      </Section>

      <Section
        id="volume"
        title="Country volume"
        hint="One row per destination"
        open={open.volume}
        onToggle={toggleSection}
      >
        {(profile.destinationCountries || []).length === 0 ? (
          <p className="courier-empty">Select destination countries to enter monthly volume and the target rate.</p>
        ) : (
          <div className="courier-lanes-wrap">
            <table className="courier-lanes">
              <thead>
                <tr>
                  <th>Country</th>
                  <th>Monthly shipments</th>
                  <th>Monthly kg</th>
                  <th>Target ₹/kg</th>
                </tr>
              </thead>
              <tbody>
                {(profile.destinationCountries || []).map((countryId) => {
                  const lane = (profile.lanes || []).find((row) => row.countryId === countryId) || {
                    countryId,
                    monthlyShipments: null,
                    monthlyWeightKg: null,
                    targetRatePerKg: null,
                  }
                  return (
                  <tr key={lane.countryId}>
                    <td>{courierDestinationLabel(lane.countryId)}</td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        disabled={disabled}
                        value={lane.monthlyShipments ?? ''}
                        aria-label={`${courierDestinationLabel(lane.countryId)} monthly shipments`}
                        onChange={(e) => updateLane(lane.countryId, 'monthlyShipments', numOrNull(e.target.value))}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        disabled={disabled}
                        value={lane.monthlyWeightKg ?? ''}
                        aria-label={`${courierDestinationLabel(lane.countryId)} monthly kg`}
                        onChange={(e) => updateLane(lane.countryId, 'monthlyWeightKg', numOrNull(e.target.value))}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        disabled={disabled}
                        value={lane.targetRatePerKg ?? ''}
                        aria-label={`${courierDestinationLabel(lane.countryId)} target rate`}
                        onChange={(e) => updateLane(lane.countryId, 'targetRatePerKg', numOrNull(e.target.value))}
                      />
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        id="compete"
        title="Competitor and term"
        hint="Rate gap, length, billing"
        open={open.compete}
        onToggle={toggleSection}
      >
        <FieldLabel>Incumbent</FieldLabel>
        <div className="courier-pills">
          {COURIER_COMPETITOR_OPTIONS.map((opt) => (
            <Pill
              key={opt.id}
              active={(profile.competitors || []).includes(opt.id)}
              disabled={disabled}
              onClick={() => patch({ competitors: toggleId(profile.competitors, opt.id) })}
            >
              {opt.label}
            </Pill>
          ))}
        </div>
        {(profile.competitors || []).includes('other') ? (
          <label className="courier-field">
            <FieldLabel>Other competitor</FieldLabel>
            <input
              value={profile.competitorOther || ''}
              disabled={disabled}
              placeholder="Name"
              onChange={(e) => patch({ competitorOther: e.target.value })}
            />
          </label>
        ) : null}
        <div className="courier-grid">
          <NumberField
            label="Competitor rate (₹/kg)"
            value={profile.competitorRatePerKg}
            disabled={disabled}
            placeholder="e.g. 450"
            onChange={(competitorRatePerKg) => patch({ competitorRatePerKg })}
          />
          <NumberField
            label="Our contract rate (₹/kg)"
            value={profile.proposedRatePerKg}
            disabled={disabled}
            placeholder="e.g. 420"
            onChange={(proposedRatePerKg) => patch({ proposedRatePerKg })}
          />
          <NumberField
            label="Our cost (₹/kg)"
            value={profile.costRatePerKg}
            disabled={disabled}
            placeholder="For margin"
            onChange={(costRatePerKg) => patch({ costRatePerKg })}
          />
        </div>
        <div className="courier-grid">
          <label className="courier-field">
            <FieldLabel>Contract term</FieldLabel>
            <select
              value={profile.contractTerm || '12'}
              disabled={disabled}
              onChange={(e) => patch({ contractTerm: e.target.value })}
            >
              {COURIER_TERM_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="courier-field">
            <FieldLabel>Billing cycle</FieldLabel>
            <select
              value={profile.billingCycle || 'monthly'}
              disabled={disabled}
              onChange={(e) => patch({ billingCycle: e.target.value })}
            >
              {COURIER_BILLING_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="courier-field">
          <FieldLabel>Notes</FieldLabel>
          <textarea
            value={profile.contractNotes || ''}
            disabled={disabled}
            rows={2}
            placeholder="SLA, pickup days, or rate-card notes"
            onChange={(e) => patch({ contractNotes: e.target.value })}
          />
        </label>
      </Section>
    </div>
  )
}

export function formatCourierSummary(courier) {
  if (!courier) return null
  const projection = courierContractProjection(courier)
  const parts = []
  const countries = (courier.destinationCountries || []).map(courierDestinationLabel).filter(Boolean)
  if (countries.length) parts.push(countries.join(', '))
  if (projection.monthlyWeightKg != null) parts.push(`${projection.monthlyWeightKg} kg/mo`)
  if (projection.monthlyRevenue != null) parts.push(`${formatDealValue(projection.monthlyRevenue)}/mo`)
  if (projection.contractValue != null) parts.push(`${formatDealValue(projection.contractValue)} contract`)
  const commodities = courierCommodityLabels(courier)
  if (commodities.length) parts.push(commodities.join(', '))
  const slabs = (courier.weightSlabs || [])
    .map((id) => COURIER_SLAB_OPTIONS.find((o) => o.id === id)?.label)
    .filter(Boolean)
  if (slabs.length) parts.push(slabs.join(', '))
  else {
    const slab = WEIGHT_SLAB_OPTIONS.find((o) => o.id === courier.weightSlab)
    if (slab?.id) parts.push(slab.id === 'custom' ? courier.weightSlabNote || 'Custom slab' : slab.label)
  }
  return parts.length ? parts.join(' · ') : null
}

export function courierCompetitorLabel(courier) {
  const names = (courier?.competitors || [])
    .map((id) => {
      if (id === 'other' && courier.competitorOther) return courier.competitorOther
      return COURIER_COMPETITOR_OPTIONS.find((o) => o.id === id)?.label || id
    })
    .filter(Boolean)
  return names.join(', ')
}
