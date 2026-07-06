import { recordAuditEvent } from './auditEvents.js'

/** Append-only audit for marketing mutations (no-op when audit disabled). */
export function recordMarketingAudit({
  organizationId,
  actorUserId,
  action,
  resourceType = 'campaign',
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
