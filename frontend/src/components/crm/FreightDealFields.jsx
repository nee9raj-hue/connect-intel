import { useState } from 'react'
import { api } from '../../lib/api'
import { CARGO_READINESS_OPTIONS, emptyFreightBox, TRANSPORT_MODE_OPTIONS } from '../../lib/freightDeal'

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

/** Freight RFQ fields for shipping deals (Xindus). */
export default function FreightDealFields({ freight, onChange, disabled = false, compact = false }) {
  const boxes = Array.isArray(freight?.boxes) && freight.boxes.length ? freight.boxes : [emptyFreightBox()]

  const setBoxes = (next) => onChange({ ...freight, boxes: next })

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

  return (
    <div className={`space-y-2 ${compact ? '' : 'border rounded-lg p-2.5 bg-indigo-50/40 border-indigo-100'}`}>
      {!compact && (
        <p className="text-[10px] font-semibold uppercase text-indigo-700">Freight RFQ</p>
      )}
      <textarea
        value={freight.rfqDetails || ''}
        disabled={disabled}
        onChange={(e) => onChange({ ...freight, rfqDetails: e.target.value })}
        rows={compact ? 2 : 3}
        placeholder="RFQ details — commodity, incoterms, special handling…"
        className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white"
      />
      <div>
        <p className="text-[10px] font-semibold uppercase text-gray-500 mb-1">Transport mode</p>
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
        <input
          type="number"
          min={0}
          step="0.01"
          value={freight.grossWeightKg ?? ''}
          disabled={disabled}
          onChange={(e) =>
            onChange({
              ...freight,
              grossWeightKg: e.target.value === '' ? null : Number(e.target.value),
            })
          }
          placeholder="Gross weight (kg)"
          className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white"
        />
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
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase text-gray-500">Box dimensions (cm)</p>
          <button
            type="button"
            disabled={disabled || boxes.length >= 20}
            onClick={addBox}
            className="text-[10px] font-semibold text-indigo-700 disabled:opacity-40"
          >
            + Add size
          </button>
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

export function formatFreightSummary(freight) {
  if (!freight) return null
  const parts = []
  if (freight.pickupZip || freight.deliveryZip) {
    const from = [freight.pickupCity, freight.pickupZip].filter(Boolean).join(' ')
    const to = [freight.deliveryCity, freight.deliveryZip].filter(Boolean).join(' ')
    if (from || to) parts.push(`${from || '—'} → ${to || '—'}`)
  }
  if (freight.grossWeightKg != null) parts.push(`${freight.grossWeightKg} kg`)
  if (freight.boxCount != null) parts.push(`${freight.boxCount} boxes`)
  const readiness = CARGO_READINESS_OPTIONS.find((o) => o.id === freight.cargoReadiness)
  if (freight.transportMode) parts.push(transportModeLabel(freight.transportMode))
  if (readiness) parts.push(readiness.label)
  return parts.length ? parts.join(' · ') : null
}

function transportModeLabel(mode) {
  const row = TRANSPORT_MODE_OPTIONS.find((o) => o.id === mode)
  return row?.label || mode || '—'
}
