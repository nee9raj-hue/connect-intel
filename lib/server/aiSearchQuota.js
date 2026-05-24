import { FREE_AI_DISCOVERY_SEARCHES } from './config.js'
import { updateStore } from './store.js'

export function getAiDiscoverySearchesLeft(user) {
  if (user?.role === 'admin') return FREE_AI_DISCOVERY_SEARCHES
  const left = user?.aiDiscoverySearchesLeft
  if (typeof left === 'number') return Math.max(0, left)
  return FREE_AI_DISCOVERY_SEARCHES
}

export async function consumeAiDiscoverySearch(user) {
  const before = getAiDiscoverySearchesLeft(user)
  if (before <= 0) {
    throw new Error(
      'No AI discovery searches left. Recharge your credit wallet to run more live AI searches.'
    )
  }

  await updateStore((store) => {
    const entry = store.users.find((u) => u.id === user.id)
    if (entry) {
      entry.aiDiscoverySearchesLeft = Math.max(0, getAiDiscoverySearchesLeft(entry) - 1)
    }
    return store
  })

  return before - 1
}
