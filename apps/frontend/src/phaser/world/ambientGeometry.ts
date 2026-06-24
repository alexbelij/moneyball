/**
 * ambientGeometry | v1.0.0 | 2026-06-13
 * Purpose: Pure geometry + config for AmbientLayer, testable without Phaser.
 * T25: Trapezoid math + cone definitions + tuning constants.
 */

/* ── Tuning config (exported for external tweaks) ────────────────────── */

export const AMBIENT_CONFIG = {
  /** Maximum live particles across both cones. */
  maxParticles: 44,
  /** Particle size in bg-space px (the world is scaled down to fit). */
  minSize: 2,
  maxSize: 5,
  /** Drift speed range in px/s (bg-space). */
  minSpeed: 4,
  maxSpeed: 11,
  /** Sine wobble amplitude in px. */
  wobbleAmp: 6,
  /** Sine wobble frequency (radians/s). */
  wobbleFreq: 1.4,
  /** Alpha range for particles. */
  minAlpha: 0.06,
  maxAlpha: 0.22,
  /** Particle lifetime in ms. */
  minLife: 3500,
  maxLife: 9000,
  /** Fade-in/out duration in ms (portion of lifetime). */
  fadeDuration: 700,
  /** Flicker: interval range (ms) between dips. */
  flickerMinInterval: 4000,
  flickerMaxInterval: 12000,
  /** Flicker: alpha dip magnitude (fraction, 0.03 = 3%). */
  flickerDipMin: 0.04,
  flickerDipMax: 0.08,
  /** Flicker: dip duration in ms. */
  flickerDipMinDur: 80,
  flickerDipMaxDur: 150,
  /** Mote color (warm white matching the lamp glow). */
  moteColor: 0xf4ede2,
  /** Warm volumetric light-beam under each lamp (ADD blend). */
  beamColor: 0xfff1cf,
  /** Beam base alpha (very subtle wash). */
  beamAlpha: 0.05,
  /** Beam breathing pulse range + period. */
  beamPulseMin: 0.6,
  beamPulseMax: 1.15,
  beamPulseMs: 3600,
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
    // Calibrated to room_v4.webp (bg-space 3394×1440). Two ceiling
    // fluorescent tubes; cones widen toward the floor (~y 1100).
    id: 'left',
    topLeft: 800, topRight: 1140, topY: 250,
    bottomLeft: 560, bottomRight: 1380, bottomY: 1100,
  },
  {
    id: 'right',
    topLeft: 2200, topRight: 2540, topY: 250,
    bottomLeft: 1980, bottomRight: 2780, bottomY: 1100,
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
