import Phaser from 'phaser'
import type { WorldAgentState } from '@moneyball/shared/events'
import { GameEventBus } from '@/events/GameEventBus'
import { palette } from '@/styles/tokens'

/** Convert a CSS hex token (e.g. "#f4ede2") to a Phaser numeric color. */
function hex(c: string): number {
  return Phaser.Display.Color.HexStringToColor(c).color
}

// T29: design-spec thought-bubble palette (paper card, hard wood border).
const BUBBLE_BG = hex(palette.paper) // #f4ede2
const BUBBLE_BORDER = hex(palette.wood700) // #341d0e
const BUBBLE_TEXT = hex(palette.wood900) // #181009

export class AgentSprite extends Phaser.GameObjects.Container {
  private id: string
  private bodyRect: Phaser.GameObjects.Rectangle
  private label: Phaser.GameObjects.Text
  private thoughtText?: Phaser.GameObjects.Text
  private thoughtBg?: Phaser.GameObjects.Rectangle
  private hideTimer?: Phaser.Time.TimerEvent

  constructor(scene: Phaser.Scene, agent: WorldAgentState) {
    super(scene, agent.position.x, agent.position.y)
    this.id = agent.agentId

    this.bodyRect = scene.add.rectangle(0, 0, 72, 96, 0x3a3a5c).setStrokeStyle(2, 0x6a6a9c)
    this.bodyRect.setInteractive({ cursor: 'pointer', useHandCursor: true })
    this.bodyRect.on('pointerdown', () => GameEventBus.emit('agent:click', { agentId: this.id }))

    this.label = scene.add.text(0, 56, agent.name, {
      fontSize: '14px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5, 0)

    this.add([this.bodyRect, this.label])
  }

  showThought(text: string, ttlMs = 2500) {
    this.hideTimer?.destroy()
    this.thoughtText?.destroy()
    this.thoughtBg?.destroy()

    // T29: pixel paper card with a hard 2px wood border (no rounded corners),
    // matching the design-spec dialog/bubble styling.
    this.thoughtText = this.scene.add.text(0, -70, text, {
      fontFamily: 'VT323, monospace',
      fontSize: '14px',
      color: Phaser.Display.Color.IntegerToColor(BUBBLE_TEXT).rgba,
      wordWrap: { width: 180 },
      align: 'center',
    }).setOrigin(0.5, 0.5)

    const w = Math.min(this.thoughtText.width + 14, 200)
    const h = this.thoughtText.height + 10
    this.thoughtBg = this.scene.add
      .rectangle(0, -70, w, h, BUBBLE_BG, 1)
      .setStrokeStyle(2, BUBBLE_BORDER)

    this.add([this.thoughtBg, this.thoughtText])

    this.hideTimer = this.scene.time.delayedCall(ttlMs, () => {
      this.thoughtText?.destroy()
      this.thoughtBg?.destroy()
      this.thoughtText = undefined
      this.thoughtBg = undefined
    })
  }
}
