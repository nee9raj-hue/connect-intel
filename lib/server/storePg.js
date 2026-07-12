/**
 * PostgreSQL document store — direct access to store_collections (no PostgREST).
 * P2 Infrastructure V2: cloud-agnostic JSON collections on any Postgres host.
 */

import { getPgPool } from './pgPool.js'

const READ_BATCH_SIZE = 6

const ENSURE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS store_collections (
  collection text PRIMARY KEY,
  json jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS store_collections_updated_at_idx ON store_collections (updated_at DESC);
`

let schemaReady = false

export async function ensureStorePgSchema() {
  if (schemaReady) return
  const pool = await getPgPool()
  await pool.query(ENSURE_SCHEMA_SQL)
  schemaReady = true
}

function normalizeJsonValue(value) {
  if (value == null) return []
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return []
    }
  }
  return value
}

/** Read named collections from Postgres store_collections. */
export async function readPostgresStorePartial(collectionNames) {
  await ensureStorePgSchema()
  const pool = await getPgPool()
  const names = [...new Set((collectionNames || []).map(String).filter(Boolean))]
  const partial = {}

  for (let i = 0; i < names.length; i += READ_BATCH_SIZE) {
    const chunk = names.slice(i, i + READ_BATCH_SIZE)
    const result = await pool.query(
      'SELECT collection, json FROM store_collections WHERE collection = ANY($1::text[])',
      [chunk]
    )
    for (const row of result.rows || []) {
      partial[row.collection] = normalizeJsonValue(row.json)
    }
  }
  return partial
}

export async function writePostgresCollections(snapshot, collectionNames) {
  await ensureStorePgSchema()
  const pool = await getPgPool()
  const names = [...new Set((collectionNames || []).map(String).filter(Boolean))]
  if (!names.length) return

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const collection of names) {
      const json = snapshot[collection] ?? []
      await client.query(
        `INSERT INTO store_collections (collection, json, updated_at)
         VALUES ($1, $2::jsonb, now())
         ON CONFLICT (collection)
         DO UPDATE SET json = EXCLUDED.json, updated_at = now()`,
        [collection, JSON.stringify(json)]
      )
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function upsertPostgresCollection(collection, json) {
  await writePostgresCollections({ [collection]: json }, [collection])
}

export async function pingPostgresStore() {
  await ensureStorePgSchema()
  const pool = await getPgPool()
  await pool.query('SELECT 1')
  return true
}

export function resetStorePgSchemaForTests() {
  schemaReady = false
}
