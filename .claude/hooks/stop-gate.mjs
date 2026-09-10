// Stop hook: translation-key gate that runs when the model stops.
// Compares literal translation keys found in code against en.json (fallbackLng).
//
//   MISSING  — literal key (t('...') / i18n.t('...') / i18nKey="...") used in code
//              but absent from en.json. BLOCKS, except the known-dynamic keys in
//              the baseline (client.appointments.types.*).
//   ORPHAN   — key present in en.json but never referenced in code. Advisory only:
//              never blocks, and only reports orphans in the top-level namespaces
//              the current turn edited (so it stays useful when deleting screens).
//
// The scanner is anchored on t( / i18n.t( / i18nKey= only. It does NOT scan bare
// backticks: src/services/api.js has `/users/${chatID}`-style URL templates that
// would pollute the key list with prefixes like "/clients/".
//
// Output contract (single JSON object on stdout, identical for both block dialects):
//   {"decision":"block","followup_message":msg,"reason":msg,
//    "hookSpecificOutput":{"decision":"block","hookEventName":"Stop","reason":msg}}
//
// Attempt counter: .gocheck/attempts (max 3). After 3 blocked rounds the gate
// goes silent and hands control back to the developer, so it can't hard-lock a
// session. On a clean pass it cleans up .gocheck/attempts and .gocheck/pending-edits.
//
// This hook NEVER modifies source files. It only writes its own bookkeeping under .gocheck/.
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import * as lib from './_i18n-lib.mjs'

const REPO_ROOT = join(new URL('.', import.meta.url).pathname, '..', '..')
const GOCHECK = join(REPO_ROOT, '.gocheck')
const ATTEMPTS = join(GOCHECK, 'attempts')
const PENDING = join(GOCHECK, 'pending-edits')
const MAX_ATTEMPTS = 3

// Which code files did this turn touch? Best-effort: git diff of the working tree
// (staged + unstaged + untracked), filtered to source files. We do NOT track this
// via a separate PostToolUse hook because the spec only defines one PostToolUse
// (the locale-parity guard). Scoping orphans to git-touched files keeps the gate
// self-contained and useful when a screen is deleted. Falls back to "all" on failure.
function touchedCodePaths() {
  const out = new Set()
  try {
    const staged = execSync('git diff --cached --name-only --diff-filter=AMR -z', { cwd: REPO_ROOT })
    const unstaged = execSync('git diff --name-only --diff-filter=AMR -z', { cwd: REPO_ROOT })
    const untracked = execSync('git ls-files --others --exclude-standard -z', { cwd: REPO_ROOT })
    const blob = Buffer.concat([staged, unstaged, untracked]).toString('utf8')
    for (const p of blob.split('\0').filter(Boolean)) out.add(join(REPO_ROOT, p))
  } catch {
    return null
  }
  if (out.size === 0) return null
  return out
}

// Map touched code files to the top-level i18n namespaces they reference.
function namespacesTouched(paths) {
  if (!paths) return null // unknown -> report all (safe default)
  const ns = new Set()
  for (const p of paths) {
    const s = String(p)
    if (/i18n[\\/]+locales/.test(s)) continue // locale edits don't tell us code namespaces
    if (!/\.(tsx|jsx|ts|js)$/.test(s)) continue
    try {
      const src = readFileSync(s, 'utf8')
      const re = /(?:(?:i18n\.)?\bt\(\s*|i18nKey\s*=\s*)(?:'([^']*)'|"([^"]*)")/g
      let m
      while ((m = re.exec(src)) !== null) {
        const k = m[1] ?? m[2]
        if (k) ns.add(k.split('.', 1)[0])
      }
    } catch {}
  }
  return ns.size ? ns : null
}

function block(msg) {
  const payload = {
    decision: 'block',
    followup_message: msg,
    reason: msg,
    hookSpecificOutput: {
      decision: 'block',
      hookEventName: 'Stop',
      reason: msg,
    },
  }
  process.stdout.write(JSON.stringify(payload) + '\n')
  process.exit(0) // block is signaled via the JSON, not a non-zero exit
}

function cleanPass() {
  try {
    if (existsSync(ATTEMPTS)) unlinkSync(ATTEMPTS)
    if (existsSync(PENDING)) unlinkSync(PENDING)
  } catch {}
  // silent pass — emit nothing
  process.exit(0)
}

function bumpAttempts() {
  try {
    mkdirSync(GOCHECK, { recursive: true })
    let n = 0
    if (existsSync(ATTEMPTS)) n = parseInt(readFileSync(ATTEMPTS, 'utf8').trim(), 10) || 0
    n += 1
    writeFileSync(ATTEMPTS, String(n))
    return n
  } catch {
    return MAX_ATTEMPTS + 1 // can't track -> don't hard-lock
  }
}

async function main() {
  let hook
  try {
    const raw = await readStdin()
    hook = raw ? JSON.parse(raw) : {}
  } catch {
    hook = {}
  }

  // 1. MISSING: scan code, compare literal keys against en.json.
  const enSet = lib.localeKeys('en')
  const { literals, prefixes } = lib.scanKeys()
  const baseline = lib.loadBaseline()
  const knownDynamic = baseline?.missing?.knownDynamic || []
  const missing = lib.computeMissing(literals, enSet, knownDynamic)

  if (missing.length > 0) {
    const n = bumpAttempts()
    if (n > MAX_ATTEMPTS) {
      // Gate gives up after MAX_ATTEMPTS rounds — hand control back to the developer.
      process.exit(0)
    }
    const lines = missing.map((k) => `  - ${k}`)
    block(
      `[i18n] ${missing.length} key(s) used in code but missing from en.json (rendered raw in ALL locales — fallbackLng: "en"):\n` +
        lines.join('\n') +
        '\n' +
        'Add each key to src/i18n/locales/en.json (and ideally all 4 locales), or remove the call.\n' +
        `(gate attempt ${n}/${MAX_ATTEMPTS}; after ${MAX_ATTEMPTS} it steps aside)`
    )
  }

  // 2. ORPHAN: advisory, scoped to namespaces touched this turn.
  const enKeys = [...enSet]
  const orphans = lib.computeOrphans(enKeys, literals, prefixes)
  if (orphans.length > 0) {
    const touched = namespacesTouched(touchedCodePaths())
    const scoped = touched
      ? orphans.filter((k) => touched.has(k.split('.', 1)[0]))
      : orphans
    if (scoped.length > 0) {
      // Non-blocking: print advisory to stderr so it doesn't pollute the block channel.
      process.stderr.write(
        `[i18n] Advisory: ${scoped.length} orphaned key(s) in en.json (not referenced in code) in namespace(s) you edited:\n` +
          scoped.map((k) => `  - ${k}`).join('\n') +
          "\nThese do not block. Remove them when you delete a screen/feature.\n"
      )
    }
  }

  cleanPass()
}

function readStdin() {
  return new Promise((resolve) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (c) => (data += c))
    process.stdin.on('end', () => resolve(data))
    process.stdin.on('error', () => resolve(''))
  })
}

main()
