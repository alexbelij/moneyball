/**
 * tokens.test | v1.0.0 | 2026-06-13
 * Purpose: Verify design-token values match docs/design-spec.md exactly.
 * T33: single source of truth — wrong values here ≈ wrong everywhere.
 */

import { describe, it, expect } from 'vitest'
import { palette, accents, fonts, borders, spacing, GRID, zIndex, shadows, T } from '../src/styles/tokens'

describe('palette matches design-spec §2', () => {
  it('bg-black', () => expect(palette.bgBlack).toBe('#000000'))
  it('surface (dark panel)', () => expect(palette.surface).toBe('#0c0c0c'))
  it('wall-green', () => expect(palette.wallGreen).toBe('#122116'))
  it('wall-green-2', () => expect(palette.wallGreen2).toBe('#1d311f'))
  it('wood-900', () => expect(palette.wood900).toBe('#181009'))
  it('wood-700', () => expect(palette.wood700).toBe('#341d0e'))
  it('wood-500', () => expect(palette.wood500).toBe('#4e2912'))
  it('wood-300', () => expect(palette.wood300).toBe('#876845'))
  it('wood-200', () => expect(palette.wood200).toBe('#9e7c54'))
  it('wood-100', () => expect(palette.wood100).toBe('#ac885e'))
  it('paper', () => expect(palette.paper).toBe('#f4ede2'))
  it('paper-bright', () => expect(palette.paperBright).toBe('#fffcf5'))
})

describe('accents', () => {
  it('gold (desk-lamp amber)', () => expect(accents.gold).toBe('#e8a44a'))
  it('red (exit-sign)', () => expect(accents.red).toBe('#e85c5c'))
  it('green (LCD/LED)', () => expect(accents.green).toBe('#39c04a'))
})

describe('typography matches design-spec §3', () => {
  it('header font includes Press Start 2P', () => {
    expect(fonts.header).toContain('Press Start 2P')
    expect(fonts.header).toContain('monospace')
  })
  it('body font includes VT323', () => {
    expect(fonts.body).toContain('VT323')
    expect(fonts.body).toContain('monospace')
  })
  it('no CDN or system sans-serif in font stacks', () => {
    for (const f of [fonts.header, fonts.body]) {
      expect(f).not.toContain('Inter')
      expect(f).not.toContain('Roboto')
      expect(f).not.toContain('system-ui')
    }
  })
})

describe('components match design-spec §4', () => {
  it('grid is 8px', () => expect(GRID).toBe(8))
  it('spacing scale is multiples of GRID', () => {
    expect(spacing.sm).toBe(8)
    expect(spacing.md).toBe(16)
    expect(spacing.lg).toBe(24)
    expect(spacing.xl).toBe(32)
  })
  it('border width is 2px', () => expect(borders.width).toBe(2))
  it('border-radius is 0', () => expect(borders.radius).toBe(0))
  it('standard border uses wood-700', () => {
    expect(borders.standard).toContain(palette.wood700)
    expect(borders.standard).toContain('2px solid')
  })
  it('hard shadow has no blur (offset only)', () => {
    // Pattern: Npx Npx 0 color (third value = 0 = no blur)
    expect(shadows.hard).toMatch(/\d+px \d+px 0 /)
    expect(shadows.hardSmall).toMatch(/\d+px \d+px 0 /)
  })
})

describe('z-index layers are ordered', () => {
  it('loading < modal < overlay < toast < wallet < topmost', () => {
    expect(zIndex.loading).toBeLessThan(zIndex.modal)
    expect(zIndex.modal).toBeLessThanOrEqual(zIndex.overlay)
    expect(zIndex.overlay).toBeLessThan(zIndex.toast)
    expect(zIndex.toast).toBeLessThan(zIndex.wallet)
    expect(zIndex.wallet).toBeLessThan(zIndex.topmost)
  })
})

describe('T flat convenience re-export', () => {
  it('includes palette values', () => {
    expect(T.paper).toBe(palette.paper)
    expect(T.wood900).toBe(palette.wood900)
    expect(T.wood700).toBe(palette.wood700)
  })
  it('includes accent values', () => {
    expect(T.gold).toBe(accents.gold)
    expect(T.red).toBe(accents.red)
  })
})
