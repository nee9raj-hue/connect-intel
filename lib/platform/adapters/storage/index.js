import { mkdir, readFile, unlink, writeFile, access } from 'node:fs/promises'
import { constants } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createS3CompatibleStorageAdapter, isS3CompatibleConfigured, resolveS3CompatibleConfig } from './s3Compatible.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..')

function localRoot() {
  return process.env.STORAGE_LOCAL_PATH || join(ROOT, 'data', 'uploads')
}

async function ensureDir(filePath) {
  await mkdir(dirname(filePath), { recursive: true })
}

function safeKey(key) {
  return String(key).replace(/\.\./g, '').replace(/^\/+/, '')
}

/** Local filesystem storage — default MVP / Docker path. */
export function createLocalStorageAdapter() {
  return {
    provider: 'local',
    configured: true,
    getConfig() {
      return { provider: 'local', root: localRoot(), configured: true }
    },
    async put(key, data, { contentType = 'application/octet-stream' } = {}) {
      const safe = safeKey(key)
      const filePath = join(localRoot(), safe)
      await ensureDir(filePath)
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)
      await writeFile(filePath, buf)
      return { url: `/uploads/${safe}`, key: safe, contentType, bytes: buf.length }
    },
    async get(key) {
      const filePath = join(localRoot(), safeKey(key))
      try {
        return await readFile(filePath)
      } catch {
        return null
      }
    },
    async delete(key) {
      const filePath = join(localRoot(), safeKey(key))
      try {
        await unlink(filePath)
      } catch {
        /* ignore */
      }
    },
    async exists(key) {
      try {
        await access(join(localRoot(), safeKey(key)), constants.F_OK)
        return true
      } catch {
        return false
      }
    },
    getPublicUrl(key) {
      return `/uploads/${safeKey(key)}`
    },
    async ping() {
      try {
        await mkdir(localRoot(), { recursive: true })
        return { ok: true, configured: true, provider: 'local' }
      } catch (error) {
        return { ok: false, configured: true, error: error?.message || String(error) }
      }
    },
  }
}

/**
 * STORAGE_PROVIDER:
 *   local (default) | s3 | r2 | minio | supabase-storage
 *
 * Production stays on `local` until explicitly flipped — Vercel ephemeral FS is fine
 * for unused storage; use R2/S3 when workspace file blobs need durability.
 */
export function createStorageAdapter(provider) {
  switch (String(provider || 'local').toLowerCase()) {
    case 's3':
    case 'r2':
    case 'minio':
    case 'supabase-storage':
      return createS3CompatibleStorageAdapter(provider)
    case 'local':
    default:
      return createLocalStorageAdapter()
  }
}

export { createS3CompatibleStorageAdapter, isS3CompatibleConfigured, resolveS3CompatibleConfig }
