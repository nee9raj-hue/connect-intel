/**
 * Next Best Sales Action (NBSA) — active sales partner, not Q&A bot.
 */

export function buildNBSA({ plan, result, leadContext, companyCard, companies, discoveryMeta, entities }) {
  const category = plan?.intentCategory || plan?.salesIntent?.category
  const newCompanies = (companies || []).filter((c) => !c.inCrm && !c.leadId)
  const inCrmCount = (companies || []).filter((c) => c.inCrm || c.leadId).length

  if (category === 'person_discovery') {
    const top = result?.people?.[0]
    if (top?.linkedin) {
      return 'Save this contact to CRM and draft a personalized intro email referencing their role.'
    }
    return 'I could search directors or leadership pages on the company website if the founder is not public on LinkedIn.'
  }

  if (companies?.length && newCompanies.length > 0) {
    const n = newCompanies.length
    return `**${n}** new prospect${n === 1 ? '' : 's'} aren't in CRM yet. I can help you add the top matches, find decision makers, and draft outreach emails.`
  }

  if (companies?.length && inCrmCount > 0) {
    return `${inCrmCount} match${inCrmCount === 1 ? '' : 'es'} already in CRM — open those records first to avoid duplicate outreach.`
  }

  if (companyCard?.leadId && leadContext) {
    if (leadContext.overdueFollowUp) {
      return 'Follow-up looks overdue. I recommend reaching out this week — I can draft the email and schedule a task.'
    }
    if (leadContext.openDeals > 0) {
      return `There ${leadContext.openDeals === 1 ? 'is' : 'are'} **${leadContext.openDeals}** open deal(s). Consider a check-in email or meeting to move the stage forward.`
    }
    return 'Draft a tailored follow-up email using this lead\'s company and pipeline history.'
  }

  if (companyCard && !companyCard.leadId) {
    return `**${companyCard.name || companyCard.company}** isn't in CRM yet. Add it, assign an owner, and create a follow-up task.`
  }

  if (category === 'crm_follow_up' && result?.crmResults?.length) {
    return 'Work through overdue follow-ups first — call or email the top lead, then mark tasks done in Pipeline.'
  }

  if (category === 'lead_generation' && discoveryMeta?.total > 20) {
    return 'Narrow by export market or city to prioritize outreach — e.g. "only USA" or "only Delhi NCR".'
  }

  if (plan?.intents?.draftEmail && !leadContext) {
    return 'Open a lead record first — I will use company, industry, and history to draft the email.'
  }

  return 'Tell me the next company or lead you want to work on — I will check CRM first, then enrich from public sources.'
}

export function nbsaActions({ nbsa, plan, companies, companyCard, leadContext }) {
  const actions = []
  const topNew = (companies || []).find((c) => !c.inCrm && !c.leadId)

  if (topNew) {
    actions.push({
      type: 'create_lead',
      label: 'Add top prospect',
      payload: {
        company: topNew.company || topNew.name,
        website: topNew.website || '',
        industry: topNew.industry || '',
        city: topNew.city || '',
        state: topNew.state || '',
      },
    })
  }

  if (companyCard?.leadId || leadContext?.id) {
    const id = companyCard?.leadId || leadContext?.id
    actions.push({
      type: 'navigate',
      panel: 'pipeline',
      leadId: id,
      leadTab: 'email',
      label: 'Draft email',
    })
  }

  if (companies?.length > 3) {
    actions.push({ type: 'navigate', panel: 'bulk-email', label: 'Email campaign' })
  }

  return actions.slice(0, 3)
}
