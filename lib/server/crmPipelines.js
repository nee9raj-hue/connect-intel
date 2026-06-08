import { getOrgCrmSettings } from './crmWorkflowRules.js'

/** Default sales pipeline stages (mirrors frontend CRM_STATUSES). */
export function defaultPipelineStages() {
  return [
    { id: 'new', label: 'New', color: 'slate' },
    { id: 'contacted', label: 'Contacted', color: 'blue' },
    { id: 'follow_up', label: 'Follow up', color: 'amber' },
    { id: 'replied', label: 'Replied', color: 'violet' },
    { id: 'won', label: 'Won', color: 'orange' },
    { id: 'active_trading', label: 'Active trading', color: 'teal' },
    { id: 'lost', label: 'Lost', color: 'gray' },
  ]
}

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
  if (Array.isArray(pipelines) && pipelines.length) return pipelines
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
  return getPipelineStages(store, organizationId, pipelineId).some((s) => s.id === status)
}

export function normalizePipelinePatch(pipelines) {
  if (!Array.isArray(pipelines) || !pipelines.length) return defaultOrgPipelines()
  return pipelines.slice(0, 8).map((p, idx) => ({
    id: String(p.id || `pipe_${idx}`).slice(0, 40),
    name: String(p.name || `Pipeline ${idx + 1}`).slice(0, 80),
    isDefault: Boolean(p.isDefault) || idx === 0,
    stages: (p.stages || defaultPipelineStages()).slice(0, 20).map((s) => ({
      id: String(s.id || 'new').slice(0, 40),
      label: String(s.label || s.id || 'Stage').slice(0, 60),
      color: String(s.color || 'slate').slice(0, 20),
    })),
  }))
}
