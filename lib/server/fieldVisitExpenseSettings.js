import {
  DEFAULT_FIELD_VISIT_EXPENSE_SETTINGS,
  mergeFieldVisitExpenseSettings,
} from '../fieldVisitExpenses.js'
import { getOrganization } from './organizations.js'

export { DEFAULT_FIELD_VISIT_EXPENSE_SETTINGS, mergeFieldVisitExpenseSettings }

export function getOrgFieldVisitExpenseSettings(store, organizationId) {
  const org = getOrganization(store, organizationId)
  return mergeFieldVisitExpenseSettings(org?.fieldVisitExpenseSettings)
}

export function setOrgFieldVisitExpenseSettings(store, organizationId, patch = {}) {
  const org = getOrganization(store, organizationId)
  if (!org) throw new Error('Organization not found')
  const current = mergeFieldVisitExpenseSettings(org.fieldVisitExpenseSettings)
  const next = mergeFieldVisitExpenseSettings({ ...current, ...patch })
  org.fieldVisitExpenseSettings = next
  return next
}
