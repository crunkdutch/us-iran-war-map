#!/usr/bin/env node
/**
 * parse-posts.js — Extract structured attack events from raw Telegram channel posts
 * and merge them into the attacks.json data store.
 */

const fs = require('fs')
const path = require('path')

const ATTACKS_FILE = path.join(__dirname, 'attacks.json')
const RAW_DIR = path.join(__dirname, 'sources')

// ── Known coordinates for key locations ──
const CITY_COORDS = {
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
}

const BASE_COORDS = {
  'Sheikh Isa Air Base': [25.9383, 50.5917],
  'Muwaffaq al Salti Air Base': [31.8825, 36.0444],
  'Camp Buehring': [28.9500, 47.5833],
  'Camp Doha': [29.3500, 47.6500],
  'Camp Arifjan': [28.9000, 47.8000],
  'Ali Al Salem Air Base': [29.3500, 47.7500],
}

// ── New incidents extracted from FotrosResistancee (July 23-24, 2026) ──
const NEW_INCIDENTS = [
  // US strikes on Iran
  {
    id: 13,
    type: 'airstrike',
    title: 'US Strike on Yazd Military Site',
    location: 'Yazd, Iran',
    coordinates: CITY_COORDS['Yazd'],
    date: '2026-07-23',
    time: 'Late evening',
    status: 'confirmed',
    sources: [
      { name: 'Fotros Resistance', url: 'https://t.me/FotrosResistancee', type: 'analyst' },
    ],
    casualties: { military: 0, civilian: 0 },
    description: 'US military struck a site in Yazd as part of aerial bombardment campaign across central Iran.',
    satelliteImage: null,
    videoUrl: null,
  },
  {
    id: 14,
    type: 'airstrike',
    title: 'Strikes on Multiple Iranian Cities',
    location: 'Ahvaz, Andimeshk, Khorramabad, Iran',
    coordinates: [31.5, 49.5],
    date: '2026-07-23',
    time: 'Night',
    status: 'confirmed',
    sources: [
      { name: 'Fotros Resistance', url: 'https://t.me/FotrosResistancee', type: 'analyst' },
    ],
    casualties: { military: 0, civilian: 0 },
    description: 'Explosions reported in Ahvaz, Andimeshk, Bandar Abbas, Khorramabad (likely targeting missile city infrastructure), Qeshm island, Jask, and outskirts of Khondab during coordinated US strikes.',
    satelliteImage: null,
    videoUrl: null,
  },
  {
    id: 15,
    type: 'airstrike',
    title: 'US Strike on Naeen, Isfahan Province',
    location: 'Naeen, Isfahan, Iran',
    coordinates: CITY_COORDS['Naeen'],
    date: '2026-07-24',
    time: '03:00 UTC',
    status: 'confirmed',
    sources: [
      { name: 'Fotros Resistance', url: 'https://t.me/FotrosResistancee', type: 'analyst' },
      { name: 'IRIB News', url: '', type: 'news' },
    ],
    casualties: { military: 0, civilian: 0 },
    description: 'US attacked a site in Naeen, Isfahan province at approximately 3 AM local time.',
    satelliteImage: null,
    videoUrl: null,
  },
  {
    id: 16,
    type: 'airstrike',
    title: 'Strike on IRGC Navy HQ — Zibakenar, Gilan',
    location: 'Zibakenar, Gilan, Iran',
    coordinates: CITY_COORDS['Zibakenar'],
    date: '2026-07-23',
    time: 'Night',
    status: 'confirmed',
    sources: [
      { name: 'Fotros Resistance', url: 'https://t.me/FotrosResistancee', type: 'analyst' },
    ],
    casualties: { military: 0, civilian: 0 },
    description: 'US attacked the IRGC Navy "Hazrat Seyyed al-Shohada" headquarters in Zibakenar, Gilan province — struck with standoff munitions deep in northern Iran near the Caspian Sea.',
    satelliteImage: null,
    videoUrl: null,
  },
  {
    id: 17,
    type: 'airstrike',
    title: 'Casualties in Bandar Abbas & Khorramabad Strikes',
    location: 'Bandar Abbas & Khorramabad, Iran',
    coordinates: [28.5, 54.0],
    date: '2026-07-23',
    time: 'Night',
    status: 'confirmed',
    sources: [
      { name: 'Fotros Resistance', url: 'https://t.me/FotrosResistancee', type: 'analyst' },
      { name: 'Iran Health Ministry', url: '', type: 'official' },
    ],
    casualties: { military: 0, civilian: 4 },
    description: 'US attacks in Bandar Abbas injured 2 civilians. Attacks in Khorramabad also resulted in 2 civilian injuries. Total Iranian injuries across all strikes reached 645; 55 killed.',
    satelliteImage: null,
    videoUrl: null,
  },

  // Iran Artesh strikes on regional bases
  {
    id: 18,
    type: 'missile',
    title: 'Iranian Strike on Sheikh Isa Air Base',
    location: 'Sheikh Isa Air Base, Bahrain',
    coordinates: BASE_COORDS['Sheikh Isa Air Base'],
    date: '2026-07-23',
    time: 'Night',
    status: 'confirmed',
    sources: [
      { name: 'Fotros Resistance', url: 'https://t.me/FotrosResistancee', type: 'analyst' },
      { name: 'Iran Artesh', url: '', type: 'official' },
    ],
    casualties: { military: 0, civilian: 0 },
    description: 'Iranian Army (Artesh) struck fuel storage facilities, large equipment warehouses, hangars, and US army barracks at Sheikh Isa Air Base in Bahrain using Arash drones.',
    satelliteImage: null,
    videoUrl: null,
  },
  {
    id: 19,
    type: 'missile',
    title: 'Iranian Strike on Muwaffaq al Salti Air Base',
    location: 'Muwaffaq al Salti Air Base, Jordan',
    coordinates: BASE_COORDS['Muwaffaq al Salti Air Base'],
    date: '2026-07-23',
    time: 'Night',
    status: 'confirmed',
    sources: [
      { name: 'Fotros Resistance', url: 'https://t.me/FotrosResistancee', type: 'analyst' },
      { name: 'Iran Artesh', url: '', type: 'official' },
    ],
    casualties: { military: 0, civilian: 0 },
    description: 'Iranian Army (Artesh) struck aircraft hangars, aircraft maintenance hangars, and barracks at Muwaffaq al Salti Air Base in Jordan.',
    satelliteImage: null,
    videoUrl: null,
  },
  {
    id: 20,
    type: 'missile',
    title: 'Iranian Strikes on US Bases in Kuwait',
    location: 'Camp Buehring, Camp Doha, Camp Arifjan, Kuwait',
    coordinates: [29.1, 47.7],
    date: '2026-07-23',
    time: 'Night',
    status: 'confirmed',
    sources: [
      { name: 'Fotros Resistance', url: 'https://t.me/FotrosResistancee', type: 'analyst' },
      { name: 'Iran Artesh', url: '', type: 'official' },
    ],
    casualties: { military: 0, civilian: 0 },
    description: 'Iranian Army (Artesh) struck US military equipment warehouses at Camp Buehring, a US troop deployment site at Camp Doha, and a US forces deployment site at Camp Arifjan, all in Kuwait.',
    satelliteImage: null,
    videoUrl: null,
  },

  // IRGC strikes
  {
    id: 21,
    type: 'drone',
    title: 'IRGC Drone Strike on Ali Al Salem Air Base',
    location: 'Ali Al Salem Air Base, Kuwait',
    coordinates: BASE_COORDS['Ali Al Salem Air Base'],
    date: '2026-07-23',
    time: 'Night',
    status: 'confirmed',
    sources: [
      { name: 'Fotros Resistance', url: 'https://t.me/FotrosResistancee', type: 'analyst' },
      { name: 'IRGC', url: '', type: 'official' },
    ],
    casualties: { military: 0, civilian: 0 },
    description: 'IRGC struck a very large ammunition depot at Ali Al Salem Air Base in Kuwait using advanced super-heavy OWA drones. The ammunition depot was completely destroyed. Six large barracks hangars were completely destroyed, three others sustained severe damage. Multiple casualties reported.',
    satelliteImage: null,
    videoUrl: null,
  },
  {
    id: 22,
    type: 'drone',
    title: 'IRGC Follow-Up Strike on Amazon Data Center',
    location: 'Bahrain',
    coordinates: [26.0000, 50.5500],
    date: '2026-07-23',
    time: 'Night',
    status: 'confirmed',
    sources: [
      { name: 'Fotros Resistance', url: 'https://t.me/FotrosResistancee', type: 'analyst' },
      { name: 'IRGC', url: '', type: 'official' },
    ],
    casualties: { military: 0, civilian: 0 },
    description: 'IRGC struck the remaining standing building of Amazon\'s intelligence data center in Bahrain as a follow-up from their previous operation.',
    satelliteImage: null,
    videoUrl: null,
  },
  {
    id: 23,
    type: 'naval',
    title: 'CENTCOM Naval Blockade — 12 Ships Prevented',
    location: 'Persian Gulf / Strait of Hormuz',
    coordinates: [27.0, 53.0],
    date: '2026-07-23',
    time: 'Evening',
    status: 'confirmed',
    sources: [
      { name: 'CENTCOM', url: '', type: 'official' },
      { name: 'Fotros Resistance', url: 'https://t.me/FotrosResistancee', type: 'analyst' },
    ],
    casualties: { military: 0, civilian: 0 },
    description: 'CENTCOM announced it prevented 12 ships from transiting as part of the ongoing naval blockade and maritime interdiction operations.',
    satelliteImage: null,
    videoUrl: null,
  },
  {
    id: 24,
    type: 'airstrike',
    title: 'Iranian Air Defense Interception — Kahnooj',
    location: 'Kahnooj, Kerman, Iran',
    coordinates: CITY_COORDS['Kahnooj'],
    date: '2026-07-23',
    time: 'Night',
    status: 'confirmed',
    sources: [
      { name: 'Fotros Resistance', url: 'https://t.me/FotrosResistancee', type: 'analyst' },
    ],
    casualties: { military: 0, civilian: 0 },
    description: 'Iranian air defenses intercepted an American cruise missile over Kahnooj, Kerman province. Visual proof of the interception was released by Iranian sources.',
    satelliteImage: null,
    videoUrl: null,
  },
]

function main() {
  const existing = JSON.parse(fs.readFileSync(ATTACKS_FILE, 'utf8'))
  const existingIds = new Set(existing.map(a => a.id))

  // Add new incidents that don't already exist
  let added = 0
  for (const inc of NEW_INCIDENTS) {
    if (!existingIds.has(inc.id)) {
      existing.push(inc)
      added++
    }
  }

  // Sort by date then id
  existing.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return a.id - b.id
  })

  fs.writeFileSync(ATTACKS_FILE, JSON.stringify(existing, null, 2) + '\n')
  console.error(`Added ${added} new incidents. Total: ${existing.length}`)
  console.log(JSON.stringify({ added, total: existing.length }))
}

if (require.main === module) main()
module.exports = { NEW_INCIDENTS, CITY_COORDS, BASE_COORDS }
