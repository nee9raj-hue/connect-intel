/** Pure helpers for account parent/child hierarchy (pipeline_companies). */

export function collectDescendantIds(companies, rootId) {
  const blocked = new Set([String(rootId)])
  let changed = true
  while (changed) {
    changed = false
    for (const row of companies || []) {
      if (
        row.parentCompanyId &&
        blocked.has(String(row.parentCompanyId)) &&
        !blocked.has(String(row.id))
      ) {
        blocked.add(String(row.id))
        changed = true
      }
    }
  }
  return blocked
}

export function validateCompanyParentAssignment(companies, companyId, parentCompanyId) {
  const cid = String(companyId || '').trim()
  if (!cid) return { ok: false, error: 'companyId is required' }

  const parentId =
    parentCompanyId == null || parentCompanyId === '' ? null : String(parentCompanyId).trim()

  if (parentId && parentId === cid) {
    return { ok: false, error: 'An account cannot be its own parent' }
  }

  const rows = companies || []
  if (!rows.some((c) => String(c.id) === cid)) {
    return { ok: false, error: 'Company not found' }
  }

  if (parentId) {
    if (!rows.some((c) => String(c.id) === parentId)) {
      return { ok: false, error: 'Parent company not found' }
    }
    const descendants = collectDescendantIds(rows, cid)
    if (descendants.has(parentId)) {
      return { ok: false, error: 'Invalid parent — would create a circular hierarchy' }
    }
  }

  return { ok: true, companyId: cid, parentCompanyId: parentId }
}

/** Sum this account plus all descendant accounts (for hub rollups). */
export function rollupAccountMetrics(companyId, companies) {
  const byId = new Map((companies || []).map((c) => [String(c.id), c]))
  const childrenOf = new Map()
  for (const row of companies || []) {
    const parentId = row.parentCompanyId ? String(row.parentCompanyId) : null
    if (!parentId) continue
    if (!childrenOf.has(parentId)) childrenOf.set(parentId, [])
    childrenOf.get(parentId).push(String(row.id))
  }

  function sumTree(id) {
    const node = byId.get(String(id))
    if (!node) {
      return { leadCount: 0, openDeals: 0, wonDeals: 0, totalDealValue: 0 }
    }
    let leadCount = Number(node.leadCount) || 0
    let openDeals = Number(node.openDeals) || 0
    let wonDeals = Number(node.wonDeals) || 0
    let totalDealValue = Number(node.totalDealValue) || 0
    for (const childId of childrenOf.get(String(id)) || []) {
      const sub = sumTree(childId)
      leadCount += sub.leadCount
      openDeals += sub.openDeals
      wonDeals += sub.wonDeals
      totalDealValue += sub.totalDealValue
    }
    return { leadCount, openDeals, wonDeals, totalDealValue }
  }

  return sumTree(companyId)
}

export function enrichCompaniesHierarchy(companies) {
  const rows = (companies || []).map((c) => ({ ...c }))
  const byId = new Map(rows.map((c) => [String(c.id), c]))

  for (const row of rows) {
    const parentId = row.parentCompanyId ? String(row.parentCompanyId) : null
    row.parentName = parentId && byId.has(parentId) ? byId.get(parentId).name : null
    row.childCount = rows.filter((c) => String(c.parentCompanyId || '') === String(row.id)).length
    row.children = rows
      .filter((c) => String(c.parentCompanyId || '') === String(row.id))
      .map((c) => ({
        id: c.id,
        name: c.name,
        leadCount: c.leadCount,
        openDeals: c.openDeals,
      }))

    const rollup = rollupAccountMetrics(row.id, rows)
    row.rollupLeadCount = rollup.leadCount
    row.rollupOpenDeals = rollup.openDeals
    row.rollupWonDeals = rollup.wonDeals
    row.rollupTotalDealValue = rollup.totalDealValue
  }

  return rows
}

export function filterRootCompanies(companies) {
  return (companies || []).filter((c) => !c.parentCompanyId)
}
