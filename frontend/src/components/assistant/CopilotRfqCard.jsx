import { formatFreightMeasure, getFreightCustomerTypeMeta } from '../../lib/freightDeal'

function row(label, value) {
  if (value == null || value === '') return null
  return (
    <div className="ci-rfq-card__row" key={label}>
      <span className="ci-rfq-card__label">{label}</span>
      <span className="ci-rfq-card__value">{value}</span>
    </div>
  )
}

export default function CopilotRfqCard({ freight, onApply, applyLabel = 'Apply to deal RFQ', disabled }) {
  if (!freight || typeof freight !== 'object') return null

  const typeMeta = getFreightCustomerTypeMeta(freight.customerType || 'spot_rfq')
  const box = freight.boxes?.[0]
  const dims =
    box?.lengthCm || box?.widthCm || box?.heightCm
      ? `${box.lengthCm || '—'} × ${box.widthCm || '—'} × ${box.heightCm || '—'} cm`
      : null
  const origin = [freight.pickupCity, freight.pickupZip, freight.pickupCountry].filter(Boolean).join(', ')
  const dest = [freight.deliveryCity, freight.deliveryCountry].filter(Boolean).join(', ')

  return (
    <div className="ci-rfq-card">
      <p className="ci-rfq-card__title">Extracted RFQ</p>
      <div className="ci-rfq-card__grid">
        {row('Type', typeMeta.shortLabel)}
        {row('Commodity', freight.commodityType)}
        {row('HSN', freight.hsnCode)}
        {row('Mode', freight.transportMode?.replace('_', ' + '))}
        {row('Incoterm', freight.incoterm)}
        {row('Gross weight', formatFreightMeasure(freight.grossWeightKg, freight.transportMode || 'air'))}
        {row('Cartons', freight.boxCount)}
        {row('Dimensions', dims)}
        {row('Origin', origin)}
        {row('Destination', dest)}
      </div>
      {onApply ? (
        <button type="button" className="ci-rfq-card__apply" onClick={onApply} disabled={disabled}>
          {applyLabel}
        </button>
      ) : null}
    </div>
  )
}
