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
  const eventKey = (e) => e.leadId || e.enrollmentId || null
  const uniqueClickLeads = new Set(clickEvents.map(eventKey).filter(Boolean)).size
  const uniqueOpenLeads = new Set(openEvents.map(eventKey).filter(Boolean)).size
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

/** Fast overview using campaign.stats only (no enrollment blob read). */
export function buildCampaignAnalyticsFromStats(campaign, events = []) {
  const campaignEvents = events.filter((ev) => ev.campaignId === campaign.id)
  const clickEvents = campaignEvents.filter((ev) => ev.type === 'click')
  const openEvents = campaignEvents.filter((ev) => ev.type === 'open')
  const eventKey = (e) => e.leadId || e.enrollmentId || null
  const uniqueClickLeads = new Set(clickEvents.map(eventKey).filter(Boolean)).size
  const uniqueOpenLeads = new Set(openEvents.map(eventKey).filter(Boolean)).size
  const stats = campaign.stats || {}
  const sent = stats.sent || 0
  const enrolled = stats.enrolled || 0

  return {
    enrolled,
    sent,
    completed: stats.completed || 0,
    active: stats.active || 0,
    unsubscribed: stats.unsubscribed || 0,
    failed: stats.failed || 0,
    bounced: stats.bounced || 0,
    clicks: clickEvents.length,
    opens: openEvents.length,
    uniqueClicks: uniqueClickLeads,
    uniqueOpens: uniqueOpenLeads,
    clickRate: sent > 0 ? Math.round((uniqueClickLeads / sent) * 100) : 0,
    openRate: sent > 0 ? Math.round((uniqueOpenLeads / sent) * 100) : 0,
    bounceRate: sent > 0 ? Math.round((stats.bounced / sent) * 100) : 0,
  }
}

function isBounceError(error) {
  const e = String(error || '').toLowerCase()
  return /bounce|bounced|undeliver|invalid recipient|mailbox unavailable|mailbox not found|550 |554 |550-5|user unknown|address rejected|does not exist|no such user/.test(
    e
  )
}

/** Roll up opens/clicks/sent from enrollments + events (matches detail campaign report). */
export function summarizeEnrollmentEngagement(rows = [], shardSent = 0, campaignEvents = []) {
  const eventsByLead = new Map()
  const eventsByEnrollment = new Map()
  for (const ev of campaignEvents) {
    if (ev.leadId) {
      if (!eventsByLead.has(ev.leadId)) eventsByLead.set(ev.leadId, [])
      eventsByLead.get(ev.leadId).push(ev)
    }
    if (ev.enrollmentId) {
      if (!eventsByEnrollment.has(ev.enrollmentId)) eventsByEnrollment.set(ev.enrollmentId, [])
      eventsByEnrollment.get(ev.enrollmentId).push(ev)
    }
  }

  let recipientsSent = 0
  let delivered = 0
  let bounced = 0
  let failed = 0
  let uniqueOpens = 0
  let uniqueClicks = 0
  let totalOpens = 0
  let totalClicks = 0
  let totalSends = 0
  let unsubscribed = 0

  for (const e of rows) {
    totalSends += e.sentCount || 0
    if (e.status === 'unsubscribed') unsubscribed += 1
    if (isBounceError(e.lastError)) {
      bounced += 1
    } else if (e.lastError || e.status === 'failed') {
      failed += 1
    }

    const hasSend =
      (e.sentCount || 0) > 0 || Boolean(e.lastSendMessageId || e.lastSentAt)
    if (hasSend) {
      recipientsSent += 1
      if (!isBounceError(e.lastError)) delivered += 1
    }

    const leadEvents =
      eventsByLead.get(e.leadId) || eventsByEnrollment.get(e.id) || []
    const openEvents = leadEvents.filter((x) => x.type === 'open')
    const clickEvents = leadEvents.filter((x) => x.type === 'click')
    const opens = Math.max(e.openCount || 0, openEvents.length)
    const clicks = Math.max(e.clickCount || 0, clickEvents.length)
    totalOpens += opens
    totalClicks += clicks
    if (opens > 0) uniqueOpens += 1
    if (clicks > 0) uniqueClicks += 1
  }

  const sent = Math.max(Number(shardSent) || 0, totalSends, recipientsSent)
  const sentForRates = delivered > 0 ? delivered : recipientsSent || sent

  return {
    sent,
    recipientsSent,
    totalSends,
    delivered,
    bounced,
    failed,
    uniqueOpens,
    uniqueClicks,
    unsubscribed,
    opens: totalOpens,
    clicks: totalClicks,
    openRate: sentForRates > 0 ? Math.round((uniqueOpens / sentForRates) * 100) : 0,
    clickRate: sentForRates > 0 ? Math.round((uniqueClicks / sentForRates) * 100) : 0,
    bounceRate: sent > 0 ? Math.round((bounced / sent) * 100) : 0,
    unsubscribeRate: sentForRates > 0 ? Math.round((unsubscribed / sentForRates) * 100) : 0,
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
    clicks += stats.uniqueClicks ?? stats.clicks ?? 0
    opens += stats.uniqueOpens ?? stats.opens ?? 0
  }
  if (!clicks && !opens && events.length) {
    clicks = events.filter((e) => e.type === 'click').length
    opens = events.filter((e) => e.type === 'open').length
  }
  return { campaigns: campaigns.length, enrolled, sent, clicks, opens }
}
