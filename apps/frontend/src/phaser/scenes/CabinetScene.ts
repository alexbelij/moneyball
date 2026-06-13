/**
 * CabinetScene | v0.7.1 | 2026-06-13
 * Purpose: Main cabinet scene. Composes the bg-space WorldLayer (background,
 * props.json props, TV states, wall clock, y-sorted table occlusion) with
 * agent sprites, wallet-flow pause, thought bubbles, and keyboard navigation
 * between interactive props.
 * T17: keyboard nav (Tab/Shift-Tab cycle, Enter/Space activate).
 * T19: cleans up PropStateController on shutdown.
 */

import Phaser from 'phaser'
import { useGameStore } from '@/store/gameStore'
import { AgentSprite } from '@/phaser/sprites/AgentSprite'
import { GameEventBus } from '@/events/GameEventBus'
import { WorldLayer, type FocusableProp } from '@/phaser/world/WorldLayer'

export class CabinetScene extends Phaser.Scene {
  private sprites = new Map<string, AgentSprite>()
  private world?: WorldLayer
  private worldReady = false

  private unsubAgents?: () => void
  private unsubWallet?: () => void
  private syncTimer?: Phaser.Time.TimerEvent

  private pendingThoughts = new Map<string, { text: string; duration?: number }>()
  private onThought?: (p: { agentId: string; text: string; duration?: number }) => void
  private onLive?: (p: { live: boolean }) => void

  /* Keyboard navigation state */
  private focusIndex = -1
  private interactiveList: readonly FocusableProp[] = []

  constructor() {
    super({ key: 'CabinetScene' })
  }

  preload() {
    WorldLayer.preloadManifests(this)
  }

  create() {
    this.world = new WorldLayer(this)
    this.add.existing(this.world)

    void this.world.build().then(() => {
      this.worldReady = true
      this.interactiveList = this.world!.getInteractiveProps()
      this.fitWorld()
      this.syncAgents()
      GameEventBus.emit('scene:ready', undefined)
    })

    this.fitWorld()
    this.scale.on('resize', () => this.fitWorld())

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

    // TV broadcast state from the match feed poller (MatchTV)
    this.onLive = ({ live }) => this.world?.setBroadcast(live)
    GameEventBus.on('matches:live', this.onLive)

    // Apply initial pause state (in case UI started wallet flow before scene)
    this.setPaused(useGameStore.getState().ui.isWalletFlowActive)

    // Keyboard navigation: Tab/Shift-Tab cycle props, Enter/Space activate
    this.input.keyboard?.on('keydown', (evt: KeyboardEvent) => {
      this.handleKeyboard(evt)
    })
  }

  shutdown() {
    if (this.onThought) GameEventBus.off('thought:show', this.onThought)
    if (this.onLive) GameEventBus.off('matches:live', this.onLive)
    this.world?.getStateController()?.destroy()
    this.syncTimer?.remove(false)
    this.unsubAgents?.()
    this.unsubWallet?.()
  }

  private handleKeyboard(evt: KeyboardEvent) {
    if (!this.worldReady || this.interactiveList.length === 0) return

    if (evt.key === 'Tab') {
      evt.preventDefault()
      const len = this.interactiveList.length
      const prev = this.focusIndex
      if (evt.shiftKey) {
        this.focusIndex = this.focusIndex <= 0 ? len - 1 : this.focusIndex - 1
      } else {
        this.focusIndex = this.focusIndex >= len - 1 ? 0 : this.focusIndex + 1
      }
      if (prev >= 0 && prev < len) this.interactiveList[prev].setFocused(false)
      this.interactiveList[this.focusIndex].setFocused(true)
      return
    }

    if ((evt.key === 'Enter' || evt.key === ' ') && this.focusIndex >= 0) {
      evt.preventDefault()
      this.interactiveList[this.focusIndex].activate()
      return
    }

    if (evt.key === 'Escape' && this.focusIndex >= 0) {
      this.interactiveList[this.focusIndex].setFocused(false)
      this.focusIndex = -1
    }
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

  private fitWorld() {
    const { width, height } = this.scale
    this.world?.cover(width, height)
  }

  private syncAgents() {
    if (!this.worldReady || !this.world) return
    const agents = Object.values(useGameStore.getState().agents)
    for (const a of agents) {
      if (this.sprites.has(a.agentId)) continue
      const sp = new AgentSprite(this, a)
      this.sprites.set(a.agentId, sp)
      this.world.addAgent(sp)
    }
  }
}
