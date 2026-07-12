import { aggregateCompaniesFromEntries } from '../../server/companiesHub.js'
import { listPipelineSavedEntries } from '../../server/organizations.js'
import { scopeByOrg } from './base.js'

export function createCompanyRepository({ database }) {
  return {
    async listForOrg(user, { search = '', limit = 50, offset = 0 } = {}) {
      const store = await database.readStore(['organizations', 'users', 'organizationMemberships', 'savedLeads'])
      const entries = await listPipelineSavedEntries(user, store)
      let companies = aggregateCompaniesFromEntries(entries)
      const q = String(search || '').trim().toLowerCase()
      if (q) {
        companies = companies.filter((c) => String(c.name || '').toLowerCase().includes(q))
      }
      return {
        companies: companies.slice(offset, offset + limit),
        total: companies.length,
        limit,
        offset,
      }
    },

    async findById(companyId, user) {
      const { companies } = await this.listForOrg(user, { limit: 5000, offset: 0 })
      return companies.find((c) => c.id === companyId) || null
    },
  }
}
