import { requireUser } from '../auth.js'
import { createId, readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'

function listSearches(store, userId) {
  return (Array.isArray(store.searches) ? store.searches : [])
    .filter((entry) => entry.userId === userId)
    .sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime())
    .map((entry) => ({
      id: entry.id,
      filters: entry.filters,
      count: entry.count,
      total: entry.total,
      at: entry.at,
      provider: entry.provider,
    }))
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const user = await requireUser(req, res)
  if (!user) return

  if (req.method === 'GET') {
    const store = await readStore({ only: ['searches'] })
    return sendJson(res, 200, { history: listSearches(store, user.id) })
  }

  if (req.method === 'POST') {
    const body = getBody(req)
    const entry = body.entry

    if (!entry?.filters) {
      return sendJson(res, 400, { error: 'Search entry is required' })
    }

    const store = await updateStore((draft) => {
      draft.searches.push({
        id: createId('search'),
        userId: user.id,
        filters: entry.filters,
        count: entry.count ?? 0,
        total: entry.total ?? 0,
        provider: entry.provider || 'unknown',
        at: entry.at || new Date().toISOString(),
      })

      const userSearches = draft.searches.filter((item) => item.userId === user.id)
      if (userSearches.length > 50) {
        const removable = userSearches
          .sort((left, right) => new Date(left.at).getTime() - new Date(right.at).getTime())
          .slice(0, userSearches.length - 50)
          .map((item) => item.id)
        draft.searches = draft.searches.filter((item) => !removable.includes(item.id))
      }

      return draft
    })

    return sendJson(res, 200, { history: listSearches(store, user.id) })
  }

  return methodNotAllowed(res, ['GET', 'POST'])
}

