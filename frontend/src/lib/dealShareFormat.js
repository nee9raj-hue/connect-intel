import { getDealStageMeta } from './crmConstants'
import { formatDealValue } from './crmTimeline'
import {
  CARGO_READINESS_OPTIONS,
  COURIER_DESTINATION_OPTIONS,
  getFreightCustomerTypeMeta,
  showsCourierFields,
  showsSpotRfqFields,
  TRANSPORT_MODE_OPTIONS,
  WEIGHT_SLAB_OPTIONS,
} from './freightDeal'

function line(label, value) {
  if (value == null || value === '' || value === '—') return null
  return `${label}: ${value}`
}

function section(title, rows) {
  const items = rows.filter(Boolean)
  if (!items.length) return ''
  return `${title}\n${items.map((r) => `  • ${r}`).join('\n')}`
}

function formatLocation(freight, side) {
  if (!freight) return null
  const parts = [
    freight[`${side}City`],
    freight[`${side}State`],
    freight[`${side}Zip`],
    freight[`${side}Country`],
  ].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

function transportLabel(mode) {
  return TRANSPORT_MODE_OPTIONS.find((o) => o.id === mode)?.label || mode || null
}

function formatBoxes(boxes) {
  if (!Array.isArray(boxes)) return null
  const rows = boxes
    .filter((b) => b?.lengthCm || b?.widthCm || b?.heightCm)
    .map((b) => {
      const dim = [b.lengthCm, b.widthCm, b.heightCm].filter((n) => n != null).join(' × ')
      const qty = b.quantity > 1 ? ` (×${b.quantity})` : ''
      return `${dim} cm${qty}`
    })
  return rows.length ? rows.join('; ') : null
}

function formatCourierBlock(courier) {
  if (!courier) return ''
  const rows = []
  const countries = (courier.destinationCountries || [])
    .map((id) => COURIER_DESTINATION_OPTIONS.find((o) => o.id === id)?.label || id)
    .filter(Boolean)
  if (countries.length) rows.push(line('Destinations', countries.join(', ')))
  if (courier.weeklyShipments != null) rows.push(line('Weekly shipments', courier.weeklyShipments))
  if (courier.weeklyWeightKg != null) rows.push(line('Weekly weight', `${courier.weeklyWeightKg} kg`))
  if (courier.avgShipmentWeightKg != null) {
    rows.push(line('Avg shipment weight', `${courier.avgShipmentWeightKg} kg`))
  }
  if (courier.targetRatePerKg != null) {
    rows.push(line('Target rate', `₹${courier.targetRatePerKg}/kg`))
  }
  const slab = WEIGHT_SLAB_OPTIONS.find((o) => o.id === courier.weightSlab)
  if (slab?.id) {
    rows.push(
      line('Weight slab', slab.id === 'custom' ? courier.weightSlabNote || 'Custom' : slab.label)
    )
  }
  if (courier.contractNotes?.trim()) rows.push(line('Contract notes', courier.contractNotes.trim()))
  return section('COURIER CONTRACT', rows)
}

function formatSpotRfqBlock(freight) {
  if (!freight) return ''
  const rows = []
  const t = transportLabel(freight.transportMode)
  if (t) rows.push(line('Transport', t))
  if (freight.incoterm) rows.push(line('Incoterm', freight.incoterm))
  if (freight.commodityType) rows.push(line('Commodity', freight.commodityType))
  if (freight.hsnCode) rows.push(line('HSN code', freight.hsnCode))
  const pickup = formatLocation(freight, 'pickup')
  const delivery = formatLocation(freight, 'delivery')
  if (pickup) rows.push(line('Pickup', pickup))
  if (delivery) rows.push(line('Delivery', delivery))
  if (freight.grossWeightKg != null) rows.push(line('Gross weight', `${freight.grossWeightKg} kg`))
  if (freight.boxCount != null) rows.push(line('Box count', freight.boxCount))
  const boxDims = formatBoxes(freight.boxes)
  if (boxDims) rows.push(line('Box dimensions', boxDims))
  const readiness = CARGO_READINESS_OPTIONS.find((o) => o.id === freight.cargoReadiness)
  if (readiness) rows.push(line('Cargo readiness', readiness.label))
  if (freight.cargoReadinessNote?.trim()) {
    rows.push(line('Readiness notes', freight.cargoReadinessNote.trim()))
  }
  if (freight.rfqDetails?.trim()) rows.push(line('RFQ notes', freight.rfqDetails.trim()))
  return section('SPOT CARGO RFQ', rows)
}

function contactName(lead) {
  return [lead?.firstName, lead?.lastName].filter(Boolean).join(' ') || lead?.name || 'Contact'
}

/** Plain-text deal summary for copy, email body, and WhatsApp. */
export function formatDealSharePlainText({ deal, lead, user, freightOrg = false }) {
  const stageMeta = getDealStageMeta(deal.stage, { freightOrg })
  const freight = deal.freight
  const currency = deal.currency || 'INR'
  const header = freightOrg ? 'FREIGHT DEAL' : 'DEAL SUMMARY'
  const divider = '─'.repeat(40)

  const metaRows = [
    line('Contact', contactName(lead)),
    lead?.company ? line('Company', lead.company) : null,
    line('Stage', stageMeta.label),
  ]

  if (freightOrg && freight?.customerType) {
    metaRows.push(line('Opportunity type', getFreightCustomerTypeMeta(freight.customerType).label))
  }

  const commercial = []
  if (deal.amount != null && deal.amount > 0) {
    commercial.push(
      line(freightOrg ? 'Freight charges' : 'Deal value', formatDealValue(deal.amount, currency))
    )
  }
  if (freightOrg && freight?.invoiceAmount != null && freight.invoiceAmount > 0) {
    commercial.push(line('Invoice amount', formatDealValue(freight.invoiceAmount, currency)))
  }
  if (deal.expectedCloseDate) {
    commercial.push(
      line('Expected close', new Date(deal.expectedCloseDate).toLocaleDateString('en-IN'))
    )
  }

  const blocks = [
    `${header} — ${deal.name}`,
    divider,
    '',
    section('OVERVIEW', metaRows),
    commercial.length ? section('COMMERCIAL', commercial) : '',
  ]

  if (freightOrg && freight) {
    if (showsCourierFields(freight.customerType)) blocks.push(formatCourierBlock(freight.courier))
    if (showsSpotRfqFields(freight.customerType)) blocks.push(formatSpotRfqBlock(freight))
  }

  if (deal.notes?.trim()) {
    blocks.push(section('NOTES', [deal.notes.trim()]))
  }

  const sender = [user?.name, user?.organizationName].filter(Boolean).join(' · ')
  blocks.push('', divider, sender ? `Shared by ${sender}` : 'Shared from Connect Intel')

  return blocks.filter((b) => b != null && b !== '').join('\n')
}

export function formatDealShareSubject(deal, freightOrg = false) {
  const prefix = freightOrg ? 'Freight deal' : 'Deal'
  return `${prefix}: ${deal.name}`
}

export function formatDealShareContent(ctx) {
  return {
    subject: formatDealShareSubject(ctx.deal, ctx.freightOrg),
    plainText: formatDealSharePlainText(ctx),
  }
}
