/**
 * Platform service contracts (ports).
 * Business logic depends on these shapes — never on vendor SDKs.
 *
 * @typedef {object} DatabasePort
 * @property {() => string} provider
 * @property {(sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>} query
 * @property {(collections: string[] | null) => Promise<object>} readStore
 * @property {(store: object, collections: string[]) => Promise<void>} writeCollections
 * @property {() => Promise<boolean>} ping
 *
 * @typedef {object} AuthPort
 * @property {() => string} provider
 * @property {(req: object) => Promise<object|null>} resolveSessionUser
 *
 * @typedef {object} CachePort
 * @property {() => string} provider
 * @property {(key: string, options?: object) => Promise<{ value: unknown, stale: boolean }>} get
 * @property {(key: string, value: unknown, options?: object) => Promise<void>} set
 * @property {(key: string) => Promise<void>} invalidate
 *
 * @typedef {object} EmailPort
 * @property {() => string} provider
 * @property {(payload: object) => Promise<object>} send
 * @property {(user: object, org: object, campaign?: object) => string} resolveProvider
 *
 * @typedef {object} SearchPort
 * @property {() => string} provider
 * @property {(query: object) => Promise<object>} searchLeads
 * @property {() => Promise<{ ok: boolean }>} ping
 *
 * @typedef {object} StoragePort
 * @property {() => string} provider
 * @property {(key: string, data: Buffer|Uint8Array, options?: object) => Promise<{ url: string }>} put
 * @property {(key: string) => Promise<Buffer|null>} get
 * @property {(key: string) => Promise<void>} delete
 *
 * @typedef {object} JobsPort
 * @property {() => string} provider
 * @property {(name: string, payload?: object) => Promise<{ jobId: string|null }>} enqueue
 * @property {(name: string, payload?: object) => Promise<object>} runNow
 *
 * @typedef {object} AiPort
 * @property {() => string} provider
 * @property {(task: string, input: object) => Promise<object>} run
 * @property {(prompt: string, options?: object) => Promise<string|null>} generateText
 */

export const PLATFORM_CONTRACT_VERSION = '2.0.0'
