import { recordAuditEvent } from './auditEvents.js'

/** Append-only audit for pipeline lead/deal mutations (no-op when audit disabled). */
export function recordPipelineAudit({
  organizationId,
  actorUserId,
  action,
  resourceType = 'lead',
  resourceId,
  metadata = {},
}) {
  if (!action || !resourceId) return
  void recordAuditEvent({
    organizationId,
    actorUserId,
    action,
    resourceType,
    resourceId: String(resourceId),
    outcome: 'success',
    metadata,
  }).catch(() => {})
}
