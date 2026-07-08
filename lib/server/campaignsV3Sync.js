import {
  buildCampaignRecipientRow,
  buildCampaignV3Row,
  campaignsV3TableActive,
  insertCampaignEvent,
  patchCampaignRecipientByEnrollmentRef,
  patchCampaignV3Fields,
  upsertCampaignRecipients,
  upsertCampaignStatsRow,
  upsertCampaignV3,
} from './campaignsV3Table.js'

function addDaysIso(days) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

/** Mirror campaign row to campaigns_v3 after store write. */
export function syncCampaignV3AfterSave({ campaign, user }) {
  if (!campaignsV3TableActive() || !campaign) return
  const row = buildCampaignV3Row(campaign, user)
  if (!row) return
  void upsertCampaignV3(row).catch((err) => {
    console.warn('campaigns_v3 sync:', err?.message || err)
  })
}

/** Snapshot enrollments into campaign_recipients (no pipeline reads during send). */
export function syncRecipientsAfterEnroll({ campaign, enrollments, store, user }) {
  if (!campaignsV3TableActive() || !campaign?.id || !enrollments?.length) return

  const rows = []
  for (const enrollment of enrollments) {
    let lead = null
    if (store?.savedLeads?.length && enrollment.leadId) {
      const entry = (store.savedLeads || []).find(
        (e) => (e.lead?.id || e.id) === enrollment.leadId
      )
      lead = entry?.lead || entry || null
    }
    const built = buildCampaignRecipientRow(campaign, enrollment, lead)
    if (built) rows.push(built)
  }

  if (!rows.length) return
  void upsertCampaignRecipients(rows)
    .then(() =>
      upsertCampaignStatsRow(campaign.id, {
        queued: rows.length,
        sent: campaign.stats?.sent || 0,
        failed: campaign.stats?.failed || 0,
        unsubscribed: campaign.stats?.unsubscribed || 0,
      })
    )
    .catch((err) => {
      console.warn('campaign_recipients sync:', err?.message || err)
    })
}

/** Dual-write stats shard patches to campaign_stats. */
export function syncCampaignStatsToSql(campaignId, patch = {}) {
  if (!campaignsV3TableActive() || !campaignId) return

  const sqlPatch = {}
  if (patch.enrolled != null) sqlPatch.queued = patch.enrolled
  if (patch.sent != null) sqlPatch.sent = patch.sent
  if (patch.failed != null) sqlPatch.failed = patch.failed
  if (patch.unsubscribed != null) sqlPatch.unsubscribed = patch.unsubscribed

  const delta = {}
  if (typeof patch.sent === 'number' && patch.sent > 0 && patch.enrolled == null) {
    delta.sent = patch.sent
  }
  if (typeof patch.failed === 'number' && patch.failed > 0 && !patch.enrolled) {
    delta.failed = patch.failed
  }
  if (typeof patch.unsubscribed === 'number' && patch.unsubscribed > 0) {
    delta.unsubscribed = patch.unsubscribed
  }

  if (Object.keys(delta).length) sqlPatch._delta = delta
  if (!Object.keys(sqlPatch).length && !patch.status) return

  void upsertCampaignStatsRow(campaignId, sqlPatch).catch((err) => {
    console.warn('campaign_stats sync:', err?.message || err)
  })

  if (patch.sendStatus) {
    void patchCampaignV3Fields(campaignId, {
      send_status: patch.sendStatus,
      ...(patch.status ? { status: patch.status } : {}),
    }).catch(() => {})
  }
}

/** Apply enrollment send writes to SQL recipients. */
export function syncRecipientWritesToSql(campaignId, pendingWrites = [], dueEnrollments = []) {
  if (!campaignsV3TableActive() || !campaignId || !pendingWrites.length) return

  const byId = new Map((dueEnrollments || []).map((e) => [e.id, e]))

  for (const write of pendingWrites) {
    const enrollment = byId.get(write.enrollmentId)
    const recipientId = enrollment?.sqlRecipientId || null

    if (write.kind === 'retry') {
      void patchCampaignRecipientByEnrollmentRef(campaignId, write.enrollmentId, {
        status: 'queued',
        next_send_at: write.nextSendAt || null,
        payload: {
          ...(enrollment?.payload || {}),
          lastError: String(write.error || 'retry').slice(0, 240),
          attempts: (write.attempts || 0) + 1,
        },
      }).catch(() => {})
      void insertCampaignEvent({
        campaignId,
        recipientId,
        eventType: 'retry',
        metadata: { error: write.error, attempts: write.attempts },
      }).catch(() => {})
      continue
    }

    if (write.kind === 'failed') {
      void patchCampaignRecipientByEnrollmentRef(campaignId, write.enrollmentId, {
        status: 'failed',
        payload: {
          ...(enrollment?.payload || {}),
          lastError: String(write.error || 'failed').slice(0, 240),
        },
      }).catch(() => {})
      void insertCampaignEvent({
        campaignId,
        recipientId,
        eventType: 'failed',
        metadata: { error: write.error },
      }).catch(() => {})
      continue
    }

    if (write.kind === 'unsubscribed') {
      void patchCampaignRecipientByEnrollmentRef(campaignId, write.enrollmentId, {
        status: 'unsubscribed',
      }).catch(() => {})
      void insertCampaignEvent({
        campaignId,
        recipientId,
        eventType: 'unsubscribed',
      }).catch(() => {})
      continue
    }

    if (write.kind === 'sent') {
      const nextSendAt = write.isLast ? null : addDaysIso(write.delayDays || 0)
      void patchCampaignRecipientByEnrollmentRef(campaignId, write.enrollmentId, {
        status: write.isLast ? 'sent' : 'queued',
        next_send_at: nextSendAt,
        payload: {
          ...(enrollment?.payload || {}),
          currentStep: write.nextStep,
          sentCount: (enrollment?.sentCount || 0) + 1,
          lastSentAt: new Date().toISOString(),
        },
      }).catch(() => {})
      void insertCampaignEvent({
        campaignId,
        recipientId,
        eventType: 'sent',
        metadata: { step: write.nextStep },
      }).catch(() => {})
    }
  }
}
