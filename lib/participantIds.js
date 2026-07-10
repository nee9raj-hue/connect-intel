/** Shared participant id normalization (browser + server safe). */
export function normalizeParticipantIds(primaryUserId, extraIds = []) {
  const ids = []
  const seen = new Set()
  for (const raw of [primaryUserId, ...(extraIds || [])]) {
    const id = String(raw || '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids
}
