import { createId, updateStorePartial } from './store.js'
import { getMembership } from './organizations.js'
import { deferMemberSqlSync } from './orgSqlSync.js'
import { canonicalErpOwner, normalizeOwnerName, parseErpPerson } from '../erpOwner.js'

const META = ['users', 'organizations', 'organizationMemberships']

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
 * Add ERP sales owners to the company roster (name + email) so they can be
 * placed on teams later. Does not send invite email.
 */
export async function ensureErpOwnerMemberships(organizationId, overlays = []) {
  const people = collectErpOwnerPeople(overlays)
  if (!organizationId || !people.length) {
    return { created: 0, linked: 0, people: 0 }
  }

  const createdIds = []
  const linkedIds = []
  const store = await updateStorePartial(META, (draft) => {
    const now = new Date().toISOString()
    for (const person of people) {
      const email = String(person.email).trim().toLowerCase()
      let user = (draft.users || []).find(
        (u) => String(u.email || '').trim().toLowerCase() === email
      )
      if (!user) {
        user = {
          id: createId('user'),
          email,
          name: person.name || email.split('@')[0],
          accountType: 'company',
          organizationId,
          onboardingComplete: false,
          source: 'erp-owner',
          createdAt: now,
        }
        draft.users.push(user)
        createdIds.push(user.id)
      } else {
        if (person.name && (!user.name || user.name === user.email)) user.name = person.name
        if (!user.organizationId) user.organizationId = organizationId
        if (!user.accountType) user.accountType = 'company'
      }
      const existing = getMembership(draft, user.id, organizationId)
      if (!existing) {
        draft.organizationMemberships.push({
          id: createId('membership'),
          userId: user.id,
          organizationId,
          role: 'member',
          pipelineRole: 'member',
          canSearch: true,
          status: 'active',
          source: 'erp-owner',
          createdAt: now,
        })
        linkedIds.push(user.id)
      }
    }
    return draft
  })

  for (const userId of new Set([...createdIds, ...linkedIds])) {
    deferMemberSqlSync(organizationId, userId, store)
  }

  return { created: createdIds.length, linked: linkedIds.length, people: people.length }
}
