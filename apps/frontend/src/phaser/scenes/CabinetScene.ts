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
import { AgentSprite, avatarIdleKey, avatarTalkKey } from '@/phaser/sprites/AgentSprite'
import { GameEventBus } from '@/events/GameEventBus'
import { WorldLayer, type FocusableProp } from '@/phaser/world/WorldLayer'
import { AmbientLayer } from '@/phaser/world/AmbientLayer'
import { getAgentThoughts, type AgentThoughtStates } from '@/lib/api'
import { mapStatusToThoughtState, thoughtForCycle } from '@/lib/thoughtCycle'
import { useUiPrefs } from '@/store/uiPrefs'
import { phaserFont } from '@/styles/uiFont'

export class CabinetScene extends Phaser.Scene {
  private sprites = new Map<string, AgentSprite>()
  private world?: WorldLayer
  private ambient?: AmbientLayer
  private worldReady = false

  private unsubAgents?: () => void
  private unsubWallet?: () => void
  private unsubFont?: () => void
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

  /* Mouse parallax (smoothed toward the pointer's horizontal position) */
  private parallaxTarget = 0
  private parallaxCur = 0
  private static readonly PARALLAX_AMOUNT = 0.4 // fraction of crop revealed at edges (subtle)

  constructor() {
    super({ key: 'CabinetScene' })
  }

  /** Fixed cabinet roster — their on-floor character art is preloaded here so
   *  AgentSprite can render real pixel-art (falls back to a rect otherwise). */
  private static readonly ROSTER = [
    'dr_morgan', 'scout_alvarez', 'viktor_kane', 'sofia_mendes', 'madame_pythia',
  ] as const

  /** v4 floor positions (bg-space 3394x1440). The backend world:state still
   *  uses old 1672x941 coords, so we override on the frontend to stand the
   *  agents across the open floor in front of the boards. Tune as needed. */
  private static readonly FLOOR_POS: Record<string, { x: number; y: number }> = {
    dr_morgan: { x: 1180, y: 1210 },
    scout_alvarez: { x: 1520, y: 1240 },
    viktor_kane: { x: 1860, y: 1205 },
    sofia_mendes: { x: 2200, y: 1245 },
    madame_pythia: { x: 2520, y: 1210 },
  }

  /** Real-world heights (cm) per agent, used to size avatars relative to the
   *  door. Men 175-185, women 170-175 (per art + design direction). */
  private static readonly AGENT_HEIGHT_CM: Record<string, number> = {
    dr_morgan: 178, // male
    scout_alvarez: 182, // male
    viktor_kane: 180, // male
    sofia_mendes: 174, // female
    madame_pythia: 172, // female
  }

  // Door scale reference (bg-space): the door prop is 553px tall and reads as a
  // ~207cm doorway -> 2.67 px/cm at the door's depth (its floor contact y).
  private static readonly DOOR_PX = 553
  private static readonly DOOR_CM = 207
  private static readonly DOOR_BASE_Y = 991 // door target_xy.y(438) + h(553)
  // Gentle floor perspective: objects shrink with distance (smaller y), so add
  // a small upscale as agents move toward the viewer (larger y).
  private static readonly PERSP_K = 0.0007

  /** Door-relative on-floor display height (bg-space px) for an agent. */
  private avatarHeightPx(agentId: string, y: number): number {
    const cm = CabinetScene.AGENT_HEIGHT_CM[agentId] ?? 175
    const pxPerCm = CabinetScene.DOOR_PX / CabinetScene.DOOR_CM
    const persp = 1 + (y - CabinetScene.DOOR_BASE_Y) * CabinetScene.PERSP_K
    return cm * pxPerCm * persp
  }

  preload() {
    WorldLayer.preloadManifests(this)
    for (const id of CabinetScene.ROSTER) {
      this.load.image(avatarIdleKey(id), `/assets/avatars/room/${id}_idle.png`)
      this.load.image(avatarTalkKey(id), `/assets/avatars/room/${id}_talk.png`)
    }
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

    // Mouse parallax: track the pointer's horizontal offset from centre.
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const w = this.scale.width || 1
      const nx = (p.x / w - 0.5) * 2 // [-1, 1]
      this.parallaxTarget = nx * CabinetScene.PARALLAX_AMOUNT
    })

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

    // Live-update canvas text font when the FontPanel choice changes.
    this.unsubFont = useUiPrefs.subscribe(
      (s) => s.fontChoice,
      (choice) => {
        const family = phaserFont(choice)
        for (const sp of this.sprites.values()) sp.setBodyFont(family)
      },
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

    // Smooth the parallax toward the pointer target (frame-rate independent).
    if (this.world) {
      const k = 1 - Math.exp(-delta / 140)
      this.parallaxCur += (this.parallaxTarget - this.parallaxCur) * k
      this.world.applyParallax(this.parallaxCur)
    }
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
    this.unsubFont?.()
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
    // Disable input so clicks don't pass through modals to Phaser props
    this.input.enabled = !paused

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
      const pos = CabinetScene.FLOOR_POS[a.agentId]
      const h = this.avatarHeightPx(a.agentId, pos ? pos.y : a.position.y)
      const sp = new AgentSprite(this, a, h)
      if (pos) sp.setPosition(pos.x, pos.y)
      this.sprites.set(a.agentId, sp)
      this.world.addAgent(sp)
    }
  }
}
