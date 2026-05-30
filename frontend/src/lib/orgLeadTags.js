/** Split comma, semicolon, or newline-separated tag input. */
export function parseTagNamesInput(input) {
  const seen = new Set()
  const names = []
  for (const part of String(input || '').split(/[,;\n]+/)) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    names.push(trimmed)
  }
  return names
}

export function tagMapById(tags = []) {
  const map = new Map()
  for (const tag of tags || []) {
    if (tag?.id) map.set(tag.id, tag)
  }
  return map
}

export function leadTagLabels(lead, tagById) {
  const ids = lead?.crm?.tagIds || []
  return ids.map((id) => tagById.get(id)).filter(Boolean)
}

export function toggleTagId(currentIds, tagId) {
  const set = new Set(currentIds || [])
  if (set.has(tagId)) set.delete(tagId)
  else set.add(tagId)
  return [...set]
}

/** Union of tag ids across multiple leads/contacts. */
export function unionTagIdsFromLeads(leads = []) {
  const set = new Set()
  for (const lead of leads) {
    for (const id of lead?.crm?.tagIds || []) {
      if (id) set.add(id)
    }
  }
  return [...set]
}
