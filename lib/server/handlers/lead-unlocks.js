import { refreshSessionCookie, requireUser } from '../auth.js'
import { enrichApolloPerson } from '../apollo.js'
import { LEAD_UNLOCK_PRICE_PAISE } from '../config.js'
import { getUnlockableFields, shapeLeadForViewer } from '../search.js'
import { createId, readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'

function buildUserPayload(user) {
  return {
    ...user,
    creditBalanceRupees: Number(((user.creditsPaise || 0) / 100).toFixed(2)),
  }
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

      return sendJson(res, 200, {
        lead: shapeLeadForViewer(snapshot, store, user, Number.MAX_SAFE_INTEGER),
        user: buildUserPayload(user),
      })
    }

    const creditsPaise = user.creditsPaise ?? 0
    if (creditsPaise < LEAD_UNLOCK_PRICE_PAISE) {
      return sendJson(res, 400, { error: 'Not enough credits to unlock this lead' })
    }

    let enrichedLead = lead
    if (lead.source === 'apollo' && lead.apolloId) {
      enrichedLead = await enrichApolloPerson(lead)
    }

    const updatedUser = {
      ...user,
      creditsPaise: creditsPaise - LEAD_UNLOCK_PRICE_PAISE,
    }
    refreshSessionCookie(res, updatedUser)

    try {
      await updateStore((freshStore) => {
        const currentUser = freshStore.users.find((entry) => entry.id === user.id)
        if (currentUser) {
          currentUser.creditsPaise = updatedUser.creditsPaise
        }

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
        return freshStore
      })
    } catch {
      // Ephemeral store on Vercel — unlock still succeeds via JWT + enriched lead.
    }

    return sendJson(res, 200, {
      lead: shapeLeadForViewer(enrichedLead, store, updatedUser, Number.MAX_SAFE_INTEGER),
      user: buildUserPayload(updatedUser),
    })
  } catch (error) {
    return sendJson(res, 400, { error: error.message || 'Unlock failed' })
  }
}
