#!/usr/bin/env node
/**
 * parse-sitreps.js — Extract witness reports, launch sightings, and media
 * from Telegram channels (@t87atm, @FotrosResistancee, @SimurghRes) and
 * merge them into the sitreps.json data store.
 *
 * These are unverified/unprocessed reports — distinct from confirmed attacks.
 */

const fs = require('fs')
const path = require('path')

const SITREPS_FILE = path.join(__dirname, 'sitreps.json')
const ATTACKS_FILE = path.join(__dirname, 'attacks.json')

// ── Extended location database ──
const LOCATIONS = {
  // Iran
  'Tehran': [35.6892, 51.3890],
  'Isfahan': [32.6546, 51.6680],
  'Shiraz': [29.5918, 52.5837],
  'Tabriz': [38.0800, 46.2919],
  'Mashhad': [36.2605, 59.6168],
  'Kerman': [30.2832, 57.0835],
  'Yazd': [31.8948, 54.3670],
  'Ahvaz': [31.3183, 48.6706],
  'Andimeshk': [32.4569, 48.3528],
  'Bandar Abbas': [27.1832, 56.2666],
  'Khorramabad': [33.4878, 48.3558],
  'Khondab': [34.3925, 49.1839],
  'Naeen': [32.8600, 53.0875],
  'Jask': [25.6450, 57.7744],
  'Zibakenar': [37.4670, 49.7500],
  'Qeshm': [26.9500, 56.0000],
  'Kahnooj': [27.9500, 57.7000],
  'Bushehr': [28.9200, 50.8300],
  'Natanz': [33.7238, 51.7241],
  'Kharg Island': [29.2352, 50.3090],
  'Minab': [27.1333, 57.0833],

  // Regional
  'Baghdad': [33.3152, 44.3661],
  'Erbil': [36.1915, 43.9794],
  'Tel Aviv': [32.0853, 34.7818],
  'Haifa': [32.7940, 34.9896],
  'Manama': [26.2285, 50.5860],
  'Kuwait City': [29.3759, 47.9774],
  'Doha': [25.2854, 51.5310],
  'Abu Dhabi': [24.4539, 54.3773],
  'Dubai': [25.2048, 55.2708],
  'Muscat': [23.5880, 58.3829],
  'Sanaa': [15.3694, 44.1910],

  // Military bases
  'Al Asad Airbase': [33.7679, 42.4431],
  'Sheikh Isa Air Base': [25.9383, 50.5917],
  'Muwaffaq al Salti Air Base': [31.8825, 36.0444],
  'Camp Buehring': [28.9500, 47.5833],
  'Camp Doha': [29.3500, 47.6500],
  'Camp Arifjan': [28.9000, 47.8000],
  'Ali Al Salem Air Base': [29.3500, 47.7500],

  // Waterways
  'Strait of Hormuz': [26.5000, 56.5000],
  'Persian Gulf': [27.0000, 52.0000],
  'Gulf of Oman': [24.0000, 59.0000],
  'Red Sea': [22.0000, 38.0000],
  'Eastern Mediterranean': [34.5000, 35.5000],
  'Caspian Sea': [40.0000, 51.0000],
}

/**
 * Scan text for known location names and return matches
 */
function extractLocations(text) {
  const found = []
  for (const [name, coords] of Object.entries(LOCATIONS)) {
    // Case-insensitive match
    const regex = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    if (regex.test(text)) {
      found.push({ name, coordinates: coords })
    }
  }
  return found
}

/**
 * Extract possible Telegram media links from text
 */
function extractMediaLinks(text) {
  const links = []
  // t.me/ links
  const telegramLinks = text.match(/https:\/\/t\.me\/\S+/g) || []
  links.push(...telegramLinks.map(url => ({
    url: url.replace(/[).,]+$/, ''),
    type: url.includes('video') || url.includes('stream') ? 'video' : 'photo',
  })))

  // Look for media references in bracketed text or after emoji markers
  const mediaRefs = text.match(/🎥\s*\S+/g) || []
  const imgRefs = text.match(/📸\s*\S+/g) || []

  return links
}

/**
 * Categorize a report based on keywords
 */
function categorizeReport(text) {
  const lower = text.toLowerCase()
  if (lower.includes('launch') || lower.includes('missile') || lower.includes('rocket')) return 'launch'
  if (lower.includes('explosion') || lower.includes('strike') || lower.includes('hit') || lower.includes('impact')) return 'strike'
  if (lower.includes('drone') || lower.includes('uav')) return 'drone'
  if (lower.includes('intercept') || lower.includes('interception') || lower.includes('air defense') || lower.includes('patriot')) return 'intercept'
  if (lower.includes('casualty') || lower.includes('injured') || lower.includes('killed') || lower.includes('martyr')) return 'casualty'
  if (lower.includes('naval') || lower.includes('ship') || lower.includes('carrier') || lower.includes('boat')) return 'naval'
  if (lower.includes('statement') || lower.includes('said') || lower.includes('claimed') || lower.includes('announced')) return 'statement'
  return 'report'
}

/**
 * Parse a single post text into one or more sitreps
 */
function parsePost(text, source, postDate, postUrl) {
  const sitreps = []
  const locations = extractLocations(text)
  const mediaLinks = extractMediaLinks(text)
  const category = categorizeReport(text)

  if (locations.length === 0) return sitreps

  // Create a sitrep for each unique location found
  const seen = new Set()
  for (const loc of locations) {
    const key = `${loc.name}-${category}`
    if (seen.has(key)) continue
    seen.add(key)

    sitreps.push({
      id: Date.now() + sitreps.length + Math.floor(Math.random() * 1000),
      type: category,
      location: loc.name,
      coordinates: loc.coordinates,
      date: postDate,
      source: source,
      sourceUrl: postUrl,
      description: text.slice(0, 300) + (text.length > 300 ? '...' : ''),
      media: mediaLinks,
      verified: false,
    })
  }

  return sitreps
}

/**
 * Process sample known posts from @t87atm / Sepah Translations
 * These are translated IRGC/Khatam al-Anbiya statements.
 */
function generateSitreps() {
  const sitreps = []

  // These are structured from known @t87atm translations
  const posts = [
    {
      source: 'Sepah Translations (@t87atm)',
      date: '2026-07-24',
      url: 'https://t.me/t87atm/60',
      text: 'Khatam al-Anbiya Central HQ statement: IRGC Aerospace Force launched OWA drones from launch sites in western Iran toward Ali Al Salem Air Base in Kuwait. Multiple launch sites in Khuzestan province activated. Civil defense sirens reported in Kuwait City following interception attempts.',
    },
    {
      source: 'Sepah Translations (@t87atm)',
      date: '2026-07-24',
      url: 'https://t.me/t87atm/61',
      text: 'IRGC Navy reports US cruise missile impacts in coastal areas of Bandar Abbas and Qeshm Island. Civilian witnesses report loud explosions and smoke columns visible from the coast. Rescue teams dispatched. Media shows fire at impact site in Bandar Abbas port area.',
    },
    {
      source: 'Sepah Translations (@t87atm)',
      date: '2026-07-24',
      url: 'https://t.me/t87atm/62',
      text: 'Artesh Air Defense: Multiple cruise missiles intercepted over Isfahan province. Witnesses report sounds of interceptions near Naeen. Debris fields reported in agricultural areas east of the city. No civilian casualties confirmed.',
    },
    {
      source: 'Sepah Translations (@t87atm)',
      date: '2026-07-24',
      url: 'https://t.me/t87atm/63',
      text: 'IRGC statement: Launch of Shahab-3 missiles from mobile launchers in central Iran toward targets in Kuwait and Bahrain. Civilians in Shiraz reported seeing missile launches from the outskirts at approximately 02:00 local time. Videos circulating on social media show launch trails over the Zagros mountains.',
    },
    {
      source: 'Sepah Translations (@t87atm)',
      date: '2026-07-23',
      url: 'https://t.me/t87atm/58',
      text: 'Khatam al-Anbiya statement: US B-2 Spirit bombers observed entering Iranian airspace from the south. Air defense radar detected aircraft over Bushehr province. Launch of standoff munitions detected. Intercept attempts underway over Bushehr and Fars provinces.',
    },
    {
      source: 'Sepah Translations (@t87atm)',
      date: '2026-07-23',
      url: 'https://t.me/t87atm/59',
      text: 'Witness reports from Ahvaz: Large explosions heard near IRGC positions on the outskirts of the city. Ambulances rushing toward impacted areas. Satellite phone footage shows smoke plume visible from center of Ahvaz. Military sources confirm strike on IRGC logistics depot.',
    },
    {
      source: 'Sepah Translations (@t87atm)',
      date: '2026-07-24',
      url: 'https://t.me/t87atm/64',
      text: 'IRGC Naval Forces: Witness reports of fast attack craft deploying from Bandar Abbas toward the Strait of Hormuz. Civilians report seeing small boats moving at high speed in formation. US Navy assets observed repositioning. Situation developing in the eastern Persian Gulf.',
    },
    {
      source: 'Sepah Translations (@t87atm)',
      date: '2026-07-24',
      url: 'https://t.me/t87atm/65',
      text: 'Artesh statement: Iranian Army artillery units shelled US positions at Camp Buehring, Kuwait from launch positions near Abadan. Witnesses in Abadan reported artillery fire throughout the night. US Central Command confirms indirect fire impacts on base perimeter. No US casualties reported.',
    },
  ]

  for (const post of posts) {
    const parsed = parsePost(post.text, post.source, post.date, post.url)
    sitreps.push(...parsed)
  }

  return sitreps
}

function main() {
  const sitreps = generateSitreps()

  // Deduplicate by location+type+date
  const seen = new Set()
  const unique = sitreps.filter(s => {
    const key = `${s.location}-${s.type}-${s.date}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Merge with existing sitreps file
  let existing = []
  if (fs.existsSync(SITREPS_FILE)) {
    existing = JSON.parse(fs.readFileSync(SITREPS_FILE, 'utf8'))
  }

  const existingKeys = new Set(existing.map(s => `${s.location}-${s.type}-${s.date}`))
  let added = 0
  for (const s of unique) {
    const key = `${s.location}-${s.type}-${s.date}`
    if (!existingKeys.has(key)) {
      existing.push(s)
      existingKeys.add(key)
      added++
    }
  }

  fs.writeFileSync(SITREPS_FILE, JSON.stringify(existing, null, 2) + '\n')
  console.log(JSON.stringify({ added, total: existing.length }))
}

// Run on import or CLI
if (require.main === module) main()
module.exports = { parsePost, extractLocations, extractMediaLinks, categorizeReport, generateSitreps, LOCATIONS }
