/**
 * AnalogClock | v0.1.0 | 2026-06-12
 * Purpose: Wall analog city clock — face sprite + hour/minute hands drawn at
 * runtime for a fixed IANA timezone (props.json `hands` + `tz`). Updates once
 * a minute; hand angles derived from wall-clock time (no drift).
 */

import Phaser from 'phaser'
import type { PropDef } from './propTypes'

export class AnalogClock extends Phaser.GameObjects.Container {
  private gfx: Phaser.GameObjects.Graphics
  private hands: NonNullable<PropDef['hands']>
  private tz: string
  private timer?: Phaser.Time.TimerEvent
  private lastKey = ''

  constructor(scene: Phaser.Scene, def: PropDef, textureKey: string) {
    super(scene, def.x, def.y)
    if (!def.hands || !def.tz) throw new Error('AnalogClock requires hands + tz')
    this.hands = def.hands
    this.tz = def.tz

    const face = scene.add.image(0, 0, textureKey).setOrigin(0, 0)
    this.add(face)

    this.gfx = scene.add.graphics()
    this.add(this.gfx)

    this.redraw()
    // 5s tick is plenty for minute hands; redraw is keyed, so it's cheap.
    this.timer = scene.time.addEvent({ delay: 5000, loop: true, callback: () => this.redraw() })
    this.once(Phaser.GameObjects.Events.DESTROY, () => this.timer?.remove(false))
  }

  /** Hour/minute in the configured timezone. */
  private tzTime(): { h: number; m: number } {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: this.tz,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(new Date())
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
    return { h: get('hour') % 12, m: get('minute') }
  }

  private redraw() {
    const { h, m } = this.tzTime()
    const key = `${h}:${m}`
    if (key === this.lastKey) return
    this.lastKey = key

    const { center, r_hour, r_min, width_hour, width_min, color } = this.hands
    const [cx, cy] = center
    const col = Phaser.Display.Color.HexStringToColor(color).color

    const angleMin = (m / 60) * Phaser.Math.PI2 - Math.PI / 2
    const angleHour = ((h + m / 60) / 12) * Phaser.Math.PI2 - Math.PI / 2

    const g = this.gfx
    g.clear()
    g.lineStyle(width_hour, col, 1)
    g.lineBetween(cx, cy, cx + Math.cos(angleHour) * r_hour, cy + Math.sin(angleHour) * r_hour)
    g.lineStyle(width_min, col, 1)
    g.lineBetween(cx, cy, cx + Math.cos(angleMin) * r_min, cy + Math.sin(angleMin) * r_min)
  }
}
