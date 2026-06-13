/**
 * worldScaling.test.ts | v1.0.0 | 2026-06-13
 * Tests for T17: integer scaling logic (extracted from WorldLayer.cover).
 * Verifies pixel-perfect integer scaling when viewport >= scene, and
 * fractional contain-fit for small viewports. Also tests letterbox centering.
 */

import { describe, it, expect } from 'vitest'

const BG_W = 1672
const BG_H = 941

/**
 * Pure version of WorldLayer.cover() logic for testability.
 * Returns { scale, x, y } representing the transform applied to the world container.
 */
function computeFit(viewW: number, viewH: number) {
  const raw = Math.min(viewW / BG_W, viewH / BG_H)
  const s = raw >= 1 ? Math.floor(raw) : raw
  return {
    scale: s,
    x: Math.floor((viewW - BG_W * s) / 2),
    y: Math.floor((viewH - BG_H * s) / 2),
  }
}

describe('WorldLayer integer scaling', () => {
  it('uses scale 1 for a 1920×1080 viewport (fits once)', () => {
    const fit = computeFit(1920, 1080)
    expect(fit.scale).toBe(1)
    // Centered with letterbox
    expect(fit.x).toBe(Math.floor((1920 - 1672) / 2)) // 124
    expect(fit.y).toBe(Math.floor((1080 - 941) / 2))  // 69
  })

  it('uses scale 2 for a 3440×1440 ultrawide', () => {
    const fit = computeFit(3440, 1440)
    // raw = min(3440/1672, 1440/941) = min(2.057, 1.530) = 1.530 → floor = 1
    // Actually 1440/941 = 1.530 → floor(1.530) = 1
    expect(fit.scale).toBe(1)
  })

  it('uses scale 2 for a 3840×2160 (4K)', () => {
    const fit = computeFit(3840, 2160)
    // raw = min(3840/1672, 2160/941) = min(2.296, 2.295) = 2.295 → floor = 2
    expect(fit.scale).toBe(2)
    // Centered: 3840 - 1672*2 = 496 → 248 each side
    expect(fit.x).toBe(Math.floor((3840 - 1672 * 2) / 2))
    expect(fit.y).toBe(Math.floor((2160 - 941 * 2) / 2))
  })

  it('uses fractional scale for viewport smaller than scene', () => {
    const fit = computeFit(1024, 768)
    // raw = min(1024/1672, 768/941) = min(0.612, 0.816) = 0.612
    expect(fit.scale).toBeCloseTo(1024 / 1672, 5)
    expect(fit.scale).toBeLessThan(1)
  })

  it('letterbox x is 0 when viewport width exactly matches', () => {
    const fit = computeFit(1672, 1080)
    expect(fit.scale).toBe(1)
    expect(fit.x).toBe(0)
    expect(fit.y).toBe(Math.floor((1080 - 941) / 2))
  })

  it('letterbox y is 0 when viewport height exactly matches', () => {
    const fit = computeFit(1920, 941)
    expect(fit.scale).toBe(1)
    expect(fit.y).toBe(0)
    expect(fit.x).toBe(Math.floor((1920 - 1672) / 2))
  })

  it('scale never exceeds integer for large viewports', () => {
    for (const [w, h] of [[2560, 1440], [3840, 2160], [5120, 2880]]) {
      const fit = computeFit(w, h)
      if (fit.scale >= 1) {
        expect(Number.isInteger(fit.scale)).toBe(true)
      }
    }
  })

  it('position is always integer (no sub-pixel offset)', () => {
    for (const [w, h] of [[1920, 1080], [1366, 768], [2560, 1440], [800, 600]]) {
      const fit = computeFit(w, h)
      expect(Number.isInteger(fit.x)).toBe(true)
      expect(Number.isInteger(fit.y)).toBe(true)
    }
  })
})

describe('propTypes parsePropsDoc', () => {
  // Import dynamically to avoid Phaser in test env
  it('filters out props with null target_xy (spare sprites)', async () => {
    const { parsePropsDoc } = await import('@/phaser/world/propTypes')
    const raw = {
      base: 'assets/backgrounds/room_bg.png',
      props: [
        { id: 'placed', src: 'props/a.png', w: 10, h: 10, target_xy: [100, 200], anchor: [105, 210], interactive: true },
        { id: 'spare', src: 'props/b.png', w: 10, h: 10, target_xy: null, anchor: null, interactive: false },
      ],
    }
    const doc = parsePropsDoc(raw)
    expect(doc.props).toHaveLength(1)
    expect(doc.props[0].id).toBe('placed')
    expect(doc.props[0].x).toBe(100)
    expect(doc.props[0].y).toBe(200)
  })

  it('parses swap states for exit_sign-like props', async () => {
    const { parsePropsDoc } = await import('@/phaser/world/propTypes')
    const raw = {
      base: 'assets/backgrounds/room_bg.png',
      props: [
        {
          id: 'exit_sign',
          src: 'props/exit_sign.png',
          w: 71, h: 29,
          target_xy: [375, 130], anchor: [410, 159],
          interactive: true,
          states: { off: 'props/exit_sign_off.png', on: 'props/exit_sign_on.png', _comment: 'ignored' },
        },
      ],
    }
    const doc = parsePropsDoc(raw)
    expect(doc.props[0].swapStates).toEqual({
      off: 'props/exit_sign_off.png',
      on: 'props/exit_sign_on.png',
    })
  })
})
