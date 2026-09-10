// Shared i18n helpers for the locale hooks (post-edit.mjs, stop-gate.mjs).
// Pure logic, no hook I/O — keeps the two hooks thin and the baseline rule in one place.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

export const LOCALES = ['en', 'ru', 'uk', 'pl']
export const BASE = 'en' // fallbackLng in src/i18n/config.js — source of truth for MISSING

// ---------- working tree path resolution ----------
// Hooks may run with cwd = repo root OR cwd = .claude/ (VS Code sometimes sets this).
// Always resolve locales/src relative to the hook file so it works in both.
const HOOK_DIR = new URL('.', import.meta.url).pathname // .../.claude/hooks/
const REPO_ROOT = join(HOOK_DIR, '..', '..') // repo root (.. = .claude)

export const LOCALES_DIR = join(REPO_ROOT, 'src/i18n/locales')
export const SRC_DIR = join(REPO_ROOT, 'src')
export const BASELINE_PATH = join(REPO_ROOT, '.claude/i18n-baseline.json')

// ---------- locale loading & flattening ----------

export function loadLocaleRaw(lang) {
  return readFileSync(join(LOCALES_DIR, `${lang}.json`), 'utf8')
}

export function loadLocale(lang) {
  return JSON.parse(loadLocaleRaw(lang))
}

// { a: { b: 'x' } } -> { 'a.b': 'x' }. Arrays/scalars become leaves.
export function flatten(obj, prefix = '', out = {}) {
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

export function localeKeys(lang) {
  return new Set(Object.keys(flatten(loadLocale(lang))))
}

export function parseLocaleStrict(lang) {
  // returns { ok:true, keys:Set } or { ok:false, error:msg }
  let raw
  try {
    raw = loadLocaleRaw(lang)
  } catch (e) {
    return { ok: false, error: `Cannot read ${lang}.json: ${e.message}` }
  }
  let obj
  try {
    obj = JSON.parse(raw)
  } catch (e) {
    return { ok: false, error: `${lang}.json: ${e.message}` }
  }
  return { ok: true, keys: new Set(Object.keys(flatten(obj))) }
}

// ---------- DIFF: cross-locale key-set comparison ----------
// Returns { key: [missingLocales...] } for keys present in SOME but not ALL locales.
// Keys absent from all locales are NOT a diff (they're code-only — MISSING's job).
export function computeDiff() {
  const sets = {}
  for (const lang of LOCALES) sets[lang] = localeKeys(lang)
  const all = new Set([...sets.en, ...sets.ru, ...sets.uk, ...sets.pl])
  const diff = {}
  for (const key of [...all].sort()) {
    const missing = LOCALES.filter((lang) => !sets[lang].has(key))
    if (missing.length > 0 && missing.length < LOCALES.length) diff[key] = missing
  }
  return diff
}

// ---------- baseline ----------
let _baseline = null
export function loadBaseline() {
  if (_baseline) return _baseline
  try {
    _baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  } catch {
    _baseline = { diff: {}, missing: { knownDynamic: [] }, orphans: { keys: [] } }
  }
  return _baseline
}

// A diff entry is "new" (gate-worthy) if it's not in the frozen baseline.
// Baseline stores the SAME shape as computeDiff() output for direct comparison.
export function newDiffs(diff) {
  const base = loadBaseline().diff || {}
  const fresh = {}
  for (const [key, missing] of Object.entries(diff)) {
    const b = base[key]
    const same =
      Array.isArray(b) &&
      b.length === missing.length &&
      missing.every((m, i) => b[i] === m)
    if (!same) fresh[key] = missing
  }
  return fresh
}

// ---------- code scanning ----------
const CODE_EXT = new Set(['.tsx', '.jsx', '.ts', '.js'])

function walk(dir, acc = []) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return acc
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === '.git') continue
    const p = join(dir, name)
    let st
    try {
      st = statSync(p)
    } catch {
      continue
    }
    if (st.isDirectory()) walk(p, acc)
    else {
      const dot = name.lastIndexOf('.')
      if (dot !== -1 && CODE_EXT.has(name.slice(dot))) acc.push(p)
    }
  }
  return acc
}

// Anchored on t( / i18n.t( / i18nKey= only — NEVER bare backticks.
// src/services/api.js has dozens of `/users/${chatID}` URL template strings that
// would otherwise masquerade as i18n keys. Anchoring avoids that trap entirely.
const LITERAL_RE = /(?:(?:i18n\.)?\bt\(\s*|i18nKey\s*=\s*)(?:'([^']*)'|"([^"]*)")/g
const TEMPLATE_RE = /(?:(?:i18n\.)?\bt\(\s*|i18nKey\s*=\s*)`([^`]*?)\$\{/g

export function scanKeys() {
  const literals = new Set()
  const prefixes = new Set() // static prefixes of t(`a.b.${x}`)
  for (const file of walk(SRC_DIR)) {
    let src
    try {
      src = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    let m
    LITERAL_RE.lastIndex = 0
    while ((m = LITERAL_RE.exec(src)) !== null) {
      const key = m[1] ?? m[2]
      if (key) literals.add(key)
    }
    TEMPLATE_RE.lastIndex = 0
    while ((m = TEMPLATE_RE.exec(src)) !== null) {
      if (m[1]) prefixes.add(m[1])
    }
  }
  return { literals, prefixes }
}

// MISSING: literal keys in code but absent from en.json, minus known dynamic keys.
export function computeMissing(literals, enSet, knownDynamic) {
  const known = new Set(knownDynamic || [])
  return [...literals].filter((k) => !enSet.has(k) && !known.has(k)).sort()
}

// ORPHAN: keys in en.json never referenced (literal) and not covered by a template prefix.
export function computeOrphans(enKeys, literals, prefixes) {
  const used = new Set(literals)
  for (const key of enKeys) {
    for (const p of prefixes) {
      if (key.startsWith(p)) {
        used.add(key)
        break
      }
    }
  }
  return [...enKeys].filter((k) => !used.has(k)).sort()
}

// ---------- top-level namespace helpers ----------

export function topLevelNamespace(key) {
  // 'client.appointments.types.group' -> 'client'
  return key.split('.', 1)[0]
}

// ---------- hook payload extraction ----------
// tool_input shape differs between Claude Code (file_path) and VS Code (filePath).
export function extractFilePaths(toolInput) {
  if (!toolInput) return []
  const fp = toolInput.file_path ?? toolInput.filePath
  if (fp) return Array.isArray(fp) ? fp : [fp]
  // MultiEdit / NotebookEdit can nest multiple paths
  if (Array.isArray(toolInput.edits)) return toolInput.edits.map((e) => e.file_path ?? e.filePath).filter(Boolean)
  if (Array.isArray(toolInput.cells)) return toolInput.cells.map((c) => c.file_path ?? c.filePath).filter(Boolean)
  return []
}

// Is any edited path a locale JSON?
export function isLocaleEdit(paths) {
  return paths.some((p) => /i18n[\\/]+locales[\\/]+[a-z]+\.json$/.test(String(p)))
}
