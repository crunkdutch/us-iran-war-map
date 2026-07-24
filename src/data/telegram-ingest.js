#!/usr/bin/env node
/**
 * telegram-ingest.js — Fetch posts from Telegram channels and parse into attack data.
 * Fetches from t.me/s/{channel} pages and extracts structured incident data.
 */

const fs = require('fs')
const path = require('path')

const CHANNELS = {
  fotros: { url: 'https://t.me/s/FotrosResistancee', label: 'Fotros Resistance' },
  enemywatch: { url: 'https://t.me/s/enemywatch', label: 'Enemy Watch' },
  simurgh: { url: 'https://t.me/s/SimurghRes', label: 'Simurgh Resistance' },
}

const ATTACKS_FILE = path.join(__dirname, 'attacks.json')
const RAW_DIR = path.join(__dirname, 'sources')

// Ensure raw data directory exists
if (!fs.existsSync(RAW_DIR)) fs.mkdirSync(RAW_DIR, { recursive: true })

/**
 * Parse a Fotros Resistance post. These follow a fairly structured format.
 * Returns an array of attack objects.
 */
function parseFotrosPost(text, postId, postDate) {
  const attacks = []
  const lines = text.split('\n')

  let currentSection = null // 'us' | 'iran_artesh' | 'iran_irgc'

  for (const line of lines) {
    const trimmed = line.trim()

    // Detect section headers
    if (trimmed.includes('CENTCOM says')) {
      currentSection = 'us'
      continue
    }
    if (trimmed.includes("Iran's Army") || trimmed.includes('Artesh')) {
      currentSection = 'iran_artesh'
      continue
    }
    if (trimmed.startsWith('IRGC has targeted') || trimmed.startsWith('IRGC has')) {
      currentSection = 'iran_irgc'
      continue
    }
    if (trimmed.startsWith('—') || trimmed.startsWith('—')) {
      continue
    }

    // Parse US attacks on Iran cities
    if (currentSection === 'us') {
      const cityMatch = trimmed.match(/US attacked a site in (\w+(?:\s\w+)?)/i)
      if (cityMatch) {
        const city = cityMatch[1]
        const coords = getCityCoords(city)
        attacks.push({
          id: Date.now() + attacks.length,
          type: 'airstrike',
          title: `US Airstrike on ${city}`,
          location: `${city}, Iran`,
          coordinates: coords,
          date: postDate,
          time: 'TBD',
          status: 'confirmed',
          sources: [
            { name: 'Fotros Resistance', url: `https://t.me/FotrosResistancee/${postId}`, type: 'analyst' }
          ],
          casualties: { military: 0, civilian: 0 },
          description: `US military strike reported in ${city} during aerial bombardment campaign. Reported via resistance channel.`,
          satelliteImage: null,
          videoUrl: null,
          sourceChannel: 'FotrosResistancee',
        })
      }
    }

    // Parse Iran Artesh strikes
    if (currentSection === 'iran_artesh') {
      const baseMatch = trimmed.match(/(?:Fuel storage|Aircraft hangars|US military|US troop|US forces)/i)
      if (baseMatch) {
        // Try to extract location
        const locMatch = trimmed.match(/(?:at the|at)\s(.+?)(?:,|\.|—)/i)
        const countryMatch = trimmed.match(/in\s([A-Z][a-z]+)/)
        const baseName = locMatch ? locMatch[1].trim() : 'Unknown base'
        const country = countryMatch ? countryMatch[1] : 'Unknown'
        const coords = getBaseCoords(baseName, country)

        attacks.push({
          id: Date.now() + attacks.length,
          type: 'missile',
          title: `Iranian Strike on ${baseName}`,
          location: `${baseName}, ${country}`,
          coordinates: coords,
          date: postDate,
          time: 'TBD',
          status: 'confirmed',
          sources: [
            { name: 'Fotros Resistance', url: `https://t.me/FotrosResistancee/${postId}`, type: 'analyst' },
            { name: 'Iran Artesh', url: '', type: 'official' }
          ],
          casualties: { military: 0, civilian: 0 },
          description: `Iranian Army (Artesh) strike on ${baseName} in ${country}. Part of retaliatory operations using Arash drones.`,
          satelliteImage: null,
          videoUrl: null,
          sourceChannel: 'FotrosResistancee',
        })
      }
    }

    // Parse IRGC strikes
    if (currentSection === 'iran_irgc') {
      const ammoMatch = trimmed.match(/ammunition depot at the\s(.+?)(?:,|\.)/i)
      if (ammoMatch) {
        const baseName = ammoMatch[1].trim()
        attacks.push({
          id: Date.now() + attacks.length,
          type: 'drone',
          title: `IRGC Drone Strike on ${baseName}`,
          location: `${baseName}, Kuwait`,
          coordinates: [29.3500, 47.7500], // approximate
          date: postDate,
          time: 'TBD',
          status: 'confirmed',
          sources: [
            { name: 'Fotros Resistance', url: `https://t.me/FotrosResistancee/${postId}`, type: 'analyst' },
            { name: 'IRGC', url: '', type: 'official' }
          ],
          casualties: { military: 0, civilian: 0 },
          description: `IRGC struck ammunition depot at ${baseName} using advanced OWA drones. Multiple hangars destroyed with casualties reported.`,
          satelliteImage: null,
          videoUrl: null,
          sourceChannel: 'FotrosResistancee',
        })
      }
    }
  }

  return attacks
}

/**
 * Geo-lookup for Iranian cities
 */
function getCityCoords(city) {
  const map = {
    'Yazd': [31.8948, 54.3670],
    'Ahvaz': [31.3183, 48.6706],
    'Andimeshk': [32.4569, 48.3528],
    'Bandar Abbas': [27.1832, 56.2666],
    'Khorramabad': [33.4878, 48.3558],
    'Khondab': [34.3925, 49.1839],
    'Naeen': [32.8600, 53.0875],
    'Jask': [25.6450, 57.7744],
    'Zibakenar': [37.4670, 49.7500],
  }
  return map[city] || [32.0, 54.0] // fallback central Iran
}

/**
 * Geo-lookup for military bases
 */
function getBaseCoords(baseName, country) {
  const map = {
    'Sheikh Isa Air Base': [25.9383, 50.5917],
    'Muwaffaq al Salti Air Base': [31.8825, 36.0444],
    'Camp Buehring': [28.9500, 47.5833],
    'Camp Doha': [29.3500, 47.6500],
    'Camp Arifjan': [28.9000, 47.8000],
    'Ali Al Salem Air Base': [29.3500, 47.7500],
  }
  return map[baseName] || [30.0, 48.0] // fallback
}

/**
 * Fetch a Telegram channel's recent posts
 */
async function fetchChannelPosts(channelKey, channelInfo) {
  const { url, label } = channelInfo
  console.error(`Fetching ${label}...`)

  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WarMapBot/1.0)' }
    })
    const html = await resp.text()

    // Save raw HTML for debugging
    const filename = `${channelKey}-${Date.now()}.html`
    fs.writeFileSync(path.join(RAW_DIR, filename), html)

    // Extract post text from the page
    // Telegram t.me/s/ pages wrap posts in <div class="tgme_widget_message_text">
    const postTexts = html.match(/<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/g) || []

    console.error(`  Found ${postTexts.length} post elements`)

    // For now, return the full text for manual/managed parsing
    return {
      channel: channelKey,
      label,
      postCount: postTexts.length,
      rawFile: filename,
    }
  } catch (e) {
    console.error(`  Error: ${e.message}`)
    return null
  }
}

async function main() {
  console.error('=== Telegram Data Ingestion ===')
  console.error()
  
  // Fetch fresh data
  for (const [key, info] of Object.entries(CHANNELS)) {
    await fetchChannelPosts(key, info)
  }

  // Merge new attack data into the attacks file
  // For now, display the raw data counts
  console.error()
  console.error('=== Raw data saved to sources/ ===')
  console.error('Next step: run parse-posts.js to extract structured attacks.')
  console.error()
  console.log(JSON.stringify({ ingested: true, timestamp: new Date().toISOString() }))
}

if (require.main === module) main()
module.exports = { parseFotrosPost, getCityCoords, getBaseCoords }
