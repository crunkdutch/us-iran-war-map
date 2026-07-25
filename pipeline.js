#!/usr/bin/env node
/**
 * pipeline.js — Automated data pipeline for the war map.
 * 1. Fetches latest posts from all Telegram channels
 * 2. Parses new attack events and sitreps
 * 3. Commits and pushes to GitHub → triggers Vercel redeploy
 */
const { execSync } = require('child_process')
const path = require('path')

const PROJECT_DIR = path.join(__dirname)

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

async function main() {
  console.error('═══════════════════════════════════════')
  console.error('  WAR MAP DATA PIPELINE')
  console.error(`  ${new Date().toISOString()}`)
  console.error('═══════════════════════════════════════')

  // 1. Run the data parsers
  run('Parsing attack events', 'node src/data/parse-posts.js')
  run('Parsing sitreps', 'node src/data/parse-sitreps.js')

  // 2. Check if there are changes
  const status = execSync('git status --porcelain', { cwd: PROJECT_DIR }).toString().trim()
  
  if (!status) {
    console.error('\n✓ No new data — nothing to push.')
    process.exit(0)
  }

  // 3. Build the site
  run('Building site', 'npm run build')

  // 4. Commit and push
  run('Committing changes', 'git add -A && git commit -m "auto: data pipeline update"')
  run('Pushing to GitHub', 'git push')

  console.error('\n═══════════════════════════════════════')
  console.error('  PIPELINE COMPLETE — Vercel deploying')
  console.error('═══════════════════════════════════════')
}

main().catch(e => {
  console.error('Pipeline failed:', e.message)
  process.exit(1)
})
