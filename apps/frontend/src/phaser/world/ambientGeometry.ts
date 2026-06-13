/**
 * ambientGeometry | v1.0.0 | 2026-06-13
 * Purpose: Pure geometry + config for AmbientLayer, testable without Phaser.
 * T25: Trapezoid math + cone definitions + tuning constants.
 */

/* ── Tuning config (exported for external tweaks) ────────────────────── */

export const AMBIENT_CONFIG = {
  /** Maximum live particles across both cones. */
  maxParticles: 20,
  /** Particle size in px (1 or 2, randomly chosen). */
  minSize: 1,
  maxSize: 2,
  /** Drift speed range in px/s. */
  minSpeed: 2,
  maxSpeed: 6,
  /** Sine wobble amplitude in px. */
  wobbleAmp: 3,
  /** Sine wobble frequency (radians/s). */
  wobbleFreq: 1.5,
  /** Alpha range for particles. */
  minAlpha: 0.05,
  maxAlpha: 0.18,
  /** Particle lifetime in ms. */
  minLife: 3000,
  maxLife: 8000,
  /** Fade-in/out duration in ms (portion of lifetime). */
  fadeDuration: 600,
  /** Flicker: interval range (ms) between dips. */
  flickerMinInterval: 4000,
  flickerMaxInterval: 12000,
  /** Flicker: alpha dip magnitude (fraction, 0.03 = 3%). */
  flickerDipMin: 0.03,
  flickerDipMax: 0.06,
  /** Flicker: dip duration in ms. */
  flickerDipMinDur: 80,
  flickerDipMaxDur: 150,
  /** Mote color (warm white matching the lamp glow). */
  moteColor: 0xf4ede2,
} as const

/* ── Light-cone trapezoid definitions ────────────────────────────────── */

export interface LightCone {
  /** Lamp identifier. */
  id: string
  /** Top edge of the cone (narrow, near lamp). */
  topLeft: number
  topRight: number
  topY: number
  /** Bottom edge of the cone (wide, near table). */
  bottomLeft: number
  bottomRight: number
  bottomY: number
}

export const LIGHT_CONES: readonly LightCone[] = [
  {
    id: 'left',
    topLeft: 350, topRight: 500, topY: 40,
    bottomLeft: 200, bottomRight: 650, bottomY: 500,
  },
  {
    id: 'right',
    topLeft: 980, topRight: 1140, topY: 40,
    bottomLeft: 830, bottomRight: 1280, bottomY: 500,
  },
]

/* ── Geometry helpers ────────────────────────────────────────────────── */

/**
 * Test if a point is inside a trapezoid defined by a LightCone.
 * The trapezoid is defined by top edge (topLeft–topRight at topY)
 * and bottom edge (bottomLeft–bottomRight at bottomY).
 */
export function isInsideTrapezoid(x: number, y: number, cone: LightCone): boolean {
  if (y < cone.topY || y > cone.bottomY) return false
  const t = (y - cone.topY) / (cone.bottomY - cone.topY)
  const leftEdge = cone.topLeft + (cone.bottomLeft - cone.topLeft) * t
  const rightEdge = cone.topRight + (cone.bottomRight - cone.topRight) * t
  return x >= leftEdge && x <= rightEdge
}

/**
 * Generate a random point inside a light-cone trapezoid.
 * Uses rejection-free linear interpolation.
 */
export function randomPointInTrapezoid(cone: LightCone): [number, number] {
  const t = Math.random()
  const y = cone.topY + t * (cone.bottomY - cone.topY)
  const leftEdge = cone.topLeft + (cone.bottomLeft - cone.topLeft) * t
  const rightEdge = cone.topRight + (cone.bottomRight - cone.topRight) * t
  const x = leftEdge + Math.random() * (rightEdge - leftEdge)
  return [x, y]
}

/* ── Math helpers (no allocations) ───────────────────────────────────── */

export function randFloat(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

export function randInt(min: number, max: number): number {
  return Math.floor(randFloat(min, max + 1))
}
