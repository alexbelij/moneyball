/**
 * CabinetScene | v0.4.0 | 2026-06-09
 * Purpose: Main cabinet scene with robust agent spawn + background cover + wallet-flow pause.
 */

import Phaser from 'phaser'
import { useGameStore } from '@/store/gameStore'
import { AgentSprite } from '@/phaser/sprites/AgentSprite'
import { GameEventBus } from '@/events/GameEventBus'

export class CabinetScene extends Phaser.Scene {
  private sprites = new Map<string, AgentSprite>()
  private bg?: Phaser.GameObjects.Image

  private unsubAgents?: () => void
  private unsubWallet?: () => void
  private syncTimer?: Phaser.Time.TimerEvent

  private pendingThoughts = new Map<string, { text: string; duration?: number }>()
  private onThought?: (p: { agentId: string; text: string; duration?: number }) => void

  constructor() {
    super({ key: 'CabinetScene' })
  }

  preload() {
    this.load.image('bg', '/assets/backgrounds/room_shell_background_v01.png')
  }

  create() {
    const { width, height } = this.scale

    // Background
    this.bg = this.add.image(width / 2, height / 2, 'bg').setDepth(0)
    this.fitBgCover()
    this.scale.on('resize', () => this.fitBgCover())

    // Subscribe FIRST (avoid missing first world:state)
    this.unsubAgents = useGameStore.subscribe(
      (s) => s.agents,
      () => this.syncAgents(),
    )

    // Wallet-flow pause subscription
    this.unsubWallet = useGameStore.subscribe(
      (s) => s.ui.isWalletFlowActive,
      (active) => this.setPaused(active),
    )

    // Immediate sync
    this.syncAgents()

    // Bootstrap loop (covers race conditions)
    this.syncTimer = this.time.addEvent({
      delay: 250,
      loop: true,
      callback: () => {
        this.syncAgents()
        if (this.sprites.size > 0) this.syncTimer?.remove(false)
      },
    })

    // Thought bubbles (buffer while paused)
    this.onThought = ({ agentId, text, duration }) => {
      const paused = useGameStore.getState().ui.isWalletFlowActive
      if (paused) {
        this.pendingThoughts.set(agentId, { text, duration })
        return
      }
      this.sprites.get(agentId)?.showThought(text, duration)
    }
    GameEventBus.on('thought:show', this.onThought)

    // Apply initial pause state (in case UI started wallet flow before scene)
    this.setPaused(useGameStore.getState().ui.isWalletFlowActive)
  }

  shutdown() {
    if (this.onThought) GameEventBus.off('thought:show', this.onThought)
    this.syncTimer?.remove(false)
    this.unsubAgents?.()
    this.unsubWallet?.()
  }

  private setPaused(paused: boolean) {
    // Freeze world animations/timers without losing state
    const scale = paused ? 0 : 1
    this.time.timeScale = scale
    this.tweens.timeScale = scale

    if (!paused && this.pendingThoughts.size > 0) {
      // Replay latest buffered thought per agent
      for (const [agentId, p] of this.pendingThoughts.entries()) {
        this.sprites.get(agentId)?.showThought(p.text, p.duration)
      }
      this.pendingThoughts.clear()
    }
  }

  private fitBgCover() {
    if (!this.bg) return
    const { width, height } = this.scale
    const tex = this.textures.get('bg')
    const src = tex.getSourceImage() as HTMLImageElement
    const s = Math.max(width / src.width, height / src.height)
    this.bg.setPosition(width / 2, height / 2).setScale(s)
  }

  private syncAgents() {
    const agents = Object.values(useGameStore.getState().agents)
    for (const a of agents) {
      if (this.sprites.has(a.agentId)) continue
      const sp = new AgentSprite(this, a)
      this.sprites.set(a.agentId, sp)
      sp.setDepth(10)
      this.add.existing(sp)
    }
  }
}
