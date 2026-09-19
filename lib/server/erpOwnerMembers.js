import { canonicalErpOwner, normalizeOwnerName, parseErpPerson } from '../erpOwner.js'

export function collectErpOwnerPeople(overlays = []) {
  const byKey = new Map()
  for (const item of overlays) {
    const person = canonicalErpOwner(item?.erp || item?.overlay) || parseErpPerson(item?.salesOwner)
    if (!person) continue
    const email = String(person.email || '')
      .trim()
      .toLowerCase()
    const key = email || `name:${normalizeOwnerName(person.name)}`
    if (!key || key === 'name:') continue
    const prev = byKey.get(key) || { name: null, email: null, phone: null }
    byKey.set(key, {
      name: person.name || prev.name,
      email: email || prev.email,
      phone: person.phone || prev.phone,
    })
  }
  return [...byKey.values()].filter((p) => p.email)
}

/**
 * ERP sales owners stay display-only on lead.erp. Do not rewrite the users JSON
 * blob during overlay — that lock stalls Team, tags, and Pipeline.
 * Owner matching uses SQL profiles of people who already have CRM accounts.
 */
export async function ensureErpOwnerMemberships(_organizationId, overlays = []) {
  const people = collectErpOwnerPeople(overlays)
  return { created: 0, linked: 0, people: people.length, skipped: true }
}
