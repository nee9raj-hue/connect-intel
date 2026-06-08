import { requireUser } from '../auth.js'
import { readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { enrichMarketingRows, requireMarketingUser } from '../marketingAccess.js'
import { buildOrgUserResponse } from '../organizations.js'
import { createMarketingFeed } from '../marketingRss.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const check = requireMarketingUser(sessionUser)
  if (!check.ok) return sendJson(res, 401, { error: check.error })

  const store = await readStore({
    only: ['marketingFeeds', 'users', 'organizations', 'organizationMemberships'],
  })
  const user = buildOrgUserResponse(store.users.find((u) => u.id === sessionUser.id) || sessionUser, store)

  if (req.method === 'GET') {
    const feeds = enrichMarketingRows(
      store,
      user,
      (store.marketingFeeds || []).filter(
        (f) =>
          f.organizationId === user.organizationId ||
          f.createdByUserId === user.id
      )
    )
    return sendJson(res, 200, { feeds })
  }

  if (req.method === 'POST') {
    try {
      const feed = await createMarketingFeed(user, getBody(req))
      return sendJson(res, 201, { feed })
    } catch (e) {
      return sendJson(res, 400, { error: e.message })
    }
  }

  if (req.method === 'DELETE') {
    const body = getBody(req)
    await updateStore((draft) => {
      draft.marketingFeeds = (draft.marketingFeeds || []).filter((f) => f.id !== body.id)
      return draft
    })
    return sendJson(res, 200, { ok: true })
  }

  return methodNotAllowed(res, ['GET', 'POST', 'DELETE'])
}
