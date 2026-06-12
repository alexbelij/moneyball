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

export class PropSprite extends Phaser.GameObjects.Container implements FocusableProp {
  readonly propId: string

  private img: Phaser.GameObjects.Image
  private outline: Phaser.GameObjects.Image[] = []
  private glow?: Phaser.GameObjects.Image
  private focused = false

  constructor(scene: Phaser.Scene, def: PropDef, textureKey: string) {
    super(scene, def.x, def.y)
    this.propId = def.id

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
        o.setTintFill(OUTLINE_COLOR).setVisible(false)
        this.outline.push(o)
        this.add(o)
      }
    }

    this.img = scene.add.image(0, 0, textureKey).setOrigin(0, 0)
    this.add(this.img)

    if (def.interactive) {
      // Glow pass: brightness lift on top of the sprite itself.
      this.glow = scene.add.image(0, 0, textureKey).setOrigin(0, 0)
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
}
