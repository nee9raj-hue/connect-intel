/** Parse ERP sales / account / lead owners and onboarding dates. */

function text(value) {
  const s = String(value ?? '').trim()
  return s || null
}

export function normalizeOwnerName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export function parseErpPerson(raw) {
  if (raw == null || raw === '') return null
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const email = String(raw.email || raw.Email || '')
      .trim()
      .toLowerCase()
    const name = text(raw.name || raw.Name || raw.fullName)
    const phone = text(raw.phone || raw.Phone)
    if (!email && !name) return null
    return { name: name || email, email: email || null, phone }
  }
  const s = String(raw).trim()
  if (!s) return null
  if (s.startsWith('{') || s.startsWith('[')) {
    try {
      return parseErpPerson(JSON.parse(s))
    } catch {
      /* fall through */
    }
  }
  const angled = s.match(/^(.*?)\s*<([^>]+@[^>]+)>/)
  if (angled) {
    const email = angled[2].trim().toLowerCase()
    const name = text(angled[1]) || email
    return { name, email, phone: null }
  }
  if (s.includes('@') && !s.includes(' ')) {
    const email = s.toLowerCase()
    return { name: email.split('@')[0], email, phone: null }
  }
  return { name: s, email: null, phone: null }
}

export function emptyErpOwnership() {
  return {
    salesOwner: null,
    accountOwner: null,
    leadOwner: null,
  }
}

export function normalizeErpPerson(raw) {
  return parseErpPerson(raw)
}

export function normalizeErpOwnership(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  return {
    salesOwner: normalizeErpPerson(src.salesOwner),
    accountOwner: normalizeErpPerson(src.accountOwner),
    leadOwner: normalizeErpPerson(src.leadOwner),
  }
}

export function mergeErpOwnership(prev, next) {
  const a = normalizeErpOwnership(prev)
  const b = normalizeErpOwnership(next)
  return {
    salesOwner: b.salesOwner || a.salesOwner,
    accountOwner: b.accountOwner || a.accountOwner,
    leadOwner: b.leadOwner || a.leadOwner,
  }
}

/** Prefer Sales owner, then Account owner, then Lead owner. */
export function canonicalErpOwner(ownershipOrErp) {
  const o =
    ownershipOrErp?.ownership ||
    (ownershipOrErp?.salesOwner || ownershipOrErp?.accountOwner || ownershipOrErp?.leadOwner
      ? ownershipOrErp
      : null) ||
    {}
  return o.salesOwner || o.accountOwner || o.leadOwner || null
}

export function ownerFirstNameKey(name) {
  const full = normalizeOwnerName(name)
  if (!full) return ''
  return full.split(' ')[0] || ''
}

export function buildOwnerMemberIndex(store, organizationId) {
  const byEmail = new Map()
  const byName = new Map()
  const byFirstName = new Map()
  const names = { unassigned: 'Unassigned' }
  for (const m of store?.organizationMemberships || []) {
    if (organizationId && m.organizationId !== organizationId) continue
    if (m.status === 'inactive') continue
    const user = (store.users || []).find((u) => u.id === m.userId)
    if (!user) continue
    const email = String(user.email || '')
      .trim()
      .toLowerCase()
    if (email) byEmail.set(email, user.id)
    const nameKey = normalizeOwnerName(user.name)
    if (nameKey && !byName.has(nameKey)) byName.set(nameKey, user.id)
    const first = ownerFirstNameKey(user.name)
    if (first) {
      if (!byFirstName.has(first)) byFirstName.set(first, user.id)
      else if (byFirstName.get(first) !== user.id) byFirstName.set(first, 'ambiguous')
    }
    names[user.id] = user.name || user.email || 'Team member'
  }
  return { byEmail, byName, byFirstName, names }
}

export function matchErpOwnerUserId(person, index) {
  if (!person) return null
  const email = String(person.email || '')
    .trim()
    .toLowerCase()
  if (email && index?.byEmail?.has(email)) return index.byEmail.get(email)
  const nameKey = normalizeOwnerName(person.name)
  if (nameKey && index?.byName?.has(nameKey)) return index.byName.get(nameKey)
  const first = ownerFirstNameKey(person.name)
  const firstHit = first && index?.byFirstName ? index.byFirstName.get(first) : null
  if (firstHit && firstHit !== 'ambiguous') return firstHit
  return null
}

/**
 * Dashboard / retention owner: ERP person mapped to CRM, else Unassigned.
 * Does not fall back to importer / saved-by.
 */
export function dashboardSalesOwnerId(entry, index) {
  const erp = entry?.erp || entry?.lead?.erp
  const person = canonicalErpOwner(erp)
  if (!person) return 'unassigned'
  const mapped = matchErpOwnerUserId(person, index)
  if (mapped) return mapped
  if (person.email) return `erp:${person.email}`
  if (person.name) return `erp-name:${normalizeOwnerName(person.name)}`
  return 'unassigned'
}

export function dashboardSalesOwnerLabel(ownerId, person, names = {}) {
  if (!ownerId || ownerId === 'unassigned') return 'Unassigned'
  if (names[ownerId]) return names[ownerId]
  if (person?.name) return person.name
  if (person?.email) return person.email
  if (String(ownerId).startsWith('erp:')) return String(ownerId).slice(4)
  if (String(ownerId).startsWith('erp-name:')) return String(ownerId).slice(9)
  return 'Unassigned'
}

export function erpOnboardedAtIso(entry) {
  const erp = entry?.erp || entry?.lead?.erp || {}
  const rev = erp.revenue || {}
  return (
    rev.onboardedAt ||
    rev.firstShipmentAt ||
    rev.customerCreatedAt ||
    null
  )
}
