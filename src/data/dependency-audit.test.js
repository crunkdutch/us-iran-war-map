const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const { formatAlert, runDependencyAudit, sendDependencyAlert } = require('./dependency-audit')

const vulnerableAudit = JSON.stringify({
  vulnerabilities: {
    sample: {
      severity: 'high',
      range: '<2.0.0',
      via: [{ title: 'Sample advisory', url: 'https://example.test/advisory' }],
    },
  },
})
const cleanAudit = JSON.stringify({ vulnerabilities: {} })
const moderateAudit = JSON.stringify({
  vulnerabilities: {
    sample: { severity: 'moderate', via: [] },
  },
})

function setupFiles() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dependency-audit-'))
  fs.writeFileSync(path.join(root, 'package.json'), '{"name":"test"}')
  fs.writeFileSync(path.join(root, 'package-lock.json'), '{"lockfileVersion":3}')
  return root
}

test('clean audit skips fixes and alerts', async () => {
  const root = setupFiles()
  const report = await runDependencyAudit({
    root,
    run: () => ({ code: 0, stdout: cleanAudit, stderr: '' }),
  })

  test('moderate findings do not trigger high/critical fixes or alerts', async () => {
    const root = setupFiles()
    const report = await runDependencyAudit({
      root,
      run: () => ({ code: 1, stdout: moderateAudit, stderr: '' }),
    })

    assert.equal(report.scanSuccessful, true)
    assert.equal(report.requiresAlert, false)
    assert.equal(report.fixAttempted, false)
    fs.rmSync(root, { recursive: true, force: true })
  })

  test('invalid audit output triggers an alert and skips fixes', async () => {
    const root = setupFiles()
    const report = await runDependencyAudit({
      root,
      run: () => ({ code: 1, stdout: '{"error":{"code":"ECONNRESET"}}', stderr: '' }),
    })

    assert.equal(report.scanSuccessful, false)
    assert.equal(report.requiresAlert, true)
    assert.equal(report.fixAttempted, false)
    fs.rmSync(root, { recursive: true, force: true })
  })

  assert.equal(report.scanSuccessful, true)
  assert.equal(report.requiresAlert, false)
  assert.equal(report.fixAttempted, false)
  fs.rmSync(root, { recursive: true, force: true })
})

test('cleared findings are validated and reported as a successful fix', async () => {
  const root = setupFiles()
  let scans = 0
  const commands = []
  const report = await runDependencyAudit({
    root,
    run(args) {
      commands.push(args)
      if (args[0] === 'audit' && args[1] === 'fix') {
        fs.writeFileSync(path.join(root, 'package-lock.json'), '{"lockfileVersion":3,"fixed":true}')
        return { code: 0, stdout: '', stderr: '' }
      }
      if (args[0] === 'audit') return { code: ++scans === 1 ? 1 : 0, stdout: scans === 1 ? vulnerableAudit : cleanAudit, stderr: '' }
      return { code: 0, stdout: '', stderr: '' }
    },
    async validate() {
      return { ok: true }
    },
  })

  assert.equal(report.fixSuccessful, true)
  assert.equal(report.validationSuccessful, true)
  assert.equal(report.dependencyChanges, true)
  assert.deepEqual(commands[1], ['audit', 'fix'])
  fs.rmSync(root, { recursive: true, force: true })
})

test('unresolved findings restore package files and installed dependencies', async () => {
  const root = setupFiles()
  const originalLock = fs.readFileSync(path.join(root, 'package-lock.json'))
  let audits = 0
  let restored = false
  const report = await runDependencyAudit({
    root,
    run(args) {
      if (args[0] === 'audit' && args[1] === 'fix') {
        fs.writeFileSync(path.join(root, 'package-lock.json'), '{"lockfileVersion":3,"partial":true}')
        return { code: 1, stdout: '', stderr: 'unresolved' }
      }
      if (args[0] === 'audit') return { code: 1, stdout: ++audits === 1 ? vulnerableAudit : vulnerableAudit, stderr: '' }
      if (args[0] === 'ci') {
        restored = true
        return { code: 0, stdout: '', stderr: '' }
      }
      throw new Error(`Unexpected command: ${args.join(' ')}`)
    },
  })

  assert.equal(report.fixSuccessful, false)
  assert.equal(report.ready, true)
  assert.equal(restored, true)
  assert.deepEqual(fs.readFileSync(path.join(root, 'package-lock.json')), originalLock)
  fs.rmSync(root, { recursive: true, force: true })
})

test('validation failure restores dependency files and installed dependencies', async () => {
  const root = setupFiles()
  const originalLock = fs.readFileSync(path.join(root, 'package-lock.json'))
  let audits = 0
  const report = await runDependencyAudit({
    root,
    run(args) {
      if (args[0] === 'audit' && args[1] === 'fix') {
        fs.writeFileSync(path.join(root, 'package-lock.json'), '{"lockfileVersion":3,"fixed":true}')
        return { code: 0, stdout: '', stderr: '' }
      }
      if (args[0] === 'audit') return { code: ++audits === 1 ? 1 : 0, stdout: audits === 1 ? vulnerableAudit : cleanAudit, stderr: '' }
      if (args[0] === 'ci') return { code: 0, stdout: '', stderr: '' }
      throw new Error(`Unexpected command: ${args.join(' ')}`)
    },
    async validate() {
      return { ok: false, failedCommand: 'npm run build', stderr: 'build failed' }
    },
  })

  assert.equal(report.fixSuccessful, false)
  assert.deepEqual(fs.readFileSync(path.join(root, 'package-lock.json')), originalLock)
  assert.ok(report.errors.some(error => error.includes('npm run build failed')))
  fs.rmSync(root, { recursive: true, force: true })
})

test('Telegram alerts use the configured bot and split messages within API limits', async () => {
  const report = {
    scanSuccessful: true,
    findings: [],
    remainingFindings: [],
    fixAttempted: false,
    fixSuccessful: null,
    validationSuccessful: null,
    errors: ['x'.repeat(5000)],
  }
  const requests = []
  await sendDependencyAlert(report, false, {
    env: { TELEGRAM_BOT_TOKEN: 'bot-token', TELEGRAM_CHAT_ID: '-100123' },
    async fetchImpl(url, options) {
      requests.push({ url, body: JSON.parse(options.body) })
      return { ok: true, async json() { return { ok: true } } }
    },
  })

  assert.equal(requests.length, 2)
  assert.ok(requests.every(({ url, body }) =>
    url === 'https://api.telegram.org/botbot-token/sendMessage' &&
    body.chat_id === '-100123' &&
    body.text.length <= 4000
  ))
  assert.equal(requests.map(({ body }) => body.text).join(''), formatAlert(report, false))
})

test('Telegram alert failures are surfaced', async () => {
  const report = {
    scanSuccessful: false,
    findings: [],
    remainingFindings: [],
    fixAttempted: false,
    fixSuccessful: null,
    validationSuccessful: null,
    errors: [],
  }
  await assert.rejects(
    sendDependencyAlert(report, false, {
      env: { TELEGRAM_BOT_TOKEN: 'bot-token', TELEGRAM_CHAT_ID: '-100123' },
      async fetchImpl() {
        return { ok: true, async json() { return { ok: false, description: 'bot was blocked' } } }
      },
    }),
    /Telegram Bot API rejected alert: bot was blocked/
  )
  await assert.rejects(
    sendDependencyAlert(report, false, { env: {} }),
    /TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be configured/
  )
})
