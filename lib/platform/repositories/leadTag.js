import { assertOrgId } from './base.js'
import {
  deleteLeadTagMasterRow,
  listLeadTagMaster,
  syncOrgLeadTagMaster,
  upsertLeadTagMasterRows,
} from '../../server/leadTagMaster.js'

export function createLeadTagRepository() {
  return {
    async list(organizationId) {
      return listLeadTagMaster(assertOrgId(organizationId))
    },

    async syncFromStore(store, organizationId) {
      return syncOrgLeadTagMaster(store, assertOrgId(organizationId))
    },

    async upsertMany(organizationId, tags) {
      return upsertLeadTagMasterRows(assertOrgId(organizationId), tags)
    },

    async remove(organizationId, tagId) {
      return deleteLeadTagMasterRow(assertOrgId(organizationId), tagId)
    },
  }
}
