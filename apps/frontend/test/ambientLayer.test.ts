/**
 * ambientLayer.test | v1.0.0 | 2026-06-13
 * Purpose: Unit tests for AmbientLayer pure geometry/math functions.
 * T25: isInsideTrapezoid, randomPointInTrapezoid, config validation.
 */

import { describe, it, expect } from 'vitest'
import {
  isInsideTrapezoid,
  randomPointInTrapezoid,
  LIGHT_CONES,
  AMBIENT_CONFIG,
  type LightCone,
} from '../src/phaser/world/ambientGeometry'

/* ── Test cone (simple for predictable math) ─────────────────────────── */

const testCone: LightCone = {
  id: 'test',
  topLeft: 100,
  topRight: 200,
  topY: 0,
  bottomLeft: 50,
  bottomRight: 250,
  bottomY: 100,
}

/* ── isInsideTrapezoid ───────────────────────────────────────────────── */

describe('isInsideTrapezoid', () => {
  it('center point is inside', () => {
    expect(isInsideTrapezoid(150, 50, testCone)).toBe(true)
  })

  it('top-left corner is inside (on boundary)', () => {
    expect(isInsideTrapezoid(100, 0, testCone)).toBe(true)
  })

  it('top-right corner is inside (on boundary)', () => {
    expect(isInsideTrapezoid(200, 0, testCone)).toBe(true)
  })

  it('bottom-left corner is inside (on boundary)', () => {
    expect(isInsideTrapezoid(50, 100, testCone)).toBe(true)
  })

  it('bottom-right corner is inside (on boundary)', () => {
    expect(isInsideTrapezoid(250, 100, testCone)).toBe(true)
  })

  it('above topY is outside', () => {
    expect(isInsideTrapezoid(150, -1, testCone)).toBe(false)
  })

  it('below bottomY is outside', () => {
    expect(isInsideTrapezoid(150, 101, testCone)).toBe(false)
  })

  it('left of left edge is outside', () => {
    // At y=50: left edge = 100 + (50 - 100) * 0.5 = 75
    expect(isInsideTrapezoid(74, 50, testCone)).toBe(false)
  })

  it('right of right edge is outside', () => {
    // At y=50: right edge = 200 + (250 - 200) * 0.5 = 225
    expect(isInsideTrapezoid(226, 50, testCone)).toBe(false)
  })

  it('midpoint edge interpolation is correct', () => {
    // At y=50 (t=0.5): left = 100 + (50-100)*0.5 = 75, right = 200 + (250-200)*0.5 = 225
    expect(isInsideTrapezoid(75, 50, testCone)).toBe(true)
    expect(isInsideTrapezoid(225, 50, testCone)).toBe(true)
    expect(isInsideTrapezoid(74.9, 50, testCone)).toBe(false)
  })
})

/* ── randomPointInTrapezoid ──────────────────────────────────────────── */

describe('randomPointInTrapezoid', () => {
  it('generates points inside the cone (100 samples)', () => {
    for (let i = 0; i < 100; i++) {
      const [x, y] = randomPointInTrapezoid(testCone)
      expect(isInsideTrapezoid(x, y, testCone)).toBe(true)
    }
  })

  it('generates points within y range', () => {
    for (let i = 0; i < 50; i++) {
      const [, y] = randomPointInTrapezoid(testCone)
      expect(y).toBeGreaterThanOrEqual(testCone.topY)
      expect(y).toBeLessThanOrEqual(testCone.bottomY)
    }
  })
})

/* ── Real light cones ────────────────────────────────────────────────── */

describe('LIGHT_CONES', () => {
  it('has exactly 2 cones (left + right)', () => {
    expect(LIGHT_CONES).toHaveLength(2)
    expect(LIGHT_CONES[0].id).toBe('left')
    expect(LIGHT_CONES[1].id).toBe('right')
  })

  it('cones are within background bounds (3394x1440)', () => {
    for (const cone of LIGHT_CONES) {
      expect(cone.topLeft).toBeGreaterThanOrEqual(0)
      expect(cone.bottomRight).toBeLessThanOrEqual(3394)
      expect(cone.topY).toBeGreaterThanOrEqual(0)
      expect(cone.bottomY).toBeLessThanOrEqual(1440)
    }
  })

  it('cones do not overlap horizontally', () => {
    const left = LIGHT_CONES[0]
    const right = LIGHT_CONES[1]
    // At bottom (widest): left ends at 650, right starts at 830
    expect(left.bottomRight).toBeLessThan(right.bottomLeft)
  })

  it('random points in real cones stay inside', () => {
    for (const cone of LIGHT_CONES) {
      for (let i = 0; i < 50; i++) {
        const [x, y] = randomPointInTrapezoid(cone)
        expect(isInsideTrapezoid(x, y, cone)).toBe(true)
      }
    }
  })
})

/* ── Config sanity checks ────────────────────────────────────────────── */

describe('AMBIENT_CONFIG', () => {
  it('particle count is reasonable (<=60)', () => {
    expect(AMBIENT_CONFIG.maxParticles).toBeGreaterThan(0)
    expect(AMBIENT_CONFIG.maxParticles).toBeLessThanOrEqual(60)
  })

  it('speed range is valid', () => {
    expect(AMBIENT_CONFIG.minSpeed).toBeLessThan(AMBIENT_CONFIG.maxSpeed)
    expect(AMBIENT_CONFIG.minSpeed).toBeGreaterThan(0)
  })

  it('alpha range is within [0,1]', () => {
    expect(AMBIENT_CONFIG.minAlpha).toBeGreaterThanOrEqual(0)
    expect(AMBIENT_CONFIG.maxAlpha).toBeLessThanOrEqual(1)
    expect(AMBIENT_CONFIG.minAlpha).toBeLessThan(AMBIENT_CONFIG.maxAlpha)
  })

  it('flicker dip is subtle (<=10%)', () => {
    expect(AMBIENT_CONFIG.flickerDipMax).toBeLessThanOrEqual(0.10)
  })

  it('flicker interval is in seconds-range', () => {
    expect(AMBIENT_CONFIG.flickerMinInterval).toBeGreaterThanOrEqual(2000)
    expect(AMBIENT_CONFIG.flickerMaxInterval).toBeLessThanOrEqual(20000)
  })

  it('lifetime range is valid', () => {
    expect(AMBIENT_CONFIG.minLife).toBeLessThan(AMBIENT_CONFIG.maxLife)
    expect(AMBIENT_CONFIG.fadeDuration * 2).toBeLessThan(AMBIENT_CONFIG.minLife)
  })
})
