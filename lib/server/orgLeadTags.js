import { createId } from './store.js'
import { getOrganization } from './organizations.js'

export const LEAD_TAG_COLORS = [
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#d97706',
  '#059669',
  '#4f46e5',
  '#0d9488',
  '#dc2626',
  '#475569',
  '#ca8a04',
]

function slugifyName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export function normalizeLeadTagDefinition(raw, index = 0) {
  if (!raw || typeof raw !== 'object') return null
  const name = String(raw.name || '').trim().slice(0, 48)
  if (!name) return null
  const color =
    typeof raw.color === 'string' && LEAD_TAG_COLORS.includes(raw.color)
      ? raw.color
      : LEAD_TAG_COLORS[index % LEAD_TAG_COLORS.length]
  return {
    id: String(raw.id || createId()),
    name,
    color,
    createdAt: raw.createdAt || new Date().toISOString(),
    createdByUserId: raw.createdByUserId || null,
  }
}

export function listOrgLeadTagDefinitions(store, organizationId) {
  const org = getOrganization(store, organizationId)
  const list = Array.isArray(org?.leadTags) ? org.leadTags : []
  return list
    .map((t, i) => normalizeLeadTagDefinition(t, i))
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function normalizeLeadTagIds(tagIds, store, organizationId) {
  const allowed = new Set(listOrgLeadTagDefinitions(store, organizationId).map((t) => t.id))
  return [...new Set((tagIds || []).map(String).filter((id) => allowed.has(id)))]
}

export function createOrgLeadTag(store, organizationId, { name, color }, actorUserId) {
  const org = getOrganization(store, organizationId)
  if (!org) throw new Error('Organization not found')
  const trimmed = String(name || '').trim()
  if (!trimmed) throw new Error('Tag name is required')
  if (trimmed.length > 48) throw new Error('Tag name is too long (max 48 characters)')

  const existing = listOrgLeadTagDefinitions(store, organizationId)
  const slug = slugifyName(trimmed)
  if (existing.some((t) => slugifyName(t.name) === slug)) {
    throw new Error('A tag with this name already exists')
  }

  const tag = normalizeLeadTagDefinition(
    {
      id: createId(),
      name: trimmed,
      color,
      createdAt: new Date().toISOString(),
      createdByUserId: actorUserId,
    },
    existing.length
  )
  org.leadTags = [...existing, tag]
  return tag
}

export function updateOrgLeadTag(store, organizationId, tagId, { name, color }) {
  const org = getOrganization(store, organizationId)
  if (!org) throw new Error('Organization not found')
  const tags = listOrgLeadTagDefinitions(store, organizationId)
  const index = tags.findIndex((t) => t.id === tagId)
  if (index < 0) throw new Error('Tag not found')

  const next = { ...tags[index] }
  if (name !== undefined) {
    const trimmed = String(name || '').trim()
    if (!trimmed) throw new Error('Tag name is required')
    const slug = slugifyName(trimmed)
    if (tags.some((t) => t.id !== tagId && slugifyName(t.name) === slug)) {
      throw new Error('A tag with this name already exists')
    }
    next.name = trimmed.slice(0, 48)
  }
  if (color !== undefined) {
    next.color = LEAD_TAG_COLORS.includes(color) ? color : next.color
  }

  const updated = [...tags]
  updated[index] = next
  org.leadTags = updated
  return next
}

export function deleteOrgLeadTag(store, organizationId, tagId) {
  const org = getOrganization(store, organizationId)
  if (!org) throw new Error('Organization not found')
  const tags = listOrgLeadTagDefinitions(store, organizationId)
  if (!tags.some((t) => t.id === tagId)) throw new Error('Tag not found')
  org.leadTags = tags.filter((t) => t.id !== tagId)

  for (const entry of store.savedLeads || []) {
    if (entry.organizationId !== organizationId) continue
    const ids = entry.crm?.tagIds
    if (!Array.isArray(ids) || !ids.includes(tagId)) continue
    entry.crm = {
      ...(entry.crm || {}),
      tagIds: ids.filter((id) => id !== tagId),
    }
  }
  return { deleted: tagId }
}
