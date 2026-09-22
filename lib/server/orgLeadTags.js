import { createId } from './store.js'
import { getOrganization } from './organizations.js'
import { memberCanUseLeadTag } from '../pipelineMemberVisibility.js'

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
  '#64748B',
]

const MAX_TAGS_PER_BATCH = 30

export function slugifyName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/** Split "B2B, B2C, UK" or newline-separated input into unique tag names. */
export function parseTagNamesInput(input) {
  const seen = new Set()
  const names = []
  for (const part of String(input || '').split(/[,;\n]+/)) {
    const trimmed = part.trim().slice(0, 48)
    if (!trimmed) continue
    const slug = slugifyName(trimmed)
    if (seen.has(slug)) continue
    seen.add(slug)
    names.push(trimmed)
    if (names.length >= MAX_TAGS_PER_BATCH) break
  }
  return names
}

export function pickTagColorForIndex(index) {
  return LEAD_TAG_COLORS[index % LEAD_TAG_COLORS.length]
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
    id: String(raw.id || createId('tag')),
    name,
    color,
    createdAt: raw.createdAt || new Date().toISOString(),
    createdByUserId: raw.createdByUserId || null,
    teamId: raw.teamId ? String(raw.teamId) : null,
    source: raw.source || (raw.teamId ? 'org_team' : raw.engagementSlug ? 'engagement' : null),
    engagementSlug: raw.engagementSlug || null,
    visibility: String(raw.source || '') === 'personal' ? 'personal' : raw.teamId ? 'team' : 'org',
  }
}

export function listOrgLeadTagDefinitions(store, organizationId) {
  stabilizeOrgLeadTagIds(store, organizationId)
  const org = getOrganization(store, organizationId)
  const list = Array.isArray(org?.leadTags) ? org.leadTags : []
  return list
    .map((t, i) => normalizeLeadTagDefinition(t, i))
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Stamp stable ids onto stored tag rows so GET vs PATCH cannot mint different ids. */
export function stabilizeOrgLeadTagIds(store, organizationId) {
  const org = getOrganization(store, organizationId)
  if (!org) return false
  const list = Array.isArray(org.leadTags) ? org.leadTags : []
  let changed = false
  const next = []
  for (let i = 0; i < list.length; i += 1) {
    const raw = list[i]
    const normalized = normalizeLeadTagDefinition(raw, i)
    if (!normalized) continue
    if (!raw || typeof raw !== 'object') {
      next.push(normalized)
      changed = true
      continue
    }
    if (!raw.id) {
      raw.id = normalized.id
      changed = true
    }
    next.push(raw)
  }
  if (changed || next.length !== list.length) {
    org.leadTags = next
    return true
  }
  return false
}

export function normalizeLeadTagIds(tagIds, store, organizationId) {
  stabilizeOrgLeadTagIds(store, organizationId)
  const org = getOrganization(store, organizationId)
  const raw = Array.isArray(org?.leadTags) ? org.leadTags : []
  const allowed = new Set(
    raw.map((t) => (t?.id != null ? String(t.id) : '')).filter(Boolean)
  )
  for (const tag of listOrgLeadTagDefinitions(store, organizationId)) {
    if (tag?.id) allowed.add(String(tag.id))
  }
  if (!allowed.size) {
    return [...new Set((tagIds || []).map(String).filter(Boolean))]
  }
  return [...new Set((tagIds || []).map(String).filter((id) => allowed.has(id)))]
}

/** Keep other people's private tags on a lead when this actor edits the visible set. */
export function mergeVisibleLeadTagIds(requestedIds, existingIds, visibleAllowedIds) {
  const allowed = new Set((visibleAllowedIds || []).map(String).filter(Boolean))
  const existing = [...new Set((existingIds || []).map(String).filter(Boolean))]
  const hiddenKeep = existing.filter((id) => !allowed.has(id))
  const nextVisible = [...new Set((requestedIds || []).map(String).filter((id) => allowed.has(id)))]
  return [...new Set([...hiddenKeep, ...nextVisible])]
}

export function visibleLeadTagIdsForUser(store, organizationId, user, { memberTeamIds = [] } = {}) {
  const admin = Boolean(user?.isPlatformAdmin || user?.isOrgAdmin || user?.orgRole === 'org_admin')
  const actorIds = [...new Set([user?.id, ...(user?.pipelineActorIds || [])].map(String).filter(Boolean))]
  return listOrgLeadTagDefinitions(store, organizationId)
    .filter((tag) => memberCanUseLeadTag(tag, memberTeamIds, { isOrgAdmin: admin, actorIds }))
    .map((tag) => String(tag.id))
}

/** Map tag name(s) to org tag ids; optionally create missing definitions on import. */
export function resolveOrgLeadTagIdsFromNames(
  store,
  organizationId,
  rawInput,
  { createMissing = false, actorUserId = null } = {}
) {
  const names = Array.isArray(rawInput)
    ? rawInput.map((n) => String(n).trim()).filter(Boolean)
    : parseTagNamesInput(rawInput)
  if (!names.length) return []

  const slugToId = () =>
    new Map(listOrgLeadTagDefinitions(store, organizationId).map((d) => [slugifyName(d.name), d.id]))

  let bySlug = slugToId()
  const missing = names.filter((n) => !bySlug.has(slugifyName(n)))

  if (createMissing && missing.length && actorUserId) {
    try {
      createOrgLeadTagsBatch(store, organizationId, missing, actorUserId)
    } catch (error) {
      if (!/already exist/i.test(error?.message || '')) throw error
    }
    bySlug = slugToId()
  }

  const ids = []
  for (const name of names) {
    const id = bySlug.get(slugifyName(name))
    if (id) ids.push(id)
  }
  return [...new Set(ids)]
}

function tagSlugTaken(existing, slug, { personal = false, actorUserId = null, ignoreId = null } = {}) {
  return existing.some((t) => {
    if (ignoreId && String(t.id) === String(ignoreId)) return false
    if (slugifyName(t.name) !== slug) return false
    const otherPersonal = String(t.source || '') === 'personal'
    if (personal) {
      if (otherPersonal) return String(t.createdByUserId || '') === String(actorUserId || '')
      return true
    }
    return !otherPersonal
  })
}

export function createLeadTagRecord(existing, { name, color, personal = false }, actorUserId) {
  const trimmed = String(name || '').trim()
  if (!trimmed) throw new Error('Tag name is required')
  if (trimmed.length > 48) throw new Error('Tag name is too long (max 48 characters)')
  const list = Array.isArray(existing) ? existing : []
  const slug = slugifyName(trimmed)
  if (tagSlugTaken(list, slug, { personal, actorUserId })) {
    throw new Error('A tag with this name already exists')
  }
  return normalizeLeadTagDefinition(
    {
      id: createId('tag'),
      name: trimmed,
      color,
      createdAt: new Date().toISOString(),
      createdByUserId: actorUserId,
      source: personal ? 'personal' : null,
    },
    list.length
  )
}

export function createOrgLeadTag(store, organizationId, { name, color, personal = false }, actorUserId) {
  const org = getOrganization(store, organizationId)
  if (!org) throw new Error('Organization not found')
  const existing = listOrgLeadTagDefinitions(store, organizationId)
  const tag = createLeadTagRecord(existing, { name, color, personal }, actorUserId)
  org.leadTags = Array.isArray(org.leadTags) ? org.leadTags : []
  org.leadTags.push(tag)
  return tag
}

/**
 * Create multiple tags at once; each gets the next color in the palette.
 * Skips names that already exist on the org.
 */
export function createOrgLeadTagsBatch(store, organizationId, names, actorUserId, { personal = false } = {}) {
  const org = getOrganization(store, organizationId)
  if (!org) throw new Error('Organization not found')

  const parsed = Array.isArray(names) ? names : parseTagNamesInput(names)
  if (!parsed.length) throw new Error('Enter at least one tag name')

  const existing = listOrgLeadTagDefinitions(store, organizationId)
  const created = []
  const skipped = []
  let colorIndex = existing.length

  for (const trimmed of parsed) {
    const name = String(trimmed).trim().slice(0, 48)
    if (!name) continue
    const slug = slugifyName(name)
    if (tagSlugTaken(existing.concat(created), slug, { personal, actorUserId })) {
      skipped.push({ name, reason: 'already_exists' })
      continue
    }
    const tag = normalizeLeadTagDefinition(
      {
        id: createId('tag'),
        name,
        color: pickTagColorForIndex(colorIndex),
        createdAt: new Date().toISOString(),
        createdByUserId: actorUserId,
        source: personal ? 'personal' : null,
      },
      colorIndex
    )
    org.leadTags = Array.isArray(org.leadTags) ? org.leadTags : []
    org.leadTags.push(tag)
    created.push(tag)
    colorIndex += 1
  }

  if (!created.length && skipped.length) {
    throw new Error('All tag names already exist')
  }

  return { created, skipped }
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
    if (
      tagSlugTaken(tags, slug, {
        personal: String(next.source || '') === 'personal',
        actorUserId: next.createdByUserId,
        ignoreId: tagId,
      })
    ) {
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
