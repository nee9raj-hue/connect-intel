import { createId, readStore, updateStore, updateStorePartial } from './store.js'
import { marketingScopeKey } from './marketingAccess.js'
import { buildOrgUserResponse } from './organizations.js'
import { writeCampaignSendShard } from './marketingCampaignSendShard.js'

function stripHtml(text) {
  return String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchFeedItems(feedUrl) {
  const res = await fetch(feedUrl, {
    headers: { 'User-Agent': 'ConnectIntel-Marketing/1.0' },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`Feed HTTP ${res.status}`)
  const xml = await res.text()

  const items = []
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || []
  for (const block of itemBlocks.slice(0, 20)) {
    const title = stripHtml(block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])
    const link = stripHtml(block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1])
    const desc = stripHtml(
      block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ||
        block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)?.[1]
    )
    if (title) items.push({ title, link, description: desc.slice(0, 500) })
  }
  return items
}

export async function createMarketingFeed(user, payload) {
  const now = new Date().toISOString()
  const feed = {
    id: createId('mfeed'),
    ...marketingScopeKey(user),
    name: String(payload.name || '').trim().slice(0, 120),
    feedUrl: String(payload.feedUrl || '').trim(),
    listId: payload.listId || null,
    segmentId: payload.segmentId || null,
    templateId: payload.templateId || null,
    status: 'active',
    lastFetchedAt: null,
    lastItemTitle: null,
    createdByUserId: user.id,
    createdAt: now,
    updatedAt: now,
  }
  if (!feed.name || !feed.feedUrl) throw new Error('Feed name and URL are required')

  await updateStore((draft) => {
    draft.marketingFeeds = draft.marketingFeeds || []
    draft.marketingFeeds.push(feed)
    return draft
  })
  return feed
}

export async function processRssFeeds({ limit = 5 } = {}) {
  const store = await readStore({
    only: [
      'marketingFeeds',
      'marketingCampaigns',
      'marketingLists',
      'marketingSegments',
      'users',
      'organizations',
      'organizationMemberships',
    ],
  })

  const feeds = (store.marketingFeeds || []).filter((f) => f.status === 'active').slice(0, limit)
  let created = 0
  const errors = []

  for (const feed of feeds) {
    try {
      const items = await fetchFeedItems(feed.feedUrl)
      const latest = items[0]
      if (!latest || latest.title === feed.lastItemTitle) continue

      const owner = store.users.find((u) => u.id === feed.createdByUserId)
      if (!owner) continue
      const user = buildOrgUserResponse(owner, store)
      const now = new Date().toISOString()

      const campaign = {
        id: createId('mcamp'),
        ...marketingScopeKey(user),
        name: `RSS: ${latest.title}`.slice(0, 120),
        type: 'one_shot',
        channel: 'email',
        campaignType: 'rss',
        listId: feed.listId,
        segmentId: feed.segmentId,
        templateId: feed.templateId,
        subject: latest.title.slice(0, 500),
        body: `${latest.description || ''}\n\n${latest.link || ''}`.trim(),
        status: 'scheduled',
        sendMode: 'scheduled',
        scheduledAt: now,
        rssFeedId: feed.id,
        stats: { enrolled: 0, sent: 0, failed: 0, unsubscribed: 0 },
        createdByUserId: user.id,
        createdAt: now,
        updatedAt: now,
      }

      await updateStorePartial(['marketingCampaigns', 'marketingFeeds'], (draft) => {
        draft.marketingCampaigns = draft.marketingCampaigns || []
        draft.marketingCampaigns.push(campaign)
        const row = (draft.marketingFeeds || []).find((f) => f.id === feed.id)
        if (row) {
          row.lastFetchedAt = now
          row.lastItemTitle = latest.title
          row.updatedAt = now
        }
        return draft
      })

      await writeCampaignSendShard(store, user, campaign)
      created += 1
    } catch (err) {
      errors.push(`${feed.id}: ${err.message}`)
    }
  }

  return { created, errors: errors.slice(0, 5) }
}
