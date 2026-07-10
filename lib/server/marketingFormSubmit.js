import { createId } from './store.js'
import { applyCommercialEmailConsent } from '../../emailConsent.js'
import { appendActivity, normalizeExtendedCrm } from './crmWorkflow.js'
import {
  normalizeFields,
  submissionGrantsCommercialConsent,
  submissionHasRequiredConsent,
} from '../marketingFormSchema.js'
import { parseFormBody } from './marketingFormPage.js'
import {
  applyUtmAttribution,
  applyVisitorAttribution,
  linkVisitorToLeadEvents,
  parseUtmFromFormBody,
  parseVisitorIdFromFormBody,
} from './marketingSiteTracking.js'
import { addManualPipelineLead } from './manualPipelineLead.js'

const MAX_FORM_RESPONSES = 200

export function formatFormAnswers(form, body) {
  const fields = normalizeFields(form.fields)
  const answers = []
  for (const field of fields) {
    if (field.type === 'section') continue
    const raw = body[field.id]
    let value = ''
    if (field.type === 'checkbox') {
      const vals = Array.isArray(raw) ? raw : raw ? [raw] : []
      value = vals.map(String).filter(Boolean).join(', ')
    } else if (field.type === 'consent') {
      value = raw === 'on' || raw === true || raw === '1' ? 'Yes' : 'No'
    } else {
      value = String(raw ?? '').trim()
    }
    if (!value) continue
    answers.push({ fieldId: field.id, label: field.label, value: value.slice(0, 2000) })
  }
  return answers
}

export function answersToText(answers, formTitle) {
  const lines = answers.map((a) => `${a.label}: ${a.value}`)
  const header = formTitle ? `Form response — ${formTitle}` : 'Form response'
  return `${header}\n${lines.join('\n')}`
}

function findPipelineEntryForForm(store, { organizationId, ownerUserId, email, leadId }) {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  const contactId = String(leadId || '').trim()

  const inScope = (entry) => {
    if (organizationId) return entry.organizationId === organizationId
    return entry.userId === ownerUserId && !entry.organizationId
  }

  if (contactId) {
    const byId = store.savedLeads.find(
      (e) => inScope(e) && (e.lead?.id === contactId || e.contactId === contactId)
    )
    if (byId) return byId
  }

  if (!normalizedEmail) return null
  return (
    store.savedLeads.find(
      (e) => inScope(e) && e.lead?.email?.toLowerCase() === normalizedEmail
    ) || null
  )
}

/**
 * Record a marketing form submission. Existing pipeline contacts get an activity +
 * notes update — never a duplicate-lead error shown to the customer.
 */
export function processMarketingFormSubmission(store, { form, owner, organizationId, body }) {
  if (!submissionHasRequiredConsent(form, body)) {
    throw new Error('Please accept the email consent to continue.')
  }
  const grantsConsent = submissionGrantsCommercialConsent(form, body)
  const answers = formatFormAnswers(form, body)
  const pipelineFields = parseFormBody(form, body)
  const utm = parseUtmFromFormBody(body)
  const visitorId = parseVisitorIdFromFormBody(body)
  const email = String(pipelineFields.email || body.email || '').trim().toLowerCase()
  const leadHint = String(body._lead || body.leadId || '').trim()

  const existing = findPipelineEntryForForm(store, {
    organizationId,
    ownerUserId: owner.id,
    email,
    leadId: leadHint,
  })

  const submittedAt = new Date().toISOString()
  const responseRecord = {
    id: createId('fresp'),
    submittedAt,
    email: email || null,
    leadId: existing?.lead?.id || null,
    answers,
  }

  const liveForm = (store.marketingForms || []).find((f) => f.id === form.id)
  if (liveForm) {
    liveForm.submissions = (liveForm.submissions || 0) + 1
    liveForm.updatedAt = submittedAt
    liveForm.responses = [responseRecord, ...(liveForm.responses || [])].slice(0, MAX_FORM_RESPONSES)
  }

  if (existing) {
    const text = answersToText(answers, form.title || form.name)
    let crm = normalizeExtendedCrm(existing.crm)
    crm = appendActivity(crm, {
      type: 'form_response',
      summary: `Form submitted: ${form.title || form.name}`,
      userId: owner.id,
      userName: 'Web form',
      meta: {
        formId: form.id,
        formSlug: form.slug,
        formName: form.name,
        answers,
        email,
      },
    })
    if (text) {
      const prior = String(crm.notes || '').trim()
      crm.notes = prior ? `${prior}\n\n---\n${text}`.slice(0, 12000) : text.slice(0, 12000)
    }
    existing.crm = applyUtmAttribution(crm, utm)
    if (visitorId) {
      linkVisitorToLeadEvents(store, {
        organizationId,
        visitorId,
        leadId: existing.lead?.id,
      })
      existing.crm = applyVisitorAttribution(existing.crm, {
        visitorId,
        marketingEvents: store.marketingEvents,
        organizationId,
      })
    }
    if (grantsConsent) {
      existing.lead = applyCommercialEmailConsent(existing.lead || existing, {
        granted: true,
        source: 'marketing_form',
      })
    }
    return { mode: 'updated', entry: existing, leadId: existing.lead?.id }
  }

  addManualPipelineLead(store, {
    user: owner,
    organizationId,
    fields: {
      ...pipelineFields,
      source: 'marketing_form',
      ...(grantsConsent ? { commercialEmailOptIn: true } : {}),
    },
  })

  if (Object.keys(utm).length || visitorId) {
    const created = findPipelineEntryForForm(store, {
      organizationId,
      ownerUserId: owner.id,
      email,
      leadId: leadHint,
    })
    if (created) {
      if (Object.keys(utm).length) {
        created.crm = applyUtmAttribution(created.crm, utm)
      }
      if (visitorId && created.lead?.id) {
        linkVisitorToLeadEvents(store, {
          organizationId,
          visitorId,
          leadId: created.lead.id,
        })
        created.crm = applyVisitorAttribution(created.crm, {
          visitorId,
          marketingEvents: store.marketingEvents,
          organizationId,
        })
      }
    }
  }

  return { mode: 'created', email }
}

/** Never expose CRM/pipeline internals on the public form page. */
export function publicFormErrorMessage(error) {
  const msg = String(error?.message || '')
  if (!msg) return 'We could not save your response. Please try again in a moment.'
  if (/pipeline|already in your|duplicate|assignee is not/i.test(msg)) {
    return 'We could not save your response. Please try again in a moment.'
  }
  if (/required|enter at least|add an email|could not create lead/i.test(msg)) {
    return msg
  }
  return 'We could not save your response. Please try again in a moment.'
}
