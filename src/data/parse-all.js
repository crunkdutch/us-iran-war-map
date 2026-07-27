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
const HORMUZ_FILE = path.join(DATA_DIR, 'hormuz-data.json')
const HORMUZ_TS_FILE = path.join(DATA_DIR, 'hormuz-data.ts')

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

// ── Extract media URLs from a post block HTML ──
function extractMediaFromBlock(block) {
  const media = []

  // Single photos: <a class="tgme_widget_message_photo_wrap" style="...background-image:url('...')">
  // Need to handle: style="width:800px;background-image:url('...')" — there may be other CSS before bg-image
  const photoRe = /<a[^>]*class="[^"]*tgme_widget_message_photo_wrap[^"]*"[^>]*style="[^"]*background-image:url\('([^']+)'\)/gi
  let match
  while ((match = photoRe.exec(block)) !== null) {
    let url = match[1].replace(/&amp;/g, '&')
    // Prefer full https:// URLs
    if (url.startsWith('//')) url = 'https:' + url
    if (!media.find(m => m.url === url)) {
      media.push({ url, type: 'photo' })
    }
  }

  // Video sources: <video src="..." class="tgme_widget_message_video"
  const videoRe = /<video[^>]*src="([^"]+)"[^>]*class="tgme_widget_message_video[^"]*"/gi
  while ((match = videoRe.exec(block)) !== null) {
    let url = match[1].replace(/&amp;/g, '&')
    if (url.startsWith('//')) url = 'https:' + url
    if (!media.find(m => m.url === url)) {
      // Try to find the thumbnail for this video
      const thumbRe = /<i[^>]*class="[^"]*tgme_widget_message_video_thumb[^"]*"[^>]*style="background-image:url\('([^']+)'\)/i
      const thumbMatch = block.match(thumbRe)
      let thumb = null
      if (thumbMatch) {
        thumb = thumbMatch[1].replace(/&amp;/g, '&')
        if (thumb.startsWith('//')) thumb = 'https:' + thumb
      }
      media.push({ url, type: 'video', thumbnail: thumb })
    }
  }

  // Video player links without direct <video> in block
  const playerRe = /<a[^>]*class="[^"]*tgme_widget_message_video_player[^"]*"[^>]*href="([^"]+)"[^>]*>/gi
  while ((match = playerRe.exec(block)) !== null) {
    const postUrl = match[1].replace(/&amp;/g, '&')
    // Extract thumbnail from the player's inner <i class="tgme_widget_message_video_thumb">
    const playerBlock = block.slice(match.index, match.index + 2000)
    const thumbRe = /<i[^>]*class="[^"]*tgme_widget_message_video_thumb[^"]*"[^>]*style="background-image:url\('([^']+)'\)/i
    const thumbMatch = playerBlock.match(thumbRe)
    let thumb = null
    if (thumbMatch) {
      thumb = thumbMatch[1].replace(/&amp;/g, '&')
      if (thumb.startsWith('//')) thumb = 'https:' + thumb
    }
    // Check if we already have this video by URL (from direct <video> src)
    // If not, store the Telegram post URL as the media reference
    if (!media.find(m => m.url === postUrl || m.url.includes(postUrl))) {
      media.push({ url: postUrl, type: 'video', thumbnail: thumb })
    }
  }

  return media
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

  // Ensure all attacks have the media field
  let mediaFieldFixed = 0
  for (const a of existingAttacks) {
    if (!('media' in a)) {
      a.media = []
      mediaFieldFixed++
    }
  }
  if (mediaFieldFixed > 0) {
    console.error(`  Added media field to ${mediaFieldFixed} existing attacks`)
  }

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

      // Extract media from this post block
      const media = extractMediaFromBlock(block)

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
            media: media.length > 0 ? media.slice(0, 10) : [],
          })
          existingAttackKeys.add(attackKey)
          newAttacks++
        } else if (media.length > 0) {
          // Backfill media onto existing attacks
          const existing = existingAttacks.find(a =>
            a.date === date &&
            a.location.split(',')[0].trim() === locations[0].name &&
            a.type === attackType
          )
          if (existing && (!existing.media || existing.media.length === 0)) {
            existing.media = media.slice(0, 10)
          }
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
              media: media.length > 0 ? media.slice(0, 10) : [],
              verified: false,
            })
            existingSitrepKeys.add(sitrepKey)
            newSitreps++
          } else if (media.length > 0) {
            // Backfill media onto existing sitreps
            const existing = existingSitreps.find(s =>
              s.date === date &&
              s.location === loc.name &&
              s.type === attackType &&
              s.description.startsWith(rawText.slice(0, 60))
            )
            if (existing && (!existing.media || existing.media.length === 0)) {
              existing.media = media.slice(0, 10)
            }
          }
        }
      }
    }
  }

  // ── Media backfill: scan ALL posts for media and attach to existing attacks ──
  let backfilledMedia = 0
  let attacksWithMediaCount = existingAttacks.filter(a => a.media && a.media.length > 0).length

  for (const file of files) {
    const html = fs.readFileSync(path.join(SOURCES_DIR, file), 'utf8')
    const channelKey = file.split('-')[0]
    const pageDateMatch = html.match(/datetime="([^"]+)"/)
    const pageDate = pageDateMatch ? pageDateMatch[1].slice(0, 10) : '2026-07-24'
    const postBlocks = html.split('tgme_widget_message_wrap')

    for (const block of postBlocks) {
      if (block.length < 100) continue

      // Extract text (needed for location/date matching)
      const textMatch = block.match(/<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/)
      if (!textMatch) continue
      const rawText = textMatch[1].replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ').trim()
      if (rawText.length < 30) continue

      const media = extractMediaFromBlock(block)
      if (media.length === 0) continue

      const locations = extractLocations(rawText)
      if (locations.length === 0) continue

      const attackType = classifyAttackType(rawText)
      const date = extractDate(rawText, pageDate)
      if (date < '2026-02-01' || date > '2026-12-31') continue

      // Try to match this post to an existing attack by date + first location + type
      const existing = existingAttacks.find(a =>
        a.date === date &&
        a.location.split(',')[0].trim() === locations[0].name &&
        a.type === attackType &&
        (!a.media || a.media.length === 0)
      )
      if (existing) {
        existing.media = media.slice(0, 10)
        backfilledMedia++
      }
    }
  }

  if (backfilledMedia > 0) {
    console.error(`  Media backfill: ${backfilledMedia} attacks got media`)
  }
  const totalWithMedia = existingAttacks.filter(a => a.media && a.media.length > 0).length
  console.error(`  Attacks with media: ${totalWithMedia}`)

  // Deduplicate attacks by title+date+near match
  existingAttacks.sort((a, b) => a.date.localeCompare(b.date) || (a.id || 0) - (b.id || 0))
  fs.writeFileSync(ATTACKS_FILE, JSON.stringify(existingAttacks, null, 2) + '\n')

  existingSitreps.sort((a, b) => a.date.localeCompare(b.date))
  // ── Hormuz Crossing Data: Extract from Telegram sources ──
  const hormuzResult = processHormuzData()

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
    addedHormuzEntries: hormuzResult.added,
    totalHormuzEntries: hormuzResult.total,
  }))
}

// ── Strait of Hormuz shipping crossings extractor ──
// Parses Telegram source HTML for shipping/crossing data,
// merges with the static seed data, and writes hormuz-data.json

function processHormuzData(htmlCache) {
  // Load existing seed data
  const existingHormuz = fs.existsSync(HORMUZ_FILE)
    ? JSON.parse(fs.readFileSync(HORMUZ_FILE, 'utf8'))
    : []
  const existingByDate = new Map(existingHormuz.map(e => [e.date, e]))
  let added = 0

  // Pattern: look for shipping data near Strait of Hormuz mentions
  // Source patterns from known shipping intelligence sources
  const shippingPatterns = [
    // Kpler pattern: "Kpler: N crossings" or "Kpler says N crossings"
    /Kpler[^\n]{0,30}?(\d{1,3})\s*(?:crossings?|vessels?|ships?|transits?)/gi,
    // Lloyds pattern: "Lloyd's: N/week" or "Lloyd's List: N"
    /Lloyd[''']?s?[^\n]{0,30}?(\d{1,3})\s*(?:vessels?|ships?|crossings?|\/week)/gi,
    // S&P Global pattern
    /S&P[^\n]{0,30}?(\d{1,3})\s*(?:vessels?|ships?|crossings?)/gi,
    // General: "N crossings / N vessels through Strait of Hormuz"
    /(\d{1,3})\s*(?:crossings?|vessels?|ships?|transits?)[^\n]{0,50}?(?:Strait of Hormuz|Hormuz|strait)/gi,
    // General: "Strait of Hormuz ... N crossings / N ships"
    /(?:Strait of Hormuz|Hormuz|strait)[^\n]{0,50}?(\d{1,3})\s*(?:crossings?|vessels?|ships?|transits?)/gi,
    // CENTCOM interdiction: "N ships prevented"
    /(\d{1,3})\s*(?:ships?|vessels?)[^\n]{0,30}?prevented/gi,
    // "traffic ... down to N" (Strait context)
    /(?:traffic|shipping|transit)[^\n]{0,30}?(?:down to|at|reached|stands at|sitting at)[^\n]{0,20}?(\d{1,3})\s*(?:\/day|daily|per day|vessels|ships|crossings?)/gi,
    // "N ships ... blocked / interdicted"
    /(\d{1,3})\s*(?:ships?|vessels?)[^\n]{0,40}?(?:blocked|interdict|turn|stop)/gi,
  ]

  // Label extraction: keywords that help identify the source/significance
  function extractLabel(text, daily) {
    const l = text.toLowerCase()
    if (l.includes('kpler')) {
      const detail = l.includes('lloyd') ? '' : ''
      if (daily > 30) return `Kpler: ${daily} crossings`
      return `Kpler: ${daily} crossings`
    }
    if (l.includes("lloyd")) return `Lloyd's: ${daily}/week`
    if (l.includes('s&p')) return `S&P: ${daily} vessels`
    if (l.includes('centcom')) return `CENTCOM: ${daily} ships`
    if (l.includes('imo')) return `IMO data`
    if (l.includes('al jazeera')) return `Al Jazeera: ${daily} crossings`
    if (l.includes('prevent') || l.includes('block')) return `${daily} ships prevented`
    if (l.includes('disabled')) return `Vessel disabled`
    if (l.includes('single digit') || daily < 10 && daily > 0) return `Single digits`
    if (daily === 0) return 'Zero traffic'
    return `~${daily}/day`
  }

  function extractNote(text) {
    // Try to extract a concise note
    const l = text.toLowerCase()
    const notes = []
    if (l.includes('kpler')) notes.push('Kpler shipping data')
    if (l.includes('lloyd')) notes.push("Lloyd's List Intelligence")
    if (l.includes('s&p')) notes.push('S&P Global')
    if (l.includes('centcom')) notes.push('CENTCOM statement')
    if (l.includes('al jazeera')) notes.push('Al Jazeera report')
    if (l.includes('imo')) notes.push('International Maritime Organization')
    // Extract any parenthetical context
    const paren = text.match(/\(([^)]{10,100})\)/)
    if (paren) notes.push(paren[1])
    return notes.join(' — ') || text.slice(0, 120).trim()
  }

  // Scan all source HTML for shipping data
  const files = fs.readdirSync(SOURCES_DIR).filter(f => f.endsWith('.html'))
  for (const file of files) {
    const html = fs.readFileSync(path.join(SOURCES_DIR, file), 'utf8')
    const pageDateMatch = html.match(/datetime="([^"]+)"/)
    const pageDate = pageDateMatch ? pageDateMatch[1].slice(0, 10) : null

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

      const l = rawText.toLowerCase()
      // Must mention Strait of Hormuz or shipping context
      const isShipping = /strait of hormuz|hormuz|shipping|vessel|tanker|oil tanker|lloyd|kpler|aiv|maritime|blockade|naval|ship/i.test(l)
      if (!isShipping) continue

      // Try each pattern
      for (const pattern of shippingPatterns) {
        pattern.lastIndex = 0
        let match
        while ((match = pattern.exec(rawText)) !== null) {
          const daily = parseInt(match[1])
          if (isNaN(daily) || daily < 0 || daily > 200) continue

          // Determine date: try inline date first, then page date
          let date = extractDate(rawText, null)
          if (!date || date < '2026-02-01') {
            date = pageDate
          }
          if (!date || date < '2026-02-01' || date > '2026-12-31') continue

          // Check if we already have an entry for this date
          if (existingByDate.has(date)) {
            const existing = existingByDate.get(date)
            // Update if new daily value is different (suggests refinement)
            if (existing.daily !== daily) {
              // Keep the one from a more authoritative source
              // Prefer Kpler > Lloyd's > S&P > CENTCOM > general
            }
            continue // skip duplicates
          }

          const label = extractLabel(rawText, daily)
          const note = extractNote(rawText)

          existingByDate.set(date, { date, daily, label, note })
          added++
        }
      }
    }
  }

  // Sort by date and write
  const merged = Array.from(existingByDate.values())
    .sort((a, b) => a.date.localeCompare(b.date))

  fs.writeFileSync(HORMUZ_FILE, JSON.stringify(merged, null, 2) + '\n')

  // Also write the TypeScript source file (bundler-friendly, no JSON import)
  const tsLines = merged.map(e =>
    `  { "date": "${e.date}", "daily": ${e.daily}, "label": ${JSON.stringify(e.label)}, "note": ${JSON.stringify(e.note)} }`
  )
  const tsContent = `// Strait of Hormuz daily shipping crossings\n// Auto-generated by pipeline - do not edit directly\n\nexport interface HormuzEntry {\n  date: string\n  daily: number\n  label: string\n  note: string\n}\n\nconst data: HormuzEntry[] = [\n${tsLines.join(',\n')}\n]\n\nexport default data\n`
  fs.writeFileSync(HORMUZ_TS_FILE, tsContent)
  console.error(`  Hormuz: ${added} new entries, ${merged.length} total (TS + JSON)`)

  return { added, total: merged.length }
}

// Cache full HTML text per file for the Hormuz extractor
// (We read files in the main loop, but pass htmlCache as empty for now)
// The Hormuz extractor re-reads files internally for clarity

if (require.main === module) main()
module.exports = { extractLocations, classifyAttackType, isStatement, extractEntity, extractDate, generateTitle, processHormuzData }
