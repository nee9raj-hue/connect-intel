import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..')
const DEFAULT_DIR = process.env.STORAGE_LOCAL_PATH || join(ROOT, 'data', 'uploads')

async function ensureDir(filePath) {
  await mkdir(dirname(filePath), { recursive: true })
}

/** Local filesystem storage — swap to S3/R2/MinIO via STORAGE_PROVIDER without business code changes. */
export function createLocalStorageAdapter() {
  return {
    provider: 'local',
    async put(key, data, { contentType = 'application/octet-stream' } = {}) {
      const safeKey = String(key).replace(/\.\./g, '').replace(/^\/+/, '')
      const filePath = join(DEFAULT_DIR, safeKey)
      await ensureDir(filePath)
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)
      await writeFile(filePath, buf)
      return { url: `/uploads/${safeKey}`, contentType, bytes: buf.length }
    },
    async get(key) {
      const safeKey = String(key).replace(/\.\./g, '').replace(/^\/+/, '')
      const filePath = join(DEFAULT_DIR, safeKey)
      try {
        return await readFile(filePath)
      } catch {
        return null
      }
    },
    async delete(key) {
      const safeKey = String(key).replace(/\.\./g, '').replace(/^\/+/, '')
      const filePath = join(DEFAULT_DIR, safeKey)
      try {
        await unlink(filePath)
      } catch {
        /* ignore */
      }
    },
  }
}

export function createStorageAdapter(provider) {
  switch (provider) {
    case 'local':
    default:
      return createLocalStorageAdapter()
  }
}
