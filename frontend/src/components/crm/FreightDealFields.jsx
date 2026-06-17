import { useState } from 'react'
import { api } from '../../lib/api'
import {
  CARGO_READINESS_OPTIONS,
  emptyFreightBox,
  emptyFreightRfq,
  emptyOriginClearance,
  emptyDestinationClearance,
  FREIGHT_CUSTOMER_TYPES,
  freightChargeableMeasure,
  freightGrossFieldLabel,
  freightRateUnitLabel,
  formatFreightMeasure,
  getFreightCustomerTypeMeta,
  INCOTERM_OPTIONS,
  isOceanTransportMode,
  showsCourierFields,
  showsSpotRfqFields,
  TRANSPORT_MODE_OPTIONS,
  VOLUMETRIC_DIVISOR_OPTIONS,
} from '../../lib/freightDeal'
import CourierContractFields, { formatCourierSummary } from './CourierContractFields'
import { CheckIcon, RouteIcon, TeamIcon } from '../ui/icons'

const FREIGHT_TYPE_OPTIONS = FREIGHT_CUSTOMER_TYPES.filter((t) => t.id !== 'mixed')

function FieldLabel({ children }) {
  return <span className="lw-field__label">{children}</span>
}

function LocationBlock({ title, side, freight, onChange, disabled }) {
  const [lookupMsg, setLookupMsg] = useState(null)
  const [lookingUp, setLookingUp] = useState(false)
  const zipKey = `${side}Zip`
  const cityKey = `${side}City`
  const stateKey = `${side}State`
  const countryKey = `${side}Country`

  const lookupZip = async () => {
    const zip = String(freight[zipKey] || '').trim()
    if (zip.length < 4 || disabled) return
    setLookingUp(true)
    setLookupMsg(null)
    try {
      const data = await api.lookupPostalCode({ pin: zip, side })
      const loc = data?.location
      if (loc) {
        onChange({
          ...freight,
          [zipKey]: loc.pincode || zip,
          [cityKey]: loc.city || freight[cityKey],
          [stateKey]: loc.state || freight[stateKey],
          [countryKey]: loc.country || freight[countryKey],
        })
        setLookupMsg('Location filled from postal code')
      }
    } catch (err) {
      setLookupMsg(err.message || 'Could not resolve postal code — enter city manually')
    } finally {
      setLookingUp(false)
    }
  }

  return (
    <fieldset className="space-y-2 border rounded-lg p-2.5 bg-white">
      <legend className="text-[10px] font-semibold uppercase text-gray-500 px-1">{title}</legend>
      <div className="grid grid-cols-2 gap-2">
        <input
          value={freight[zipKey] || ''}
          disabled={disabled}
          onChange={(e) => onChange({ ...freight, [zipKey]: e.target.value })}
          onBlur={lookupZip}
          placeholder="ZIP / pincode"
          className="w-full text-xs border rounded-lg px-2 py-1.5"
        />
        <input
          value={freight[countryKey] || ''}
          disabled={disabled}
          onChange={(e) => onChange({ ...freight, [countryKey]: e.target.value })}
          placeholder="Country"
          className="w-full text-xs border rounded-lg px-2 py-1.5"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          value={freight[cityKey] || ''}
          disabled={disabled}
          onChange={(e) => onChange({ ...freight, [cityKey]: e.target.value })}
          placeholder="City"
          className="w-full text-xs border rounded-lg px-2 py-1.5"
        />
        <input
          value={freight[stateKey] || ''}
          disabled={disabled}
          onChange={(e) => onChange({ ...freight, [stateKey]: e.target.value })}
          placeholder="State / region"
          className="w-full text-xs border rounded-lg px-2 py-1.5"
        />
      </div>
      {(lookingUp || lookupMsg) && (
        <p className={`text-[10px] ${lookupMsg?.includes('Could not') ? 'text-amber-700' : 'text-gray-500'}`}>
          {lookingUp ? 'Looking up postal code…' : lookupMsg}
        </p>
      )}
    </fieldset>
  )
}

function ClearanceBlock({ title, clearance, onChange, disabled, optional = false }) {
  const data = clearance || (optional ? emptyDestinationClearance() : emptyOriginClearance())
  const showFields = !optional || data.applicable

  const patch = (next) => onChange({ ...data, ...next })

  return (
    <fieldset className="space-y-2 border rounded-lg p-2.5 bg-white">
      <legend className="text-[10px] font-semibold uppercase text-gray-500 px-1 flex items-center gap-2">
        {title}
        {optional ? (
          <label className="inline-flex items-center gap-1.5 normal-case font-medium text-gray-600">
            <input
              type="checkbox"
              checked={Boolean(data.applicable)}
              disabled={disabled}
              onChange={(e) => patch({ applicable: e.target.checked })}
            />
            Required
          </label>
        ) : null}
      </legend>
      {showFields ? (
        <>
          <input
            value={data.broker || ''}
            disabled={disabled}
            onChange={(e) => patch({ broker: e.target.value })}
            placeholder="Broker / CHA name"
            className="w-full text-xs border rounded-lg px-2 py-1.5"
          />
          <input
            type="number"
            min={0}
            step="0.01"
            value={data.chargesInr ?? ''}
            disabled={disabled}
            onChange={(e) =>
              patch({ chargesInr: e.target.value === '' ? null : Number(e.target.value) })
            }
            placeholder="Clearance charges (₹)"
            className="w-full text-xs border rounded-lg px-2 py-1.5"
          />
          <textarea
            value={data.notes || ''}
            disabled={disabled}
            onChange={(e) => patch({ notes: e.target.value })}
            rows={2}
            placeholder="Documents, duties, special instructions…"
            className="w-full text-xs border rounded-lg px-2 py-1.5"
          />
        </>
      ) : (
        <p className="text-[10px] text-gray-500 m-0">No destination clearance for this shipment.</p>
      )}
    </fieldset>
  )
}

function FreightMeasureSummary({ freight, boxes }) {
  const ocean = isOceanTransportMode(freight.transportMode)
  const measure = freightChargeableMeasure({
    transportMode: freight.transportMode,
    grossWeightKg: freight.grossWeightKg,
    boxes,
    volumetricDivisor: freight.volumetricDivisor,
  })

  if (!measure.dimensionalValue && !measure.grossValue) return null

  const unitLabel = ocean ? 'CBM' : 'kg'
  const formula = ocean
    ? 'L × W × H (cm) ÷ 1,000,000'
    : `L × W × H (cm) ÷ ${(freight.volumetricDivisor ?? 5000).toLocaleString('en-IN')}`

  return (
    <div className="lw-freight-weights rounded-lg border border-indigo-100 bg-indigo-50/40 p-2.5 text-xs space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-indigo-900">{ocean ? 'Volume summary' : 'Weight summary'}</span>
        <span className="text-[10px] text-gray-600">Formula: {formula}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div>
          <span className="text-[10px] uppercase text-gray-500">{ocean ? 'From dimensions' : 'Volumetric'}</span>
          <div className="font-semibold">
            {measure.dimensionalValue != null ? `${measure.dimensionalValue} ${unitLabel}` : '—'}
          </div>
        </div>
        <div>
          <span className="text-[10px] uppercase text-gray-500">Gross</span>
          <div className="font-semibold">
            {measure.grossValue != null ? `${measure.grossValue} ${unitLabel}` : '—'}
          </div>
        </div>
        <div>
          <span className="text-[10px] uppercase text-gray-500">Chargeable</span>
          <div className="font-semibold text-indigo-900">
            {measure.chargeableValue != null ? `${measure.chargeableValue} ${unitLabel}` : '—'}
          </div>
        </div>
      </div>
      {ocean ? (
        <p className="text-[10px] text-gray-600 m-0">Ocean freight is quoted per CBM — enter rate as {freightRateUnitLabel('ocean')}.</p>
      ) : null}
    </div>
  )
}

function SpotRfqSection({ freight, onChange, disabled, compact, boxes, setBoxes, updateBox, addBox, removeBox }) {
  const originClearance = freight.originClearance || emptyOriginClearance()
  const destinationClearance = freight.destinationClearance || emptyDestinationClearance()
  const ocean = isOceanTransportMode(freight.transportMode)

  return (
    <div className={`space-y-2 lw-freight-fields ${compact ? '' : 'border rounded-lg p-2.5 bg-indigo-50/20 border-indigo-100'}`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <FieldLabel>Invoice (₹)</FieldLabel>
          <input
            type="number"
            min={0}
            step="0.01"
            value={freight.invoiceAmount ?? ''}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                ...freight,
                invoiceAmount: e.target.value === '' ? null : Number(e.target.value),
              })
            }
            placeholder="Declared value"
            className="lw-input w-full"
          />
        </div>
      </div>

      <textarea
        value={freight.rfqDetails || ''}
        disabled={disabled}
        onChange={(e) => onChange({ ...freight, rfqDetails: e.target.value })}
        rows={compact ? 2 : 3}
        placeholder="Additional RFQ notes — special handling, packaging, insurance…"
        className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div>
          <FieldLabel>Incoterm</FieldLabel>
          <select
            value={freight.incoterm || ''}
            disabled={disabled}
            onChange={(e) => onChange({ ...freight, incoterm: e.target.value })}
            className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white"
          >
            {INCOTERM_OPTIONS.map((o) => (
              <option key={o.id || 'none'} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>Commodity type</FieldLabel>
          <input
            value={freight.commodityType || ''}
            disabled={disabled}
            onChange={(e) => onChange({ ...freight, commodityType: e.target.value })}
            placeholder="e.g. Electronics, textiles"
            className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white"
          />
        </div>
        <div>
          <FieldLabel>HSN code</FieldLabel>
          <input
            value={freight.hsnCode || ''}
            disabled={disabled}
            onChange={(e) => onChange({ ...freight, hsnCode: e.target.value.replace(/\s+/g, '') })}
            placeholder="e.g. 8517"
            maxLength={20}
            className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white"
          />
        </div>
      </div>

      <div>
        <FieldLabel>Transport mode</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {TRANSPORT_MODE_OPTIONS.map((o) => (
            <label
              key={o.id}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer ${
                freight.transportMode === o.id
                  ? 'border-indigo-400 bg-indigo-50 text-indigo-900 font-semibold'
                  : 'border-gray-200 bg-white text-gray-700'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <input
                type="radio"
                name="transportMode"
                value={o.id}
                checked={freight.transportMode === o.id}
                disabled={disabled}
                onChange={() => onChange({ ...freight, transportMode: o.id })}
                className="sr-only"
              />
              {o.label}
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <LocationBlock title="Pickup" side="pickup" freight={freight} onChange={onChange} disabled={disabled} />
        <LocationBlock title="Delivery" side="delivery" freight={freight} onChange={onChange} disabled={disabled} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <FieldLabel>{freightGrossFieldLabel(freight.transportMode)}</FieldLabel>
          <input
            type="number"
            min={0}
            step={ocean ? 0.001 : 0.01}
            value={freight.grossWeightKg ?? ''}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                ...freight,
                grossWeightKg: e.target.value === '' ? null : Number(e.target.value),
              })
            }
            placeholder={ocean ? 'e.g. 2.5' : 'e.g. 120'}
            className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white"
          />
        </div>
        <input
          type="number"
          min={0}
          step={1}
          value={freight.boxCount ?? ''}
          disabled={disabled}
          onChange={(e) =>
            onChange({
              ...freight,
              boxCount: e.target.value === '' ? null : Number(e.target.value),
            })
          }
          placeholder="Box count"
          className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white"
        />
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <FieldLabel>Box dimensions (cm)</FieldLabel>
          <div className="flex items-center gap-2">
            {!ocean ? (
              <>
                <span className="text-[10px] text-gray-500">Divisor</span>
                <select
                  value={freight.volumetricDivisor ?? 5000}
                  disabled={disabled}
                  onChange={(e) => onChange({ ...freight, volumetricDivisor: Number(e.target.value) })}
                  className="text-[10px] border rounded-lg px-2 py-1 bg-white"
                  aria-label="Volumetric weight divisor"
                >
                  {VOLUMETRIC_DIVISOR_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
            <button
              type="button"
              disabled={disabled || boxes.length >= 20}
              onClick={addBox}
              className="text-[10px] font-semibold text-indigo-700 disabled:opacity-40"
            >
              + Add size
            </button>
          </div>
        </div>
        {boxes.map((box, index) => (
          <div key={index} className="grid grid-cols-5 gap-1.5 items-center">
            <input
              type="number"
              min={0}
              value={box.lengthCm ?? ''}
              disabled={disabled}
              onChange={(e) =>
                updateBox(index, { lengthCm: e.target.value === '' ? null : Number(e.target.value) })
              }
              placeholder="L"
              className="text-xs border rounded-lg px-1.5 py-1 bg-white"
            />
            <input
              type="number"
              min={0}
              value={box.widthCm ?? ''}
              disabled={disabled}
              onChange={(e) =>
                updateBox(index, { widthCm: e.target.value === '' ? null : Number(e.target.value) })
              }
              placeholder="W"
              className="text-xs border rounded-lg px-1.5 py-1 bg-white"
            />
            <input
              type="number"
              min={0}
              value={box.heightCm ?? ''}
              disabled={disabled}
              onChange={(e) =>
                updateBox(index, { heightCm: e.target.value === '' ? null : Number(e.target.value) })
              }
              placeholder="H"
              className="text-xs border rounded-lg px-1.5 py-1 bg-white"
            />
            <input
              type="number"
              min={1}
              value={box.quantity ?? 1}
              disabled={disabled}
              onChange={(e) => updateBox(index, { quantity: Math.max(1, Number(e.target.value) || 1) })}
              placeholder="Qty"
              className="text-xs border rounded-lg px-1.5 py-1 bg-white"
            />
            <button
              type="button"
              disabled={disabled || boxes.length <= 1}
              onClick={() => removeBox(index)}
              className="text-[10px] text-gray-500 disabled:opacity-30"
              aria-label="Remove box size"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <FreightMeasureSummary freight={freight} boxes={boxes} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <ClearanceBlock
          title="Origin clearance"
          clearance={originClearance}
          onChange={(next) => onChange({ ...freight, originClearance: next })}
          disabled={disabled}
        />
        <ClearanceBlock
          title="Destination clearance"
          clearance={destinationClearance}
          onChange={(next) => onChange({ ...freight, destinationClearance: next })}
          disabled={disabled}
          optional
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select
          value={freight.cargoReadiness || 'ready'}
          disabled={disabled}
          onChange={(e) => onChange({ ...freight, cargoReadiness: e.target.value })}
          className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white"
        >
          {CARGO_READINESS_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        {(freight.cargoReadiness === 'custom' || freight.cargoReadiness === 'not_ready') && (
          <input
            value={freight.cargoReadinessNote || ''}
            disabled={disabled}
            onChange={(e) => onChange({ ...freight, cargoReadinessNote: e.target.value })}
            placeholder="Cargo readiness notes"
            className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white"
          />
        )}
      </div>
    </div>
  )
}

/** Freight deal fields — customer type drives RFQ vs courier contract sections. */
export default function FreightDealFields({ freight, onChange, disabled = false, compact = false }) {
  const data = freight || emptyFreightRfq()
  const customerType = data.customerType || 'spot_rfq'
  const boxes = Array.isArray(data.boxes) && data.boxes.length ? data.boxes : [emptyFreightBox()]

  const setCustomerType = (nextType) => onChange({ ...data, customerType: nextType })

  const setBoxes = (next) => onChange({ ...data, boxes: next })
  const updateBox = (index, patch) => {
    const next = boxes.map((b, i) => (i === index ? { ...b, ...patch } : b))
    setBoxes(next)
  }
  const addBox = () => {
    if (boxes.length >= 20) return
    setBoxes([...boxes, emptyFreightBox()])
  }
  const removeBox = (index) => {
    if (boxes.length <= 1) return
    setBoxes(boxes.filter((_, i) => i !== index))
  }

  const setCourier = (courier) => onChange({ ...data, courier })

  return (
    <div className="space-y-3 lw-freight-fields">
      <FieldLabel>Type</FieldLabel>
      <div className="lw-freight-type">
        {FREIGHT_TYPE_OPTIONS.map((type) => {
          const active = customerType === type.id
          const Icon = type.id === 'courier' ? TeamIcon : RouteIcon
          return (
            <button
              key={type.id}
              type="button"
              disabled={disabled}
              onClick={() => setCustomerType(type.id)}
              className={`lw-freight-type__opt ${active ? 'is-active' : ''}`}
              aria-pressed={active}
            >
              <span className="lw-freight-type__icon">
                <Icon aria-hidden />
              </span>
              <span className="lw-freight-type__label">{type.label}</span>
              <span className="lw-freight-type__check">
                <CheckIcon aria-hidden />
              </span>
            </button>
          )
        })}
      </div>

      {showsCourierFields(customerType) && (
        <CourierContractFields
          courier={data.courier}
          onChange={setCourier}
          disabled={disabled}
          compact={compact}
        />
      )}

      {showsSpotRfqFields(customerType) && (
        <SpotRfqSection
          freight={data}
          onChange={onChange}
          disabled={disabled}
          compact={compact}
          boxes={boxes}
          setBoxes={setBoxes}
          updateBox={updateBox}
          addBox={addBox}
          removeBox={removeBox}
        />
      )}
    </div>
  )
}

export function formatFreightSummary(freight) {
  if (!freight) return null
  const parts = []
  const typeMeta = getFreightCustomerTypeMeta(freight.customerType)
  if (freight.customerType && freight.customerType !== 'spot_rfq') {
    parts.push(typeMeta.shortLabel)
  }
  const courierLine = formatCourierSummary(freight.courier)
  if (courierLine) parts.push(courierLine)
  if (freight.commodityType) parts.push(freight.commodityType)
  if (freight.hsnCode) parts.push(`HSN ${freight.hsnCode}`)
  if (freight.incoterm) parts.push(freight.incoterm)
  if (freight.invoiceAmount != null && freight.invoiceAmount > 0) {
    parts.push(`Invoice ₹${Number(freight.invoiceAmount).toLocaleString('en-IN')}`)
  }
  if (freight.pickupZip || freight.deliveryZip) {
    const from = [freight.pickupCity, freight.pickupZip].filter(Boolean).join(' ')
    const to = [freight.deliveryCity, freight.deliveryZip].filter(Boolean).join(' ')
    if (from || to) parts.push(`${from || '—'} → ${to || '—'}`)
  }
  if (freight.grossWeightKg != null) {
    parts.push(formatFreightMeasure(freight.grossWeightKg, freight.transportMode))
  }
  const measure = freightChargeableMeasure({
    transportMode: freight.transportMode,
    grossWeightKg: freight.grossWeightKg,
    boxes: freight.boxes,
    volumetricDivisor: freight.volumetricDivisor,
  })
  if (
    measure.chargeableValue != null &&
    measure.chargeableValue !== freight.grossWeightKg
  ) {
    parts.push(`Chargeable ${formatFreightMeasure(measure.chargeableValue, freight.transportMode)}`)
  }
  if (freight.boxCount != null) parts.push(`${freight.boxCount} boxes`)
  if (freight.originClearance?.broker) parts.push(`Origin CHA: ${freight.originClearance.broker}`)
  if (freight.destinationClearance?.applicable && freight.destinationClearance?.broker) {
    parts.push(`Dest CHA: ${freight.destinationClearance.broker}`)
  }
  const readiness = CARGO_READINESS_OPTIONS.find((o) => o.id === freight.cargoReadiness)
  if (freight.transportMode) parts.push(transportModeLabel(freight.transportMode))
  if (readiness && showsSpotRfqFields(freight.customerType || 'spot_rfq')) parts.push(readiness.label)
  return parts.length ? parts.join(' · ') : null
}

function transportModeLabel(mode) {
  const row = TRANSPORT_MODE_OPTIONS.find((o) => o.id === mode)
  return row?.label || mode || '—'
}

export function freightDealCreateLabel(customerType) {
  if (customerType === 'courier') return 'Create courier deal'
  return 'Create RFQ deal'
}
