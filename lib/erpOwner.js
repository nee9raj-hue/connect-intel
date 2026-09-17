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

function ownerRank(user, preferUserId) {
  if (!user) return 0
  if (preferUserId && String(user.id) === String(preferUserId)) return 400
  if (user.lastLoginAt) return 300
  if (user.onboardingComplete) return 200
  if (user.source === 'erp-owner') return 10
  return 100
}

/** True when an ERP owner person is this CRM user (email, full name, or first name). */
export function erpPersonMatchesUser(person, user) {
  if (!person || !user) return false
  const email = String(person.email || '')
    .trim()
    .toLowerCase()
  const userEmail = String(user.email || '')
    .trim()
    .toLowerCase()
  if (email && userEmail && email === userEmail) return true
  const pn = normalizeOwnerName(person.name)
  const un = normalizeOwnerName(user.name)
  if (pn && un) {
    if (pn === un) return true
    if (un.startsWith(`${pn} `) || pn.startsWith(`${un} `)) return true
  }
  const pf = ownerFirstNameKey(person.name)
  const uf = ownerFirstNameKey(user.name)
  return Boolean(pf && uf && pf === uf)
}

export function buildOwnerMemberIndex(store, organizationId, { preferUserId } = {}) {
  const byEmail = new Map()
  const byName = new Map()
  const byFirstName = new Map()
  const names = { unassigned: 'Unassigned' }
  const usersById = new Map((store?.users || []).map((u) => [String(u.id), u]))
  let preferUser = preferUserId ? usersById.get(String(preferUserId)) || null : null
  for (const m of store?.organizationMemberships || []) {
    if (organizationId && m.organizationId !== organizationId) continue
    if (m.status === 'inactive') continue
    const user = usersById.get(String(m.userId))
    if (!user) continue
    const email = String(user.email || '')
      .trim()
      .toLowerCase()
    if (email) {
      const prevEmailUser = usersById.get(String(byEmail.get(email) || ''))
      if (!prevEmailUser || ownerRank(user, preferUserId) >= ownerRank(prevEmailUser, preferUserId)) {
        byEmail.set(email, user.id)
      }
    }
    const nameKey = normalizeOwnerName(user.name)
    if (nameKey) {
      const prevNameUser = usersById.get(String(byName.get(nameKey) || ''))
      if (!prevNameUser || ownerRank(user, preferUserId) >= ownerRank(prevNameUser, preferUserId)) {
        byName.set(nameKey, user.id)
      }
    }
    const first = ownerFirstNameKey(user.name)
    if (first) {
      const existing = byFirstName.get(first)
      if (!existing) byFirstName.set(first, user.id)
      else if (existing !== user.id && existing !== 'ambiguous') {
        const prev = usersById.get(String(existing))
        const a = ownerRank(prev, preferUserId)
        const b = ownerRank(user, preferUserId)
        if (b > a) byFirstName.set(first, user.id)
        else if (a > b) {
          /* keep existing */
        } else byFirstName.set(first, 'ambiguous')
      }
    }
    names[user.id] = user.name || user.email || 'Team member'
  }
  if (preferUserId && !preferUser) {
    preferUser = usersById.get(String(preferUserId)) || null
  }
  return { byEmail, byName, byFirstName, names, preferUser }
}

/** PostgREST clauses that match this CRM user as an ERP sales/account/lead owner. */
export function erpOwnerIdentityPostgrestParts(user) {
  const parts = []
  const email = String(user?.email || '')
    .trim()
    .toLowerCase()
  if (email) {
    const enc = encodeURIComponent(email)
    for (const path of [
      'entry->erp->ownership->salesOwner->>email',
      'entry->erp->ownership->accountOwner->>email',
      'entry->erp->ownership->leadOwner->>email',
    ]) {
      parts.push(`${path}.eq.${enc}`)
    }
  }
  const token = String(ownerFirstNameKey(user?.name) || (email ? email.split('@')[0] : ''))
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  if (token.length >= 3) {
    const pat = encodeURIComponent(`*${token}*`)
    for (const path of [
      'entry->erp->ownership->salesOwner->>name',
      'entry->erp->ownership->accountOwner->>name',
      'entry->erp->ownership->leadOwner->>name',
    ]) {
      parts.push(`${path}.ilike.${pat}`)
    }
  }
  return parts
}

export function matchErpOwnerUserId(person, index, { preferUserId } = {}) {
  if (!person) return null
  const preferUser =
    index?.preferUser ||
    (preferUserId && index?.names?.[preferUserId]
      ? { id: preferUserId, name: index.names[preferUserId], email: null }
      : null)
  const email = String(person.email || '')
    .trim()
    .toLowerCase()
  if (email && index?.byEmail?.has(email)) return index.byEmail.get(email)
  if (preferUser && erpPersonMatchesUser(person, preferUser)) return String(preferUser.id)
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
