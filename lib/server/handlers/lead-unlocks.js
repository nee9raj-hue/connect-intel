import { refreshSessionCookie, requireUser } from '../auth.js'
import { enrichApolloPerson } from '../apollo.js'
import { LEAD_FIELD_UNLOCK_PRICE_PAISE } from '../config.js'
import { getUnlockableFields, getUnlockedFields, shapeLeadForViewer } from '../search.js'
import { createId, readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'

function buildUserPayload(user) {
  return {
    ...user,
    creditBalanceRupees: Number(((user.creditsPaise || 0) / 100).toFixed(2)),
  }
}

function mergeUnlockedFields(existing, field) {
  const set = new Set(existing || [])
  set.add(field)
  return [...set]
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  const user = await requireUser(req, res)
  if (!user) return

  const body = getBody(req)
  const lead = body.lead
  const field = String(body.field || '').toLowerCase()

  if (!lead?.id) {
    return sendJson(res, 400, { error: 'Lead payload is required' })
  }

  const allowedFields = ['email', 'phone']
  if (!field || !allowedFields.includes(field)) {
    return sendJson(res, 400, { error: 'Specify field as "email" or "phone"' })
  }

  const unlockableFields = getUnlockableFields(lead)
  if (!unlockableFields.includes(field)) {
    return sendJson(res, 400, { error: `This result has no ${field} to reveal` })
  }

  try {
    const store = await readStore()
    const already = getUnlockedFields(store, user.id, lead.id)
    if (already.includes(field)) {
      const snapshot = store.leadUnlocks.find((e) => e.userId === user.id && e.leadId === lead.id)?.leadSnapshot
      const base = snapshot?.id ? snapshot : lead
      return sendJson(res, 200, {
        lead: shapeLeadForViewer(base, store, user, Number.MAX_SAFE_INTEGER),
        user: buildUserPayload(user),
        field,
        alreadyUnlocked: true,
      })
    }

    const creditsPaise = user.creditsPaise ?? 0
    if (creditsPaise < LEAD_FIELD_UNLOCK_PRICE_PAISE) {
      return sendJson(res, 402, {
        error: 'Not enough credits. Recharge your wallet to reveal email (₹1) or phone (₹1).',
        creditsPaise,
        requiredPaise: LEAD_FIELD_UNLOCK_PRICE_PAISE,
      })
    }

    let enrichedLead = lead
    if (lead.source === 'apollo' && lead.apolloId) {
      enrichedLead = await enrichApolloPerson(lead)
    }

    const updatedUser = {
      ...user,
      creditsPaise: creditsPaise - LEAD_FIELD_UNLOCK_PRICE_PAISE,
    }
    refreshSessionCookie(res, updatedUser)

    try {
      await updateStore((freshStore) => {
        const currentUser = freshStore.users.find((entry) => entry.id === user.id)
        if (currentUser) {
          currentUser.creditsPaise = updatedUser.creditsPaise
        }

        const existing = freshStore.leadUnlocks.find(
          (entry) => entry.userId === user.id && entry.leadId === lead.id
        )

        if (existing) {
          existing.fields = mergeUnlockedFields(existing.fields, field)
          existing.leadSnapshot = { ...existing.leadSnapshot, ...enrichedLead }
          existing.pricePaise = (existing.pricePaise || 0) + LEAD_FIELD_UNLOCK_PRICE_PAISE
        } else {
          freshStore.leadUnlocks.push({
            id: createId('unlock'),
            userId: user.id,
            leadId: lead.id,
            fields: [field],
            leadSnapshot: enrichedLead,
            pricePaise: LEAD_FIELD_UNLOCK_PRICE_PAISE,
            unlockedAt: new Date().toISOString(),
          })
        }

        freshStore.creditLedger.push({
          id: createId('credit'),
          userId: user.id,
          kind: 'debit',
          amountPaise: -LEAD_FIELD_UNLOCK_PRICE_PAISE,
          description: `Revealed ${field} for ${lead.company || lead.id}`,
          createdAt: new Date().toISOString(),
        })
        return freshStore
      })
    } catch {
      // Ephemeral store on Vercel — unlock still succeeds via JWT + enriched lead.
    }

    const nextStore = await readStore()
    return sendJson(res, 200, {
      lead: shapeLeadForViewer(enrichedLead, nextStore, updatedUser, Number.MAX_SAFE_INTEGER),
      user: buildUserPayload(updatedUser),
      field,
    })
  } catch (error) {
    return sendJson(res, 400, { error: error.message || 'Reveal failed' })
  }
}
