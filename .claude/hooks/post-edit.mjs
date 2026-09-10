// PostToolUse hook: locale parity guard.
// Triggers on Edit|Write|MultiEdit|NotebookEdit touching src/i18n/locales/*.json.
//   - Broken JSON in any of the 4 locales   -> block (exit 2) with parse error.
//   - Cross-locale key-set diff not in baseline -> block (exit 2) with key -> missing locales.
//   - Otherwise: silent (exit 0).
//
// Reads hook JSON from stdin. Path fields: tool_input.file_path (Claude Code) or
// tool_input.filePath (VS Code) — both supported.
//
// This hook NEVER modifies the working tree. It only reports.
import * as lib from './_i18n-lib.mjs'

function block(msg) {
  process.stderr.write(msg + '\n')
  process.exit(2)
}

async function main() {
  let hook
  try {
    const raw = await readStdin()
    if (!raw) return // no stdin -> nothing to do, allow the edit
    hook = JSON.parse(raw)
  } catch {
    // Can't parse the hook payload — don't block an edit over our own bad input.
    return
  }

  // Only act on locale JSON edits. If the tool didn't touch a locale file, stay silent.
  const paths = lib.extractFilePaths(hook?.tool_input)
  if (!lib.isLocaleEdit(paths)) return

  // 1. Parse all four locales strictly. Broken JSON blocks immediately.
  for (const lang of lib.LOCALES) {
    const r = lib.parseLocaleStrict(lang)
    if (!r.ok) {
      block(
        `[i18n] Broken JSON — ${r.error}\n` +
          `Fix the syntax in ${lang}.json before continuing.`
      )
    }
  }

  // 2. Cross-locale diff. Anything not in the frozen baseline is a NEW hole -> block.
  const diff = lib.computeDiff()
  const fresh = lib.newDiffs(diff)
  const keys = Object.keys(fresh)
  if (keys.length === 0) return // clean

  const lines = keys
    .slice()
    .sort()
    .map((k) => `  ${k.padEnd(44)} -> missing in ${fresh[k].join(', ')}`)
  block(
    `[i18n] Locale parity broken — ${keys.length} new key gap(s) introduced:\n` +
      lines.join('\n') +
      '\n' +
      'Every key must exist in all 4 locales (en, ru, uk, pl). ' +
      'Keys missing from en.json render raw in ALL locales (fallbackLng: "en").\n' +
      'Add the missing key(s) to the listed locale file(s).'
  )
}

function readStdin() {
  return new Promise((resolve) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (c) => (data += c))
    process.stdin.on('end', () => resolve(data))
    // If stdin is closed with no data, resolve empty.
    process.stdin.on('error', () => resolve(''))
  })
}

main()
