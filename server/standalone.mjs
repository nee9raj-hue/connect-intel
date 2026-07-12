#!/usr/bin/env node
/**
 * Standalone Node HTTP server — cloud-agnostic hosting (Docker, Railway, Oracle, Hetzner).
 * Serves built frontend from site/ and API via the same handler as Vercel.
 *
 *   npm run build && npm run server
 *   HOST_PROVIDER=docker npm run server
 */

import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync, createReadStream } from 'node:fs'
import { dirname, join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import apiHandler from '../api/index.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SITE_DIR = join(ROOT, 'site')
const PORT = Number(process.env.PORT) || 3000
const HOST = process.env.HOST || '0.0.0.0'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch {
        resolve({ raw })
      }
    })
  })
}

function createVercelResponse(nodeRes) {
  const state = { statusCode: 200, headers: {} }
  return {
    status(code) {
      state.statusCode = code
      return this
    },
    setHeader(key, value) {
      state.headers[key] = value
    },
    json(payload) {
      const body = JSON.stringify(payload)
      nodeRes.writeHead(state.statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        ...state.headers,
      })
      nodeRes.end(body)
    },
    end(body = '') {
      nodeRes.writeHead(state.statusCode, state.headers)
      nodeRes.end(body)
    },
    get statusCode() {
      return state.statusCode
    },
    get headers() {
      return state.headers
    },
  }
}

async function serveStatic(pathname, nodeRes) {
  const safe = pathname.replace(/\.\./g, '').replace(/^\/+/, '') || 'index.html'
  let filePath = join(SITE_DIR, safe)
  if (pathname.endsWith('/')) filePath = join(SITE_DIR, 'index.html')
  if (!existsSync(filePath) && !extname(filePath)) {
    filePath = join(SITE_DIR, 'index.html')
  }
  if (!existsSync(filePath)) {
    nodeRes.writeHead(404)
    nodeRes.end('Not found')
    return
  }
  const ext = extname(filePath)
  const type = MIME[ext] || 'application/octet-stream'
  nodeRes.writeHead(200, { 'Content-Type': type })
  createReadStream(filePath).pipe(nodeRes)
}

async function handleRequest(nodeReq, nodeRes) {
  const url = new URL(nodeReq.url || '/', `http://${nodeReq.headers.host || 'localhost'}`)
  const pathname = url.pathname

  if (pathname.startsWith('/api')) {
    const pathKey = pathname.replace(/^\/api\/?/, '').replace(/\/$/, '')
    const query = Object.fromEntries(url.searchParams.entries())
    const body = nodeReq.method === 'GET' || nodeReq.method === 'HEAD' ? {} : await readBody(nodeReq)
    const req = {
      method: nodeReq.method,
      url: nodeReq.url,
      headers: nodeReq.headers,
      query: { ...query, path: pathKey },
      body,
    }
    const res = createVercelResponse(nodeRes)
    try {
      await apiHandler(req, res)
    } catch (error) {
      console.error('API error:', error)
      if (!nodeRes.headersSent) {
        nodeRes.writeHead(500, { 'Content-Type': 'application/json' })
        nodeRes.end(JSON.stringify({ error: error?.message || 'Server error' }))
      }
    }
    return
  }

  if (pathname.startsWith('/uploads/')) {
    const key = pathname.slice('/uploads/'.length)
    const filePath = join(ROOT, 'data', 'uploads', key)
    if (existsSync(filePath)) {
      const ext = extname(filePath)
      nodeRes.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
      createReadStream(filePath).pipe(nodeRes)
      return
    }
  }

  await serveStatic(pathname, nodeRes)
}

if (!existsSync(SITE_DIR)) {
  console.error('site/ not found — run: npm run build')
  process.exit(1)
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((err) => {
    console.error(err)
    if (!res.headersSent) {
      res.writeHead(500)
      res.end('Internal error')
    }
  })
})

server.listen(PORT, HOST, () => {
  console.log(`Connect Intel standalone server`)
  console.log(`  http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`)
  console.log(`  HOST_PROVIDER=${process.env.HOST_PROVIDER || 'node'}`)
  console.log(`  DATABASE_PROVIDER=${process.env.DATABASE_PROVIDER || '(auto)'}`)
})
