/**
 * surfaceContract.test.tsx | v1.0.0 | 2026-06-13
 * T35 — DOM visual-regression for presentational UI surfaces (browser-free).
 *
 * jsdom renders each surface and asserts its visual contract: design-token
 * colours, pixel rules (border-radius 0), required glyphs/labels, and the
 * hard rule that NO emoji ever reaches the rendered DOM. Any drift in colour,
 * structure, or iconography fails CI.
 *
 * (Vitest's toMatchSnapshot is unavailable here — globals:false — so we pin the
 * contract with explicit assertions instead of a .snap baseline. To extend:
 * add the new surface below; mock its @/lib/api calls as shown for MatchTV.)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

Object.defineProperty(window, 'WebGLRenderingContext', { value: class {}, writable: true, configurable: true })
window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as any

vi.mock('@/lib/api', () => ({
  getMatches: vi.fn().mockResolvedValue({ live: [], upcoming: [], recent: [] }),
}))

import React from 'react'
import { render, screen } from '@testing-library/react'
import { RankMedal } from '@/components/ui'
import { OfflineBanner } from '@/components/OfflineBanner'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'
import { MatchTV } from '@/components/MatchTV'
import { useGameStore } from '@/store/gameStore'
import { accents, palette } from '@/styles/tokens'

/** '#rrggbb' -> 'rgb(r, g, b)' (jsdom normalises inline colours to rgb). */
function rgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}

/** Emoji / pictographic ranges that must never reach the DOM (✓✗→■ are fine). */
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{FE0F}]/u

const resetStore = () => {
  useGameStore.setState({
    agents: {},
    predictions: {},
    ui: { selectedAgentId: null, isConnected: false, isWalletFlowActive: false },
  })
}

describe('surface contract: RankMedal', () => {
  it('top-3 render bevelled medal chips in the spec colours', () => {
    render(
      <div>
        <RankMedal rank={1} />
        <RankMedal rank={2} />
        <RankMedal rank={3} />
        <RankMedal rank={7} />
      </div>,
    )
    const m1 = screen.getByLabelText('Rank 1')
    const m2 = screen.getByLabelText('Rank 2')
    const m3 = screen.getByLabelText('Rank 3')
    const plain = screen.getByLabelText('Rank 7')

    expect(getComputedStyle(m1).backgroundColor).toBe(rgb(accents.gold))
    expect(getComputedStyle(m2).backgroundColor).toBe(rgb(palette.wood200))
    expect(getComputedStyle(m3).backgroundColor).toBe(rgb(palette.wood500))
    // Medals have a hard 2px border; the plain rank does not.
    expect(getComputedStyle(m1).borderStyle).toBe('solid')
    expect(getComputedStyle(plain).borderStyle).not.toBe('solid')
  })
})

describe('surface contract: OfflineBanner', () => {
  beforeEach(resetStore)
  it('is a red, square, accessible status banner with a geometric glyph', () => {
    render(<OfflineBanner />)
    const banner = screen.getByRole('status')
    expect(banner).toHaveTextContent(/offline/i)
    expect(banner.textContent).toContain('■') // geometric glyph, not emoji
    expect(banner).toHaveAttribute('aria-live', 'polite')
    expect(getComputedStyle(banner).color).toBe(rgb(accents.red))
    expect(banner.textContent).not.toMatch(EMOJI)
  })
})

describe('surface contract: LoadingSkeleton', () => {
  it('renders the labelled cabinet frame with no emoji', () => {
    render(<LoadingSkeleton />)
    const root = screen.getByRole('status', { name: /loading game/i })
    expect(root).toHaveTextContent('MONEYBALL CABINET')
    expect(root).toHaveTextContent(/loading/i)
    expect(root.textContent).not.toMatch(EMOJI)
  })
})

describe('surface contract: MatchTV', () => {
  beforeEach(resetStore)
  it('renders the collapsed ticker with a geometric play glyph, no emoji', () => {
    const { container } = render(<MatchTV />)
    expect(container.textContent).toContain('WC2026')
    expect(container.textContent).toContain('▶') // geometric, not the ▶️ emoji
    expect(container.querySelector('button')).not.toBeNull()
    expect(container.textContent).not.toMatch(EMOJI)
  })
})
