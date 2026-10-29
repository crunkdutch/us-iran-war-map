const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const PROJECT_DIR = path.resolve(__dirname, '../..')
const PACKAGE_FILES = ['package.json', 'package-lock.json']
const TELEGRAM_MESSAGE_LIMIT = 4000

function runNpm(args, cwd = PROJECT_DIR) {
  try {
    const stdout = execSync(`npm ${args.join(' ')}`, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 600000,
    })
    return { code: 0, stdout, stderr: '' }
  } catch (error) {
    return {
      code: error.status ?? 1,
      stdout: error.stdout?.toString() || '',
      stderr: error.stderr?.toString() || error.message,
    }
  }
}

function parseAudit(result) {
  try {
    const audit = JSON.parse(result.stdout)
    if (!audit.vulnerabilities || typeof audit.vulnerabilities !== 'object' || Array.isArray(audit.vulnerabilities)) {
      return { ok: false, vulnerabilities: [] }
    }
    const vulnerabilities = Object.entries(audit.vulnerabilities || {})
      .filter(([, vulnerability]) => ['high', 'critical'].includes(vulnerability.severity))
      .map(([name, vulnerability]) => ({
        name,
        severity: vulnerability.severity,
        range: vulnerability.range,
        advisories: (vulnerability.via || [])
          .filter(item => typeof item === 'object')
          .map(item => ({ title: item.title, url: item.url })),
      }))
    return { ok: true, vulnerabilities }
  } catch {
    return { ok: false, vulnerabilities: [] }
  }
}

function snapshotPackageFiles(root) {
  return Object.fromEntries(PACKAGE_FILES.map(name => [
    name,
    fs.readFileSync(path.join(root, name)),
  ]))
}

function restorePackageFiles(root, snapshot) {
  for (const [name, contents] of Object.entries(snapshot)) {
    fs.writeFileSync(path.join(root, name), contents)
  }
}

function packageFilesChanged(root, snapshot) {
  return Object.entries(snapshot).some(([name, contents]) =>
    !fs.readFileSync(path.join(root, name)).equals(contents)
  )
}

async function validateProject(run, root) {
  for (const args of [['run', 'lint'], ['run', 'build']]) {
    const result = run(args, root)
    if (result.code !== 0) return { ok: false, failedCommand: `npm ${args.join(' ')}`, stderr: result.stderr }
  }
  return { ok: true }
}

async function runDependencyAudit({
  root = PROJECT_DIR,
  run = runNpm,
  validate = validateProject,
} = {}) {
  const report = {
    requiresAlert: false,
    scanSuccessful: false,
    findings: [],
    remainingFindings: [],
    fixAttempted: false,
    fixSuccessful: null,
    validationSuccessful: null,
    dependencyChanges: false,
    ready: true,
    errors: [],
  }
  const initial = parseAudit(run(['audit', '--json'], root))
  if (!initial.ok) {
    report.requiresAlert = true
    report.errors.push('Initial npm audit failed or returned invalid JSON.')
    return report
  }

  report.scanSuccessful = true
  report.findings = initial.vulnerabilities
  report.remainingFindings = [...initial.vulnerabilities]
  if (report.findings.length === 0) return report
  report.requiresAlert = true

  let snapshot
  try {
    snapshot = snapshotPackageFiles(root)
  } catch (error) {
    report.fixSuccessful = false
    report.errors.push(`Could not snapshot dependency files: ${error.message}`)
    return report
  }

  report.fixAttempted = true
  run(['audit', 'fix'], root)
  const afterFix = parseAudit(run(['audit', '--json'], root))
  if (afterFix.ok) report.remainingFindings = afterFix.vulnerabilities
  if (!afterFix.ok || afterFix.vulnerabilities.length > 0) {
    report.fixSuccessful = false
    report.errors.push(afterFix.ok
      ? 'npm audit fix left high or critical vulnerabilities unresolved.'
      : 'The post-fix npm audit failed or returned invalid JSON.')
  } else {
    let validation
    try {
      validation = await validate(run, root)
    } catch (error) {
      validation = { ok: false, failedCommand: 'Dependency validation', stderr: error.message }
    }
    report.validationSuccessful = validation.ok
    if (!validation.ok) {
      report.fixSuccessful = false
      report.errors.push(`${validation.failedCommand} failed: ${validation.stderr || 'no error details'}`)
    } else {
      report.fixSuccessful = true
      report.dependencyChanges = packageFilesChanged(root, snapshot)
      return report
    }
  }

  try {
    restorePackageFiles(root, snapshot)
    report.remainingFindings = [...report.findings]
    const restored = run(['ci'], root)
    if (restored.code !== 0) {
      report.ready = false
      report.errors.push(`Could not restore installed dependencies with npm ci: ${restored.stderr}`)
    }
  } catch (error) {
    report.ready = false
    report.errors.push(`Could not restore dependency files: ${error.message}`)
  }
  return report
}

function formatAlert(report, dependencyPublished) {
  const lines = [
    'Scheduled npm dependency audit for us-iran-war-map',
    `Scan successful: ${report.scanSuccessful ? 'yes' : 'no'}`,
    `Safe fix attempted: ${report.fixAttempted ? 'yes' : 'no'}`,
    `High/critical findings fixed and validated: ${report.fixSuccessful === true ? 'yes' : report.fixSuccessful === false ? 'no' : report.scanSuccessful ? 'not needed' : 'not run'}`,
    `Lint/build validation: ${report.validationSuccessful === true ? 'passed' : report.validationSuccessful === false ? 'failed' : 'not run'}`,
    `High/critical findings remaining after rollback/scan: ${report.remainingFindings.length}`,
    `Dependency changes published: ${dependencyPublished ? 'yes' : 'no'}`,
  ]
  if (report.findings.length) {
    lines.push('', 'High/critical findings from initial scan:')
    for (const finding of report.findings) {
      lines.push(`- ${finding.severity.toUpperCase()}: ${finding.name} (${finding.range || 'range unavailable'})`)
      for (const advisory of finding.advisories) {
        lines.push(`  ${advisory.title || 'Advisory'}${advisory.url ? ` — ${advisory.url}` : ''}`)
      }
    }
  }
  if (report.errors.length) lines.push('', 'Errors:', ...report.errors.map(error => `- ${error}`))
  return lines.join('\n')
}

async function sendDependencyAlert(report, dependencyPublished, {
  env = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = env
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    throw new Error('TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be configured.')
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('A fetch implementation is required to send Telegram alerts.')
  }

  const text = formatAlert(report, dependencyPublished)
  const messages = []
  let message = ''
  for (const character of text) {
    if (message.length + character.length > TELEGRAM_MESSAGE_LIMIT) {
      messages.push(message)
      message = ''
    }
    message += character
  }
  if (message) messages.push(message)

  for (const text of messages) {
    let response
    try {
      response = await fetchImpl(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text }),
      })
    } catch {
      throw new Error('Telegram Bot API request failed.')
    }

    let result
    try {
      result = await response.json()
    } catch {
      throw new Error('Telegram Bot API returned invalid JSON.')
    }
    if (!response.ok || !result.ok) {
      throw new Error(`Telegram Bot API rejected alert: ${result.description || response.statusText || 'unknown error'}`)
    }
  }
}

module.exports = { formatAlert, parseAudit, runDependencyAudit, sendDependencyAlert }
