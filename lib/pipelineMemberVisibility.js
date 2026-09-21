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

export function teamNameKey(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/** Map a lead tag onto a hierarchy team the member actually belongs to (id or name). */
export function resolveLeadTagTeamId(tag, teams = [], memberTeamIds = [], { isOrgAdmin = false } = {}) {
  if (!tag) return ''
  const memberSet = new Set((memberTeamIds || []).map(String).filter(Boolean))
  const tagged = String(tag.teamId || '').trim()
  const key = teamNameKey(tag.name)
  const named = (teams || []).filter((team) => teamNameKey(team.name || team.label) === key)
  const memberNamed = named.find((team) => memberSet.has(String(team.id)))
  if (memberNamed) return String(memberNamed.id)
  if (tagged && (isOrgAdmin || memberSet.size === 0 || memberSet.has(tagged))) return tagged
  if (named[0] && (isOrgAdmin || memberSet.size === 0)) return String(named[0].id)
  const isTeamTag = Boolean(tagged) || String(tag.source || '') === 'org_team'
  if (isTeamTag && !tagged && !named.length && memberSet.size === 1) return [...memberSet][0]
  return ''
}

/** Team-scoped More-filter tags (e.g. Non Large B2B) mean the whole team book, not assignee-only. */
export function consumeTeamScopedLeadTags(
  tagIds,
  tags = [],
  memberTeamIds = [],
  { isOrgAdmin = false, teams = [] } = {}
) {
  const remaining = []
  const teamIds = []
  const byId = new Map((tags || []).map((tag) => [String(tag.id), tag]))
  for (const id of tagIds || []) {
    const tag = byId.get(String(id))
    const teamId = resolveLeadTagTeamId(tag, teams, memberTeamIds, { isOrgAdmin })
    const isTeamTag = Boolean(tag?.teamId) || String(tag?.source || '') === 'org_team' || Boolean(teamId)
    if (isTeamTag && teamId) {
      teamIds.push(teamId)
      continue
    }
    remaining.push(String(id))
  }
  return { tagIds: remaining, teamIds: [...new Set(teamIds)] }
}

export function mergeTeamScopedTagFilters(filters = {}, tags = [], memberTeamIds = [], options = {}) {
  const consumed = consumeTeamScopedLeadTags(filters.tagIds, tags, memberTeamIds, options)
  return {
    ...filters,
    tagIds: consumed.tagIds,
    teamIds: [...new Set([...(filters.teamIds || []).map(String).filter(Boolean), ...consumed.teamIds])],
  }
}

/** Keep More → Tags checked after a team tag was applied as a shared team book. */
export function displayTagIdsForFilters(filters = {}, tags = []) {
  const selected = [...new Set((filters.tagIds || []).map(String).filter(Boolean))]
  const teamIds = new Set(
    [...(filters.teamIds || []), filters.teamId].map((id) => String(id || '').trim()).filter(Boolean)
  )
  if (!teamIds.size) return selected
  for (const tag of tags || []) {
    const id = String(tag?.id || '').trim()
    const teamId = String(tag?.teamId || '').trim()
    if (!id || !teamId || !teamIds.has(teamId)) continue
    if (!selected.includes(id)) selected.push(id)
  }
  return selected
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
