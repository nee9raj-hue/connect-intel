import { pipelineOwnerUserId } from '../../pipelineOwner.js'

/** Map Meili lead doc → minimal entry for visibility checks (RBAC-safe). */
export function meiliDocToEntryStub(doc) {
  if (!doc) return null
  const stub = {
    organizationId: doc.organizationId || null,
    assignedToUserId: doc.assignedToUserId ?? null,
    savedByUserId: doc.savedByUserId ?? null,
    userId: doc.userId ?? null,
    lead: { id: doc.leadId },
  }
  // Legacy index rows only stored a combined assignee field (assignee || savedBy).
  if (!stub.savedByUserId && !stub.userId && doc.assignedToUserId && !stub.assignedToUserId) {
    stub.savedByUserId = doc.assignedToUserId
  }
  if (doc.ownerUserId && !pipelineOwnerUserId(stub)) {
    const owner = String(doc.ownerUserId)
    if (!stub.assignedToUserId) stub.savedByUserId = stub.savedByUserId || owner
  }
  return stub
}
