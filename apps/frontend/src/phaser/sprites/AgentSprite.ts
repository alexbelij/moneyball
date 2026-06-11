import Phaser from 'phaser'
import type { WorldAgentState } from '@moneyball/shared/events'
import { GameEventBus } from '@/events/GameEventBus'

export class AgentSprite extends Phaser.GameObjects.Container {
  private id: string
  private body: Phaser.GameObjects.Rectangle
  private label: Phaser.GameObjects.Text
  private thoughtText?: Phaser.GameObjects.Text
  private thoughtBg?: Phaser.GameObjects.Rectangle
  private hideTimer?: Phaser.Time.TimerEvent

  constructor(scene: Phaser.Scene, agent: WorldAgentState) {
    super(scene, agent.position.x, agent.position.y)
    this.id = agent.agentId

    this.body = scene.add.rectangle(0, 0, 52, 72, 0x3a3a5c).setStrokeStyle(2, 0x6a6a9c)
    this.body.setInteractive({ cursor: 'pointer' })
    this.body.on('pointerdown', () => GameEventBus.emit('agent:click', { agentId: this.id }))

    this.label = scene.add.text(0, 44, agent.name, {
      fontSize: '11px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5, 0)

    this.add([this.body, this.label])
  }

  showThought(text: string, ttlMs = 2500) {
    this.hideTimer?.destroy()
    this.thoughtText?.destroy()
    this.thoughtBg?.destroy()

    this.thoughtText = this.scene.add.text(0, -70, text, {
      fontSize: '10px',
      color: '#111827',
      wordWrap: { width: 180 },
      align: 'center',
    }).setOrigin(0.5, 0.5)

    const w = Math.min(this.thoughtText.width + 14, 200)
    const h = this.thoughtText.height + 10
    this.thoughtBg = this.scene.add.rectangle(0, -70, w, h, 0xffffff, 0.92).setStrokeStyle(1, 0xcccccc)

    this.add([this.thoughtBg, this.thoughtText])

    this.hideTimer = this.scene.time.delayedCall(ttlMs, () => {
      this.thoughtText?.destroy()
      this.thoughtBg?.destroy()
      this.thoughtText = undefined
      this.thoughtBg = undefined
    })
  }
}
