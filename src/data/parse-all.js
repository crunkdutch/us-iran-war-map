#!/usr/bin/env node
/**
 * parse-all.js — Comprehensive parser for Telegram channel HTML archives.
 * Reads all source HTML files, extracts attack events, statements, and sitreps,
 * and updates the JSON data stores with deduplication.
 *
 * Run: node src/data/parse-all.js
 * Pipelines: add to pipeline.js after telegram-ingest.js
 */

const fs = require('fs')
const path = require('path')

const DATA_DIR = __dirname
const SOURCES_DIR = path.join(DATA_DIR, 'sources')
const ATTACKS_FILE = path.join(DATA_DIR, 'attacks.json')
const SITREPS_FILE = path.join(DATA_DIR, 'sitreps.json')
const STATEMENTS_FILE = path.join(DATA_DIR, 'statements.json')

// ── Location database (military bases, cities, waterways) ──
const LOCATIONS = {
  // Iran
  'Tehran': [35.6892, 51.3890], 'Isfahan': [32.6546, 51.6680],
  'Shiraz': [29.5918, 52.5837], 'Tabriz': [38.0800, 46.2919],
  'Mashhad': [36.2605, 59.6168], 'Kerman': [30.2832, 57.0835],
  'Yazd': [31.8948, 54.3670], 'Ahvaz': [31.3183, 48.6706],
  'Andimeshk': [32.4569, 48.3528], 'Bandar Abbas': [27.1832, 56.2666],
  'Khorramabad': [33.4878, 48.3558], 'Khondab': [34.3925, 49.1839],
  'Naeen': [32.8600, 53.0875], 'Jask': [25.6450, 57.7744],
  'Zibakenar': [37.4670, 49.7500], 'Qeshm Island': [26.9500, 56.0000],
  'Qeshm': [26.9500, 56.0000], 'Kahnooj': [27.9500, 57.7000],
  'Bushehr': [28.9200, 50.8300], 'Natanz': [33.7238, 51.7241],
  'Kharg Island': [29.2352, 50.3090], 'Minab': [27.1333, 57.0833],
  'Behbahan': [30.6000, 50.2500], 'Shahroud': [36.4181, 54.9770],
  'Sirik': [26.5167, 57.1000], 'Semnan': [35.5724, 53.3972],
  'Khuzestan': [31.3, 48.7], 'Gilan': [37.3, 49.6],
  'Fars': [29.6, 53.0], 'Kermanshah': [34.3, 47.1],
  'Hormozgan': [27.2, 56.3], 'Larak Island': [26.8500, 56.3500],
  'Abadan': [30.3392, 48.3043],
  // Regional cities
  'Baghdad': [33.3152, 44.3661], 'Erbil': [36.1915, 43.9794],
  'Tel Aviv': [32.0853, 34.7818], 'Haifa': [32.7940, 34.9896],
  'Manama': [26.2285, 50.5860], 'Kuwait City': [29.3759, 47.9774],
  'Doha': [25.2854, 51.5310], 'Abu Dhabi': [24.4539, 54.3773],
  'Dubai': [25.2048, 55.2708], 'Muscat': [23.5880, 58.3829],
  'Sanaa': [15.3694, 44.1910], 'Hodeidah': [14.7979, 42.9545],
  'Aden': [12.7855, 45.0187], 'Riyadh': [24.7136, 46.6753],
  'Jeddah': [21.5433, 39.1728], 'Damascus': [33.5138, 36.2768],
  'Amman': [31.9454, 35.9284], 'Beirut': [33.8938, 35.5018],
  'Gaza City': [31.5019, 34.4644],
  // Military bases
  'Al Asad Airbase': [33.7679, 42.4431], 'Al Dhafra Air Base': [24.2486, 54.6333],
  'Al Udeid Air Base': [25.1175, 51.3180], 'Prince Sultan Air Base': [24.0767, 47.5800],
  'Sheikh Isa Air Base': [25.9383, 50.5917],
  'Muwaffaq al Salti Air Base': [31.8825, 36.0444],
  'Camp Buehring': [28.9500, 47.5833], 'Camp Doha': [29.3500, 47.6500],
  'Camp Arifjan': [28.9000, 47.8000], 'Ali Al Salem Air Base': [29.3500, 47.7500],
  'King Faisal Air Base': [30.0500, 35.4500],
  'Ramat David Airbase': [32.6667, 35.1833],
  'Nevatim Airbase': [31.2000, 34.5000], 'Hatzerim Airbase': [31.2333, 34.5167],
  'Tel Nof Airbase': [31.8333, 34.7833], 'Sdot Micha Airbase': [31.6833, 35.0500],
  'Ovda Airbase': [29.9375, 34.9358],
  // Waterways
  'Strait of Hormuz': [26.5000, 56.5000], 'Persian Gulf': [27.0000, 52.0000],
  'Gulf of Oman': [24.0000, 59.0000], 'Red Sea': [22.0000, 38.0000],
  'Eastern Mediterranean': [34.5000, 35.5000], 'Caspian Sea': [40.0000, 51.0000],
  'Bab al-Mandab': [13.0000, 43.5000],
  // Countries/regions
  'Lebanon': [33.9, 35.5], 'Syria': [34.8, 39.0], 'Jordan': [31.2, 36.6],
  'Yemen': [15.5, 47.5], 'Bahrain': [26.0, 50.5], 'Kuwait': [29.3, 47.7],
  'Qatar': [25.3, 51.2], 'UAE': [23.8, 54.5], 'Oman': [21.5, 57.0],
  'Saudi Arabia': [24.0, 45.0], 'Iraq': [33.0, 43.0], 'Israel': [31.0, 34.8],
  'West Bank': [31.8, 35.3], 'Gaza Strip': [31.4, 34.4],
  'Sinai': [30.0, 34.0], 'Turkey': [39.0, 35.0],
}

// ── Entity extractors ──
function extractLocations(text) {
  const found = []
  for (const [name, coords] of Object.entries(LOCATIONS)) {
    const regex = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    if (regex.test(text)) found.push({ name, coordinates: coords })
  }
  return found
}

// ── Attack type classification ──
function classifyAttackType(text) {
  const l = text.toLowerCase()
  if (l.includes('drone') || l.includes('uav') || l.includes('shahed') || l.includes('arash') ||
      l.includes('owa drone')) return 'drone'
  if (l.includes('missile') || l.includes('ballistic') || l.includes('cruise') ||
      l.includes('shahab') || l.includes('emad') || l.includes('khorramshahr') ||
      l.includes('qadr') || l.includes('qiam') || l.includes('fateh') ||
      l.includes('zolfaghar') || l.includes('dezfoul')) return 'missile'
  if (l.includes('rocket') || l.includes('katyusha') || l.includes('mortar') ||
      l.includes('artillery') || l.includes('shelling')) return 'rocket'
  if (l.includes('airstrike') || l.includes('bomb') || l.includes('fighter jet') ||
      l.includes('sortie') || (l.includes('air strike') || l.includes('strike')) &&
      !l.includes('missile') && !l.includes('drone')) return 'airstrike'
  if (l.includes('naval') || l.includes('ship') || l.includes('warship') ||
      l.includes('boat') || l.includes('carrier') || l.includes('frigate') ||
      l.includes('destroyer') || l.includes('blockade')) return 'naval'
  if (l.includes('intercept') || l.includes('patriot') || l.includes('air defense') ||
      l.includes('thaa') || l.includes('c-ram') || l.includes('iron dome') ||
      l.includes('david\'s sling')) return 'intercept'
  if (l.includes('cyber') || l.includes('hack') || l.includes('malware')) return 'cyber'
  return 'airstrike'
}

// ── Determine if post is a statement ──
function isStatement(text) {
  const l = text.toLowerCase()
  const statementMarkers = [
    'statement', 'said', 'says', 'announced', 'announces', 'warned', 'warns',
    'claimed', 'claims', 'condemned', 'condemns', 'vowed', 'vows', 'threatened',
    'threatens', 'declared', 'declares', 'confirmed', 'confirms', 'reports',
    'issued', 'stressed', 'emphasized', 'spokesman', 'spokesperson',
    'general', 'commander said', 'commander says',
  ]
  return statementMarkers.some(m => l.includes(m))
}

// ── Extract source entity (who said/did it) ──
function extractEntity(text) {
  const markers = [
    { names: ['IRGC', 'Islamic Revolutionary Guard Corps', 'Sepah', 'Khatam al-Anbiya',
              'Khatam al Anbiya', 'IRGC Aerospace', 'IRGC Navy', 'IRGC Ground Forces'],
      type: 'Khatam al Anbiya', canonical: 'IRGC/Khatam al-Anbiya' },
    { names: ['Artesh', 'Iranian Army', 'Iran Army', 'Iranian Armed Forces',
              'IRIAF', 'Iranian Air Force', 'Iranian Navy'],
      type: 'Khatam al Anbiya', canonical: 'Iranian Army (Artesh)' },
    { names: ['CENTCOM', 'US Central Command', 'Pentagon', 'U.S. Central Command',
              'US Central Command'],
      type: 'CENTCOM', canonical: 'CENTCOM' },
    { names: ['Hezbollah', 'Hizbullah'],
      type: 'Hezbollah', canonical: 'Hezbollah' },
    { names: ['Houthi', 'Ansar Allah', 'Ansarallah', 'Yemeni Armed Forces'],
      type: 'Ansar Allah', canonical: 'Ansar Allah' },
    { names: ['IDF', 'Israeli Defense Forces', 'Israel Defense Forces', 'Israeli army',
              'Israeli military', 'IAF', 'Israeli Air Force'],
      type: 'CENTCOM', canonical: 'IDF' },
    { names: ['Saudi', 'Saudi Arabia', 'Saudi-led'],
      type: 'CENTCOM', canonical: 'Saudi Arabia' },
  ]
  for (const group of markers) {
    for (const name of group.names) {
      if (text.includes(name)) return group
    }
  }
  return null
}

// ── Extract date from text (flexible) ──
function extractDate(text, fallback) {
  // Look for ISO dates
  const iso = text.match(/(\d{4}-\d{2}-\d{2})/)
  if (iso) return iso[1]
  // Look for "Month DD, YYYY" or "Month DD YYYY"
  const monthDayYear = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i)
  if (monthDayYear) {
    const months = {January:'01',February:'02',March:'03',April:'04',May:'05',June:'06',
                    July:'07',August:'08',September:'09',October:'10',November:'11',December:'12'}
    const m = months[monthDayYear[1].charAt(0).toUpperCase() + monthDayYear[1].slice(1).toLowerCase()] || '01'
    const d = monthDayYear[2].padStart(2, '0')
    return `${monthDayYear[3]}-${m}-${d}`
  }
  return fallback || '2026-07-24'
}

// ── Generate a unique title from text ──
function generateTitle(text, locations, attackType, entity) {
  let loc = 'Unknown'
  if (locations.length > 0) {
    loc = locations.map(l => l.name).slice(0, 3).join(', ')
  }
  let entityName = entity ? entity.canonical : 'Unknown'
  // Determine context
  const l = text.toLowerCase()
  if (l.includes('hezbollah') || l.includes('hizbullah')) entityName = 'Hezbollah'
  else if (l.includes('idf') || l.includes('israeli')) entityName = 'IDF/Israel'
  else if (l.includes('houthi') || l.includes('ansar') || l.includes('yemen')) entityName = 'Ansar Allah'

  const typeMap = { drone: 'Drone Strike', missile: 'Missile Strike',
    rocket: 'Rocket Attack', airstrike: 'Airstrike', naval: 'Naval Operation',
    intercept: 'Interception', cyber: 'Cyber Attack', report: 'Event' }
  const typeLabel = typeMap[attackType] || 'Event'

  // Try to extract a short description
  const words = text.replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 3)
  let summary = words.slice(0, 10).join(' ')
  if (summary.length > 80) summary = summary.slice(0, 80) + '...'

  // Prefer a shorter title
  const shortWords = words.slice(0, 6).join(' ')
  const shortSummary = shortWords.length > 60 ? shortWords.slice(0, 60) + '...' : shortWords
  return `${entityName} ${typeLabel} — ${loc}: ${shortSummary}`
}

// ── Main parser ──
function main() {
  // Load existing data
  const existingAttacks = JSON.parse(fs.readFileSync(ATTACKS_FILE, 'utf8'))
  const existingSitreps = fs.existsSync(SITREPS_FILE) ?
    JSON.parse(fs.readFileSync(SITREPS_FILE, 'utf8')) : []
  const existingStatements = fs.existsSync(STATEMENTS_FILE) ?
    JSON.parse(fs.readFileSync(STATEMENTS_FILE, 'utf8')) : []

  const existingAttackKeys = new Set(existingAttacks.map(a =>
    `${a.date}-${a.location}-${a.type}`))
  const existingSitrepKeys = new Set(existingSitreps.map(s =>
    `${s.date}-${s.location}-${s.type}-${(s.description || '').slice(0, 80)}`))
  const existingStatementKeys = new Set(existingStatements.map(s =>
    `${s.date}-${(s.title || '').slice(0, 60)}`))

  // Read all source HTML files
  const files = fs.readdirSync(SOURCES_DIR).filter(f => f.endsWith('.html'))
  console.error(`Processing ${files.length} source files...`)

  let newAttacks = 0
  let newSitreps = 0
  let newStatements = 0
  let seenTexts = new Set()

  for (const file of files) {
    const html = fs.readFileSync(path.join(SOURCES_DIR, file), 'utf8')
    const channelKey = file.split('-')[0]

    // Extract page date
    const pageDateMatch = html.match(/datetime="([^"]+)"/)
    const pageDate = pageDateMatch ? pageDateMatch[1].slice(0, 10) : '2026-07-24'

    // Extract post blocks
    const postBlocks = html.split('tgme_widget_message_wrap')

    for (const block of postBlocks) {
      if (block.length < 100) continue

      // Extract text
      const textMatch = block.match(/<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/)
      if (!textMatch) continue
      const rawText = textMatch[1].replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ').trim()
      if (rawText.length < 30) continue

      // Deduplicate by text prefix
      const textKey = rawText.slice(0, 100)
      if (seenTexts.has(textKey)) continue
      seenTexts.add(textKey)

      const locations = extractLocations(rawText)
      if (locations.length === 0) continue

      const entity = extractEntity(rawText)
      const attackType = classifyAttackType(rawText)
      const date = extractDate(rawText, pageDate)

      // Categorize the post
      const l = rawText.toLowerCase()

      // Strong attack signal — requires explicit military action language
      const isStrongAttack = /(?:struck|destroyed|targeted|launched|shelled|bombed)\s+(?:a\s+)?(?:US|Iranian|IRGC|Israeli|Hezbollah|Houthi|Saudi|military|base|site|position|depot|hangar|barrack|airbase|airfield|refinery|storage|warehouse|data center|hq|headquarters|ammunition|fuel|drone|missile|naval|ship|carrier)/i.test(l) ||
        /(?:missile|rocket|drone|artillery|airstrike|barrage|salvo|wave|bombardment)\s+(?:struck|hit|targeted|launched|fired|destroyed)/i.test(l) ||
        /(?:targeted|attacked|struck)\s+(?:by|using|with|via)\s+(?:missile|drone|rocket|airstrike|artillery)/i.test(l) ||
        /(?:Intercept|Intercepted|shot down|destroyed)\s+(?:cruise missile|drone|missile|projectile)/i.test(l) ||
        /(?:Iran|IRGC|Artesh|Iranian Army|Army)\s+(?:hit|struck|targeted|destroyed|launched|fired)/i.test(l) ||
        /(?:US|CENTCOM|American|US forces)\s+(?:hit|struck|targeted|destroyed|launched|fired|strike)/i.test(l) ||
        /(?:Hezbollah|Houthi|Ansar)\s+(?:hit|struck|targeted|destroyed|launched|fired|rocket|missile|drone)/i.test(l)

      const hasMentionOfAttack = /strike|struck|attack|hit|target|destroyed|launch|fired|shelled|barrage|salvo/i.test(l) && 
        /missile|drone|rocket|airstrike|bomb|artillery|naval|military|base|airbase|barrack|depot|hangar|refinery/i.test(l)

      const hasCasualtyKeywords = /killed|injured|wounded|civilian|casualty|martyr|death/i.test(l)
      const isStatementPost = isStatement(rawText)
      const hasMediaRefs = /🎥|video|footage|satellite image|imagery|photo|picture/i.test(l)

      // Skip blatant non-war content
      const isNoise = /^(?:published|this is|check out|follow|subscribe|donate|support|ko-fi|patreon|link)/i.test(l.trim()) ||
        /t.me\/\w+/i.test(l.trim()) && l.trim().length < 80 ||
        /letter|article|published|read more/i.test(l) && !/(?:Iran|IRGC|Hezbollah|strike|missile|drone|attack|military)/i.test(l)

      // Validate attack has strong enough signal and good date
      const isValidDate = date >= '2026-02-01' && date <= '2026-12-31'

      // 1. Attack events — only create if strong signal + valid date + not noise
      if ((isStrongAttack || (hasMentionOfAttack && (entity || hasCasualtyKeywords))) && !isNoise && isValidDate) {
        const attackKey = `${date}-${locations[0].name}-${attackType}`
        if (!existingAttackKeys.has(attackKey)) {
          existingAttacks.push({
            id: existingAttacks.length > 0 ?
              Math.max(...existingAttacks.map(a => a.id)) + existingAttacks.length + 1 : 1,
            type: attackType,
            status: 'confirmed',
            date: date,
            time: 'TBD',
            title: generateTitle(rawText, locations, attackType, entity),
            location: locations.map(l => l.name).join(', '),
            coordinates: locations.length > 0 ? locations[0].coordinates : [32.5, 54],
            sources: [{
              name: entity ? entity.canonical : `Telegram (${channelKey})`,
              url: `https://t.me/s/${channelKey}`,
              type: entity ? 'official' : 'analyst',
            }],
            casualties: { iranian_mil: 0, iranian_civ: 0, us_mil: 0, us_civ: 0, kurdish: 0, other: 0 },
            description: rawText.slice(0, 500),
            satelliteImage: null,
            videoUrl: null,
          })
          existingAttackKeys.add(attackKey)
          newAttacks++
        }
      }

      // 2. Statements
      if (isStatementPost && entity) {
        const stmtKey = `${date}-${generateTitle(rawText, locations, attackType, entity).slice(0, 60)}`
        if (!existingStatementKeys.has(stmtKey)) {
          existingStatements.push({
            id: existingStatements.length > 0 ?
              Math.max(...existingStatements.map(s => s.id || 0)) + existingStatements.length + 1 : 1,
            title: generateTitle(rawText, locations, attackType, entity),
            date: date,
            source: entity.canonical,
            sourceType: entity.type,
            sourceUrl: `https://t.me/s/${channelKey}`,
            description: rawText.slice(0, 500),
            keyPoints: [rawText.slice(0, 200) + (rawText.length > 200 ? '...' : '')],
          })
          existingStatementKeys.add(stmtKey)
          newStatements++
        }
      }

      // 3. Sitreps (witness reports, media, casualty counts)
      if (hasCasualtyKeywords || hasMediaRefs || !isStatementPost) {
        for (const loc of locations) {
          const sitrepKey = `${date}-${loc.name}-${attackType}-${rawText.slice(0, 80)}`
          if (!existingSitrepKeys.has(sitrepKey)) {
            existingSitreps.push({
              id: Date.now() + Math.floor(Math.random() * 100000),
              type: attackType,
              location: loc.name,
              coordinates: loc.coordinates,
              date: date,
              source: entity ? entity.canonical : `Telegram (${channelKey})`,
              sourceUrl: `https://t.me/s/${channelKey}`,
              description: rawText.slice(0, 300) + (rawText.length > 300 ? '...' : ''),
              media: [],
              verified: false,
            })
            existingSitrepKeys.add(sitrepKey)
            newSitreps++
          }
        }
      }
    }
  }

  // Deduplicate attacks by title+date+near match
  existingAttacks.sort((a, b) => a.date.localeCompare(b.date) || (a.id || 0) - (b.id || 0))
  fs.writeFileSync(ATTACKS_FILE, JSON.stringify(existingAttacks, null, 2) + '\n')

  existingSitreps.sort((a, b) => a.date.localeCompare(b.date))
  fs.writeFileSync(SITREPS_FILE, JSON.stringify(existingSitreps, null, 2) + '\n')

  existingStatements.sort((a, b) => a.date.localeCompare(b.date))
  fs.writeFileSync(STATEMENTS_FILE, JSON.stringify(existingStatements, null, 2) + '\n')

  console.log(JSON.stringify({
    addedAttacks: newAttacks,
    totalAttacks: existingAttacks.length,
    addedSitreps: newSitreps,
    totalSitreps: existingSitreps.length,
    addedStatements: newStatements,
    totalStatements: existingStatements.length,
  }))
}

if (require.main === module) main()
module.exports = { extractLocations, classifyAttackType, isStatement, extractEntity, extractDate, generateTitle }
