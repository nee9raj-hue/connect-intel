import { createId } from './store.js'
import { appendActivity, addTask, normalizeExtendedCrm } from './crmWorkflow.js'
import { findPipelineEntry } from './pipelineAccess.js'
import { listTeamMembers } from './organizations.js'

const MAX_STEPS = 8

export function listSequencesForOrg(store, organizationId) {
  store.crmSequences = store.crmSequences || []
  return store.crmSequences
    .filter((s) => s.organizationId === organizationId)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
}

export function createSequence(store, organizationId, userId, payload) {
  const steps = normalizeSteps(payload.steps)
  if (!steps.length) throw new Error('Add at least one step')

  const seq = {
    id: createId('cseq'),
    organizationId,
    createdByUserId: userId,
    name: String(payload.name || 'Sales sequence').slice(0, 120),
    description: String(payload.description || '').slice(0, 500),
    status: 'active',
    steps,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  store.crmSequences = store.crmSequences || []
  store.crmSequences.push(seq)
  return seq
}

function normalizeSteps(steps) {
  if (!Array.isArray(steps)) return []
  return steps.slice(0, MAX_STEPS).map((s, i) => {
    const type = ['wait', 'task', 'note'].includes(s.type) ? s.type : 'task'
    return {
      stepIndex: i,
      type,
      waitDays: type === 'wait' ? Math.max(0, Math.min(30, Number(s.waitDays) || 1)) : 0,
      title: String(s.title || '').slice(0, 200),
      note: String(s.note || '').slice(0, 500),
      dueDays: Math.max(0, Math.min(14, Number(s.dueDays) || 1)),
    }
  })
}

export function enrollLeadInSequence(store, user, { sequenceId, leadId }) {
  const seq = (store.crmSequences || []).find((s) => s.id === sequenceId)
  if (!seq || seq.status !== 'active') throw new Error('Sequence not found')

  const entry = findPipelineEntry(store, user, leadId)
  if (!entry) throw new Error('Lead not in your pipeline')

  const existing = (store.crmSequenceEnrollments || []).find(
    (e) => e.leadId === leadId && e.sequenceId === sequenceId && e.status === 'active'
  )
  if (existing) throw new Error('Lead is already enrolled in this sequence')

  const enrollment = {
    id: createId('cenr'),
    sequenceId,
    organizationId: seq.organizationId,
    leadId,
    enrolledByUserId: user.id,
    currentStepIndex: 0,
    status: 'active',
    nextDueAt: new Date().toISOString(),
    enrolledAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedSteps: 0,
  }

  store.crmSequenceEnrollments = store.crmSequenceEnrollments || []
  store.crmSequenceEnrollments.push(enrollment)

  entry.crm = appendActivity(normalizeExtendedCrm(entry.crm), {
    type: 'note',
    summary: `Enrolled in sequence: ${seq.name}`,
    userId: user.id,
    userName: user.name || user.email,
    meta: { sequenceId: seq.id, enrollmentId: enrollment.id },
  })

  return { enrollment, sequence: seq }
}

function advanceEnrollment(store, enrollment, seq, entry, actorUserId) {
  const steps = seq.steps || []
  if (enrollment.currentStepIndex >= steps.length) {
    enrollment.status = 'completed'
    enrollment.completedAt = new Date().toISOString()
    enrollment.updatedAt = enrollment.completedAt
    entry.crm = appendActivity(normalizeExtendedCrm(entry.crm), {
      type: 'note',
      summary: `Completed sequence: ${seq.name}`,
      userId: actorUserId || 'system',
      userName: 'Automation',
      meta: { sequenceId: seq.id },
    })
    return
  }

  const step = steps[enrollment.currentStepIndex]
  const userId = actorUserId || enrollment.enrolledByUserId
  let crm = normalizeExtendedCrm(entry.crm)

  if (step.type === 'wait') {
    enrollment.currentStepIndex += 1
    enrollment.completedSteps += 1
    enrollment.nextDueAt = new Date(
      Date.now() + (step.waitDays || 1) * 86400000
    ).toISOString()
    enrollment.updatedAt = new Date().toISOString()
    return
  }

  if (step.type === 'task') {
    const dueAt = new Date(Date.now() + (step.dueDays || 1) * 86400000).toISOString()
    const result = addTask(crm, {
      title: step.title || `Sequence: ${seq.name}`,
      dueAt,
      assignedToUserId: entry.assignedToUserId || userId,
      createdByUserId: userId,
      createdByName: 'Sequence',
    })
    crm = result.crm
  } else if (step.type === 'note') {
    crm = appendActivity(crm, {
      type: 'note',
      summary: step.note || step.title || `Sequence step ${enrollment.currentStepIndex + 1}`,
      userId,
      userName: 'Sequence',
      meta: { sequenceId: seq.id, stepIndex: enrollment.currentStepIndex },
    })
  }

  entry.crm = crm
  enrollment.currentStepIndex += 1
  enrollment.completedSteps += 1
  enrollment.nextDueAt = new Date().toISOString()
  enrollment.updatedAt = new Date().toISOString()

  if (enrollment.currentStepIndex >= steps.length) {
    enrollment.status = 'completed'
    enrollment.completedAt = enrollment.updatedAt
  }
}

export function processDueSequenceEnrollments(store, organizationId) {
  const now = Date.now()
  const enrollments = (store.crmSequenceEnrollments || []).filter(
    (e) =>
      e.status === 'active' &&
      e.nextDueAt &&
      new Date(e.nextDueAt).getTime() <= now &&
      (!organizationId || e.organizationId === organizationId)
  )

  let processed = 0
  for (const enrollment of enrollments.slice(0, 40)) {
    const seq = (store.crmSequences || []).find((s) => s.id === enrollment.sequenceId)
    if (!seq || seq.status !== 'active') {
      enrollment.status = 'cancelled'
      continue
    }

    const entry = store.savedLeads.find(
      (e) =>
        e.lead?.id === enrollment.leadId &&
        e.organizationId === enrollment.organizationId
    )
    if (!entry) {
      enrollment.status = 'cancelled'
      continue
    }

    const before = enrollment.currentStepIndex
    advanceEnrollment(store, enrollment, seq, entry, enrollment.enrolledByUserId)
    if (enrollment.status === 'completed') {
      void import('../automationTriggers.js').then(({ fireAutomationTrigger }) =>
        fireAutomationTrigger({
          type: 'sequence_completed',
          leadId: enrollment.leadId,
          organizationId: enrollment.organizationId,
          createdByUserId: enrollment.enrolledByUserId,
          meta: { sequenceId: enrollment.sequenceId },
        })
      )
    }
    if (enrollment.currentStepIndex > before || enrollment.status === 'completed') processed += 1
  }

  return { processed, due: enrollments.length }
}

export function listEnrollmentsForLead(store, leadId) {
  return (store.crmSequenceEnrollments || []).filter((e) => e.leadId === leadId && e.status === 'active')
}

export function defaultSequenceTemplate() {
  return {
    name: 'Standard follow-up',
    steps: [
      { type: 'task', title: 'First outreach call', dueDays: 0 },
      { type: 'wait', waitDays: 2 },
      { type: 'task', title: 'Follow-up email', dueDays: 0 },
      { type: 'wait', waitDays: 3 },
      { type: 'note', note: 'If no reply, try WhatsApp or alternate contact' },
    ],
  }
}
