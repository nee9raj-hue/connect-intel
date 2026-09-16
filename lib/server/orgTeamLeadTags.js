import { createId } from './store.js'
import { getOrganization } from './organizations.js'
import {
  listOrgLeadTagDefinitions,
  normalizeLeadTagDefinition,
  pickTagColorForIndex,
  slugifyName,
} from './orgLeadTags.js'
import { listOrgHierarchy, orgHierarchyActive } from './orgHierarchy.js'
import { updateStorePartial } from './store.js'

export function flattenHierarchyTeams(hierarchy) {
  return (hierarchy?.departments || []).flatMap((dept) =>
    (dept.teams || []).map((team) => ({
      ...team,
      departmentName: dept.name || '',
    }))
  )
}

export function teamForUser(teams, userId) {
  if (!userId) return null
  return (
    (teams || []).find((team) =>
      (team.members || []).some((m) => String(m.userId) === String(userId))
    ) || null
  )
}

export function memberUserIdsForTeams(teams, teamIds) {
  const wanted = new Set((teamIds || []).map(String).filter(Boolean))
  if (!wanted.size) return []
  const ids = []
  for (const team of teams || []) {
    if (!wanted.has(String(team.id))) continue
    for (const m of team.members || []) {
      if (m.userId) ids.push(String(m.userId))
    }
  }
  return [...new Set(ids)]
}

/** Ensure each org team has a matching lead tag (same display name). */
export function ensureOrgTeamLeadTags(store, organizationId, teams, actorUserId) {
  const org = getOrganization(store, organizationId)
  if (!org) return []
  org.leadTags = Array.isArray(org.leadTags) ? org.leadTags : []
  const existing = org.leadTags
  let colorIndex = existing.length
  const ensured = []

  for (const team of teams || []) {
    const name = String(team.name || '').trim().slice(0, 48)
    if (!name || !team.id) continue
    const teamId = String(team.id)
    let tag = existing.find((t) => t && String(t.teamId) === teamId)
    if (!tag) {
      const slug = slugifyName(name)
      tag = existing.find((t) => t && !t.teamId && slugifyName(t.name) === slug)
    }
    if (!tag) {
      tag = normalizeLeadTagDefinition(
        {
          id: createId(),
          name,
          color: pickTagColorForIndex(colorIndex),
          teamId,
          source: 'org_team',
          createdAt: new Date().toISOString(),
          createdByUserId: actorUserId || null,
        },
        colorIndex
      )
      existing.push(tag)
      colorIndex += 1
    } else {
      tag.teamId = teamId
      tag.source = 'org_team'
      tag.name = name
    }
    ensured.push(tag)
  }

  org.leadTags = existing
  return ensured
}

export function applyAssigneeTeamTagToCrm(store, organizationId, crm, assigneeUserId, teams) {
  const prev = crm && typeof crm === 'object' ? crm : {}
  const tags = listOrgLeadTagDefinitions(store, organizationId)
  const teamTagIds = new Set(
    tags.filter((t) => t.teamId || t.source === 'org_team').map((t) => String(t.id))
  )
  const nextIds = (prev.tagIds || []).map(String).filter((id) => !teamTagIds.has(id))

  if (!assigneeUserId) {
    return { ...prev, tagIds: nextIds }
  }

  ensureOrgTeamLeadTags(store, organizationId, teams, null)
  const team = teamForUser(teams, assigneeUserId)
  if (!team) return { ...prev, tagIds: nextIds }

  const refreshed = listOrgLeadTagDefinitions(store, organizationId)
  const tag = refreshed.find((t) => String(t.teamId) === String(team.id))
  if (tag && !nextIds.includes(String(tag.id))) nextIds.push(String(tag.id))
  return { ...prev, tagIds: nextIds }
}

export function applyAssigneeTeamOnPipelineEntry(store, organizationId, entry, crm, assigneeUserId, teams) {
  const team = assigneeUserId ? teamForUser(teams, assigneeUserId) : null
  entry.teamId = team?.id ? String(team.id) : null
  entry.departmentId = team?.departmentId ? String(team.departmentId) : null
  return applyAssigneeTeamTagToCrm(store, organizationId, crm, assigneeUserId, teams)
}

export async function syncOrgTeamLeadTags(organizationId, actorUserId, hierarchy) {
  if (!organizationId) return
  const teams = flattenHierarchyTeams(hierarchy)
  if (!teams.length) return
  await updateStorePartial(['organizations'], (draft) => {
    ensureOrgTeamLeadTags(draft, organizationId, teams, actorUserId)
    return draft
  })
}

export async function loadHierarchyTeams(organizationId) {
  if (!organizationId || !orgHierarchyActive()) return []
  try {
    const hierarchy = await listOrgHierarchy(organizationId, { skipLeadCounts: true })
    return flattenHierarchyTeams(hierarchy)
  } catch {
    return []
  }
}

export async function attachTeamMemberUserIdsToFilters(organizationId, filters = {}) {
  const teamIds = [...new Set([...(filters.teamIds || []), filters.teamId].map((id) => String(id || '').trim()).filter(Boolean))]
  if (!teamIds.length || !organizationId) return { ...filters, teamIds }
  const teams = await loadHierarchyTeams(organizationId)
  return {
    ...filters,
    teamIds,
    teamMemberUserIds: memberUserIdsForTeams(teams, teamIds),
  }
}
