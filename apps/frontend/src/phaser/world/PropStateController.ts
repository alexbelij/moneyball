/**
 * PropStateController | v1.0.0 | 2026-06-13
 * Purpose: State machines for interactive props per docs/interactivity-spec.md.
 * T19: exit_sign toggle, light_switch dim overlay, coffee_machine/mug micro-interaction.
 * All states are keyboard-triggerable (via prop:click from CabinetScene keyboard nav).
 * Respects prefers-reduced-motion.
 */

import Phaser from 'phaser'
import { GameEventBus } from '@/events/GameEventBus'
import type { PropDef } from './propTypes'

/** Matches the texKey() helper in WorldLayer. */
function texKey(path: string): string {
  return `prop:${path}`
}

/* ── Types ─────────────────────────────────────────────────────────── */

type ExitSignState = 'on' | 'off'
type LightState = 'on' | 'off'
type CoffeeState = 'idle' | 'brewing' | 'done'

interface PropRef {
  setTexture?(key: string): void
}

/* ── Reduced-motion query ──────────────────────────────────────────── */

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
}

/* ── Controller ────────────────────────────────────────────────────── */

export class PropStateController {
  private scene: Phaser.Scene
  private propRefs = new Map<string, PropRef>()
  private propDefs = new Map<string, PropDef>()

  /* State machines */
  private exitSignState: ExitSignState = 'on'
  private lightState: LightState = 'on'
  private coffeeState: CoffeeState = 'idle'
  private doorOpen = false

  /* Scene objects managed by controller */
  private dimOverlay?: Phaser.GameObjects.Rectangle
  private steamEmitters: Phaser.GameObjects.Rectangle[] = []
  private steamTimer?: Phaser.Time.TimerEvent
  private brewTimer?: Phaser.Time.TimerEvent

  private onPropClick?: (p: { propId: string }) => void
  private onSceneResume?: () => void

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /**
   * Register a prop instance so the controller can manipulate it.
   * Call after WorldLayer.buildChildren() creates each interactive prop.
   */
  register(def: PropDef, ref: PropRef) {
    this.propDefs.set(def.id, def)
    this.propRefs.set(def.id, ref)
  }

  /**
   * Provide the dim overlay (drawn once by WorldLayer at a high depth).
   * Must cover the full bg-space (1672×941).
   */
  setDimOverlay(overlay: Phaser.GameObjects.Rectangle) {
    this.dimOverlay = overlay
    this.dimOverlay.setVisible(false)
  }

  /** Start listening for prop:click events. */
  start() {
    this.onPropClick = ({ propId }) => this.handleClick(propId)
    GameEventBus.on('prop:click', this.onPropClick)
    // When any modal closes (scene resumes), make sure the door is shut again.
    this.onSceneResume = () => this.closeDoor()
    GameEventBus.on('scene:resume', this.onSceneResume)
  }

  /** Clean up listeners and timers. */
  destroy() {
    if (this.onPropClick) GameEventBus.off('prop:click', this.onPropClick)
    if (this.onSceneResume) GameEventBus.off('scene:resume', this.onSceneResume)
    this.steamTimer?.remove(false)
    this.brewTimer?.remove(false)
    this.clearSteam()
  }

  /* ── State-machine transitions ─────────────────────────────────── */

  private handleClick(propId: string) {
    switch (propId) {
      case 'exit_sign':
        return this.toggleExitSign()
      case 'light_switch':
        return this.toggleLight()
      case 'coffee_machine':
        return this.brewCoffee()
      case 'door':
        return this.openDoor()
      // tv_set handled internally by TvSet class
      // board_main: TacticsBoard modal (T74)
      // board_left: MemoryLab modal (T75)
      // board_scout: WalrusProof modal (T75)
      // door: AboutDoor modal (T75)
      // All board/door modals self-register via GameEventBus prop:click listeners.
    }
  }

  /* ── Exit sign ─────────────────────────────────────────────────── */

  private toggleExitSign() {
    this.exitSignState = this.exitSignState === 'on' ? 'off' : 'on'
    const def = this.propDefs.get('exit_sign')
    const ref = this.propRefs.get('exit_sign')
    if (!def?.swapStates || !ref?.setTexture) return
    const src = def.swapStates[this.exitSignState]
    if (src) ref.setTexture(texKey(src))
  }

  /* ── Door (open while the About modal is up) ───────────────────── */

  private openDoor() {
    if (this.doorOpen) return
    this.doorOpen = true
    this.swapDoor('open')
  }

  private closeDoor() {
    if (!this.doorOpen) return
    this.doorOpen = false
    this.swapDoor('closed')
  }

  private swapDoor(state: 'open' | 'closed') {
    const def = this.propDefs.get('door')
    const ref = this.propRefs.get('door')
    const src = def?.swapStates?.[state]
    if (src && ref?.setTexture) ref.setTexture(texKey(src))
  }

  /* ── Light switch ──────────────────────────────────────────────── */

  private toggleLight() {
    this.lightState = this.lightState === 'on' ? 'off' : 'on'
    if (!this.dimOverlay) return
    if (this.lightState === 'off') {
      this.dimOverlay.setVisible(true)
      if (!prefersReducedMotion()) {
        this.dimOverlay.setAlpha(0)
        this.scene.tweens.add({
          targets: this.dimOverlay,
          alpha: 0.55,
          duration: 300,
          ease: 'Power1',
        })
      } else {
        this.dimOverlay.setAlpha(0.55)
      }
    } else {
      if (!prefersReducedMotion()) {
        this.scene.tweens.add({
          targets: this.dimOverlay,
          alpha: 0,
          duration: 200,
          ease: 'Power1',
          onComplete: () => this.dimOverlay?.setVisible(false),
        })
      } else {
        this.dimOverlay.setAlpha(0).setVisible(false)
      }
    }
  }

  /* ── Coffee machine / mug ──────────────────────────────────────── */

  private brewCoffee() {
    if (this.coffeeState === 'brewing') return // ignore spam clicks
    this.coffeeState = 'brewing'
    this.clearSteam()

    // Brewing phase: 2 seconds
    this.brewTimer?.remove(false)
    this.brewTimer = this.scene.time.delayedCall(2000, () => {
      this.coffeeState = 'done'
      this.startSteam()

      // Steam lasts 90 seconds then stops
      this.steamTimer?.remove(false)
      this.steamTimer = this.scene.time.delayedCall(90_000, () => {
        this.clearSteam()
        this.coffeeState = 'idle'
      })
    })
  }

  /**
   * Pixel-art steam: small rectangles that rise from the mug position.
   * Uses Phaser tween with steps() for pixel feel. Respects reduced-motion
   * (shows static wisps instead of animating).
   */
  private startSteam() {
    const mugDef = this.propDefs.get('mug')
    if (!mugDef) return

    // Steam origin: top-center of mug
    const baseX = mugDef.x + Math.floor(mugDef.w / 2)
    const baseY = mugDef.y - 2

    const reduced = prefersReducedMotion()
    const createWisp = (delay: number, offsetX: number) => {
      const wisp = this.scene.add.rectangle(
        baseX + offsetX, baseY, 3, 3, 0xf4ede2, 0.7,
      )
      wisp.setDepth(9000)
      this.steamEmitters.push(wisp)

      if (reduced) {
        // Static wisps at different heights
        wisp.setPosition(baseX + offsetX, baseY - 8 - delay * 2)
        return
      }

      // Looping rise animation with steps easing for pixel feel
      const animate = () => {
        wisp.setPosition(baseX + offsetX, baseY)
        wisp.setAlpha(0.7)
        this.scene.tweens.add({
          targets: wisp,
          y: baseY - 20,
          alpha: 0,
          duration: 1200,
          delay,
          ease: 'Steps(6)',
          onComplete: animate,
        })
      }
      animate()
    }

    createWisp(0, -2)
    createWisp(400, 1)
    createWisp(800, -1)
  }

  private clearSteam() {
    for (const w of this.steamEmitters) w.destroy()
    this.steamEmitters = []
  }

  /* ── Public getters for testing ────────────────────────────────── */
  getExitSignState(): ExitSignState { return this.exitSignState }
  getLightState(): LightState { return this.lightState }
  getCoffeeState(): CoffeeState { return this.coffeeState }
}
