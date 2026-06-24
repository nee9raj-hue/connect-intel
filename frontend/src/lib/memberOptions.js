import { useMemo } from 'react'

/** Merge live team roster with API memberOptions so new reps always appear in filters. */
export function mergeMemberOptions(teamMembers = [], ...sources) {
  const map = new Map()
  for (const m of teamMembers || []) {
    if ((m.status || 'active') !== 'active') continue
    if (m.userId) map.set(String(m.userId), { userId: m.userId, name: m.name })
  }
  for (const list of sources) {
    for (const m of list || []) {
      if (m?.userId) map.set(String(m.userId), { userId: m.userId, name: m.name })
    }
  }
  return [...map.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)))
}

export function useMergedMemberOptions(teamMembers, ...sources) {
  return useMemo(() => mergeMemberOptions(teamMembers, ...sources), [teamMembers, ...sources])
}
