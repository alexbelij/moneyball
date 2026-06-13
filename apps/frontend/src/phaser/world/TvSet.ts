/**
 * TvSet | v0.2.0 | 2026-06-13
 * Purpose: Cabinet TV with the three spec states (docs/interactivity-spec.md):
 * `off` (black screen overlay + red LED), `static` (noise flicker + green LED,
 * "no broadcast"), `live` (broadcast available; MVP renders the noise loop +
 * green LED until match-frame art lands). Click toggles power. Broadcast
 * availability is driven externally via setBroadcast().
 * T17: hover outline + glow per interactivity-spec; FocusableProp for keyboard nav.
 */

import Phaser from 'phaser'
import { GameEventBus } from '@/events/GameEventBus'
import type { PropDef, TvStatesSpec } from './propTypes'
import type { FocusableProp } from './WorldLayer'

const OUTLINE_COLOR = 0xfff7d6
const GLOW_ALPHA = 0.14
const OUTLINE_PX = 2

export type TvState = 'off' | 'static' | 'live'

export class TvSet extends Phaser.GameObjects.Container implements FocusableProp {
  readonly propId: string
  private spec: TvStatesSpec
  private base: Phaser.GameObjects.Image
  private overlay: Phaser.GameObjects.Image
  private led: Phaser.GameObjects.Rectangle
  private flicker?: Phaser.Time.TimerEvent

  private powered = true
  private broadcast = false
  private frameIdx = 0
  /** texture keys aligned with spec.staticFrames (null = hide overlay). */
  private frameKeys: Array<string | null>
  private offKey: string

  /* Hover / focus outline (same technique as PropSprite). */
  private outlineImages: Phaser.GameObjects.Image[] = []
  private glowImg?: Phaser.GameObjects.Image
  private focused = false

  constructor(
    scene: Phaser.Scene,
    def: PropDef,
    baseKey: string,
    frameKeys: Array<string | null>,
    offKey: string,
  ) {
    super(scene, def.x, def.y)
    if (!def.tv) throw new Error('TvSet requires a tv spec')
    this.propId = def.id
    this.spec = def.tv
    this.frameKeys = frameKeys
    this.offKey = offKey

    // Outline pass (behind base).
    const offsets = [
      [-OUTLINE_PX, 0],
      [OUTLINE_PX, 0],
      [0, -OUTLINE_PX],
      [0, OUTLINE_PX],
    ] as const
    for (const [dx, dy] of offsets) {
      const o = scene.add.image(dx, dy, baseKey).setOrigin(0, 0)
      o.setTintFill(OUTLINE_COLOR).setVisible(false)
      this.outlineImages.push(o)
      this.add(o)
    }

    this.base = scene.add.image(0, 0, baseKey).setOrigin(0, 0)
    this.base.setInteractive({ pixelPerfect: true, cursor: 'pointer' })
    this.base.on('pointerover', () => this.setHighlight(true))
    this.base.on('pointerout', () => { if (!this.focused) this.setHighlight(false) })
    this.base.on('pointerdown', () => this.activate())
    this.add(this.base)

    // Glow pass (on top of base, below overlay so screen content stays visible).
    this.glowImg = scene.add.image(0, 0, baseKey).setOrigin(0, 0)
    this.glowImg.setTintFill(0xffffff).setAlpha(0).setVisible(false)
    this.add(this.glowImg)

    const { x: ox, y: oy } = this.spec.overlay_offset
    // First non-null frame as initial texture; overlay visibility is state-driven.
    const firstKey = frameKeys.find((k): k is string => k !== null) ?? offKey
    this.overlay = scene.add.image(ox, oy, firstKey).setOrigin(0, 0).setVisible(false)
    this.add(this.overlay)

    const ledSpec = this.spec.led
    this.led = scene.add.rectangle(ledSpec.x, ledSpec.y, ledSpec.w, ledSpec.h, 0x39c04a).setOrigin(0, 0)
    this.add(this.led)

    this.applyState()
    this.once(Phaser.GameObjects.Events.DESTROY, () => this.flicker?.remove(false))
  }

  get tvState(): TvState {
    if (!this.powered) return 'off'
    return this.broadcast ? 'live' : 'static'
  }

  /** External driver: true while at least one match is live. */
  setBroadcast(on: boolean) {
    if (this.broadcast === on) return
    this.broadcast = on
    this.applyState()
  }

  /** Keyboard focus ring. */
  setFocused(on: boolean) {
    this.focused = on
    this.setHighlight(on)
  }

  /** Trigger click action (pointer or keyboard). */
  activate() {
    this.powered = !this.powered
    GameEventBus.emit('prop:click', { propId: this.propId })
    this.applyState()
  }

  private setHighlight(on: boolean) {
    for (const o of this.outlineImages) o.setVisible(on)
    if (this.glowImg) this.glowImg.setVisible(on).setAlpha(on ? GLOW_ALPHA : 0)
  }

  private applyState() {
    const s = this.tvState
    this.led.fillColor = Phaser.Display.Color.HexStringToColor(
      s === 'off' ? this.spec.led.off : this.spec.led.on,
    ).color

    if (s === 'off') {
      this.stopFlicker()
      this.overlay.setTexture(this.offKey).setVisible(true)
      return
    }

    // static & live (MVP shares the noise loop; live gets match frames later)
    this.startFlicker()
  }

  private startFlicker() {
    if (this.flicker) return
    this.showFrame(this.frameIdx)
    this.flicker = this.scene.time.addEvent({
      delay: Math.round(1000 / this.spec.staticFps),
      loop: true,
      callback: () => {
        this.frameIdx = (this.frameIdx + 1) % this.frameKeys.length
        this.showFrame(this.frameIdx)
      },
    })
  }

  private stopFlicker() {
    this.flicker?.remove(false)
    this.flicker = undefined
  }

  private showFrame(idx: number) {
    const key = this.frameKeys[idx]
    if (key === null) {
      this.overlay.setVisible(false) // frame 0 = base sprite art
    } else {
      this.overlay.setTexture(key).setVisible(true)
    }
  }
}
