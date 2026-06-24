/**
 * AgentSprite | v0.4.0 | 2026-06-24
 * Renders an agent as a pixel-art character that stands on the floor at its
 * bg-space position (feet anchored to position.y). Shows an idle pose with a
 * subtle breathing bob, swaps to a "talk" pose while a thought bubble is up,
 * keeps the click-to-open interaction, a name plate above the head, and the
 * paper speech bubble. Falls back to a placeholder rectangle if the character
 * textures have not been loaded (keeps the scene robust).
 */
import Phaser from 'phaser'
import type { WorldAgentState } from '@moneyball/shared/events'
import { GameEventBus } from '@/events/GameEventBus'
import { palette } from '@/styles/tokens'
import { phaserFont } from '@/styles/uiFont'
import { useUiPrefs } from '@/store/uiPrefs'

/** Active body font for canvas text (mirrors the FontPanel choice). */
function activeFont(): string {
  return phaserFont(useUiPrefs.getState().fontChoice)
}

/** Convert a CSS hex token (e.g. "#f4ede2") to a Phaser numeric color. */
function hex(c: string): number {
  return Phaser.Display.Color.HexStringToColor(c).color
}

// T29: design-spec thought-bubble palette (paper card, hard wood border).
const BUBBLE_BG = hex(palette.paper) // #f4ede2
const BUBBLE_BORDER = hex(palette.wood700) // #341d0e
const BUBBLE_TEXT = hex(palette.wood900) // #181009

/** Fallback on-floor character display height in bg-space pixels. Real sizing
 *  is computed per-agent (door-relative + perspective) in CabinetScene and
 *  passed into the constructor. */
const AVATAR_H = 480

export function avatarIdleKey(agentId: string): string {
  return `avatar:${agentId}:idle`
}
export function avatarTalkKey(agentId: string): string {
  return `avatar:${agentId}:talk`
}

export class AgentSprite extends Phaser.GameObjects.Container {
  private id: string
  /** Resolved on-floor display height in bg-space px (door-relative). */
  private avatarH: number
  /** Character image (bottom-anchored) or null when using the rect fallback. */
  private charImage?: Phaser.GameObjects.Image
  private shadow?: Phaser.GameObjects.Ellipse
  private fallback?: Phaser.GameObjects.Rectangle
  private label: Phaser.GameObjects.Text
  private hitTarget: Phaser.GameObjects.GameObject
  private headY: number

  private idleKey?: string
  private talkKey?: string
  private bobTween?: Phaser.Tweens.Tween
  private talkResetTimer?: Phaser.Time.TimerEvent

  private thoughtText?: Phaser.GameObjects.Text
  private thoughtBg?: Phaser.GameObjects.Rectangle
  private thoughtTail?: Phaser.GameObjects.Triangle
  private hideTimer?: Phaser.Time.TimerEvent

  constructor(scene: Phaser.Scene, agent: WorldAgentState, displayH: number = AVATAR_H) {
    super(scene, agent.position.x, agent.position.y)
    this.id = agent.agentId
    this.avatarH = displayH

    const idleKey = avatarIdleKey(agent.agentId)
    const talkKey = avatarTalkKey(agent.agentId)
    const hasArt = scene.textures.exists(idleKey)

    if (hasArt) {
      this.idleKey = idleKey
      this.talkKey = scene.textures.exists(talkKey) ? talkKey : idleKey
      // Feet planted at the container origin (y = 0 = floor at position.y).
      this.charImage = scene.add.image(0, 0, idleKey).setOrigin(0.5, 1)
      this.charImage.displayHeight = this.avatarH
      this.charImage.scaleX = this.charImage.scaleY // keep aspect (uniform scale)
      // The game runs in pixelArt mode (global NEAREST filter). Continuously
      // scaling a NEAREST-sampled texture for the breathing tween makes pixel
      // rows snap across thresholds — that read as "trembling". Use LINEAR
      // filtering on the avatar textures only so the breath scales smoothly
      // while the room/props stay crisp.
      try {
        scene.textures.get(idleKey)?.setFilter(Phaser.Textures.FilterMode.LINEAR)
        if (scene.textures.exists(talkKey)) {
          scene.textures.get(talkKey)?.setFilter(Phaser.Textures.FilterMode.LINEAR)
        }
      } catch {
        /* texture filter is best-effort */
      }
      this.headY = -this.avatarH

      // Soft pixel contact shadow on the floor, behind the character, so the
      // feet read as planted (no more "floating" without the old table).
      const shadowW = this.charImage.displayWidth * 0.66
      this.shadow = scene.add.ellipse(0, -4, shadowW, shadowW * 0.2, 0x000000, 0.4)
      this.add(this.shadow) // added first -> drawn behind the character

      this.hitTarget = this.charImage
      this.add(this.charImage)
      // Feet-anchored "breathing": subtle vertical scale about the floor origin
      // (origin y = 1), so the body never lifts off the ground.
      this.startBreath()
    } else {
      // Robust fallback: original placeholder rectangle.
      this.fallback = scene.add.rectangle(0, -48, 72, 96, 0x3a3a5c).setStrokeStyle(2, 0x6a6a9c)
      this.headY = -96
      this.hitTarget = this.fallback
      this.add(this.fallback)
    }

    this.hitTarget.setInteractive({ cursor: 'pointer', useHandCursor: true })
    this.hitTarget.on('pointerdown', () => GameEventBus.emit('agent:click', { agentId: this.id }))

    // Name plate above the head.
    this.label = scene.add.text(0, this.headY - 10, agent.name, {
      fontFamily: activeFont(),
      fontSize: '28px',
      color: '#f4ede2',
      stroke: '#181009',
      strokeThickness: 5,
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5, 1)

    this.add(this.label)
  }

  /** Subtle feet-anchored breathing (reduced-motion safe). Scales vertically
   *  about the floor origin (origin y = 1) so the feet never lift off — fixes
   *  the old "jittery / floating feet" bob that moved the whole body up. */
  private startBreath() {
    if (!this.charImage) return
    if (typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const base = this.charImage.scaleY
    // Deterministic-ish phase offset per agent so they don't breathe in lockstep.
    const delay = (this.id.charCodeAt(0) % 7) * 220
    // Gentle + slow: a tiny, smooth swell (LINEAR-filtered above so no pixel
    // snapping). Big enough to feel alive, small/slow enough to never twitch.
    this.bobTween = this.scene.tweens.add({
      targets: this.charImage,
      scaleY: base * 1.008,
      duration: 3400,
      delay,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    })
  }

  /** Live-update the canvas body font when the FontPanel choice changes. */
  setBodyFont(family: string) {
    this.label?.setFontFamily(family)
    this.thoughtText?.setFontFamily(family)
  }

  showThought(text: string, ttlMs = 2500) {
    this.hideTimer?.destroy()
    this.thoughtText?.destroy()
    this.thoughtBg?.destroy()
    this.thoughtTail?.destroy()

    // Swap to the talking pose for the duration of the bubble. Both poses share
    // the same 480px-tall canvas, so the existing uniform scale keeps the
    // character planted at the right height (no displayHeight reset needed,
    // which preserves the breathing tween).
    if (this.charImage && this.talkKey) {
      this.charImage.setTexture(this.talkKey)
      this.talkResetTimer?.destroy()
      this.talkResetTimer = this.scene.time.delayedCall(ttlMs, () => {
        if (this.charImage && this.idleKey) this.charImage.setTexture(this.idleKey)
      })
    }

    const by = this.headY - 40 // bubble sits above the head

    // Pixel speech bubble: paper card with 2px wood border + triangle tail
    this.thoughtText = this.scene.add.text(0, by, text, {
      fontFamily: activeFont(),
      fontSize: '28px',
      color: Phaser.Display.Color.IntegerToColor(BUBBLE_TEXT).rgba,
      wordWrap: { width: 340 },
      align: 'center',
      lineSpacing: 4,
      padding: { x: 3, y: 3 },
    }).setOrigin(0.5, 0.5)

    const w = Math.min(this.thoughtText.width + 28, 400)
    const h = this.thoughtText.height + 20

    this.thoughtBg = this.scene.add
      .rectangle(0, by, w, h, BUBBLE_BG, 1)
      .setStrokeStyle(2, BUBBLE_BORDER)

    this.thoughtTail = this.scene.add.triangle(
      4, by + h / 2 + 6,
      0, 0, 10, 0, 5, 8,
      BUBBLE_BG, 1,
    ).setStrokeStyle(2, BUBBLE_BORDER)

    this.add([this.thoughtBg, this.thoughtTail, this.thoughtText])

    this.hideTimer = this.scene.time.delayedCall(ttlMs, () => {
      this.thoughtText?.destroy()
      this.thoughtBg?.destroy()
      this.thoughtTail?.destroy()
      this.thoughtText = undefined
      this.thoughtBg = undefined
      this.thoughtTail = undefined
    })
  }
}
