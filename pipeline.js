#!/usr/bin/env node
/**
 * pipeline.js — Automated data pipeline for the war map.
 * 1. Fetches latest posts from all Telegram channels (LIVE mode)
 * 2. Parses all raw HTML into structured attacks, sitreps, statements
 * 3. Commits and pushes to GitHub → triggers Vercel redeploy
 *
 * Every 24h, the first run does a BACKFILL to walk archives aggressively.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const PROJECT_DIR = __dirname
const STATE_FILE = path.join(PROJECT_DIR, 'src/data/ingest-state.json')

function run(desc, cmd) {
  console.error(`\n▶ ${desc}...`)
  try {
    const out = execSync(cmd, { cwd: PROJECT_DIR, timeout: 120000 })
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
  const isBackfillCycle = (state.totalFetches % 48) === 0 // backfill every 24h (48 × 30min)

  // 1. Fetch from Telegram channels
  const mode = isBackfillCycle ? '--backfill' : ''
  run(`Ingesting Telegram data (${isBackfillCycle ? 'BACKFILL' : 'LIVE'})`,
    `node src/data/telegram-ingest.js ${mode}`)

  // 2. Parse all raw HTML into structured data
  run('Parsing attacks, sitreps, statements from sources',
    'node src/data/parse-all.js')

  // 3. Check if there are changes
  const status = execSync('git status --porcelain', { cwd: PROJECT_DIR }).toString().trim()

  if (!status) {
    console.error('\n✓ No new data — nothing to push.')
    process.exit(0)
  }

  // 4. Copy dynamic data to public/ for client-side polling
  run('Copying irgc-losses to public/', 'cp src/data/irgc-losses.json public/data/irgc-losses.json')
  run('Copying hormuz-data to public/', 'cp src/data/hormuz-data.json public/data/hormuz-data.json')

  // 5. Build the site
  run('Building site', 'npm run build')

  // 5. Commit and push
  const dateStr = new Date().toISOString().slice(0, 19).replace('T', ' ')
  run('Committing changes', `git add -A && git commit -m "auto: data pipeline update ${dateStr}" || true`)
  run('Pushing to GitHub', 'git push')

  console.error('\n═══════════════════════════════════════')
  console.error('  PIPELINE COMPLETE — Vercel deploying')
  console.error('═══════════════════════════════════════')
}

main().catch(e => {
  console.error('Pipeline failed:', e.message)
  process.exit(1)
})
