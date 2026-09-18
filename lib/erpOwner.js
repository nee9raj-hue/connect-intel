/** Parse ERP sales / account / lead owners and onboarding dates. */

function isPlaceholderOwnerName(value) {
  const s = String(value || '')
    .trim()
    .toLowerCase()
  return !s || s === 'na' || s === 'n/a' || s === 'none' || s === 'null' || s === 'undefined' || s === '-'
}

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

function erpStaffIdFromPerson(raw) {
  const value = raw?.erp_staff_id ?? raw?.erpStaffId ?? raw?.user_id ?? raw?.userId ?? raw?.id
  if (value == null || value === '') return null
  const s = String(value).trim()
  return s || null
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
    if (isPlaceholderOwnerName(name) && !email) return null
    const erpStaffId = erpStaffIdFromPerson(raw)
    return { name: name || email, email: email || null, phone, ...(erpStaffId ? { erpStaffId } : {}) }
  }
  const s = String(raw).trim()
  if (!s) return null
  if (isPlaceholderOwnerName(s)) return null
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

function nameTokenCount(name) {
  return normalizeOwnerName(name)
    .split(' ')
    .filter(Boolean).length
}

/** True when an ERP owner person is this CRM user (email or full name — not first name alone). */
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
  if (!pn || !un) return false
  if (pn === un) return true
  const short = pn.length <= un.length ? pn : un
  const long = pn.length <= un.length ? un : pn
  if (nameTokenCount(short) >= 2 && long.startsWith(`${short} `)) return true
  return false
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
  const fullName = normalizeOwnerName(user?.name)
  if (fullName && nameTokenCount(fullName) >= 2) {
    const pat = encodeURIComponent(`*${fullName}*`)
    for (const path of [
      'entry->erp->ownership->salesOwner->>name',
      'entry->erp->ownership->accountOwner->>name',
      'entry->erp->ownership->leadOwner->>name',
    ]) {
      parts.push(`${path}.ilike.${pat}`)
    }
  } else {
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
  if (
    preferUser &&
    nameTokenCount(person.name) === 1 &&
    ownerFirstNameKey(person.name) &&
    ownerFirstNameKey(person.name) === ownerFirstNameKey(preferUser.name)
  ) {
    return String(preferUser.id)
  }
  const nameKey = normalizeOwnerName(person.name)
  if (nameKey && index?.byName?.has(nameKey)) {
    if (nameTokenCount(person.name) === 1) {
      const firstHit = index?.byFirstName?.get(nameKey)
      if (firstHit && firstHit !== 'ambiguous') return firstHit
    }
    return index.byName.get(nameKey)
  }
  if (nameKey && index?.byName) {
    for (const [key, id] of index.byName) {
      const short = nameKey.length <= key.length ? nameKey : key
      const long = nameKey.length <= key.length ? key : nameKey
      if (nameTokenCount(short) >= 2 && long.startsWith(`${short} `)) return id
      if (
        nameTokenCount(key) === 1 &&
        nameKey.startsWith(`${key} `) &&
        index.byFirstName?.get(key) === id
      ) {
        return id
      }
    }
  }
  if (nameTokenCount(person.name) === 1) {
    const first = ownerFirstNameKey(person.name)
    const firstHit = first && index?.byFirstName ? index.byFirstName.get(first) : null
    if (firstHit && firstHit !== 'ambiguous') return firstHit
  }
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
  const profile = entry?.tradingProfile || entry?.lead?.tradingProfile || {}
  return (
    rev.onboardedAt ||
    rev.firstShipmentAt ||
    profile.firstShipmentAt ||
    rev.customerCreatedAt ||
    null
  )
}
