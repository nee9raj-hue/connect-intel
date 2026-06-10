/**
 * Enterprise leads data contract (Supabase multi-tenant + Vault PII).
 *
 * The browser does NOT call Supabase directly. All reads/writes go through
 * `/api/saved-leads` and related CRM APIs. The server:
 *   • READ  — merges PII from `decrypted_leads` (first_name, last_name, email, phone)
 *   • WRITE — upserts `leads` with encrypted_* columns (plaintext in; DB trigger seals)
 *
 * UI code keeps using camelCase: firstName, lastName, email, phone.
 */

export const ENTERPRISE_LEADS_TABLE = 'leads'
export const ENTERPRISE_LEADS_READ_VIEW = 'decrypted_leads'

/** decrypted_leads view columns → app lead fields (server maps before JSON response). */
export function mapDecryptedLeadToClient(row) {
  if (!row) return null
  return {
    id: row.legacy_lead_id || row.id,
    firstName: row.first_name ?? null,
    lastName: row.last_name ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    company: row.company_name ?? null,
    city: row.city ?? null,
    state: row.state ?? null,
    country: row.country ?? null,
    source: row.lead_source ?? null,
    assignedToUserId: row.assigned_to ?? null,
    organizationId: row.organization_id ?? null,
    crm: {
      status: row.lead_status || 'new',
      leadScore: row.lead_score ?? null,
      ...(row.crm_payload || {}),
    },
  }
}

/** App contact / form state → server write payload for public.leads (encrypted_*). */
export function mapClientLeadToEnterpriseWrite(lead, { organizationId, assignedToUserId } = {}) {
  if (!lead) return null
  return {
    organization_id: organizationId || lead.organizationId || null,
    assigned_to: assignedToUserId ?? lead.assignedToUserId ?? null,
    encrypted_first_name: lead.firstName ?? lead.first_name ?? null,
    encrypted_last_name: lead.lastName ?? lead.last_name ?? null,
    encrypted_email: lead.email ? String(lead.email).trim().toLowerCase() : null,
    encrypted_phone: lead.phone ?? null,
  }
}

/** CSV / import row (snake_case) → camelCase lead fields for API bodies. */
export function mapImportRowToClientLead(row) {
  const normalized = row || {}
  return {
    firstName: normalized.first_name || normalized.firstName || null,
    lastName: normalized.last_name || normalized.lastName || null,
    email: normalized.email || null,
    phone: normalized.phone || normalized.mobile || null,
    company: normalized.company || normalized.company_name || normalized.business_name || null,
    city: normalized.city || null,
    state: normalized.state || null,
    title: normalized.title || normalized.job_title || null,
    source: normalized.source || 'import',
  }
}
