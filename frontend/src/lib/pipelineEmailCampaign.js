const STORAGE_KEY = 'ci.pipelineEmailCampaignId'

export function saveActivePipelineEmailCampaign(campaignId) {
  if (!campaignId) return
  try {
    sessionStorage.setItem(STORAGE_KEY, String(campaignId))
  } catch {
    // ignore
  }
}

export function readActivePipelineEmailCampaign() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) || null
  } catch {
    return null
  }
}

export function clearActivePipelineEmailCampaign(campaignId) {
  try {
    const current = sessionStorage.getItem(STORAGE_KEY)
    if (!campaignId || current === campaignId) sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
