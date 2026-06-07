/** Freight / shipping RFQ fields on CRM deals (Xindus and opt-in orgs). */

export const CARGO_READINESS_OPTIONS = [
  { id: 'ready', label: 'Ready to ship' },
  { id: 'within_7_days', label: 'Ready within 7 days' },
  { id: 'within_30_days', label: 'Ready within 30 days' },
  { id: 'not_ready', label: 'Not ready yet' },
  { id: 'custom', label: 'Other (see notes)' },
]

export const TRANSPORT_MODE_OPTIONS = [
  { id: 'air', label: 'Air' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'air_ocean', label: 'Air + Ocean' },
]

export function emptyFreightRfq() {
  return {
    rfqDetails: '',
    transportMode: '',
    pickupZip: '',
    pickupCity: '',
    pickupState: '',
    pickupCountry: 'India',
    deliveryZip: '',
    deliveryCity: '',
    deliveryState: '',
    deliveryCountry: '',
    grossWeightKg: null,
    boxCount: null,
    boxes: [{ lengthCm: null, widthCm: null, heightCm: null, quantity: 1 }],
    cargoReadiness: 'ready',
    cargoReadinessNote: '',
  }
}

export function emptyFreightBox() {
  return { lengthCm: null, widthCm: null, heightCm: null, quantity: 1 }
}

/** Whether this org/user gets freight RFQ fields on deals (others use standard deals). */
export function isFreightDealOrg(orgOrUser, user = null) {
  const u = user || orgOrUser
  const org =
    orgOrUser &&
    typeof orgOrUser === 'object' &&
    (orgOrUser.workspacePreset != null || orgOrUser.workspaceFeatures != null) &&
    !orgOrUser.email
      ? orgOrUser
      : null

  if (u?.workspaceFeatures?.freightDealRfq === true) return true
  if (u?.workspaceFeatures?.freightDealRfq === false) return false
  if (org?.workspaceFeatures?.freightDealRfq === true) return true
  if (org?.workspaceFeatures?.freightDealRfq === false) return false

  const name = String(org?.name || u?.organizationName || '').toLowerCase()
  if (name.includes('xindus')) return true
  const email = String(u?.email || '').toLowerCase()
  if (email.endsWith('@xindus.net')) return true
  return false
}
