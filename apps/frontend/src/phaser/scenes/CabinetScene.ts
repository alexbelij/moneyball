/**
 * CabinetScene | v0.9.0 | 2026-06-14
 * Purpose: Main cabinet scene. Composes the bg-space WorldLayer (background,
 * props.json props, TV states, wall clock, y-sorted table occlusion) with
 * agent sprites, wallet-flow pause, thought bubbles, and keyboard navigation
 * between interactive props.
 * T17: keyboard nav (Tab/Shift-Tab cycle, Enter/Space activate).
 * T19: cleans up PropStateController on shutdown.
 * T25: AmbientLayer (dust motes + lamp flicker) above props, below UI.
 * T29: auto-cycles personality thought bubbles by live agent status
 *      (reduced-motion safe; pauses with wallet flow). Phaser wiring is
 *      visual — verified via e2e, not jsdom unit tests.
 */

import Phaser from 'phaser'
import { useGameStore } from '@/store/gameStore'
import { AgentSprite } from '@/phaser/sprites/AgentSprite'
import { GameEventBus } from '@/events/GameEventBus'
import { WorldLayer, type FocusableProp } from '@/phaser/world/WorldLayer'
import { AmbientLayer } from '@/phaser/world/AmbientLayer'
import { getAgentThoughts, type AgentThoughtStates } from '@/lib/api'
import { mapStatusToThoughtState, thoughtForCycle } from '@/lib/thoughtCycle'

export class CabinetScene extends Phaser.Scene {
  private sprites = new Map<string, AgentSprite>()
  private world?: WorldLayer
  private ambient?: AmbientLayer
  private worldReady = false

  private unsubAgents?: () => void
  private unsubWallet?: () => void
  private syncTimer?: Phaser.Time.TimerEvent

  private pendingThoughts = new Map<string, { text: string; duration?: number }>()
  private onThought?: (p: { agentId: string; text: string; duration?: number }) => void
  private onLive?: (p: { live: boolean }) => void

  /** T48: track whether a UI modal is requesting scene pause. */
  private modalPaused = false
  private onScenePause?: () => void
  private onSceneResume?: () => void

  /* T29: room thought-bubble cycling */
  private thoughtCache = new Map<string, AgentThoughtStates>()
  private thoughtFetching = new Set<string>()
  private thoughtTick = 0
  private thoughtCycleTimer?: Phaser.Time.TimerEvent

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

      // T25: add ambient layer above props (depth 7500), below dim overlay (8000) and UI
      this.ambient = new AmbientLayer(this)
      this.ambient.setDepth(7500)
      this.world!.add(this.ambient)

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

    // Wallet-flow pause subscription (T48: merged with modal pause via refreshPause)
    this.unsubWallet = useGameStore.subscribe(
      (s) => s.ui.isWalletFlowActive,
      () => this.refreshPause(),
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

    // Thought bubbles (buffer while paused — wallet flow or modal)
    this.onThought = ({ agentId, text, duration }) => {
      const paused = useGameStore.getState().ui.isWalletFlowActive || this.modalPaused
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

    // T48: scene:pause/resume from UI modals (AgentModal)
    this.onScenePause = () => { this.modalPaused = true; this.refreshPause() }
    this.onSceneResume = () => { this.modalPaused = false; this.refreshPause() }
    GameEventBus.on('scene:pause', this.onScenePause)
    GameEventBus.on('scene:resume', this.onSceneResume)

    // T29: auto-cycle personality thought bubbles based on each agent's live
    // status. Uses this.time so it freezes with the wallet-flow pause. Skipped
    // entirely when the user prefers reduced motion (bubbles still appear on
    // explicit thought:show events).
    if (!this.prefersReducedMotion()) {
      this.thoughtCycleTimer = this.time.addEvent({
        delay: 5200,
        loop: true,
        callback: () => this.cycleThoughts(),
      })
    }

    // Apply initial pause state (in case UI started wallet flow before scene)
    this.refreshPause()

    // Keyboard navigation: Tab/Shift-Tab cycle props, Enter/Space activate
    this.input.keyboard?.on('keydown', (evt: KeyboardEvent) => {
      this.handleKeyboard(evt)
    })
  }

  update(time: number, delta: number) {
    // T25: update ambient particles + flicker each frame
    this.ambient?.update(time, delta)
  }

  shutdown() {
    if (this.onThought) GameEventBus.off('thought:show', this.onThought)
    if (this.onLive) GameEventBus.off('matches:live', this.onLive)
    if (this.onScenePause) GameEventBus.off('scene:pause', this.onScenePause)
    if (this.onSceneResume) GameEventBus.off('scene:resume', this.onSceneResume)
    this.world?.getStateController()?.destroy()
    this.ambient?.destroy()
    this.syncTimer?.remove(false)
    this.thoughtCycleTimer?.remove(false)
    this.unsubAgents?.()
    this.unsubWallet?.()
  }

  private prefersReducedMotion(): boolean {
    return typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  /**
   * T29: one cycle pass — pick a random visible agent, map its live status to a
   * thought state, and show a deterministic line from its configured bubbles.
   * Thought sets are lazily fetched + cached per agent. Skipped while paused.
   */
  private cycleThoughts() {
    if (useGameStore.getState().ui.isWalletFlowActive) return
    const agents = Object.values(useGameStore.getState().agents)
    if (agents.length === 0) return

    this.thoughtTick += 1
    // Rotate which agent speaks each tick to avoid all bubbles firing at once.
    const agent = agents[this.thoughtTick % agents.length]
    const sprite = this.sprites.get(agent.agentId)
    if (!sprite) return

    const bubbles = this.thoughtCache.get(agent.agentId)
    if (!bubbles) {
      this.ensureThoughts(agent.agentId)
      return
    }
    const state = mapStatusToThoughtState(agent.status)
    const text = thoughtForCycle(agent.agentId, state, bubbles, this.thoughtTick)
    if (text) sprite.showThought(text, 3000)
  }

  private ensureThoughts(agentId: string) {
    if (this.thoughtCache.has(agentId) || this.thoughtFetching.has(agentId)) return
    this.thoughtFetching.add(agentId)
    getAgentThoughts(agentId)
      .then((r) => { this.thoughtCache.set(agentId, r.states) })
      .catch(() => { /* no thoughts available — silently skip cycling for this agent */ })
      .finally(() => { this.thoughtFetching.delete(agentId) })
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

  /** T48: combined pause state from wallet flow + modal overlay. */
  private refreshPause() {
    const paused = useGameStore.getState().ui.isWalletFlowActive || this.modalPaused
    this.setPaused(paused)
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
