export function buildCampaignAnalytics(campaign, enrollments = [], events = []) {
  const byStatus = {
    active: 0,
    completed: 0,
    paused: 0,
    unsubscribed: 0,
    failed: 0,
  }

  for (const e of enrollments) {
    if (e.status === 'active') byStatus.active += 1
    else if (e.status === 'completed') byStatus.completed += 1
    else if (e.status === 'paused') byStatus.paused += 1
    else if (e.status === 'unsubscribed') byStatus.unsubscribed += 1
    else if (e.lastError) byStatus.failed += 1
  }

  const campaignEvents = events.filter((ev) => ev.campaignId === campaign.id)
  const clickEvents = campaignEvents.filter((ev) => ev.type === 'click')
  const openEvents = campaignEvents.filter((ev) => ev.type === 'open')
  const uniqueClickLeads = new Set(clickEvents.map((e) => e.leadId).filter(Boolean)).size
  const uniqueOpenLeads = new Set(openEvents.map((e) => e.leadId).filter(Boolean)).size
  const sent = campaign.stats?.sent || enrollments.reduce((n, e) => n + (e.sentCount || 0), 0)
  const enrolled = campaign.stats?.enrolled || enrollments.length

  let bounced = 0
  for (const e of enrollments) {
    const err = String(e.lastError || '').toLowerCase()
    if (/bounce|bounced|undeliver|550|554|mailbox/.test(err)) bounced += 1
  }

  return {
    enrolled,
    sent,
    completed: byStatus.completed,
    active: byStatus.active,
    unsubscribed: byStatus.unsubscribed,
    failed: campaign.stats?.failed || byStatus.failed,
    bounced,
    clicks: clickEvents.length,
    opens: openEvents.length,
    uniqueClicks: uniqueClickLeads,
    uniqueOpens: uniqueOpenLeads,
    clickRate: sent > 0 ? Math.round((uniqueClickLeads / sent) * 100) : 0,
    openRate: sent > 0 ? Math.round((uniqueOpenLeads / sent) * 100) : 0,
    bounceRate: sent > 0 ? Math.round((bounced / sent) * 100) : 0,
  }
}

export function marketingSummary(campaigns = [], events = []) {
  let sent = 0
  let enrolled = 0
  let clicks = 0
  let opens = 0
  for (const c of campaigns) {
    const stats = c.analytics || c.stats || {}
    sent += stats.sent || 0
    enrolled += stats.enrolled || 0
    clicks += stats.clicks || 0
    opens += stats.opens || 0
  }
  if (!clicks && !opens && events.length) {
    clicks = events.filter((e) => e.type === 'click').length
    opens = events.filter((e) => e.type === 'open').length
  }
  return { campaigns: campaigns.length, enrolled, sent, clicks, opens }
}
