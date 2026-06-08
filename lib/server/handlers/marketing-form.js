import { readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, sendJson } from '../http.js'
import { resolveOrgRole } from '../organizations.js'
import { normalizeFields } from '../../marketingFormSchema.js'
import {
  buildMarketingFormPageHtml,
  prefillFromQuery,
} from '../marketingFormPage.js'
import {
  processMarketingFormSubmission,
  publicFormErrorMessage,
} from '../marketingFormSubmit.js'

function findFormBySlug(store, slug) {
  return (store.marketingForms || []).find((f) => f.slug === slug)
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const slug = String(req.query?.slug || '').trim()
  if (!slug) {
    return sendJson(res, 400, { error: 'slug is required' })
  }

  const store = await readStore()
  const form = findFormBySlug(store, slug)
  if (!form) {
    if (req.method === 'GET') {
      res.statusCode = 404
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      return res.end('<!DOCTYPE html><html><body><p>Form not found.</p></body></html>')
    }
    return sendJson(res, 404, { error: 'Form not found' })
  }

  const action = `/api/marketing/form?slug=${encodeURIComponent(slug)}`
  const prefill = prefillFromQuery(req.query)

  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.end(buildMarketingFormPageHtml(form, { action, prefill }))
  }

  if (req.method === 'POST') {
    const body = getBody(req)
    const owner =
      (store.users || []).find((u) => {
        if (form.organizationId) return u.organizationId === form.organizationId && u.isOrgAdmin
        return u.id === form.createdByUserId
      }) || (store.users || []).find((u) => u.id === form.createdByUserId)

    if (!owner) {
      return renderFormError(res, form, action, prefill, 'We could not save your response. Please try again in a moment.')
    }

    const fields = normalizeFields(form.fields)
    for (const field of fields) {
      if (field.type === 'section' || !field.required) continue
      const val = body[field.id]
      if (field.type === 'checkbox') {
        const arr = Array.isArray(val) ? val : val ? [val] : []
        if (!arr.length) {
          return renderFormError(res, form, action, prefill, `${field.label} is required`)
        }
      } else if (!String(val ?? '').trim()) {
        return renderFormError(res, form, action, prefill, `${field.label} is required`)
      }
    }

    const { accountType } = resolveOrgRole(owner, store)
    const organizationId =
      accountType === 'company' && owner.organizationId ? owner.organizationId : null

    let submitLeadId = null
    try {
      await updateStore((draft) => {
        const liveForm = findFormBySlug(draft, slug)
        if (!liveForm) throw new Error('Form not found')
        const result = processMarketingFormSubmission(draft, {
          form: liveForm,
          owner,
          organizationId,
          body,
        })
        submitLeadId = result?.leadId || result?.entry?.lead?.id || null
        return draft
      })
      if (submitLeadId) {
        const { fireAutomationTrigger } = await import('../automationTriggers.js')
        await fireAutomationTrigger({
          type: 'form_submitted',
          leadId: submitLeadId,
          organizationId,
          createdByUserId: owner.id,
          meta: { formId: form.id },
        })
      }
    } catch (error) {
      const wantsJson = req.headers.accept?.includes('application/json')
      const publicMsg = publicFormErrorMessage(error)
      if (wantsJson) {
        return sendJson(res, 400, { error: publicMsg })
      }
      return renderFormError(res, form, action, prefill, publicMsg)
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.end(
      buildMarketingFormPageHtml(form, {
        success: true,
        successMessage:
          form.successMessage ||
          "Thank you — we've received your details. Our team will follow up shortly.",
      })
    )
  }

  res.setHeader('Allow', 'GET, POST')
  return sendJson(res, 405, { error: 'Method not allowed' })
}

function renderFormError(res, form, action, prefill, message) {
  res.statusCode = 400
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  return res.end(
    buildMarketingFormPageHtml(form, {
      action,
      prefill,
      error: message,
    })
  )
}
