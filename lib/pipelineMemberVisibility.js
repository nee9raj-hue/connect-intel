/** Team and tag visibility for non-admin pipeline members. */

export function isOrgWideLeadTag(tag) {
  if (!tag) return false
  if (tag.teamId) return false
  if (String(tag.source || '') === 'org_team') return false
  return true
}

export function memberCanUseLeadTag(tag, memberTeamIds = [], { isOrgAdmin = false } = {}) {
  if (!tag) return false
  if (isOrgAdmin) return true
  if (isOrgWideLeadTag(tag)) return true
  const teamId = String(tag.teamId || '').trim()
  if (!teamId) return false
  return memberTeamIds.map(String).includes(teamId)
}

export function allowedTeamIdsForMember(requestedTeamIds, memberTeamIds = [], { isOrgAdmin = false } = {}) {
  const requested = [...new Set((requestedTeamIds || []).map(String).filter(Boolean))]
  if (isOrgAdmin) return requested
  const allowed = new Set(memberTeamIds.map(String).filter(Boolean))
  return requested.filter((id) => allowed.has(id))
}

export function allowedTagIdsForMember(
  requestedTagIds,
  tags = [],
  memberTeamIds = [],
  { isOrgAdmin = false } = {}
) {
  const requested = [...new Set((requestedTagIds || []).map(String).filter(Boolean))]
  if (!requested.length) return []
  const byId = new Map((tags || []).map((tag) => [String(tag.id), tag]))
  return requested.filter((id) => memberCanUseLeadTag(byId.get(id), memberTeamIds, { isOrgAdmin }))
}

/** Default pipeline is assigned leads; team or allowed-tag filters open a shared view. */
export function repFilterLiftsOwnerScope(filters = {}) {
  return Boolean(
    (filters.teamIds || []).length ||
      (filters.tagIds || []).length ||
      String(filters.teamId || '').trim()
  )
}

export function teamIdsFromHierarchyForUser(departments = [], userId, fallbackTeamId = null) {
  const ids = new Set()
  const uid = String(userId || '').trim()
  if (fallbackTeamId) ids.add(String(fallbackTeamId))
  if (!uid) return [...ids]
  for (const dept of departments || []) {
    for (const team of dept.teams || []) {
      const members = team.members || []
      const onTeam = members.some(
        (m) => String(m.userId || m.legacyUserId || '') === uid
      )
      if (onTeam && team.id) ids.add(String(team.id))
    }
  }
  return [...ids]
}
