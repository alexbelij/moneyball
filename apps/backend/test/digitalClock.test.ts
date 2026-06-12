/**
 * digitalClock.test | v0.1.0 | 2026-06-12
 * Unit tests for the 7-segment clock core: bitmask integrity, local-time
 * digit extraction, colon blink phase, segment geometry, and layout fitting.
 */

import { describe, expect, it } from 'vitest'
import {
  SEVEN_SEG,
  allSegmentRects,
  colonVisible,
  layoutClock,
  localTimeDigits,
  popcount,
  segmentRects,
} from '@moneyball/shared/digitalClock'

describe('SEVEN_SEG bitmasks', () => {
  it('covers digits 0-9 with unique masks', () => {
    expect(SEVEN_SEG.length).toBe(10)
    expect(new Set(SEVEN_SEG).size).toBe(10)
  })

  it('has canonical segment counts', () => {
    const counts = SEVEN_SEG.map((m) => popcount(m))
    expect(counts).toEqual([6, 2, 5, 5, 4, 5, 6, 3, 7, 6])
  })
})

describe('localTimeDigits', () => {
  it('extracts zero-padded 24h digits from local time', () => {
    // Date constructed from local components — TZ-independent assertions.
    expect(localTimeDigits(new Date(2026, 5, 12, 0, 0))).toEqual([0, 0, 0, 0])
    expect(localTimeDigits(new Date(2026, 5, 12, 9, 5))).toEqual([0, 9, 0, 5])
    expect(localTimeDigits(new Date(2026, 5, 12, 23, 59))).toEqual([2, 3, 5, 9])
  })
})

describe('colonVisible', () => {
  it('blinks at 1 Hz aligned to wall clock', () => {
    expect(colonVisible(1_000_000)).toBe(true)
    expect(colonVisible(1_000_499)).toBe(true)
    expect(colonVisible(1_000_500)).toBe(false)
    expect(colonVisible(1_000_999)).toBe(false)
    expect(colonVisible(1_001_000)).toBe(true)
  })
})

describe('segment geometry', () => {
  const cell = { w: 12, h: 20, t: 2 }

  it('returns 7 rects for the full cell, all within bounds', () => {
    const all = allSegmentRects(cell)
    expect(all.length).toBe(7)
    for (const r of all) {
      expect(r.x >= 0 && r.y >= 0, 'rect origin in cell').toBe(true)
      expect(r.x + r.w <= cell.w, 'rect right edge in cell').toBe(true)
      expect(r.y + r.h <= cell.h, 'rect bottom edge in cell').toBe(true)
      expect(r.w > 0 && r.h > 0, 'non-degenerate rect').toBe(true)
    }
  })

  it('lit rect count matches the digit mask popcount', () => {
    for (let d = 0; d <= 9; d++) {
      expect(segmentRects(d, cell).length).toBe(popcount(SEVEN_SEG[d]))
    }
  })

  it('digit 1 lights only the right-side column', () => {
    const rects = segmentRects(1, cell)
    expect(rects.length).toBe(2)
    for (const r of rects) expect(r.x).toBe(cell.w - cell.t)
  })

  it('rejects out-of-range digits', () => {
    expect(() => segmentRects(10, cell)).toThrow()
  })
})

describe('layoutClock', () => {
  const sizes: Array<[number, number]> = [
    [79, 22],
    [76, 25],
    [71, 27],
    [127, 21],
  ]

  it('fits 4 digits + colon inside the screen rect, in order', () => {
    for (const [sw, sh] of sizes) {
      const l = layoutClock(sw, sh)
      expect(l.digits.length).toBe(4)
      // Strictly increasing x, colon between digit 1 and 2
      expect(l.digits[0].x < l.digits[1].x).toBe(true)
      expect(l.digits[1].x + l.cell.w <= l.colon.x).toBe(true)
      expect(l.colon.x + l.colon.size <= l.digits[2].x).toBe(true)
      expect(l.digits[2].x < l.digits[3].x).toBe(true)
      // Inside bounds
      expect(l.digits[0].x >= 0, `left edge ${sw}x${sh}`).toBe(true)
      expect(l.digits[3].x + l.cell.w <= sw, `right edge ${sw}x${sh}`).toBe(true)
      expect(l.digits[0].y >= 0 && l.digits[0].y + l.cell.h <= sh, `vertical ${sw}x${sh}`).toBe(true)
      // Colon dots inside the digit band
      expect(l.colon.topY >= l.digits[0].y).toBe(true)
      expect(l.colon.botY + l.colon.size <= l.digits[0].y + l.cell.h).toBe(true)
    }
  })

  it('is integer-valued and roughly centered', () => {
    const l = layoutClock(79, 22)
    const vals = [
      l.digits[0].x,
      l.digits[0].y,
      l.cell.w,
      l.cell.h,
      l.cell.t,
      l.colon.x,
      l.colon.topY,
      l.colon.botY,
      l.colon.size,
    ]
    for (const v of vals) expect(Number.isInteger(v), `integer ${v}`).toBe(true)
    const right = 79 - (l.digits[3].x + l.cell.w)
    expect(Math.abs(l.digits[0].x - right) <= 2, 'horizontal centering').toBe(true)
  })
})
