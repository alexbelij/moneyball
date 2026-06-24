/**
 * DigitalClock | v0.1.0 | 2026-06-12
 * Purpose: Wall-mounted LCD clock overlay. Housing sprite + 7-segment digits
 * drawn on the screen area: client local time (24h), ghost segments, and a
 * colon blinking at 1 Hz aligned to the wall clock. Pure math lives in
 * @moneyball/shared/digitalClock.
 */

import Phaser from 'phaser'
import {
  allSegmentRects,
  colonVisible,
  layoutClock,
  localTimeDigits,
  segmentRects,
  type ClockLayout,
} from '@moneyball/shared/digitalClock'

export interface DigitalClockConfig {
  /** Texture key of the housing sprite (preloaded). */
  textureKey: string
  /** Screen (LCD) rect, sprite-local px. */
  screen: { x: number; y: number; w: number; h: number }
}

const COLOR_LIT = 0xb9f0c9
const COLOR_GHOST = 0x24372c
const ALPHA_GHOST = 0.55

export class DigitalClock extends Phaser.GameObjects.Container {
  private gfx: Phaser.GameObjects.Graphics
  private layout: ClockLayout
  private screenRect: DigitalClockConfig['screen']
  private timer?: Phaser.Time.TimerEvent
  private lastKey = ''

  constructor(scene: Phaser.Scene, x: number, y: number, cfg: DigitalClockConfig) {
    super(scene, x, y)

    const housing = scene.add.image(0, 0, cfg.textureKey).setOrigin(0, 0)
    this.add(housing)

    this.screenRect = cfg.screen
    this.layout = layoutClock(cfg.screen.w, cfg.screen.h)

    this.gfx = scene.add.graphics()
    this.add(this.gfx)

    this.redraw(new Date())
    // 4 Hz tick is enough for a 1 Hz blink without visible phase error;
    // actual on/off state is derived from epoch ms, so no drift accumulates.
    this.timer = scene.time.addEvent({
      delay: 250,
      loop: true,
      callback: () => this.tick(),
    })

    this.once(Phaser.GameObjects.Events.DESTROY, () => this.timer?.remove(false))
  }

  private tick() {
    const now = new Date()
    const key = `${localTimeDigits(now).join('')}|${colonVisible(now.getTime())}`
    if (key === this.lastKey) return
    this.redraw(now)
  }

  private redraw(now: Date) {
    const digits = localTimeDigits(now)
    const colonOn = colonVisible(now.getTime())
    this.lastKey = `${digits.join('')}|${colonOn}`

    const { x: sx, y: sy } = this.screenRect
    const { digits: cells, cell, colon } = this.layout
    const g = this.gfx
    g.clear()

    // Ghost segments (unlit LCD traces)
    g.fillStyle(COLOR_GHOST, ALPHA_GHOST)
    for (const c of cells) {
      for (const r of allSegmentRects(cell)) g.fillRect(sx + c.x + r.x, sy + c.y + r.y, r.w, r.h)
    }
    g.fillRect(sx + colon.x, sy + colon.topY, colon.size, colon.size)
    g.fillRect(sx + colon.x, sy + colon.botY, colon.size, colon.size)

    // Lit segments only (no 1px halo) so the digits read crisp/thin, not bold.
    g.fillStyle(COLOR_LIT, 1)
    for (let i = 0; i < 4; i++) {
      const c = cells[i]
      for (const r of segmentRects(digits[i], cell)) {
        g.fillRect(sx + c.x + r.x, sy + c.y + r.y, r.w, r.h)
      }
    }
    if (colonOn) {
      g.fillRect(sx + colon.x, sy + colon.topY, colon.size, colon.size)
      g.fillRect(sx + colon.x, sy + colon.botY, colon.size, colon.size)
    }
  }
}
