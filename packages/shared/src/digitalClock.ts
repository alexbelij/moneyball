/**
 * digitalClock | v0.1.0 | 2026-06-12
 * Purpose: Pure 7-segment digital clock core — segment bitmasks, local-time
 * digit extraction, wall-clock-aligned colon blink, and screen layout math.
 * Rendering-agnostic (consumed by the Phaser overlay in apps/frontend).
 */

/**
 * Segment bit layout (classic 7-seg):
 *
 *   aaaa        a = bit 0
 *  f    b       b = bit 1
 *  f    b       c = bit 2
 *   gggg        d = bit 3
 *  e    c       e = bit 4
 *  e    c       f = bit 5
 *   dddd        g = bit 6
 */
export const SEG_A = 1 << 0
export const SEG_B = 1 << 1
export const SEG_C = 1 << 2
export const SEG_D = 1 << 3
export const SEG_E = 1 << 4
export const SEG_F = 1 << 5
export const SEG_G = 1 << 6

export const SEVEN_SEG: readonly number[] = [
  SEG_A | SEG_B | SEG_C | SEG_D | SEG_E | SEG_F, // 0
  SEG_B | SEG_C, // 1
  SEG_A | SEG_B | SEG_G | SEG_E | SEG_D, // 2
  SEG_A | SEG_B | SEG_G | SEG_C | SEG_D, // 3
  SEG_F | SEG_G | SEG_B | SEG_C, // 4
  SEG_A | SEG_F | SEG_G | SEG_C | SEG_D, // 5
  SEG_A | SEG_F | SEG_G | SEG_E | SEG_C | SEG_D, // 6
  SEG_A | SEG_B | SEG_C, // 7
  SEG_A | SEG_B | SEG_C | SEG_D | SEG_E | SEG_F | SEG_G, // 8
  SEG_A | SEG_B | SEG_C | SEG_D | SEG_F | SEG_G, // 9
]

export interface SegRect {
  x: number
  y: number
  w: number
  h: number
}

export interface DigitCell {
  /** Digit glyph width in px. */
  w: number
  /** Digit glyph height in px. */
  h: number
  /** Segment thickness in px. */
  t: number
}

export interface ClockLayout {
  /** Top-left of each of the 4 digit glyphs (HH MM), screen-rect-local px. */
  digits: Array<{ x: number; y: number }>
  cell: DigitCell
  colon: { x: number; topY: number; botY: number; size: number }
}

/** Local wall-clock digits [H1, H2, M1, M2], 24h format. */
export function localTimeDigits(d: Date): [number, number, number, number] {
  const h = d.getHours()
  const m = d.getMinutes()
  return [Math.floor(h / 10), h % 10, Math.floor(m / 10), m % 10]
}

/**
 * 1 Hz blink aligned to the wall clock (no drift across timer jitter):
 * visible during the first half of every second.
 */
export function colonVisible(epochMs: number): boolean {
  return epochMs % 1000 < 500
}

/** Rects for ALL 7 segments of one digit cell (cell-local coords). */
export function allSegmentRects(cell: DigitCell): SegRect[] {
  const { w, h, t } = cell
  const half = (h - 3 * t) / 2
  return [
    { x: t, y: 0, w: w - 2 * t, h: t }, // a
    { x: w - t, y: t, w: t, h: half }, // b
    { x: w - t, y: 2 * t + half, w: t, h: half }, // c
    { x: t, y: h - t, w: w - 2 * t, h: t }, // d
    { x: 0, y: 2 * t + half, w: t, h: half }, // e
    { x: 0, y: t, w: t, h: half }, // f
    { x: t, y: t + half, w: w - 2 * t, h: t }, // g
  ]
}

/** Rects for the lit segments of `digit` (0-9), cell-local coords. */
export function segmentRects(digit: number, cell: DigitCell): SegRect[] {
  const mask = SEVEN_SEG[digit]
  if (mask === undefined) throw new Error(`segmentRects: digit out of range: ${digit}`)
  const all = allSegmentRects(cell)
  return all.filter((_, i) => (mask & (1 << i)) !== 0)
}

/**
 * Fit a centered HH:MM block into a screen rect of screenW x screenH px.
 * All output values are integers (pixel-grid friendly).
 */
export function layoutClock(screenW: number, screenH: number): ClockLayout {
  const pad = Math.max(2, Math.round(screenH * 0.16))
  const h = screenH - 2 * pad
  const t = Math.max(1, Math.round(h / 8))
  const w = Math.max(3 * t, Math.round(h * 0.62))
  const gap = Math.max(1, Math.round(t * 1.5))
  const colonSize = t
  const colonBlock = gap + colonSize + gap
  const total = 4 * w + 2 * gap + colonBlock
  const x0 = Math.round((screenW - total) / 2)
  const y0 = Math.round((screenH - h) / 2)

  const d0 = x0
  const d1 = d0 + w + gap
  const colonX = d1 + w + gap
  const d2 = colonX + colonSize + gap
  const d3 = d2 + w + gap

  const half = (h - 3 * t) / 2
  return {
    digits: [
      { x: d0, y: y0 },
      { x: d1, y: y0 },
      { x: d2, y: y0 },
      { x: d3, y: y0 },
    ],
    cell: { w, h, t },
    colon: {
      x: colonX,
      topY: y0 + Math.round(t + half / 2),
      botY: y0 + Math.round(2 * t + half + half / 2),
      size: colonSize,
    },
  }
}

/** Number of set bits (test helper for segment masks). */
export function popcount(n: number): number {
  let c = 0
  while (n) {
    c += n & 1
    n >>= 1
  }
  return c
}
