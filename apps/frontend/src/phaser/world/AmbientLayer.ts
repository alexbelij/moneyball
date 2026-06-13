/**
 * AmbientLayer | v1.0.0 | 2026-06-13
 * Purpose: Procedural dust motes + lamp flicker for living room atmosphere.
 * T25: Above props, below UI. 100% procedural — NO image assets.
 *
 * Light-cone bounds (rough trapezoids eyeballed from
 * room_bg_v02_table_clock_pennant.png 1672×941):
 *
 * LEFT LAMP  (tube ≈ x 330–520, y ≈ 28):
 *   top:    x 350–500,  y  40
 *   bottom: x 200–650,  y 500
 *
 * RIGHT LAMP (tube ≈ x 960–1160, y ≈ 28):
 *   top:    x 980–1140, y  40
 *   bottom: x 830–1280, y 500
 */

import Phaser from 'phaser'
import {
  AMBIENT_CONFIG,
  LIGHT_CONES,
  isInsideTrapezoid,
  randomPointInTrapezoid,
  randFloat,
  randInt,
} from './ambientGeometry'

// Re-export for convenience
export { AMBIENT_CONFIG, LIGHT_CONES, isInsideTrapezoid, randomPointInTrapezoid }
export type { LightCone } from './ambientGeometry'

/* ── Particle pool entry ─────────────────────────────────────────────── */

interface DustMote {
  alive: boolean
  rect: Phaser.GameObjects.Rectangle
  coneIndex: number
  spawnTime: number
  lifetime: number
  dx: number
  dy: number
  speed: number
  wobblePhase: number
  startX: number
  startY: number
  /** Per-mote peak alpha (fixed at spawn time for consistent fading). */
  peakAlpha: number
}

/* ── Flicker state per lamp ──────────────────────────────────────────── */

interface FlickerState {
  overlay: Phaser.GameObjects.Rectangle
  nextFlicker: number
  isDipping: boolean
  dipEnd: number
  dipAlpha: number
}

/* ── Main class ──────────────────────────────────────────────────────── */

export class AmbientLayer extends Phaser.GameObjects.Container {
  private pool: DustMote[] = []
  private flickers: FlickerState[] = []
  private disabled = false

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0)

    // Respect prefers-reduced-motion: fully disable
    if (typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
      this.disabled = true
      return
    }

    this.initPool(scene)
    this.initFlickers(scene)
  }

  /* ── Pool initialisation ───────────────────────────────────────────── */

  private initPool(scene: Phaser.Scene): void {
    const cfg = AMBIENT_CONFIG
    for (let i = 0; i < cfg.maxParticles; i++) {
      const rect = scene.add.rectangle(0, 0, cfg.minSize, cfg.minSize, cfg.moteColor, 0)
      rect.setOrigin(0.5, 0.5)
      rect.setBlendMode(Phaser.BlendModes.ADD)
      rect.setVisible(false)
      this.add(rect)

      this.pool.push({
        alive: false,
        rect,
        coneIndex: 0,
        spawnTime: 0,
        lifetime: 0,
        dx: 0,
        dy: 0,
        speed: 0,
        wobblePhase: 0,
        startX: 0,
        startY: 0,
        peakAlpha: 0,
      })
    }
  }

  /* ── Flicker overlays ──────────────────────────────────────────────── */

  private initFlickers(scene: Phaser.Scene): void {
    for (const cone of LIGHT_CONES) {
      const cx = (cone.bottomLeft + cone.bottomRight) / 2
      const cy = (cone.topY + cone.bottomY) / 2
      const w = cone.bottomRight - cone.bottomLeft + 40
      const h = cone.bottomY - cone.topY + 20
      const overlay = scene.add.rectangle(cx, cy, w, h, 0x000000, 0)
      overlay.setOrigin(0.5, 0.5)
      overlay.setBlendMode(Phaser.BlendModes.NORMAL)
      this.add(overlay)

      this.flickers.push({
        overlay,
        nextFlicker: this.randomFlickerDelay(scene),
        isDipping: false,
        dipEnd: 0,
        dipAlpha: 0,
      })
    }
  }

  /* ── Update (called every frame from scene) ────────────────────────── */

  update(_time: number, delta: number): void {
    if (this.disabled) return

    const now = this.scene.time.now
    const dt = delta / 1000

    this.updateSpawning(now)
    this.updateParticles(now, dt)
    this.updateFlickers(now)
  }

  /* ── Spawning ──────────────────────────────────────────────────────── */

  private updateSpawning(now: number): void {
    const cfg = AMBIENT_CONFIG
    const aliveCount = this.pool.filter((m) => m.alive).length
    if (aliveCount >= cfg.maxParticles) return

    const slot = this.pool.find((m) => !m.alive)
    if (!slot) return

    const coneIdx = Math.floor(Math.random() * LIGHT_CONES.length)
    const cone = LIGHT_CONES[coneIdx]
    const [px, py] = randomPointInTrapezoid(cone)

    const size = randInt(cfg.minSize, cfg.maxSize)
    slot.alive = true
    slot.rect.setVisible(true)
    slot.rect.setSize(size, size)
    slot.rect.setPosition(px, py)
    slot.rect.setAlpha(0)
    slot.coneIndex = coneIdx
    slot.spawnTime = now
    slot.lifetime = randFloat(cfg.minLife, cfg.maxLife)
    slot.startX = px
    slot.startY = py
    slot.wobblePhase = Math.random() * Math.PI * 2
    slot.peakAlpha = randFloat(cfg.minAlpha, cfg.maxAlpha)

    const angle = randFloat(-Math.PI * 0.6, Math.PI * 0.6)
    slot.dx = Math.sin(angle)
    slot.dy = Math.cos(angle) * 0.5 + 0.5
    const mag = Math.sqrt(slot.dx * slot.dx + slot.dy * slot.dy)
    slot.dx /= mag
    slot.dy /= mag
    slot.speed = randFloat(cfg.minSpeed, cfg.maxSpeed)
  }

  /* ── Particle movement & lifecycle ─────────────────────────────────── */

  private updateParticles(now: number, _dt: number): void {
    const cfg = AMBIENT_CONFIG

    for (const mote of this.pool) {
      if (!mote.alive) continue

      const age = now - mote.spawnTime
      if (age >= mote.lifetime) {
        mote.alive = false
        mote.rect.setVisible(false)
        continue
      }

      // Drift
      const elapsed = age / 1000
      const dist = elapsed * mote.speed
      const wobble = Math.sin(elapsed * cfg.wobbleFreq + mote.wobblePhase) * cfg.wobbleAmp
      const x = mote.startX + mote.dx * dist + wobble
      const y = mote.startY + mote.dy * dist
      mote.rect.setPosition(x, y)

      // Bounds check
      const cone = LIGHT_CONES[mote.coneIndex]
      if (!isInsideTrapezoid(x, y, cone)) {
        mote.alive = false
        mote.rect.setVisible(false)
        continue
      }

      // Alpha: fade in → hold → fade out
      const fadeIn = cfg.fadeDuration
      const fadeOut = cfg.fadeDuration
      const holdEnd = mote.lifetime - fadeOut

      let alpha: number
      if (age < fadeIn) {
        alpha = (age / fadeIn) * mote.peakAlpha
      } else if (age > holdEnd) {
        alpha = ((mote.lifetime - age) / fadeOut) * mote.peakAlpha
      } else {
        alpha = mote.peakAlpha
      }
      mote.rect.setAlpha(alpha)
    }
  }

  /* ── Lamp flicker ──────────────────────────────────────────────────── */

  private updateFlickers(now: number): void {
    const cfg = AMBIENT_CONFIG

    for (const fl of this.flickers) {
      if (fl.isDipping) {
        if (now >= fl.dipEnd) {
          fl.isDipping = false
          fl.overlay.setAlpha(0)
          fl.nextFlicker = now + randFloat(cfg.flickerMinInterval, cfg.flickerMaxInterval)
        }
      } else if (now >= fl.nextFlicker) {
        fl.isDipping = true
        fl.dipAlpha = randFloat(cfg.flickerDipMin, cfg.flickerDipMax)
        fl.overlay.setAlpha(fl.dipAlpha)
        fl.dipEnd = now + randFloat(cfg.flickerDipMinDur, cfg.flickerDipMaxDur)
      }
    }
  }

  private randomFlickerDelay(scene: Phaser.Scene): number {
    const cfg = AMBIENT_CONFIG
    return scene.time.now + randFloat(cfg.flickerMinInterval, cfg.flickerMaxInterval)
  }

  /* ── Cleanup ───────────────────────────────────────────────────────── */

  destroy(fromScene?: boolean): void {
    this.pool.length = 0
    this.flickers.length = 0
    super.destroy(fromScene)
  }
}
