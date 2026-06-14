import {
  COURIER_DESTINATION_OPTIONS,
  emptyCourierProfile,
  WEIGHT_SLAB_OPTIONS,
} from '../../lib/freightDeal'

function FieldLabel({ children }) {
  return <p className="text-[10px] font-semibold uppercase text-gray-500 mb-1">{children}</p>
}

function toggleCountry(countries, id) {
  const set = new Set(countries || [])
  if (set.has(id)) set.delete(id)
  else set.add(id)
  return [...set]
}

/** Long-term courier contract profile — volume, lanes, and target rates. */
export default function CourierContractFields({ courier, onChange, disabled = false, compact = false }) {
  const profile = courier || emptyCourierProfile()

  const patch = (next) => onChange({ ...profile, ...next })

  return (
    <div className={`space-y-3 lw-freight-fields ${compact ? '' : 'border rounded-lg p-2.5 bg-teal-50/30 border-teal-100'}`}>
      <div>
        <FieldLabel>Destination countries</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {COURIER_DESTINATION_OPTIONS.map((o) => {
            const active = (profile.destinationCountries || []).includes(o.id)
            return (
              <button
                key={o.id}
                type="button"
                disabled={disabled}
                onClick={() => patch({ destinationCountries: toggleCountry(profile.destinationCountries, o.id) })}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors ${
                  active
                    ? 'border-teal-500 bg-teal-100 text-teal-900'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-teal-200'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div>
          <FieldLabel>Weekly shipments</FieldLabel>
          <input
            type="number"
            min={0}
            step={1}
            value={profile.weeklyShipments ?? ''}
            disabled={disabled}
            onChange={(e) =>
              patch({ weeklyShipments: e.target.value === '' ? null : Number(e.target.value) })
            }
            placeholder="e.g. 120"
            className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white"
          />
        </div>
        <div>
          <FieldLabel>Weekly weight (kg)</FieldLabel>
          <input
            type="number"
            min={0}
            step="0.01"
            value={profile.weeklyWeightKg ?? ''}
            disabled={disabled}
            onChange={(e) =>
              patch({ weeklyWeightKg: e.target.value === '' ? null : Number(e.target.value) })
            }
            placeholder="Total kg / week"
            className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white"
          />
        </div>
        <div>
          <FieldLabel>Avg shipment (kg)</FieldLabel>
          <input
            type="number"
            min={0}
            step="0.01"
            value={profile.avgShipmentWeightKg ?? ''}
            disabled={disabled}
            onChange={(e) =>
              patch({ avgShipmentWeightKg: e.target.value === '' ? null : Number(e.target.value) })
            }
            placeholder="Per parcel"
            className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white"
          />
        </div>
        <div>
          <FieldLabel>Target rate (₹/kg)</FieldLabel>
          <input
            type="number"
            min={0}
            step="0.01"
            value={profile.targetRatePerKg ?? ''}
            disabled={disabled}
            onChange={(e) =>
              patch({ targetRatePerKg: e.target.value === '' ? null : Number(e.target.value) })
            }
            placeholder="Target slab rate"
            className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <FieldLabel>Weight slab</FieldLabel>
          <select
            value={profile.weightSlab || ''}
            disabled={disabled}
            onChange={(e) => patch({ weightSlab: e.target.value })}
            className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white"
          >
            {WEIGHT_SLAB_OPTIONS.map((o) => (
              <option key={o.id || 'none'} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {profile.weightSlab === 'custom' && (
          <div>
            <FieldLabel>Custom slab</FieldLabel>
            <input
              value={profile.weightSlabNote || ''}
              disabled={disabled}
              onChange={(e) => patch({ weightSlabNote: e.target.value })}
              placeholder="e.g. 0.5 – 3 kg per piece"
              className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white"
            />
          </div>
        )}
      </div>

      <textarea
        value={profile.contractNotes || ''}
        disabled={disabled}
        onChange={(e) => patch({ contractNotes: e.target.value })}
        rows={compact ? 2 : 3}
        placeholder="Contract terms, SLA, billing cycle, or rate-card notes…"
        className="w-full text-xs border rounded-lg px-2 py-1.5 bg-white"
      />
    </div>
  )
}

export function formatCourierSummary(courier) {
  if (!courier) return null
  const parts = []
  const countries = (courier.destinationCountries || [])
    .map((id) => COURIER_DESTINATION_OPTIONS.find((o) => o.id === id)?.label || id)
    .filter(Boolean)
  if (countries.length) parts.push(countries.join(', '))
  if (courier.weeklyShipments != null) parts.push(`${courier.weeklyShipments}/wk`)
  if (courier.weeklyWeightKg != null) parts.push(`${courier.weeklyWeightKg} kg/wk`)
  if (courier.avgShipmentWeightKg != null) parts.push(`avg ${courier.avgShipmentWeightKg} kg`)
  if (courier.targetRatePerKg != null) parts.push(`₹${courier.targetRatePerKg}/kg target`)
  const slab = WEIGHT_SLAB_OPTIONS.find((o) => o.id === courier.weightSlab)
  if (slab?.id) parts.push(slab.id === 'custom' ? courier.weightSlabNote || 'Custom slab' : slab.label)
  return parts.length ? parts.join(' · ') : null
}
