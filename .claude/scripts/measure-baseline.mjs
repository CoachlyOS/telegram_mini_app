// One-shot baseline measurement for the i18n locale hooks.
// Replicates the exact logic used by post-edit.mjs (diff) and stop-gate.mjs (MISSING/ORPHAN)
// so the frozen baseline matches what the hooks will compute at runtime.
//
//   node .claude/scripts/measure-baseline.mjs
//
// Prints three sections:
//   DIFF      — flat-key set differences across the 4 locales (expected to be non-empty;
//               these are the pre-existing holes frozen into baseline).
//   MISSING   — literal keys found in code but absent from en.json (real bugs).
//   ORPHAN    — keys present in en.json but not referenced anywhere in code.
//
// Output is also written to .claude/i18n-baseline.json for the hooks to consume.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = process.cwd()
const LOCALES_DIR = join(ROOT, 'src/i18n/locales')
const SRC_DIR = join(ROOT, 'src')
const LOCALES = ['en', 'ru', 'uk', 'pl']
const BASE = 'en' // fallbackLng in src/i18n/config.js — the source of truth

// ---------- locale loading & flattening ----------

function loadLocale(lang) {
  const raw = readFileSync(join(LOCALES_DIR, `${lang}.json`), 'utf8')
  return JSON.parse(raw)
}

// flatten a nested object into dot-paths: { a: { b: 'x' } } -> { 'a.b': 'x' }
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      flatten(v, path, out)
    } else {
      out[path] = v
    }
  }
  return out
}

function localeKeys(lang) {
  return new Set(Object.keys(flatten(loadLocale(lang))))
}

// ---------- DIFF: set differences across the 4 locales ----------

function computeDiff() {
  const sets = {}
  for (const lang of LOCALES) sets[lang] = localeKeys(lang)

  const allKeys = new Set([...sets.en, ...sets.ru, ...sets.uk, ...sets.pl])
  const diff = {}
  for (const key of [...allKeys].sort()) {
    const missingIn = LOCALES.filter((lang) => !sets[lang].has(key))
    if (missingIn.length > 0 && missingIn.length < LOCALES.length) {
      // key exists in at least one locale but not all — a real hole
      diff[key] = missingIn
    }
    // keys missing from ALL locales are handled by MISSING, not DIFF
  }
  return diff
}

// ---------- code scanning for translation keys ----------

const CODE_EXT = new Set(['.tsx', '.jsx', '.ts', '.js'])

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, acc)
    else {
      const dot = name.lastIndexOf('.')
      if (dot !== -1 && CODE_EXT.has(name.slice(dot))) acc.push(p)
    }
  }
  return acc
}

// Extract literal keys from a source file.
//   t('a.b'), t("a.b"), i18n.t('a.b'), i18nKey="a.b"   -> literal key 'a.b'
//   t(`a.b.${x}`), i18n.t(`a.b.${x}`)                  -> static prefix 'a.b.'
// We deliberately do NOT scan bare backticks: src/services/api.js has dozens of
// `/users/${chatID}`-style template strings that are URLs, not i18n keys. Anchoring
// on t( / i18n.t( / i18nKey= avoids that trap.
const LITERAL_RE = /(?:(?:i18n\.)?\bt\(\s*|i18nKey\s*=\s*)(?:'([^']*)'|"([^"]*)")/g
const TEMPLATE_RE = /(?:(?:i18n\.)?\bt\(\s*|i18nKey\s*=\s*)`([^`]*?)\$\{/g

function scanKeys() {
  const literals = new Set()
  const prefixes = new Set() // static prefixes of template-literal keys
  const files = walk(SRC_DIR)
  for (const file of files) {
    const src = readFileSync(file, 'utf8')
    let m
    LITERAL_RE.lastIndex = 0
    while ((m = LITERAL_RE.exec(src)) !== null) {
      const key = m[1] ?? m[2]
      if (key) literals.add(key)
    }
    TEMPLATE_RE.lastIndex = 0
    while ((m = TEMPLATE_RE.exec(src)) !== null) {
      const prefix = m[1]
      if (prefix) prefixes.add(prefix)
    }
  }
  return { literals, prefixes }
}

// ---------- MISSING: literal keys in code but absent from en.json ----------

function computeMissing(literals, enSet) {
  const missing = []
  for (const key of [...literals].sort()) {
    if (!enSet.has(key)) missing.push(key)
  }
  return missing
}

// ---------- ORPHAN: keys in en.json not referenced anywhere ----------

function computeOrphans(enKeys, literals, prefixes) {
  const used = new Set(literals)
  // a prefix like 'professional.appointments.types.' makes every key under it "used"
  for (const key of enKeys) {
    for (const p of prefixes) {
      if (key.startsWith(p)) {
        used.add(key)
        break
      }
    }
  }
  const orphans = [...enKeys].filter((k) => !used.has(k)).sort()
  return orphans
}

// ---------- run ----------

const sets = {}
for (const lang of LOCALES) sets[lang] = [...localeKeys(lang)].sort()
const enSet = new Set(sets.en)
const { literals, prefixes } = scanKeys()

const diff = computeDiff()
const missing = computeMissing(literals, enSet)
const orphans = computeOrphans(enSet, literals, prefixes)

// Known dynamic keys: literals that look real but resolve at runtime. The Stop gate
// must NOT block on these. Listed explicitly so the baseline is self-documenting.
const knownDynamic = [
  'professional.appointments.types.personal',
  'professional.appointments.types.split',
  'professional.appointments.types.group',
  'professional.appointments.types.unavailable',
]

const report = {
  measuredAt: new Date().toISOString(),
  locales: LOCALES,
  base: BASE,
  counts: {
    literalCalls: null, // not computed here; hooks count calls, this measures keys
    distinctLiteralKeys: literals.size,
    templatePrefixes: [...prefixes].sort(),
    enKeyCount: enSet.size,
  },
  diff,                       // { key: [missingInLocales...] } — pre-existing holes
  missing,                    // [key...] literal keys absent from en.json
  knownDynamic,               // subset of missing/usage the gate must ignore
  orphans,                    // [key...] en.json keys never referenced in code
}

console.log(JSON.stringify(report, null, 2))
