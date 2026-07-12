import { scopeByOrg, assertOrgId } from './base.js'

export function createOrganizationRepository({ database }) {
  return {
    async findById(organizationId) {
      const store = await database.readStore(['organizations'])
      return (store.organizations || []).find((o) => o.id === organizationId) || null
    },

    async listForUser(userId) {
      const store = await database.readStore(['organizations', 'organizationMemberships', 'users'])
      const user = (store.users || []).find((u) => u.id === userId)
      if (!user) return []
      if (user.organizationId) {
        const org = (store.organizations || []).find((o) => o.id === user.organizationId)
        return org ? [org] : []
      }
      const memberOrgIds = new Set(
        (store.organizationMemberships || [])
          .filter((m) => m.userId === userId && (m.status || 'active') === 'active')
          .map((m) => m.organizationId)
      )
      return (store.organizations || []).filter((o) => memberOrgIds.has(o.id))
    },

    async listMembers(organizationId) {
      const org = assertOrgId(organizationId)
      const store = await database.readStore(['users', 'organizationMemberships'])
      const memberIds = new Set(
        scopeByOrg(store.organizationMemberships, org)
          .filter((m) => (m.status || 'active') === 'active')
          .map((m) => m.userId)
      )
      return (store.users || []).filter((u) => memberIds.has(u.id) || u.organizationId === org)
    },
  }
}
