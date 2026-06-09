import { getOrgCrmSettings } from './crmWorkflowRules.js'
import {
  evaluateBulkAssign,
  evaluatePipelineEmail,
  getUsagePolicies,
} from '../resourceProtection.js'

export function policiesForUser(store, user) {
  const settings =
    user?.organizationId && store
      ? getOrgCrmSettings(store, user.organizationId)
      : null
  return getUsagePolicies(settings)
}

/** @returns {{ status: number, body: object } | null} */
export function pipelineEmailGuard(count, user, store) {
  const verdict = evaluatePipelineEmail(count, user, policiesForUser(store, user))
  if (verdict === 'allow') return null
  if (verdict === 'guide_marketing') {
    return {
      status: 400,
      body: {
        code: 'GUIDE_MARKETING_HUB',
        message:
          'For larger outreach, use Marketing Hub Campaigns for better tracking, deliverability, and reporting.',
      },
    }
  }
  return {
    status: 400,
    body: {
      code: 'LARGE_AUDIENCE_MARKETING',
      message: 'Large audience outreach is managed through Marketing Hub Campaigns.',
    },
  }
}

/** @returns {{ status: number, body: object } | null} */
export function bulkAssignGuard(count, user, store) {
  const verdict = evaluateBulkAssign(count, user, policiesForUser(store, user))
  if (verdict === 'allow') return null
  if (verdict === 'manager_required') {
    return {
      status: 403,
      body: {
        code: 'MANAGER_ASSIGN_REQUIRED',
        message:
          'Assigning this many leads works best with a manager or admin. Ask your team lead to help, or narrow your selection.',
      },
    }
  }
  return null
}

export function normalizeUsagePoliciesPatch(raw) {
  if (!raw || typeof raw !== 'object') return null
  const out = {}
  const num = (v, min, max, fallback) => {
    const n = Math.floor(Number(v))
    if (!Number.isFinite(n)) return fallback
    return Math.min(max, Math.max(min, n))
  }

  if (raw.pipelineEmail) {
    out.pipelineEmail = {
      allowMax: num(raw.pipelineEmail.allowMax, 1, 50, 10),
      guideMax: num(raw.pipelineEmail.guideMax, 11, 200, 50),
      blockAbove: num(raw.pipelineEmail.blockAbove, 51, 500, 50),
    }
  }
  if (raw.bulkAssign) {
    out.bulkAssign = {
      confirmAbove: num(raw.bulkAssign.confirmAbove, 1, 1000, 100),
      managerRequiredAbove: num(raw.bulkAssign.managerRequiredAbove, 101, 10_000, 500),
    }
  }
  if (raw.bulkEdit) {
    out.bulkEdit = { reviewAbove: num(raw.bulkEdit.reviewAbove, 1, 1000, 100) }
  }
  if (raw.export) {
    out.export = {
      instantMax: num(raw.export.instantMax, 1, 5000, 500),
      prepareMax: num(raw.export.prepareMax, 501, 50_000, 5000),
    }
  }
  if (raw.meetingsBulkMax != null) {
    out.meetingsBulkMax = num(raw.meetingsBulkMax, 1, 100, 25)
  }
  if (raw.searchDebounceMs != null) {
    out.searchDebounceMs = num(raw.searchDebounceMs, 200, 2000, 500)
  }
  if (raw.searchMinLength != null) {
    out.searchMinLength = num(raw.searchMinLength, 1, 5, 2)
  }
  if (raw.searchMaxResults != null) {
    out.searchMaxResults = num(raw.searchMaxResults, 10, 100, 50)
  }
  if (raw.dashboardRefreshMinMs != null) {
    out.dashboardRefreshMinMs = num(raw.dashboardRefreshMinMs, 15_000, 300_000, 60_000)
  }
  if (raw.timelineInitial != null) {
    out.timelineInitial = num(raw.timelineInitial, 5, 50, 20)
  }
  if (raw.notesAutosaveMs != null) {
    out.notesAutosaveMs = num(raw.notesAutosaveMs, 1000, 10_000, 3000)
  }
  if (raw.roleLimits && typeof raw.roleLimits === 'object') {
    out.roleLimits = {}
    for (const role of ['rep', 'manager', 'admin']) {
      const src = raw.roleLimits[role]
      if (!src || typeof src !== 'object') continue
      out.roleLimits[role] = {
        emailMax: num(src.emailMax, 1, 500, role === 'rep' ? 10 : role === 'manager' ? 50 : 200),
        exportMax: num(src.exportMax, 100, 100_000, role === 'rep' ? 500 : role === 'manager' ? 5000 : 10_000),
        bulkAssignMax: num(src.bulkAssignMax, 10, 10_000, role === 'rep' ? 100 : role === 'manager' ? 500 : 5000),
      }
    }
  }
  return Object.keys(out).length ? out : null
}
