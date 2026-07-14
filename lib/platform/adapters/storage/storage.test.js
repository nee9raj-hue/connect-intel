import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createLocalStorageAdapter,
  createStorageAdapter,
  resolveS3CompatibleConfig,
  isS3CompatibleConfigured,
  createS3CompatibleStorageAdapter,
} from './index.js'

describe('storage adapters (P4)', () => {
  let tempRoot
  let savedLocalPath

  before(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'ci-storage-'))
    savedLocalPath = process.env.STORAGE_LOCAL_PATH
    process.env.STORAGE_LOCAL_PATH = tempRoot
  })

  after(async () => {
    if (savedLocalPath === undefined) delete process.env.STORAGE_LOCAL_PATH
    else process.env.STORAGE_LOCAL_PATH = savedLocalPath
    if (tempRoot) await rm(tempRoot, { recursive: true, force: true })
  })

  it('local put/get/delete/exists round-trip', async () => {
    const storage = createLocalStorageAdapter()
    assert.equal(storage.provider, 'local')
    const put = await storage.put('orgs/o1/hello.txt', Buffer.from('hello-p4'), {
      contentType: 'text/plain',
    })
    assert.equal(put.bytes, 8)
    assert.ok(put.url.includes('orgs/o1/hello.txt'))
    assert.equal(await storage.exists('orgs/o1/hello.txt'), true)
    const got = await storage.get('orgs/o1/hello.txt')
    assert.equal(got.toString('utf8'), 'hello-p4')
    await storage.delete('orgs/o1/hello.txt')
    assert.equal(await storage.exists('orgs/o1/hello.txt'), false)
    assert.equal(await storage.get('orgs/o1/hello.txt'), null)
    const ping = await storage.ping()
    assert.equal(ping.ok, true)
  })

  it('createStorageAdapter routes s3/r2/minio to S3-compatible adapter', () => {
    assert.equal(createStorageAdapter('s3').provider, 's3')
    assert.equal(createStorageAdapter('r2').provider, 'r2')
    assert.equal(createStorageAdapter('minio').provider, 'minio')
    assert.equal(createStorageAdapter('supabase-storage').provider, 'supabase-storage')
    assert.equal(createStorageAdapter('local').provider, 'local')
  })

  it('resolveS3CompatibleConfig builds R2 endpoint from account id', () => {
    const saved = {
      R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
      STORAGE_BUCKET: process.env.STORAGE_BUCKET,
      STORAGE_ACCESS_KEY_ID: process.env.STORAGE_ACCESS_KEY_ID,
      STORAGE_SECRET_ACCESS_KEY: process.env.STORAGE_SECRET_ACCESS_KEY,
      STORAGE_ENDPOINT: process.env.STORAGE_ENDPOINT,
    }
    process.env.R2_ACCOUNT_ID = 'acct123'
    process.env.STORAGE_BUCKET = 'ci-uploads'
    process.env.STORAGE_ACCESS_KEY_ID = 'key'
    process.env.STORAGE_SECRET_ACCESS_KEY = 'secret'
    delete process.env.STORAGE_ENDPOINT

    const cfg = resolveS3CompatibleConfig('r2')
    assert.equal(cfg.endpoint, 'https://acct123.r2.cloudflarestorage.com')
    assert.equal(cfg.region, 'auto')
    assert.equal(cfg.forcePathStyle, true)
    assert.equal(isS3CompatibleConfigured(cfg), true)

    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  })

  it('s3 adapter reports not_configured without credentials', async () => {
    const saved = {
      STORAGE_BUCKET: process.env.STORAGE_BUCKET,
      STORAGE_ACCESS_KEY_ID: process.env.STORAGE_ACCESS_KEY_ID,
      STORAGE_SECRET_ACCESS_KEY: process.env.STORAGE_SECRET_ACCESS_KEY,
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
      R2_BUCKET: process.env.R2_BUCKET,
      S3_BUCKET: process.env.S3_BUCKET,
    }
    for (const k of Object.keys(saved)) delete process.env[k]

    const storage = createS3CompatibleStorageAdapter('s3')
    assert.equal(storage.configured, false)
    const ping = await storage.ping()
    assert.equal(ping.ok, false)
    assert.equal(ping.error, 'not_configured')

    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  })

  it('public base url wins for returned object urls', () => {
    const storage = createS3CompatibleStorageAdapter('r2', {
      bucket: 'b',
      accessKeyId: 'k',
      secretAccessKey: 's',
      region: 'auto',
      endpoint: 'https://acct.r2.cloudflarestorage.com',
      forcePathStyle: true,
      publicBaseUrl: 'https://cdn.example.com',
      provider: 'r2',
    })
    assert.equal(storage.getPublicUrl('a/b.png'), 'https://cdn.example.com/a/b.png')
  })
})
