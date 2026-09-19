/**
 * Create public.lead_tag_master and backfill from store_collections organizations.leadTags.
 *
 *   node scripts/apply-lead-tag-master.mjs
 */
import fs from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'
import { slugifyName } from '../lib/server/orgLeadTags.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SQL_PATH = join(ROOT, 'supabase/migrations/20260919120000_lead_tag_master.sql')

function parseEnv(path) {
  const env = {}
  try {
    for (const line of fs.readFileSync(path, 'utf8').split('\n')) {
      if (!line || line.startsWith('#') || !line.includes('=')) continue
      const i = line.indexOf('=')
      env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    /* optional */
  }
  return env
}

function pgClient() {
  const deploy = parseEnv(join(ROOT, '.env.deploy.local'))
  const railway = parseEnv(join(ROOT, '.env.railway.secrets'))
  const ref = String(railway.SUPABASE_URL || '')
    .replace(/^https:\/\//, '')
    .split('.')[0]
  return new Client({
    host: deploy.SUPABASE_DB_HOST,
    port: 5432,
    user: `postgres.${ref}`,
    password: deploy.SUPABASE_DB_PASSWORD,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  })
}

async function main() {
  const sql = fs.readFileSync(SQL_PATH, 'utf8')
  const client = pgClient()
  await client.connect()
  try {
    await client.query(sql)
    const orgs = await client.query(`select json from store_collections where collection = 'organizations'`)
    const list = orgs.rows[0]?.json
    if (!Array.isArray(list)) {
      console.log(JSON.stringify({ table: 'lead_tag_master', backfill: 0, reason: 'no organizations json' }))
      return
    }

    let upserted = 0
    let skipped = 0
    const skippedReasons = []
    let orgsWithTags = 0
    for (const org of list) {
      const orgId = org?.id
      const tags = Array.isArray(org?.leadTags) ? org.leadTags : []
      if (!orgId || !tags.length) continue
      orgsWithTags += 1
      for (const tag of tags) {
        const id = String(tag?.id || '').trim()
        const name = String(tag?.name || '').trim()
        if (!id || !name) continue
        try {
          await client.query(
            `insert into public.lead_tag_master (
               id, organization_id, name, name_slug, color, team_id, source, engagement_slug, created_by_user_id, created_at
             ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
             on conflict (id) do update set
               name = excluded.name,
               color = excluded.color,
               team_id = excluded.team_id,
               source = excluded.source,
               engagement_slug = excluded.engagement_slug,
               created_by_user_id = coalesce(public.lead_tag_master.created_by_user_id, excluded.created_by_user_id)`,
            [
              id,
              String(orgId),
              name,
              slugifyName(name),
              tag.color || null,
              tag.teamId || null,
              tag.source || null,
              tag.engagementSlug || null,
              tag.createdByUserId || null,
              tag.createdAt || new Date().toISOString(),
            ]
          )
          upserted += 1
        } catch (error) {
          skipped += 1
          skippedReasons.push(`${orgId}:${id}:${error.message}`)
        }
      }
    }

    const count = await client.query(
      `select organization_id, count(*)::int as n from public.lead_tag_master group by organization_id order by n desc`
    )
    console.log(
      JSON.stringify({
        table: 'lead_tag_master',
        orgsWithTags,
        upserted,
        skipped,
        skippedReasons: skippedReasons.slice(0, 12),
        byOrg: count.rows,
      })
    )
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
