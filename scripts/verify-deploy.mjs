#!/usr/bin/env node
/**
 * Pre-deploy checks — catch missing assets/modules before production.
 * Usage: npm run prod:verify
 */

import { existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = new Set(process.argv.slice(2))
const skipBuild = args.has('--skip-build')
const serverOnly = args.has('--server-only')

const REQUIRED_FILES = [
  'lib/server/slackOAuth.js',
  'lib/server/handlers/chithi.js',
  'frontend/public/phone-call-icon.png',
  'vercel.json',
  'frontend/vite.config.js',
]

const SERVER_IMPORTS = [
  'lib/server/handlers/chithi.js',
  'lib/server/handlers/marketing-lists.js',
  'lib/server/handlers/marketing-campaigns.js',
  'lib/server/handlers/crm-activity-log.js',
  'lib/server/handlers/crm-team-dashboard.js',
]

function fail(msg) {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

function ok(msg) {
  console.log(`✓ ${msg}`)
}

if (!serverOnly) {
  for (const rel of REQUIRED_FILES) {
    const path = join(ROOT, rel)
    if (!existsSync(path)) fail(`Missing required file: ${rel}`)
    ok(`Found ${rel}`)
  }
}

if (!skipBuild && !serverOnly) {
  console.log('\nBuilding frontend…')
  execSync('npm run build --prefix frontend', {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, NODE_OPTIONS: '--disable-warning=DEP0040' },
  })
  ok('Frontend build')
}

if (!skipBuild || serverOnly) {
  console.log('\nLoading server handlers…')
  for (const rel of SERVER_IMPORTS) {
    const path = join(ROOT, rel)
    try {
      await import(pathToFileURL(path).href)
      ok(`Import ${rel}`)
    } catch (err) {
      fail(`${rel}: ${err.message}`)
    }
  }
}

console.log('\nAll pre-deploy checks passed.')
