#!/usr/bin/env node
/**
 * telegram-ingest.js — Fetch fresh posts from all Telegram channels,
 * extract structured attack events, sitreps, confirmation data, and media.
 *
 * This is the ingestion engine for the war map data pipeline.
 * Run via: node src/data/telegram-ingest.js
 * Or via the cron pipeline: node pipeline.js
 */

const fs = require('fs')
const path = require('path')

const BASE_DIR = __dirname
const ATTACKS_FILE = path.join(BASE_DIR, 'attacks.json')
const SITREPS_FILE = path.join(BASE_DIR, 'sitreps.json')
const STATEMENTS_FILE = path.join(BASE_DIR, 'statements.json')
const RAW_DIR = path.join(BASE_DIR, 'sources')
const STATE_FILE = path.join(BASE_DIR, 'ingest-state.json')

// Channel configuration
const CHANNELS = {
  fotros: { url: 'https://t.me/s/FotrosResistancee', label: 'Fotros Resistance', type: 'ops_summary' },
  enemywatch: { url: 'https://t.me/s/enemywatch', label: 'Enemy Watch', type: 'analysis' },
  simurgh: { url: 'https://t.me/s/SimurghRes', label: 'Simurgh Resistance', type: 'ops_intel' },
  me_observer: { url: 'https://t.me/s/me_observer_TG', label: 'Middle East Observer', type: 'news_aggregator' },
  me_spectator: { url: 'https://t.me/s/Middle_East_Spectator', label: 'Middle East Spectator', type: 'analysis' },
  mmirlb: { url: 'https://t.me/s/mmirlb', label: 'Military Media (IRGC/Iran Army)', type: 'official_ops' },
}

// ── State tracking ──
function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) }
  catch { return { lastFetch: null, seenPostIds: [], totalFetches: 0 } }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n')
}

// ── Geo database ──
const LOCATIONS = {
  // Iran
  'Tehran': [35.6892, 51.3890], 'Isfahan': [32.6546, 51.6680],
  'Shiraz': [29.5918, 52.5837], 'Tabriz': [38.0800, 46.2919],
  'Mashhad': [36.2605, 59.6168], 'Kerman': [30.2832, 57.0835],
  'Yazd': [31.8948, 54.3670], 'Ahvaz': [31.3183, 48.6706],
  'Andimeshk': [32.4569, 48.3528], 'Bandar Abbas': [27.1832, 56.2666],
  'Khorramabad': [33.4878, 48.3558], 'Khondab': [34.3925, 49.1839],
  'Naeen': [32.8600, 53.0875], 'Jask': [25.6450, 57.7744],
  'Zibakenar': [37.4670, 49.7500], 'Qeshm': [26.9500, 56.0000],
  'Kahnooj': [27.9500, 57.7000], 'Bushehr': [28.9200, 50.8300],
  'Natanz': [33.7238, 51.7241], 'Kharg Island': [29.2352, 50.3090],
  'Minab': [27.1333, 57.0833], 'Behbahan': [30.6000, 50.2500],
  'Shahroud': [36.4181, 54.9770], 'Sirik': [26.5167, 57.1000],
  'Semnan': [35.5724, 53.3972], 'Khuzestan': [31.3, 48.7],
  // Regional
  'Baghdad': [33.3152, 44.3661], 'Erbil': [36.1915, 43.9794],
  'Tel Aviv': [32.0853, 34.7818], 'Haifa': [32.7940, 34.9896],
  'Manama': [26.2285, 50.5860], 'Kuwait City': [29.3759, 47.9774],
  'Doha': [25.2854, 51.5310], 'Abu Dhabi': [24.4539, 54.3773],
  'Dubai': [25.2048, 55.2708], 'Muscat': [23.5880, 58.3829],
  'Sanaa': [15.3694, 44.1910], 'Hodeidah': [14.7979, 42.9545],
  'Aden': [12.7855, 45.0187], 'Riyadh': [24.7136, 46.6753],
  'Jeddah': [21.5433, 39.1728], 'Kamaran Island': [15.3333, 42.5833],
  'Beirut': [33.8938, 35.5018], 'Gaza City': [31.5019, 34.4644],
  'West Bank': [31.8000, 35.3000], 'Damascus': [33.5138, 36.2768],
  'Amman': [31.9454, 35.9284], 'Sulaymaniyah': [35.5614, 35.4350],
  'Jurf al-Nadaf': [33.2000, 44.5000], 'Baqubah': [33.7500, 44.6500],
  'Ovda': [29.9375, 34.9358], 'Ben Gurion': [32.0094, 34.8861],
  // Military bases
  'Al Asad Airbase': [33.7679, 42.4431], 'Al Dhafra Air Base': [24.2486, 54.6333],
  'Al Udeid Air Base': [25.1175, 51.3180], 'Prince Sultan Air Base': [24.0767, 47.5800],
  'Sheikh Isa Air Base': [25.9383, 50.5917], 'Muwaffaq al Salti Air Base': [31.8825, 36.0444],
  'Camp Buehring': [28.9500, 47.5833], 'Camp Doha': [29.3500, 47.6500],
  'Camp Arifjan': [28.9000, 47.8000], 'Ali Al Salem Air Base': [29.3500, 47.7500],
  'Juffair': [26.2167, 50.6000],
  // Waterways
  'Strait of Hormuz': [26.5000, 56.5000], 'Persian Gulf': [27.0000, 52.0000],
  'Gulf of Oman': [24.0000, 59.0000], 'Red Sea': [22.0000, 38.0000],
  'Eastern Mediterranean': [34.5000, 35.5000], 'Caspian Sea': [40.0000, 51.0000],
  'Bab al-Mandab': [13.0000, 43.5000],
}

function getCoords(name) {
  // Try exact match, then case-insensitive
  if (LOCATIONS[name]) return LOCATIONS[name]
  const lower = name.toLowerCase()
  for (const [key, val] of Object.entries(LOCATIONS)) {
    if (key.toLowerCase() === lower) return val
  }
  return null
}

// ── Extract locations from text ──
function extractLocations(text) {
  const found = []
  for (const [name, coords] of Object.entries(LOCATIONS)) {
    const regex = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    if (regex.test(text)) found.push({ name, coordinates: coords })
  }
  return found
}

// ── Extract Telegram media links ──
function extractMedia(text) {
  const links = []
  const telegramUrls = text.match(/https:\/\/t\.me\/\S+/g) || []
  for (const url of telegramUrls) {
    const clean = url.replace(/[).,]+$/, '')
    const isVideo = text.match(new RegExp(`🎥|video|footage|media is too big|media is not supported`, 'i'))
    links.push({ url: clean, type: isVideo ? 'video' : 'photo' })
  }
  return links
}

// ── Determine post category ──
function categorize(text) {
  const l = text.toLowerCase()
  if (l.includes('launch') || l.includes('missile') || l.includes('rocket') || l.includes('wave')) return 'launch'
  if (l.includes('explosion') || l.includes('strike') || l.includes('hit') || l.includes('impact')) return 'strike'
  if (l.includes('drone') || l.includes('uav')) return 'drone'
  if (l.includes('intercept') || l.includes('patriot') || l.includes('air defense')) return 'intercept'
  if (l.includes('casualty') || l.includes('injured') || l.includes('killed') || l.includes('martyr')) return 'casualty'
  if (l.includes('naval') || l.includes('ship') || l.includes('carrier') || l.includes('boat')) return 'naval'
  if (l.includes('satellite') || l.includes('imagery') || l.includes('image')) return 'intel'
  return 'report'
}

// ── Check if an attack description matches for confirmation ──
function findConfirmation(text, attacks) {
  const lower = text.toLowerCase()
  for (const a of attacks) {
    // Check location match
    const locs = extractLocations(text)
    const attackLoc = extractLocations(a.location)
    const hasMatchingLoc = attackLoc.some(al =>
      locs.some(fl => fl.name.toLowerCase() === al.name.toLowerCase())
    )
    // Check type match
    const hasMatchingType = lower.includes(a.type) ||
      (a.type === 'airstrike' && (lower.includes('strike') || lower.includes('bomb'))) ||
      (a.type === 'missile' && lower.includes('missile'))

    if (hasMatchingLoc && hasMatchingType) return a.id
  }
  return null
}

// ── Process a single channel's HTML ──
function processChannelHtml(html, channelKey, channelInfo, state) {
  const results = { sitreps: [], confirmations: [], media: [], posts: 0 }

  // Extract post blocks from Telegram HTML
  // Each post is in a div with class "tgme_widget_message_wrap"
  const postBlocks = html.split('tgme_widget_message_wrap')
  console.error(`  Processing ${postBlocks.length} post blocks...`)

  // Try to extract post date from the page
  const dateMatch = html.match(/datetime="([^"]+)"/)
  const pageDate = dateMatch ? dateMatch[1].slice(0, 10) : new Date().toISOString().slice(0, 10)

  const attacks = JSON.parse(fs.readFileSync(ATTACKS_FILE, 'utf8'))

  for (let i = 0; i < postBlocks.length; i++) {
    const block = postBlocks[i]
    if (block.length < 100) continue

    // Extract post text
    const textMatch = block.match(/<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/)
    if (!textMatch) continue
    const rawText = textMatch[1].replace(/<[^>]*>/g, '').trim()
    if (rawText.length < 30) continue

    results.posts++

    // Skip if we've seen this exact text before
    const textHash = rawText.slice(0, 100)
    if (state.seenPostHashes && state.seenPostHashes.has(textHash)) continue

    const locations = extractLocations(rawText)
    const media = extractMedia(rawText)
    const category = categorize(rawText)
    const sourceUrl = channelInfo.url

    // Check if this post confirms a prior attack
    const confirmedId = findConfirmation(rawText, attacks)

    // Create sitreps for each location
    for (const loc of locations) {
      results.sitreps.push({
        id: Date.now() + results.sitreps.length + Math.floor(Math.random() * 1000),
        type: category,
        location: loc.name,
        coordinates: loc.coordinates,
        date: pageDate,
        source: `${channelInfo.label} (@${channelKey})`,
        sourceUrl,
        description: rawText.slice(0, 300) + (rawText.length > 300 ? '...' : ''),
        media,
        verified: false,
      })
    }

    // Track confirmation
    if (confirmedId) {
      results.confirmations.push({ attackId: confirmedId, source: channelInfo.label, text: rawText.slice(0, 100) })
    }

    // Track new media for existing attacks
    if (confirmedId && media.length > 0) {
      results.media.push({ attackId: confirmedId, media, source: channelInfo.label })
    }
  }

  return results
}

// ── Main ──
async function main() {
  console.error('═══════════════════════════════════════')
  console.error('  TELEGRAM DATA INGESTION')
  console.error(`  ${new Date().toISOString()}`)
  console.error('═══════════════════════════════════════\n')

  const state = loadState()
  state.totalFetches = (state.totalFetches || 0) + 1
  state.lastFetch = new Date().toISOString()
  if (!state.seenPostHashes) state.seenPostHashes = {}

  let totalSitreps = 0
  let totalConfirmations = 0
  let totalMediaUpdates = 0

  // Fetch each channel
  for (const [key, info] of Object.entries(CHANNELS)) {
    console.error(`\n--- ${info.label} ---`)
    try {
      // Paginate backwards using before parameter to access historical posts
      const fetchUrl = info.lastPostId ? info.url + '?before=' + info.lastPostId : info.url
      const resp = await fetch(fetchUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WarMapBot/1.0)' },
      })
      const html = await resp.text()

      // Extract oldest post ID for historical pagination
      const idMatches = [...html.matchAll(/href="https:\/\/t\.me\/[^/]+\/(\d+)"/g)]
      if (idMatches.length > 0) {
        const ids = idMatches.map(m => parseInt(m[1])).filter(n => !isNaN(n))
        const oldestId = ids.length > 0 ? Math.min(...ids) : null
        info.lastPostId = oldestId ? String(oldestId - 1) : null
      }

      // Save raw
      if (!fs.existsSync(RAW_DIR)) fs.mkdirSync(RAW_DIR, { recursive: true })
      const filename = `${key}-${Date.now()}.html`
      fs.writeFileSync(path.join(RAW_DIR, filename), html)

      // Process
      const results = processChannelHtml(html, key, info, state)
      totalSitreps += results.sitreps.length
      totalConfirmations += results.confirmations.length
      totalMediaUpdates += results.media.length

      // Track seen hashes
      for (const s of results.sitreps) {
        const hash = s.description.slice(0, 100)
        state.seenPostHashes[hash] = true
      }

      console.error(`  → ${results.posts} posts, ${results.sitreps.length} sitreps, ${results.confirmations.length} confirmations, ${results.media.length} media`)

    } catch (e) {
      console.error(`  Error fetching ${info.label}: ${e.message}`)
    }
  }

  // Save state
  saveState(state)

  // Output results
  console.error('\n═══════════════════════════════════════')
  console.error('  INGESTION RESULTS')
  console.error('═══════════════════════════════════════')
  console.log(JSON.stringify({
    timestamp: state.lastFetch,
    fetches: state.totalFetches,
    newSitreps: totalSitreps,
    confirmations: totalConfirmations,
    mediaUpdates: totalMediaUpdates,
  }))
}

if (require.main === module) main().catch(e => { console.error('Fatal:', e.message); process.exit(1) })
module.exports = { processChannelHtml, extractLocations, extractMedia, categorize, findConfirmation }
