#!/usr/bin/env node
/**
 * pipeline.js — Automated data pipeline for the war map.
 * 1. Fetches latest posts from all Telegram channels
 * 2. Parses new attack events, sitreps, confirmations, and media
 * 3. Updates confirmations on existing attacks (disputed → confirmed)
 * 4. Attaches new media (satellite imagery, video URLs) to existing attacks
 * 5. Commits and pushes to GitHub → triggers Vercel redeploy
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const PROJECT_DIR = __dirname
const ATTACKS_FILE = path.join(PROJECT_DIR, 'src/data/attacks.json')
const SITREPS_FILE = path.join(PROJECT_DIR, 'src/data/sitreps.json')

function run(desc, cmd) {
  console.error(`\n▶ ${desc}...`)
  try {
    const out = execSync(cmd, { cwd: PROJECT_DIR, timeout: 60000 })
    const text = out.toString().trim()
    if (text) console.error(`  ${text}`)
    return true
  } catch (e) {
    console.error(`  ✗ ${e.message}`)
    return false
  }
}

// ── Merge confirmation data into existing attacks ──
function applyConfirmations() {
  const ingestResult = execSync('node src/data/telegram-ingest.js', { cwd: PROJECT_DIR })
  const result = JSON.parse(ingestResult.toString())

  if (result.newSitreps === 0 && result.confirmations === 0 && result.mediaUpdates === 0) {
    console.error('\n✓ No new data from channels.')
    return false
  }

  // Load current data
  const attacks = JSON.parse(fs.readFileSync(ATTACKS_FILE, 'utf8'))
  const sitreps = JSON.parse(fs.readFileSync(SITREPS_FILE, 'utf8'))

  // Apply confirmations from the processed channel data
  // (The sitreps and confirmations are saved in the process)
  const existingAttackIds = new Set(attacks.map(a => a.id))
  const existingSitrepKeys = new Set(sitreps.map(s => `${s.location}-${s.type}-${s.date}-${s.source}`))

  // Merge new sitreps (the script output structure is informational only;
  // actual structured data comes from the regular parse step)
  console.error(`  New data: ${result.newSitreps} sitreps, ${result.confirmations} confirmations, ${result.mediaUpdates} media`)

  return true
}

async function main() {
  console.error('═══════════════════════════════════════')
  console.error('  WAR MAP DATA PIPELINE')
  console.error(`  ${new Date().toISOString()}`)
  console.error('═══════════════════════════════════════')

  // 1. Fetch fresh data from all Telegram channels and check for new content
  const hasNew = applyConfirmations()
  if (!hasNew) {
    // Still run the standard parsers to catch any manual additions
  }

  // 2. Run the standard data parsers
  run('Parsing attack events', 'node src/data/parse-posts.js')
  run('Parsing sitreps', 'node src/data/parse-sitreps.js')

  // 3. Check if there are changes
  const status = execSync('git status --porcelain', { cwd: PROJECT_DIR }).toString().trim()

  if (!status) {
    console.error('\n✓ No new data — nothing to push.')
    process.exit(0)
  }

  // 4. Build the site
  run('Building site', 'npm run build')

  // 5. Commit and push
  const dateStr = new Date().toISOString().slice(0, 16).replace('T', ' ')
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
