/** Read-only ERP tags — display only; never mixed with CRM tagIds. */

export function readErpTagsFromLead(lead) {
  if (!lead || typeof lead !== 'object') return []

  if (Array.isArray(lead.erpTags) && lead.erpTags.length) {
    return lead.erpTags.filter((t) => t?.name)
  }

  if (Array.isArray(lead.crm_payload?.erp_tags)) {
    return lead.crm_payload.erp_tags.filter((t) => t?.name)
  }

  if (Array.isArray(lead.crm?.erp_tags)) {
    return lead.crm.erp_tags.filter((t) => t?.name)
  }

  const fromErp = lead.erp?.erpTags ?? lead.erp?.erp_tags
  if (Array.isArray(fromErp)) return fromErp.filter((t) => t?.name)

  return []
}
