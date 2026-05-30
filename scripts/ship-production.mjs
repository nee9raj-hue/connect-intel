#!/usr/bin/env node
/**
 * Pre-flight before pushing to production (main → Vercel).
 * Does not push or deploy — run prod:log after Vercel is Ready.
 *
 * Usage: npm run prod:ship
 */

import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function run(cmd) {
  execSync(cmd, { cwd: ROOT, stdio: 'inherit' })
}

function git(cmd) {
  return execSync(`git ${cmd}`, { cwd: ROOT, encoding: 'utf8' }).trim()
}

console.log('Connect Intel — production pre-flight\n')

run('node scripts/verify-deploy.mjs')

const branch = git('branch --show-current')
if (branch !== 'main') {
  console.warn(`\n⚠ You are on branch "${branch}", not main. Production deploys from main.`)
}

const dirty = git('status --porcelain')
const allowedUntracked = new Set([
  'capacitor.config.json',
  'docs/PLAY_STORE.md',
  'frontend/src/lib/nativeGoogleAuth.js',
  'android/',
])
const lines = dirty.split('\n').filter(Boolean)
const blocking = lines.filter((line) => {
  const path = line.slice(3).trim()
  if (line.startsWith('??')) {
    if (allowedUntracked.has(path)) return false
    if (path.startsWith('android/')) return false
  }
  return true
})

if (blocking.length) {
  console.log('\nUncommitted changes (review before ship):')
  blocking.forEach((l) => console.log(`  ${l}`))
} else {
  console.log('\n✓ Working tree clean (or only ignored local Android/Capacitor files).')
}

const head = git('rev-parse --short HEAD')
console.log(`
Next steps:
  1. Preview locally first (desktop + mobile):
       npm run dev          → http://localhost:5173  (+ npx vercel dev for API)
       npm run prod:preview → http://127.0.0.1:4173  (production build)
  2. Commit anything that should ship (if not already).
  3. git push origin main
  4. Wait for GitHub CI ✓ and Vercel Production Ready (~30s).
  5. Open the Vercel preview URL from the deploy (optional smoke test).
  6. npm run prod:log
  7. Optional known-good tag: npm run prod:tag -- ${head}

Rollback: docs/PRODUCTION_LOG.md or npm run prod:rollback -- <commit>
Checklist: docs/RELEASE_CHECKLIST.md
`)
