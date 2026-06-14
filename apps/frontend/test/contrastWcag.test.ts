/**
 * contrastWcag.test | v1.0.0 | 2026-06-14
 * T46 — CI guard: every text/accent token must pass WCAG AA contrast
 * (≥ 4.5:1 normal text, ≥ 3.0 for accent.red used only as a signal)
 * against the primary dark background (palette.wood900).
 *
 * If this test fails, fix the token in tokens.ts — do NOT weaken the
 * threshold. Use scripts/contrast-check.ts to explore candidates.
 */

import { describe, it, expect } from 'vitest'
import { palette, text, accents, agentColors } from '../src/styles/tokens'
import {
  contrastRatio,
  buildContrastPairs,
  checkContrast,
} from '../scripts/contrast-check'

describe('WCAG AA contrast (T46)', () => {
  const pairs = buildContrastPairs({
    wood900:     palette.wood900,
    textPrimary: text.primary,
    textDim:     text.dim,
    textMuted:   text.muted,
    textFaint:   text.faint,
    accentGold:  accents.gold,
    accentRed:   accents.red,
    accentGreen: accents.green,
    agentColors: { ...agentColors },
  })

  const results = checkContrast(pairs)

  for (const r of results) {
    it(`${r.name} — ${r.fg} on ${r.bg} ≥ ${r.threshold}:1`, () => {
      expect(r.ratio).toBeGreaterThanOrEqual(r.threshold)
    })
  }

  it('contrastRatio is symmetric (order-independent)', () => {
    const a = contrastRatio('#ffffff', '#000000')
    const b = contrastRatio('#000000', '#ffffff')
    expect(a).toBe(b)
    expect(a).toBeCloseTo(21, 0)
  })

  it('all results pass', () => {
    const failing = results.filter((r) => !r.pass)
    if (failing.length > 0) {
      const detail = failing
        .map((r) => `${r.name}: ${r.ratio.toFixed(2)}:1 (need ${r.threshold}:1)`)
        .join('\n')
      expect.fail(`WCAG AA contrast failures:\n${detail}`)
    }
  })
})
