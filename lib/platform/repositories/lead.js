import { scopeByOrg } from './base.js'

export function createLeadRepository({ database }) {
  return {
    async findById(leadId, { organizationId, userId } = {}) {
      const store = await database.readStore(['savedLeads'])
      const rows = store.savedLeads || []
      return (
        rows.find((entry) => {
          if (entry.lead?.id !== leadId && entry.id !== leadId) return false
          if (organizationId && entry.organizationId !== organizationId) return false
          if (!organizationId && userId && entry.userId !== userId) return false
          return true
        }) || null
      )
    },

    async listForOrg(organizationId, { limit = 100, offset = 0 } = {}) {
      const store = await database.readStore(['savedLeads'])
      const rows = scopeByOrg(store.savedLeads, organizationId)
      return {
        leads: rows.slice(offset, offset + limit),
        total: rows.length,
        limit,
        offset,
      }
    },

    async countForOrg(organizationId) {
      const store = await database.readStore(['savedLeads'])
      return scopeByOrg(store.savedLeads, organizationId).length
    },
  }
}
