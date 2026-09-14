#!/usr/bin/env node
/**
 * prune-sources.js — delete raw Telegram HTML older than a retention window.
 *
 * Safe because parse-all.js persists everything (attacks, sitreps, statements,
 * media, casualties, Hormuz data) into the JSON stores every cycle — the raw
 * HTML under src/data/sources/ is pure scratch once parsed. It is also
 * gitignored, so pruning never touches what ships to Vercel.
 *
 * Age is read from the fetch-time epoch-ms embedded in each filename
 * (`<channel>-<epochMs>.html`) rather than mtime, because `git clone` resets
 * mtimes to clone time. Falls back to mtime when the filename isn't parseable.
 *
 * Retention is configurable via SOURCE_RETENTION_DAYS (default 7).
 */

const fs = require('fs')
const path = require('path')

const SOURCES_DIR = path.join(__dirname, 'sources')
const RETENTION_DAYS = parseInt(process.env.SOURCE_RETENTION_DAYS || '7', 10)
const CUTOFF_MS = Date.now() - RETENTION_DAYS * 24 * 3600 * 1000

if (!fs.existsSync(SOURCES_DIR)) {
  console.error('No sources dir — nothing to prune.')
  process.exit(0)
}

const files = fs.readdirSync(SOURCES_DIR).filter(f => f.endsWith('.html'))
let deleted = 0
let freedBytes = 0
let skipped = 0

for (const f of files) {
  const p = path.join(SOURCES_DIR, f)
  try {
    let ageMs = null
    const m = f.match(/-(\d{10,})\.html$/)
    if (m) {
      ageMs = parseInt(m[1], 10)
    } else {
      ageMs = fs.statSync(p).mtimeMs
    }
    if (ageMs < CUTOFF_MS) {
      freedBytes += fs.statSync(p).size
      fs.unlinkSync(p)
      deleted++
    } else {
      skipped++
    }
  } catch (e) {
    console.error(`  skip ${f}: ${e.message}`)
  }
}

const freedMb = (freedBytes / 1024 / 1024).toFixed(1)
console.error(
  `Pruned ${deleted} files (kept ${skipped}), freed ${freedMb} MB (retention ${RETENTION_DAYS}d)`
)
console.log(JSON.stringify({ deleted, kept: skipped, freedBytes, retentionDays: RETENTION_DAYS }))
