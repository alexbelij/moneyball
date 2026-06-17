/**
 * designDrift.test.ts | v1.0.0 | 2026-06-13
 * T35 — Visual-regression / consistency guard (source scan, browser-free).
 *
 * Statically scans every UI surface under src/components for design-spec
 * violations so future drift FAILS CI without needing a real browser:
 *   - raw hex colours (every colour must come from styles/tokens.ts)
 *   - emoji used as icons (design-spec §4 / §7 — FORBIDDEN; unicode
 *     box-drawing / geometric glyphs are allowed)
 *   - non-zero border-radius (design-spec §4 — border-radius: 0)
 *   - "generic AI" tells: css gradients, glassmorphism / backdrop-filter
 *
 * This complements the DOM snapshots in surfaceContract.test.tsx.
 * Baseline-update process: there is no baseline to update — fix the source.
 */

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

// Vitest runs with cwd = apps/frontend (the package root).
const COMPONENTS_DIR = path.resolve(process.cwd(), 'src/components')

/** Recursively collect .ts/.tsx files (skip .css, .test, snapshots). */
function collect(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...collect(full))
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

/** Strip block, line, and JSX comments so documentation can mention hex/emoji. */
function stripComments(src: string): string {
  return src
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '') // {/* jsx */}
    .replace(/\/\*[\s\S]*?\*\//g, '')           // /* block */
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')        // // line  (keep http://)
}

const FILES = collect(COMPONENTS_DIR)
const rel = (f: string) => path.relative(COMPONENTS_DIR, f)

describe('design-drift guard', () => {
  it('finds UI surfaces to scan', () => {
    expect(FILES.length).toBeGreaterThan(5)
  })

  it('no raw hex colours in components (use styles/tokens.ts)', () => {
    const offenders: string[] = []
    for (const f of FILES) {
      const code = stripComments(readFileSync(f, 'utf8'))
      const m = code.match(/#[0-9a-fA-F]{3,8}\b/g)
      if (m) offenders.push(`${rel(f)}: ${[...new Set(m)].join(', ')}`)
    }
    expect(offenders, `raw hex found:\n${offenders.join('\n')}`).toEqual([])
  })

  it('no emoji icons (unicode box-drawing/geometric glyphs are allowed)', () => {
    // Glyphs explicitly permitted by design-spec §4 ("unicode box-drawing").
    const ALLOWED = '✓✗✕→←↑↓…—–·■□▶◀▸◂▾▴▲▼▽△●○◆◇×÷°№‹›«»'
    const allowedRe = new RegExp(`[${ALLOWED.replace(/[-[\]\\]/g, '\\$&')}]`, 'g')
    // Emoji / pictographic ranges (incl. ⏳ U+23F3, 🏆 U+1F3C6, ⭐ U+2B50, ☀ U+2600).
    const emojiRe = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{FE0F}\u{2122}\u{2139}]/u
    const offenders: string[] = []
    for (const f of FILES) {
      const code = stripComments(readFileSync(f, 'utf8')).replace(allowedRe, '')
      const m = code.match(new RegExp(emojiRe, 'gu'))
      if (m) offenders.push(`${rel(f)}: ${[...new Set(m)].join(' ')}`)
    }
    expect(offenders, `emoji icons found:\n${offenders.join('\n')}`).toEqual([])
  })

  it('border-radius is always 0 (design-spec §4)', () => {
    // T66: Anna's toast spec explicitly requires ~5px rounded corners
    // ("rounded-corner rectangle in the SNES/Sui pixel style").
    const RADIUS_WHITELIST = ['toast/Toast.tsx']
    const offenders: string[] = []
    for (const f of FILES) {
      if (RADIUS_WHITELIST.some((w) => rel(f).includes(w))) continue
      const code = stripComments(readFileSync(f, 'utf8'))
      const re = /border-?radius\s*:\s*['"]?([^,;'"\n}]+)/gi
      let m: RegExpExecArray | null
      while ((m = re.exec(code))) {
        if (parseFloat(m[1]) !== 0) offenders.push(`${rel(f)}: borderRadius ${m[1].trim()}`)
      }
    }
    expect(offenders, `non-zero radius found:\n${offenders.join('\n')}`).toEqual([])
  })

  it('no generic-AI tells (gradients, glassmorphism, backdrop-filter)', () => {
    const offenders: string[] = []
    const bad = /linear-gradient|radial-gradient|conic-gradient|backdrop-filter|-webkit-backdrop-filter|glassmorph/i
    for (const f of FILES) {
      const code = stripComments(readFileSync(f, 'utf8'))
      const m = code.match(bad)
      if (m) offenders.push(`${rel(f)}: ${m[0]}`)
    }
    expect(offenders, `anti-pattern found:\n${offenders.join('\n')}`).toEqual([])
  })
})
