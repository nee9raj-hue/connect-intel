#!/usr/bin/env node
/**
 * Production deployment log — sync from Vercel, list snapshots, rollback.
 *
 * Usage:
 *   node scripts/production-log.mjs sync      # refresh log from Vercel + git
 *   node scripts/production-log.mjs list      # print known production snapshots
 *   node scripts/production-log.mjs markdown  # rewrite docs/PRODUCTION_LOG.md
 *   node scripts/production-log.mjs rollback <commit|logId|preview-url>
 */

import { execSync, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const JSON_PATH = join(ROOT, 'docs/production-log.json')
const MD_PATH = join(ROOT, 'docs/PRODUCTION_LOG.md')
const PRODUCTION_DOMAIN = 'https://connectintel.net'
const VERCEL_PROJECT = 'connect-intel'
const MAX_ENTRIES = 80

function run(cmd, opts = {}) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts }).trim()
}

function readLog() {
  try {
    return JSON.parse(readFileSync(JSON_PATH, 'utf8'))
  } catch {
    return {
      productionDomain: PRODUCTION_DOMAIN,
      vercelProject: VERCEL_PROJECT,
      currentProductionCommit: null,
      entries: [],
    }
  }
}

function writeLog(data) {
  mkdirSync(dirname(JSON_PATH), { recursive: true })
  writeFileSync(JSON_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

function shortSha(sha) {
  return String(sha || '').slice(0, 7)
}

function firstLine(text) {
  return String(text || '')
    .split('\n')[0]
    .trim()
}

function formatIst(ms) {
  if (!ms) return '—'
  return new Date(ms).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function logIdFrom(ms, sha) {
  const d = new Date(ms)
  const pad = (n) => String(n).padStart(2, '0')
  const ist = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const stamp = `${ist.getFullYear()}${pad(ist.getMonth() + 1)}${pad(ist.getDate())}-${pad(ist.getHours())}${pad(ist.getMinutes())}`
  return `${stamp}-${shortSha(sha)}`
}

function fetchVercelDeployments() {
  const raw = run('vercel ls --format json -y')
  const parsed = JSON.parse(raw)
  const list = parsed.deployments || parsed
  if (!Array.isArray(list)) throw new Error('Unexpected vercel ls JSON shape')
  return list
    .filter((d) => d.target === 'production' && d.state === 'READY')
    .slice(0, MAX_ENTRIES)
}

function gitCommitTime(sha) {
  if (!sha) return null
  try {
    const iso = run(`git show -s --format=%cI ${sha}`)
    return Date.parse(iso)
  } catch {
    return null
  }
}

function syncLog() {
  const existing = readLog()
  const byCommit = new Map((existing.entries || []).map((e) => [e.commit, e]))
  const deployments = fetchVercelDeployments()
  const seenCommits = new Set()
  const uniqueDeployments = []
  for (const d of deployments) {
    const commit = shortSha(d.meta?.githubCommitSha)
    if (!commit || seenCommits.has(commit)) continue
    seenCommits.add(commit)
    uniqueDeployments.push(d)
  }

  const entries = uniqueDeployments.map((d, index) => {
    const shaFull = d.meta?.githubCommitSha || ''
    const commit = shortSha(shaFull)
    const deployedAt = d.ready || d.createdAt
    const prev = byCommit.get(commit) || {}
    const previewUrl = d.url.startsWith('http') ? d.url : `https://${d.url}`

    return {
      logId: prev.logId || logIdFrom(deployedAt, commit),
      commit,
      commitFull: shaFull || prev.commitFull || '',
      message: firstLine(d.meta?.githubCommitMessage) || prev.message || '(no message)',
      deployedAt: new Date(deployedAt).toISOString(),
      deployedAtIst: formatIst(deployedAt),
      committedAtIst: formatIst(gitCommitTime(shaFull) || prev.committedAtMs),
      vercelPreviewUrl: previewUrl,
      state: d.state,
      isCurrentProduction: index === 0,
      notes: prev.notes || '',
      rollbackCommand: `npm run prod:rollback -- ${commit}`,
    }
  })

  const data = {
    updatedAt: new Date().toISOString(),
    updatedAtIst: formatIst(Date.now()),
    productionDomain: PRODUCTION_DOMAIN,
    vercelProject: VERCEL_PROJECT,
    currentProductionCommit: entries[0]?.commit || null,
    entries,
  }

  writeLog(data)
  writeMarkdown(data)
  console.log(`Synced ${entries.length} production snapshot(s). Current: ${data.currentProductionCommit || '—'}`)
  console.log(`Log: docs/production-log.json`)
  console.log(`Guide: docs/PRODUCTION_LOG.md`)
  return data
}

function writeMarkdown(data) {
  const rollbackExample =
    (data.entries || []).find((e) => !e.isCurrentProduction)?.commit ||
    (data.entries || [])[1]?.commit ||
    'abc1234'

  const rows = (data.entries || [])
    .map((e) => {
      const current = e.isCurrentProduction ? ' **← LIVE**' : ''
      const notes = e.notes ? `\n  - Notes: ${e.notes}` : ''
      return `| ${e.deployedAtIst} | \`${e.commit}\` | ${e.message.replace(/\|/g, '\\|')} | [preview](${e.vercelPreviewUrl}) | \`${e.rollbackCommand}\` |${current}${notes}`
    })
    .join('\n')

  const md = `# Production deployment log

Connect Intel production runs on **Vercel** at [${PRODUCTION_DOMAIN.replace('https://', '')}](${PRODUCTION_DOMAIN}).

This file is the human-readable view of \`docs/production-log.json\`. After each production deploy, run:

\`\`\`bash
npm run prod:log
\`\`\`

That syncs Vercel deployments with git commits so you can **roll back** to any known good snapshot without guessing.

---

## Quick rollback

1. Find the row you want below (date/time + commit message).
2. Run the rollback command for that commit, for example:

\`\`\`bash
npm run prod:rollback -- ${rollbackExample}
\`\`\`

3. Wait until Vercel finishes (~30s). **connectintel.net** will serve that older build immediately.
4. Fix code on \`main\`, test locally, then deploy again when ready.

**Preview before rollback:** open the **preview** link in the table — that URL is the exact build for that commit (still hosted on Vercel).

**Dashboard:** [Vercel → connect-intel → Deployments](https://vercel.com/nee9raj-hues-projects/connect-intel)

---

## Current production

| Field | Value |
|-------|-------|
| Domain | ${data.productionDomain} |
| Commit | \`${data.currentProductionCommit || '—'}\` |
| Log updated (IST) | ${data.updatedAtIst || '—'} |

---

## Snapshots (newest first)

| Deployed (IST) | Commit | Message | Preview | Rollback command |
|----------------|--------|---------|---------|------------------|
${rows || '| — | — | Run `npm run prod:log` to populate | — | — |'}

---

## After a bad deploy

1. **Rollback first** — restore the site for users (\`npm run prod:rollback -- <commit>\`).
2. Add a note in \`docs/production-log.json\` on that entry's \`notes\` field (optional), e.g. \`"Known good baseline before marketing UI change"\`.
3. Run \`npm run prod:log\` again to refresh this table.
4. Fix forward on a new commit; do not force-push \`main\` unless you know what you are doing.

---

## Commands

| Command | Purpose |
|---------|---------|
| \`npm run prod:log\` | Sync log from Vercel + regenerate this file |
| \`npm run prod:log:list\` | Print snapshots in the terminal |
| \`npm run prod:rollback -- <commit>\` | Point production domain at that deployment |
| \`npm run prod:ship\` | Pre-flight checks before pushing to \`main\` |
| \`npm run prod:verify\` | Build + verify critical files only |
| \`npm run prod:tag -- [commit]\` | Git tag for a known-good production commit |

---

*Auto-generated by \`scripts/production-log.mjs markdown\`. Edit notes in \`docs/production-log.json\` only.*
`

  writeFileSync(MD_PATH, md, 'utf8')
}

function listLog() {
  const data = readLog()
  if (!data.entries?.length) {
    console.log('No entries. Run: npm run prod:log')
    return
  }
  console.log(`Production: ${data.productionDomain}`)
  console.log(`Current commit: ${data.currentProductionCommit || '—'}\n`)
  for (const e of data.entries) {
    const mark = e.isCurrentProduction ? ' *LIVE*' : ''
    console.log(`${e.deployedAtIst}  ${e.commit}  ${e.message}${mark}`)
    console.log(`  preview: ${e.vercelPreviewUrl}`)
    if (e.notes) console.log(`  notes: ${e.notes}`)
    console.log(`  rollback: ${e.rollbackCommand}`)
    console.log('')
  }
}

function resolveEntry(arg, entries) {
  if (!arg) return null
  const a = arg.trim().toLowerCase()
  return (
    entries.find((e) => e.commit === a) ||
    entries.find((e) => e.logId === a) ||
    entries.find((e) => e.vercelPreviewUrl.includes(a)) ||
    entries.find((e) => e.commitFull?.startsWith(a))
  )
}

function tagRelease(arg) {
  const data = readLog()
  const commit = arg?.trim() || data.currentProductionCommit
  if (!commit) {
    console.error('No commit specified and no current production commit in log.')
    process.exit(1)
  }
  const entry = resolveEntry(commit, data.entries || [])
  const sha = entry?.commitFull || run(`git rev-parse ${commit}`)
  const tag = `prod/${entry?.logId || logIdFrom(Date.now(), commit)}`
  const msg = entry?.message || run(`git show -s --format=%s ${commit}`)
  const safeMsg = msg.replace(/"/g, '\\"')
  run(`git tag -a "${tag}" -m "Production: ${safeMsg}" ${sha}`)
  console.log(`Tagged ${tag} → ${shortSha(sha)}`)
  console.log('Push tags: git push origin --tags')
}

function rollback(arg) {
  const data = readLog()
  if (!data.entries?.length) syncLog()
  const fresh = readLog()
  const entry = resolveEntry(arg, fresh.entries)
  if (!entry) {
    console.error(`No log entry matching "${arg}". Run: npm run prod:log:list`)
    process.exit(1)
  }
  const target = entry.vercelPreviewUrl.replace(/^https:\/\//, '')
  console.log(`Rolling back production to:`)
  console.log(`  ${entry.deployedAtIst}  ${entry.commit}  ${entry.message}`)
  console.log(`  ${entry.vercelPreviewUrl}\n`)

  const result = spawnSync('vercel', ['rollback', target, '-y'], {
    cwd: ROOT,
    stdio: 'inherit',
  })
  if (result.status !== 0) process.exit(result.status || 1)
  console.log(`\nRollback requested. ${PRODUCTION_DOMAIN} should match commit ${entry.commit} shortly.`)
  console.log('Run npm run prod:log to refresh the log.')
}

const [cmd, arg] = process.argv.slice(2)

try {
  switch (cmd) {
    case 'sync':
    case 'record':
      syncLog()
      break
    case 'list':
      listLog()
      break
    case 'markdown':
      writeMarkdown(readLog())
      console.log(`Wrote ${MD_PATH}`)
      break
    case 'rollback':
      rollback(arg)
      break
    case 'tag':
      tagRelease(arg)
      break
    default:
      console.log(`Usage:
  node scripts/production-log.mjs sync
  node scripts/production-log.mjs list
  node scripts/production-log.mjs markdown
  node scripts/production-log.mjs rollback <commit|logId|preview-host>
  node scripts/production-log.mjs tag [commit]`)
      process.exit(cmd ? 1 : 0)
  }
} catch (err) {
  console.error(err.message || err)
  process.exit(1)
}
