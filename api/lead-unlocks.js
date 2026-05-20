import { requireUser } from '../lib/server/auth.js'
import { LEAD_UNLOCK_PRICE_PAISE } from '../lib/server/config.js'
import { shapeLeadForViewer } from '../lib/server/search.js'
import { createId, updateStore } from '../lib/server/store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../lib/server/http.js'

function getUnlockableFields(lead) {
  const fields = []
  if (lead.email) fields.push('email')
  if (lead.phone) fields.push('phone')
  if (lead.linkedin) fields.push('linkedin')
  return fields
}

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
    await updateStore((store) => {
      const currentUser = store.users.find((entry) => entry.id === user.id)
      if (!currentUser) {
        throw new Error('User not found')
      }

      const alreadyUnlocked = store.leadUnlocks.find(
        (entry) => entry.userId === user.id && entry.leadId === lead.id
      )

      if (alreadyUnlocked) {
        const snapshot = alreadyUnlocked.leadSnapshot
        if (!snapshot?.id) {
          throw new Error('Stored unlock record is invalid')
        }
        responsePayload = {
          lead: shapeLeadForViewer(snapshot, store, currentUser, Number.MAX_SAFE_INTEGER),
          user: {
            ...currentUser,
            creditsPaise: currentUser.creditsPaise ?? 0,
          },
        }
        return store
      }

      const creditsPaise = currentUser.creditsPaise ?? 0
      if (creditsPaise < LEAD_UNLOCK_PRICE_PAISE) {
        throw new Error('Not enough credits to unlock this lead')
      }

      currentUser.creditsPaise = creditsPaise - LEAD_UNLOCK_PRICE_PAISE
      store.leadUnlocks.push({
        id: createId('unlock'),
        userId: user.id,
        leadId: lead.id,
        leadSnapshot: lead,
        pricePaise: LEAD_UNLOCK_PRICE_PAISE,
        unlockedAt: new Date().toISOString(),
      })
      store.creditLedger.push({
        id: createId('credit'),
        userId: user.id,
        kind: 'debit',
        amountPaise: -LEAD_UNLOCK_PRICE_PAISE,
        description: `Unlocked lead ${lead.id}`,
        createdAt: new Date().toISOString(),
      })

      responsePayload = {
        lead: shapeLeadForViewer(lead, store, currentUser, Number.MAX_SAFE_INTEGER),
        user: {
          ...currentUser,
          creditsPaise: currentUser.creditsPaise,
        },
      }

      return store
    })
  } catch (error) {
    return sendJson(res, 400, { error: error.message || 'Unlock failed' })
  }

  return sendJson(res, 200, responsePayload)
}
