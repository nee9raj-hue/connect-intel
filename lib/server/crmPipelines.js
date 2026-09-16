import { getOrgCrmSettings } from './crmWorkflowRules.js'
import {
  defaultPipelineStages,
  migrateOrgPipelineStages,
  normalizeCrmLeadStatus,
} from '../crmLeadStatuses.js'

export { defaultPipelineStages }

export function defaultOrgPipelines() {
  return [
    {
      id: 'default',
      name: 'Sales pipeline',
      isDefault: true,
      stages: defaultPipelineStages(),
    },
  ]
}

export function getOrgPipelines(store, organizationId) {
  const settings = getOrgCrmSettings(store, organizationId)
  const pipelines = settings.pipelines
  if (Array.isArray(pipelines) && pipelines.length) {
    return pipelines.map((p) => ({
      ...p,
      stages: migrateOrgPipelineStages(p.stages),
    }))
  }
  return defaultOrgPipelines()
}

export function getDefaultPipelineId(store, organizationId) {
  const pipelines = getOrgPipelines(store, organizationId)
  return pipelines.find((p) => p.isDefault)?.id || pipelines[0]?.id || 'default'
}

export function getPipelineById(store, organizationId, pipelineId) {
  const pipelines = getOrgPipelines(store, organizationId)
  return pipelines.find((p) => p.id === pipelineId) || pipelines[0]
}

export function getPipelineStages(store, organizationId, pipelineId) {
  const pipe = getPipelineById(store, organizationId, pipelineId)
  return pipe?.stages?.length ? pipe.stages : defaultPipelineStages()
}

export function isValidPipelineStatus(store, organizationId, pipelineId, status) {
  const id = normalizeCrmLeadStatus(status)
  return getPipelineStages(store, organizationId, pipelineId).some((s) => s.id === id || s.id === status)
}

export function normalizePipelinePatch(pipelines) {
  if (!Array.isArray(pipelines) || !pipelines.length) return defaultOrgPipelines()
  return pipelines.slice(0, 8).map((p, idx) => ({
    id: String(p.id || `pipe_${idx}`).slice(0, 40),
    name: String(p.name || `Pipeline ${idx + 1}`).slice(0, 80),
    isDefault: Boolean(p.isDefault) || idx === 0,
    stages: migrateOrgPipelineStages(p.stages || defaultPipelineStages())
      .slice(0, 20)
      .map((s) => ({
        id: String(s.id || 'unqualified').slice(0, 40),
        label: String(s.label || s.id || 'Stage').slice(0, 60),
        color: String(s.color || 'slate').slice(0, 20),
        hint: String(s.hint || '').slice(0, 160),
      })),
  }))
}
