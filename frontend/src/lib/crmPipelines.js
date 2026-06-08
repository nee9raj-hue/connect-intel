import { CRM_STATUSES } from './crmConstants'

const COLOR_MAP = {
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  violet: 'bg-violet-50 text-violet-700 border-violet-200',
  orange: 'bg-[#fff4ee] text-[#FF773D] border-[#ffd4b8]',
  teal: 'bg-teal-50 text-teal-800 border-teal-200',
  gray: 'bg-gray-100 text-gray-500 border-gray-200',
}

export function stageToColumn(stage) {
  const fallback = CRM_STATUSES.find((s) => s.id === stage.id)
  return {
    id: stage.id,
    label: stage.label || fallback?.label || stage.id,
    color: COLOR_MAP[stage.color] || fallback?.color || COLOR_MAP.slate,
  }
}

export function pipelinesFromSettings(settings) {
  if (settings?.pipelines?.length) return settings.pipelines
  return [
    {
      id: 'default',
      name: 'Sales pipeline',
      isDefault: true,
      stages: CRM_STATUSES.map((s) => ({ id: s.id, label: s.label, color: 'slate' })),
    },
  ]
}

export function getDefaultPipelineId(settings) {
  const pipes = pipelinesFromSettings(settings)
  return pipes.find((p) => p.isDefault)?.id || pipes[0]?.id || 'default'
}

export function getPipelineStages(settings, pipelineId) {
  const pipes = pipelinesFromSettings(settings)
  const pipe = pipes.find((p) => p.id === pipelineId) || pipes[0]
  return (pipe?.stages || []).map(stageToColumn)
}

export function getVisiblePipelineColumnsForSettings(user, settings, pipelineId) {
  if (!user || user.accountType !== 'company') return CRM_STATUSES
  const stages = getPipelineStages(settings, pipelineId)
  if (!stages.length) return CRM_STATUSES

  if (user.isOrgAdmin || user.orgRole === 'org_admin' || user.isPlatformAdmin) return stages

  const role = user.pipelineRole || 'member'
  if (role === 'sales') {
    const early = new Set(['new', 'contacted', 'follow_up'])
    return stages.filter((col) => early.has(col.id))
  }
  return stages
}
