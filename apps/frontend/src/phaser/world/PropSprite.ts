/**
 * PropSprite | v0.2.0 | 2026-06-13
 * Purpose: One scene prop from props.json. Interactive props get the global
 * hover treatment from docs/interactivity-spec.md: crisp 1px pixel outline
 * (4-direction texture clones, no smooth blur) + slight brightness glow.
 * Click emits `prop:click` on the GameEventBus.
 * T17: implements FocusableProp for keyboard navigation.
 */

import Phaser from 'phaser'
import { GameEventBus } from '@/events/GameEventBus'
import type { PropDef } from './propTypes'
import type { FocusableProp } from './WorldLayer'

const OUTLINE_COLOR = 0xfff7d6
const GLOW_ALPHA = 0.14
/** Outline thickness in bg-space px (bg is hi-res pixel art; 2px reads as 1 art-pixel). */
const OUTLINE_PX = 2

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  )
}

export class PropSprite extends Phaser.GameObjects.Container implements FocusableProp {
  readonly propId: string

  private img: Phaser.GameObjects.Image
  private outline: Phaser.GameObjects.Image[] = []
  private glow?: Phaser.GameObjects.Image
  private focused = false
  private readonly propW: number
  private readonly propH: number

  constructor(scene: Phaser.Scene, def: PropDef, textureKey: string) {
    super(scene, def.x, def.y)
    this.propId = def.id
    this.propW = def.w
    this.propH = def.h

    // Outline pass: same texture drawn 4x offset behind, flat tint fill.
    if (def.interactive) {
      const offsets = [
        [-OUTLINE_PX, 0],
        [OUTLINE_PX, 0],
        [0, -OUTLINE_PX],
        [0, OUTLINE_PX],
      ] as const
      for (const [dx, dy] of offsets) {
        const o = scene.add.image(dx, dy, textureKey).setOrigin(0, 0)
        o.setDisplaySize(def.w, def.h)
        o.setTintFill(OUTLINE_COLOR).setVisible(false)
        this.outline.push(o)
        this.add(o)
      }
    }

    // Render at authored display size (def.w x def.h, bg-space px). This makes
    // the prop editor's scale/export WYSIWYG: change scale -> exported w/h ->
    // same size in-game. Assets keep their own aspect via the editor's uniform scale.
    this.img = scene.add.image(0, 0, textureKey).setOrigin(0, 0)
    this.img.setDisplaySize(def.w, def.h)
    this.add(this.img)

    if (def.interactive) {
      // Glow pass: brightness lift on top of the sprite itself.
      this.glow = scene.add.image(0, 0, textureKey).setOrigin(0, 0)
      this.glow.setDisplaySize(def.w, def.h)
      this.glow.setTintFill(0xffffff).setAlpha(0).setVisible(false)
      this.add(this.glow)

      this.img.setInteractive({ pixelPerfect: true, cursor: 'pointer' })
      this.img.on('pointerover', () => this.setHighlight(true))
      this.img.on('pointerout', () => { if (!this.focused) this.setHighlight(false) })
      this.img.on('pointerdown', () => this.activate())
    }
  }

  /** Swap the visible texture in place (state sprites share the canvas size). */
  setTexture(textureKey: string) {
    this.img.setTexture(textureKey)
    for (const o of this.outline) o.setTexture(textureKey)
    this.glow?.setTexture(textureKey)
  }

  /** Keyboard focus: shows outline ring, persists until explicitly cleared. */
  setFocused(on: boolean) {
    this.focused = on
    this.setHighlight(on)
  }

  /** Trigger the prop click action (pointer or keyboard Enter/Space). */
  activate() {
    GameEventBus.emit('prop:click', { propId: this.propId })
  }

  private setHighlight(on: boolean) {
    for (const o of this.outline) o.setVisible(on)
    if (this.glow) this.glow.setVisible(on).setAlpha(on ? GLOW_ALPHA : 0)
  }

  /**
   * Rare fluorescent-sign flicker (EXIT). Every few seconds the sign stutters
   * with a short burst of quick alpha dips, like a failing tube, then holds
   * steady. Respects prefers-reduced-motion.
   */
  startSignFlicker() {
    if (prefersReducedMotion()) return
    const scene = this.scene

    const stutter = () => {
      if (!this.scene) return
      const bursts = Phaser.Math.Between(2, 4)
      let i = 0
      const dip = () => {
        if (!this.scene) return
        scene.tweens.add({
          targets: this.img,
          alpha: Phaser.Math.FloatBetween(0.28, 0.55),
          duration: 45,
          yoyo: true,
          onComplete: () => {
            i += 1
            if (i < bursts) scene.time.delayedCall(Phaser.Math.Between(40, 130), dip)
            else {
              this.img.setAlpha(1)
              schedule()
            }
          },
        })
      }
      dip()
    }

    const schedule = () => {
      if (!this.scene) return
      scene.time.delayedCall(Phaser.Math.Between(5000, 13000), stutter)
    }

    schedule()
  }

  /**
   * A soft highlight "glint" that sweeps across the prop every few seconds to
   * signal it is interactive (magnetic boards). A thin, bright, slightly
   * angled bar travels left-to-right, clipped to the prop's bounds via a
   * geometry mask so it never spills onto the wall. Respects reduced-motion.
   */
  startGlint() {
    if (prefersReducedMotion()) return
    const scene = this.scene

    const barW = Math.max(28, this.propW * 0.09)
    const bar = scene.add
      .rectangle(0, this.propH / 2, barW, this.propH * 1.8, 0xffffff, 0.0)
      .setOrigin(0.5, 0.5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAngle(14)
    this.add(bar)

    // Clip to the prop rectangle (local coords; the mask graphics is a child
    // so it inherits the container's world transform and stays aligned under
    // scaling/parallax).
    const maskG = scene.add.graphics().fillStyle(0xffffff, 1).fillRect(0, 0, this.propW, this.propH)
    maskG.setVisible(false)
    this.add(maskG)
    bar.setMask(maskG.createGeometryMask())

    const travel = () => {
      if (!this.scene) return
      bar.setPosition(-barW, this.propH / 2)
      scene.tweens.add({
        targets: bar,
        x: this.propW + barW,
        duration: 850,
        ease: 'Sine.easeInOut',
      })
      scene.tweens.add({
        targets: bar,
        alpha: 0.16,
        duration: 425,
        yoyo: true,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          bar.setAlpha(0)
          if (this.scene) scene.time.delayedCall(Phaser.Math.Between(6000, 11000), travel)
        },
      })
    }

    scene.time.delayedCall(Phaser.Math.Between(1500, 4000), travel)
  }
}
