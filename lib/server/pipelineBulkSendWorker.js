import { findPipelineEntry } from './pipelineAccess.js'
import { generateAiEmail } from './crm.js'
import { buildCrmDraftOptions } from './crmEmailPrompt.js'
import { recordOutboundEmail } from './crmEmailThread.js'
import { mergeTemplateFields } from './marketingTemplates.js'
import { patchPipelineEntriesCrmBatch } from './pipelineShard.js'
import { readPipelineLeadsByIds } from './pipelineLeadsTable.js'
import { pipelineShardNameForUser } from './pipelineShard.js'

/** Attach pipeline lead rows for enrollments in this send burst. */
export async function attachPipelineLeadsForBulkSend(store, user, campaign, dueEnrollments) {
  if (campaign?.source !== 'pipeline_bulk' || !dueEnrollments?.length) return store
  const leadIds = [...new Set(dueEnrollments.map((e) => e.leadId).filter(Boolean))]
  if (!leadIds.length) return store

  const shardName = pipelineShardNameForUser(user)
  const fromTable = (await readPipelineLeadsByIds(shardName, leadIds)) || []
  if (fromTable.length) {
    return { ...store, savedLeads: fromTable }
  }

  const { loadPipelineStoreForLeadIds } = await import('./pipelineShard.js')
  const { pipelineStore } = await loadPipelineStoreForLeadIds(user, leadIds)
  return { ...store, savedLeads: pipelineStore.savedLeads }
}

/** Apply AI or merge-field template for pipeline bulk sends. */
export async function resolvePipelineBulkStepContent(campaign, lead, step, user) {
  const opts = campaign?.pipelineBulkOptions
  if (opts?.useAiPerLead) {
    const draft = await generateAiEmail(lead, buildCrmDraftOptions(user, opts))
    return {
      subject: draft.subject || step.subject,
      body: draft.body || step.body,
      blocks: step.blocks,
      design: step.design,
      previewText: step.previewText,
    }
  }
  const merged = mergeTemplateFields({ subject: step.subject, body: step.body }, lead)
  return { ...step, subject: merged.subject, body: merged.body }
}

/** Record CRM email thread entries after async pipeline bulk sends. */
export async function applyPipelineBulkCrmPatches(user, campaign, dueEnrollments, pendingWrites) {
  if (campaign?.source !== 'pipeline_bulk' || !pendingWrites?.length) return

  const enrollmentById = new Map((dueEnrollments || []).map((e) => [e.id, e]))
  const patches = []

  for (const write of pendingWrites) {
    if (write.kind !== 'sent') continue
    const enrollment = enrollmentById.get(write.enrollmentId)
    if (!enrollment?.leadId) continue

    const subj = String(write.sendSubject || campaign.subject || '').trim()
    const bodyText = String(write.sendBody || campaign.body || '').trim()
    if (!subj || !bodyText) continue

    patches.push({
      leadId: enrollment.leadId,
      updateCrm: (crm) =>
        recordOutboundEmail(
          crm,
          {
            subject: subj,
            body: bodyText,
            sentAt: write.result?.sentAt || new Date().toISOString(),
            cc: campaign.pipelineBulkOptions?.cc || undefined,
            aiGenerated: Boolean(campaign.pipelineBulkOptions?.useAiPerLead || campaign.pipelineBulkOptions?.aiGenerated),
            fromMailbox: write.result?.mailbox || user.email,
            toEmail: enrollment.contactEmail,
            gmailMessageId: write.result?.logPayload?.gmailMessageId || null,
            provider: write.result?.provider || 'bulk',
            campaignId: campaign.id,
          },
          { userId: user.id, userName: user.name }
        ),
    })
  }

  if (patches.length) {
    await patchPipelineEntriesCrmBatch(user, patches, {
      mirrorToSavedLeads: false,
      refreshIndex: false,
    })
  }
}
