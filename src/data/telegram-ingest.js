#!/usr/bin/env node
/**
 * telegram-ingest.js — Aggressive Telegram archive backfill + live fetch.
 *
 * Strategy:
 *   - Live mode (no args): fetch one page per channel (the latest).
 *   - Backfill mode (--backfill): fetch MANY historical pages per channel
 *     (up to MAX_PAGES per run) to rapidly fill in the Feb-June gap.
 *
 * Each page is saved as raw HTML and ingested by parse-all.js.
 */

const fs = require('fs')
const path = require('path')

const BASE_DIR = __dirname
const RAW_DIR = path.join(BASE_DIR, 'sources')
const STATE_FILE = path.join(BASE_DIR, 'ingest-state.json')

// ── Configuration ──
const CHANNELS = {
  enemywatch: { url: 'https://t.me/s/enemywatch', label: 'Enemy Watch', type: 'analysis' },
  fotros: { url: 'https://t.me/s/FotrosResistancee', label: 'Fotros Resistance', type: 'ops_summary' },
  simurgh: { url: 'https://t.me/s/SimurghRes', label: 'Simurgh Resistance', type: 'ops_intel' },
  me_observer: { url: 'https://t.me/s/me_observer_TG', label: 'Middle East Observer', type: 'news_aggregator' },
  me_spectator: { url: 'https://t.me/s/Middle_East_Spectator', label: 'Middle East Spectator', type: 'analysis' },
  mmirlb: { url: 'https://t.me/s/mmirlb', label: 'Military Media (IRGC/Iran Army)', type: 'official_ops' },
}

const BACKFILL_MODE = process.argv.includes('--backfill')
const MAX_PAGES_PER_CHANNEL = BACKFILL_MODE ? 200 : 1
const RATE_LIMIT_MS = 1500 // 1.5s between fetches to avoid rate limiting

// ── State tracking ──
function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) }
  catch { return { lastFetch: null, seenPostIds: [], totalFetches: 0, seenPostHashes: {} } }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n')
}

// ── Sleep helper ──
const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── Extract `before` param from prev link ──
function extractPrevBefore(html) {
  const m = html.match(/<link rel="prev" href="[^?]*\?before=(\d+)"/)
  return m ? m[1] : null
}

// ── Extract post IDs from page to know what we've seen ──
function extractPostIds(html, channelKey) {
  // Post IDs are in data-post="channelKey/N" attributes
  const regex = new RegExp(`data-post="${channelKey}/(\\d+[a-z]?)"`, 'gi')
  const ids = []
  let match
  while ((match = regex.exec(html)) !== null) {
    // Some IDs have trailing 'g' suffix (pagination edge cases), strip it
    const id = parseInt(match[1].replace(/[a-z]/gi, ''))
    if (!isNaN(id)) ids.push(id)
  }
  return ids.filter((v, i, a) => a.indexOf(v) === i) // deduplicate
}

// ── Fetch a single page ──
async function fetchPage(url) {
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WarMapBot/2.0)' },
    signal: AbortSignal.timeout(30000),
  })
  return await resp.text()
}

// ── Fetch pages for one channel, walking backwards ──
async function fetchChannelHistory(key, info, state) {
  if (!fs.existsSync(RAW_DIR)) fs.mkdirSync(RAW_DIR, { recursive: true })

  let pagesFetched = 0
  let before = null // null = latest page
  let consecutiveEmpty = 0

  for (let i = 0; i < MAX_PAGES_PER_CHANNEL; i++) {
    // Build URL
    const url = before ? `${info.url}?before=${before}` : info.url
    console.error(`  [${i + 1}/${MAX_PAGES_PER_CHANNEL}] Fetching: ${url}`)

    try {
      const html = await fetchPage(url)

      // Check if this page is new content (vs. a repeat)
      const postIds = extractPostIds(html, key)
      // Allow some overlap (up to 3 IDs may appear on consecutive pages)
      const newIds = postIds.filter(id => !state.seenPostIds.includes(id))
      const isNew = newIds.length > postIds.length - 4 // at least ~80% new

      if (!isNew && before !== null) {
        consecutiveEmpty++
        console.error(`    → No new IDs (${consecutiveEmpty}x).`)
        if (consecutiveEmpty >= 3) {
          console.error(`    → Breaking: 3 consecutive pages with no new IDs`)
          break
        }
      } else {
        consecutiveEmpty = 0
      }

      // Save raw HTML
      const filename = `${key}-${Date.now()}.html`
      fs.writeFileSync(path.join(RAW_DIR, filename), html)

      // Track seen post IDs
      for (const id of postIds) {
        if (!state.seenPostIds.includes(id)) {
          state.seenPostIds.push(id)
        }
      }
      console.error(`    → ${newIds.length}/${postIds.length} new IDs (before=${before || 'latest'})`)

      pagesFetched++

      // Get the "before" ID for next page
      const nextBefore = extractPrevBefore(html)
      if (!nextBefore) {
        console.error(`    → No prev link — reached the earliest page`)
        break
      }

      // Sanity check: if we haven't moved, break
      if (nextBefore === before) {
        console.error(`    → before param unchanged — reached the earliest page`)
        break
      }

      before = nextBefore
      state.totalFetches++
      state.lastFetch = new Date().toISOString()

      // Rate limit between pages
      if (i < MAX_PAGES_PER_CHANNEL - 1) {
        await sleep(RATE_LIMIT_MS)
      }

    } catch (e) {
      console.error(`    ✗ Error: ${e.message}`)
      // Wait longer after an error
      await sleep(5000)
      continue
    }
  }

  return pagesFetched
}

// ── Main ──
async function main() {
  const mode = BACKFILL_MODE ? 'BACKFILL' : 'LIVE'
  console.error('═══════════════════════════════════════')
  console.error(`  TELEGRAM INGEST — ${mode} MODE`)
  console.error(`  ${new Date().toISOString()}`)
  console.error(`  Max pages/channel: ${MAX_PAGES_PER_CHANNEL}`)
  console.error('═══════════════════════════════════════\n')

  const state = loadState()
  if (!state.seenPostIds) state.seenPostIds = []
  if (!state.seenPostHashes) state.seenPostHashes = {}

  let totalPages = 0
  let totalErrors = 0

  for (const [key, info] of Object.entries(CHANNELS)) {
    console.error(`\n━━━ ${info.label} (@${key}) ━━━`)
    try {
      const pages = await fetchChannelHistory(key, info, state)
      totalPages += pages
      console.error(`  → ${pages} pages fetched`)
    } catch (e) {
      console.error(`  ✗ Channel error: ${e.message}`)
      totalErrors++
    }
  }

  // Save state
  saveState(state)

  console.error('\n═══════════════════════════════════════')
  console.error('  INGESTION COMPLETE')
  console.error('═══════════════════════════════════════')
  console.log(JSON.stringify({
    mode,
    timestamp: new Date().toISOString(),
    totalFetches: state.totalFetches,
    pagesFetched: totalPages,
    errors: totalErrors,
    seenPostIds: state.seenPostIds.length,
    sourceFiles: fs.existsSync(RAW_DIR) ? fs.readdirSync(RAW_DIR).length : 0,
  }))
}

if (require.main === module) main().catch(e => {
  console.error('Fatal:', e.message)
  process.exit(1)
})
