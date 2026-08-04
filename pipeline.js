#!/usr/bin/env node
/**
 * pipeline.js — Automated data pipeline for the war map.
 * 1. Fetches latest posts from all Telegram channels (LIVE mode)
 * 2. Parses all raw HTML into structured attacks, sitreps, statements
 * 3. Commits and pushes to GitHub → triggers Vercel redeploy
 *
 * Backfill (archive walk) runs roughly once per 24h, keyed off
 * `state.lastBackfill` (set by telegram-ingest.js in backfill mode).
 *
 * Failure policy: ingest/parse failures are FATAL — we never commit
 * half-fetched or unparsed data. Build failures are FATAL too — the push
 * is what triggers Vercel's build, so pushing a tree that fails to build
 * locally means a failed deploy (and corrupt data files are exactly what
 * breaks builds). No commit/push happens unless the build passes.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const PROJECT_DIR = __dirname
const STATE_FILE = path.join(PROJECT_DIR, 'src/data/ingest-state.json')

// generous per-step timeouts: backfill can walk 200 pages/channel
const INGEST_TIMEOUT_MS = 600000  // 10 min
const PARSE_TIMEOUT_MS = 600000   // 10 min
const BUILD_TIMEOUT_MS = 600000   // 10 min

function run(desc, cmd, timeoutMs = 120000) {
  console.error(`\n▶ ${desc}...`)
  try {
    const out = execSync(cmd, { cwd: PROJECT_DIR, timeout: timeoutMs })
    const text = out.toString().trim()
    if (text) console.error(`  ${text}`)
    return true
  } catch (e) {
    console.error(`  ✗ ${e.message}`)
    return false
  }
}

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) }
  catch { return { totalFetches: 0 } }
}

async function main() {
  console.error('═══════════════════════════════════════')
  console.error('  WAR MAP DATA PIPELINE')
  console.error(`  ${new Date().toISOString()}`)
  console.error('═══════════════════════════════════════')

  const state = loadState()

  // Backfill roughly once per 24h (based on last successful backfill,
  // NOT totalFetches — a frozen counter previously forced backfill every run).
  const lastBackfillMs = state.lastBackfill ? Date.parse(state.lastBackfill) : 0
  const isBackfillCycle = !state.lastBackfill || (Date.now() - lastBackfillMs > 23 * 3600 * 1000)

  // 1. Fetch from Telegram channels
  const mode = isBackfillCycle ? '--backfill' : ''
  const ingestOk = run(
    `Ingesting Telegram data (${isBackfillCycle ? 'BACKFILL' : 'LIVE'})`,
    `node src/data/telegram-ingest.js ${mode}`,
    INGEST_TIMEOUT_MS
  )
  if (!ingestOk) {
    console.error('\n✗ Ingest failed — aborting. No commit/push (state not saved, retry next cycle).')
    process.exit(1)
  }

  // 2. Parse all raw HTML into structured data
  const parseOk = run('Parsing attacks, sitreps, statements from sources',
    'node src/data/parse-all.js', PARSE_TIMEOUT_MS)
  if (!parseOk) {
    console.error('\n✗ Parse failed — aborting. No commit/push (retry next cycle).')
    process.exit(1)
  }

  // 3. Check if there are changes
  const status = execSync('git status --porcelain', { cwd: PROJECT_DIR }).toString().trim()

  if (!status) {
    console.error('\n✓ No new data — nothing to push.')
    process.exit(0)
  }

  // 4. Copy dynamic data to public/ for client-side polling
  run('Copying irgc-losses to public/', 'cp src/data/irgc-losses.json public/data/irgc-losses.json')
  run('Copying hormuz-data to public/', 'cp src/data/hormuz-data.json public/data/hormuz-data.json')

  // 5. Build the site (smoke test — the pushed source is what Vercel builds,
  //    so a failed build here means a failed deploy; abort and retry next cycle).
  const buildOk = run('Building site', 'npm run build', BUILD_TIMEOUT_MS)
  if (!buildOk) {
    console.error('\n✗ Build failed — NOT committing/pushing (Vercel would deploy a broken build). Retry next cycle.')
    process.exit(1)
  }

  // 6. Commit and push
  const dateStr = new Date().toISOString().slice(0, 19).replace('T', ' ')
  run('Committing changes', `git add -A && git commit -m "auto: data pipeline update ${dateStr}" || true`)
  const pushOk = run('Pushing to GitHub', 'git push')
  if (!pushOk) {
    console.error('\n✗ Push failed — data committed locally, will retry next cycle.')
    process.exit(1)
  }

  console.error('\n═══════════════════════════════════════')
  console.error('  PIPELINE COMPLETE — Vercel deploying')
  console.error('═══════════════════════════════════════')
}

main().catch(e => {
  console.error('Pipeline failed:', e.message)
  process.exit(1)
})
