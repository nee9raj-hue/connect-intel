import {
  buildCompaniesHub,
  enrichCompaniesHierarchy,
  filterRootCompanies,
  getCompanyDetail,
  getCompanyDetailForLeadIds,
} from '../../server/companiesHub.js'
import {
  getPipelineCompanyById,
  listPipelineCompaniesPage,
  orgHasPipelineCompanies,
  updatePipelineCompanyParent,
} from '../../server/pipelineCompaniesTable.js'

function clampLimit(limit, max = 100) {
  return Math.min(max, Math.max(1, Number(limit) || 50))
}

function clampOffset(offset) {
  return Math.max(0, Number(offset) || 0)
}

export function createCompanyRepository() {
  return {
    /**
     * Accounts hub list — SQL table when available, else in-memory aggregation from pipeline.
     */
    async listHub(user, store, { search = '', limit = 50, offset = 0, rootsOnly = false } = {}) {
      const lim = clampLimit(limit)
      const off = clampOffset(offset)
      const q = String(search || '').trim()

      if (user.organizationId && (await orgHasPipelineCompanies(user.organizationId))) {
        const tablePage = await listPipelineCompaniesPage(user.organizationId, {
          search: q,
          limit: lim,
          offset: off,
          rootsOnly,
        })
        if (tablePage) {
          const enriched = enrichCompaniesHierarchy(tablePage.companies)
          return {
            ...tablePage,
            companies: enriched,
            total: tablePage.total,
            limit: lim,
            offset: off,
            fromTable: true,
            hierarchyEnabled: true,
            rootsOnly,
          }
        }
      }

      const payload = buildCompaniesHub(store, user, { search: q, limit: lim, offset: off })
      let companies = enrichCompaniesHierarchy(payload.companies)
      if (rootsOnly) {
        companies = filterRootCompanies(companies)
      }
      return {
        ...payload,
        companies,
        total: rootsOnly ? companies.length : payload.total,
        limit: lim,
        offset: off,
        fromTable: false,
        hierarchyEnabled: false,
        rootsOnly,
      }
    },

    /**
     * Single account detail with related leads.
     */
    async getDetail(user, store, companyId) {
      const id = String(companyId || '').trim()
      if (!id) return null

      if (user.organizationId && (await orgHasPipelineCompanies(user.organizationId))) {
        const sqlCompany = await getPipelineCompanyById(user.organizationId, id)
        if (sqlCompany) {
          const page = await listPipelineCompaniesPage(user.organizationId, { limit: 5000, offset: 0 })
          const enriched = enrichCompaniesHierarchy(page?.companies || [])
          const meta = enriched.find((c) => c.id === id)
          const company = getCompanyDetailForLeadIds(
            store,
            user,
            { ...sqlCompany, ...meta },
            sqlCompany.leadIds
          )
          if (company) {
            return { company, fromTable: true, hierarchyEnabled: true }
          }
        }
      }

      const company = getCompanyDetail(store, user, id)
      if (!company) return null
      return { company, fromTable: false, hierarchyEnabled: false }
    },

    /** Update parent company in SQL hierarchy table. */
    async updateParent(organizationId, companyId, parentCompanyId) {
      return updatePipelineCompanyParent(organizationId, companyId, parentCompanyId)
    },

    /** @deprecated Use listHub — kept for gradual migration. */
    async listForOrg(user, { search = '', limit = 50, offset = 0 } = {}) {
      const store = { savedLeads: [] }
      const page = await this.listHub(user, store, { search, limit, offset })
      return {
        companies: page.companies,
        total: page.total,
        limit: page.limit,
        offset: page.offset,
      }
    },

    /** @deprecated Use getDetail — kept for gradual migration. */
    async findById(companyId, user, store = { savedLeads: [] }) {
      const result = await this.getDetail(user, store, companyId)
      return result?.company || null
    },
  }
}
