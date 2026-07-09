/**
 * Master contact dedup — find duplicate groups and merge into one contact.
 */

import { normalizePhoneDigits } from './phoneUtils.js'
import { normalizeLinkedinKey, normalizeCompanyKey } from './pipelineLeadDedup.js'
import { inferLeadCompanyDomain } from './companyDomain.js'
import {
  listContactsForUser,
  shapeContactRecord,
  userCanAccessContact,
  updateMasterContactById,
} from './pipelineContact.js'
import { listPipelineSavedEntries } from './organizations.js'

function contactIdentityKeys(contact, company) {
  const keys = []
  const email = String(contact.email || '').trim().toLowerCase()
  if (email) keys.push(`email:${email}`)

  const phone = normalizePhoneDigits(contact.phone)
  if (phone) keys.push(`phone:${phone}`)

  const linkedin = normalizeLinkedinKey(contact.linkedinUrl || contact.linkedin)
  if (linkedin) keys.push(`linkedin:${linkedin}`)

  const first = String(contact.firstName || '').trim().toLowerCase()
  const last = String(contact.lastName || '').trim().toLowerCase()
  const companyKey = normalizeCompanyKey(company?.name || contact.company || '')
  const domain = inferLeadCompanyDomain({
    company: company?.name || contact.company,
    companyDomain: company?.domain || contact.companyDomain,
    email: contact.email,
  })
  if (first && last && (companyKey || domain)) {
    keys.push(`name:${first}|${last}|${companyKey || domain}`)
  }

  return keys
}

/** Union-find duplicate groups for visible contacts. */
export function findDuplicateContactGroups(store, user, { limit = 20 } = {}) {
  const { contacts } = listContactsForUser(store, user, { limit: 5000, offset: 0 })
  const companyById = new Map(store.companies.map((c) => [c.id, c]))
  const parent = new Map()

  function find(id) {
    if (!parent.has(id)) parent.set(id, id)
    if (parent.get(id) !== id) parent.set(id, find(parent.get(id)))
    return parent.get(id)
  }

  function union(a, b) {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(rb, ra)
  }

  const keyToContact = new Map()
  for (const row of contacts) {
    const company = companyById.get(row.companyId) || {
      name: row.company,
      domain: row.companyDomain,
    }
    for (const key of contactIdentityKeys(row, company)) {
      if (keyToContact.has(key)) union(row.id, keyToContact.get(key))
      else keyToContact.set(key, row.id)
    }
  }

  const groups = new Map()
  for (const row of contacts) {
    const root = find(row.id)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root).push(row)
  }

  return [...groups.values()]
    .filter((g) => g.length > 1)
    .map((group) => {
      const shaped = group.map((c) => shapeContactRecord(c, companyById.get(c.companyId)))
      shaped.sort((a, b) => {
        const score = (r) =>
          (r.email ? 4 : 0) + (r.phone ? 2 : 0) + (r.linkedin ? 2 : 0) + (r.title ? 1 : 0)
        return score(b) - score(a)
      })
      return {
        primaryContactId: shaped[0].id,
        contacts: shaped,
        mergeContactIds: shaped.slice(1).map((c) => c.id),
        reason: shaped[0].email ? 'email' : shaped[0].phone ? 'phone' : 'identity',
      }
    })
    .slice(0, limit)
}

/** Merge secondary master contacts into primary; re-point pipeline entries. */
export function mergeMasterContacts(store, user, primaryContactId, mergeContactIds = []) {
  const primaryId = String(primaryContactId || '').trim()
  const mergeIds = [...new Set(mergeContactIds.map(String).filter(Boolean))].filter(
    (id) => id !== primaryId
  )
  if (!primaryId || !mergeIds.length) {
    throw new Error('primaryContactId and mergeContactIds are required')
  }

  if (!userCanAccessContact(store, user, primaryId)) {
    throw new Error('Contact not found')
  }
  for (const id of mergeIds) {
    if (!userCanAccessContact(store, user, id)) {
      throw new Error('Contact not found')
    }
  }

  const primary = store.contacts.find((row) => row.id === primaryId)
  if (!primary) throw new Error('Contact not found')

  let company = store.companies.find((row) => row.id === primary.companyId) || null
  const mergedFields = {}
  const removedIds = []

  for (const mergeId of mergeIds) {
    const secondary = store.contacts.find((row) => row.id === mergeId)
    if (!secondary) continue
    const secondaryCompany = store.companies.find((row) => row.id === secondary.companyId) || null

    mergedFields.firstName = mergedFields.firstName || secondary.firstName
    mergedFields.lastName = mergedFields.lastName || secondary.lastName
    mergedFields.title = mergedFields.title || secondary.title
    mergedFields.email = mergedFields.email || secondary.email
    mergedFields.phone = mergedFields.phone || secondary.phone
    mergedFields.linkedin = mergedFields.linkedin || secondary.linkedinUrl
    mergedFields.city = mergedFields.city || secondary.city
    mergedFields.state = mergedFields.state || secondary.state
    mergedFields.company = mergedFields.company || secondaryCompany?.name
    mergedFields.website = mergedFields.website || secondaryCompany?.domain

    for (const entry of listPipelineSavedEntries(store, user)) {
      if (entry.contactId === mergeId || entry.lead?.id === mergeId) {
        entry.contactId = primaryId
        entry.companyId = primary.companyId || company?.id || entry.companyId
        if (entry.lead) entry.lead.id = primaryId
      }
    }

    store.contacts = store.contacts.filter((row) => row.id !== mergeId)
    removedIds.push(mergeId)
  }

  const shaped = updateMasterContactById(store, user, primaryId, mergedFields)
  return {
    contact: shaped,
    mergedCount: removedIds.length,
    removedContactIds: removedIds,
    primaryContactId: primaryId,
  }
}
