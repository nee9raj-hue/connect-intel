import { requireUser } from '../lib/server/auth.js'
import { enrichApolloPerson } from '../lib/server/apollo.js'
import { LEAD_UNLOCK_PRICE_PAISE } from '../lib/server/config.js'
import { getUnlockableFields, shapeLeadForViewer } from '../lib/server/search.js'
import { createId, readStore, updateStore } from '../lib/server/store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../lib/server/http.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  const user = await requireUser(req, res)
  if (!user) return

  const body = getBody(req)
  const lead = body.lead

  if (!lead?.id) {
    return sendJson(res, 400, { error: 'Lead payload is required' })
  }

  const unlockableFields = getUnlockableFields(lead)
  if (!unlockableFields.length) {
    return sendJson(res, 400, { error: 'This result has no premium fields to unlock' })
  }

  let responsePayload = null

  try {
    const store = await readStore()
    const alreadyUnlocked = store.leadUnlocks.find(
      (entry) => entry.userId === user.id && entry.leadId === lead.id
    )

    if (alreadyUnlocked) {
      const snapshot = alreadyUnlocked.leadSnapshot
      if (!snapshot?.id) {
        return sendJson(res, 400, { error: 'Stored unlock record is invalid' })
      }

      const currentUser = store.users.find((entry) => entry.id === user.id)
      return sendJson(res, 200, {
        lead: shapeLeadForViewer(snapshot, store, currentUser, Number.MAX_SAFE_INTEGER),
        user: {
          ...currentUser,
          creditsPaise: currentUser?.creditsPaise ?? 0,
        },
      })
    }

    let enrichedLead = lead
    if (lead.source === 'apollo' && lead.apolloId) {
      enrichedLead = await enrichApolloPerson(lead)
    }

    await updateStore((freshStore) => {
      const currentUser = freshStore.users.find((entry) => entry.id === user.id)
      if (!currentUser) {
        throw new Error('User not found')
      }

      const creditsPaise = currentUser.creditsPaise ?? 0
      if (creditsPaise < LEAD_UNLOCK_PRICE_PAISE) {
        throw new Error('Not enough credits to unlock this lead')
      }

      currentUser.creditsPaise = creditsPaise - LEAD_UNLOCK_PRICE_PAISE
      freshStore.leadUnlocks.push({
        id: createId('unlock'),
        userId: user.id,
        leadId: lead.id,
        leadSnapshot: enrichedLead,
        pricePaise: LEAD_UNLOCK_PRICE_PAISE,
        unlockedAt: new Date().toISOString(),
      })
      freshStore.creditLedger.push({
        id: createId('credit'),
        userId: user.id,
        kind: 'debit',
        amountPaise: -LEAD_UNLOCK_PRICE_PAISE,
        description: `Unlocked lead ${lead.id}`,
        createdAt: new Date().toISOString(),
      })

      responsePayload = {
        lead: shapeLeadForViewer(enrichedLead, freshStore, currentUser, Number.MAX_SAFE_INTEGER),
        user: {
          ...currentUser,
          creditsPaise: currentUser.creditsPaise,
        },
      }

      return freshStore
    })
  } catch (error) {
    return sendJson(res, 400, { error: error.message || 'Unlock failed' })
  }

  return sendJson(res, 200, responsePayload)
}
