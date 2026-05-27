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
