/**
 * WorldLayer | v0.2.0 | 2026-06-13
 * Purpose: Single bg-space (1672×941) container for background, props and
 * agents. Children live in background pixel coordinates; one integer-scale
 * transform + letterbox glues everything to any viewport. Y-sort via
 * child depth = anchorY (table occlusion sprite overdraws agents at the desk).
 * T17: integer scaling + letterbox, exposes interactive prop list for keyboard nav.
 */

import Phaser from 'phaser'
import { parsePropsDoc, type PropDef, type PropsDoc } from './propTypes'
import { PropSprite } from './PropSprite'
import { TvSet } from './TvSet'
import { DigitalClock } from '@/phaser/objects/DigitalClock'
import { AnalogClock } from './AnalogClock'

const PROPS_JSON_URL = '/assets/props/props.json'
const MANIFEST_JSON_URL = '/assets/props/props_manifest.json'
/** props.json mixes path styles: prop `src` is relative to /assets/, while
 * `base` and manifest sprites already start with "assets/". Normalize both. */
function assetUrl(path: string): string {
  return path.startsWith('assets/') ? `/${path}` : `/assets/${path}`
}

const DEPTH_BG = 0

interface ManifestTable {
  sprite: string
  offset: { x: number; y: number }
  anchorY: number
}

function texKey(path: string): string {
  return `prop:${path}`
}

/** Common contract for keyboard-focusable interactive props. */
export interface FocusableProp {
  readonly propId: string
  setFocused(on: boolean): void
  activate(): void
}

export class WorldLayer extends Phaser.GameObjects.Container {
  /** Background-space size (from props_manifest scene block). */
  private bgW = 1672
  private bgH = 941

  private doc?: PropsDoc
  private tv?: TvSet

  /** Ordered interactive props for keyboard navigation (spec order). */
  private interactiveProps: FocusableProp[] = []

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0)
  }

  /** Phase 1: queue the JSON manifests (call from scene preload). */
  static preloadManifests(scene: Phaser.Scene) {
    scene.load.json('propsDoc', PROPS_JSON_URL)
    scene.load.json('propsManifest', MANIFEST_JSON_URL)
  }

  /**
   * Phase 2: queue textures derived from the manifests, then build children.
   * Returns a promise resolving when the world is fully constructed.
   */
  build(): Promise<void> {
    const scene = this.scene
    this.doc = parsePropsDoc(scene.cache.json.get('propsDoc'))
    const manifest = scene.cache.json.get('propsManifest') as {
      scene?: { width: number; height: number }
      props?: { table?: ManifestTable }
    }
    if (manifest?.scene) {
      this.bgW = manifest.scene.width
      this.bgH = manifest.scene.height
    }

    const queue = (path: string) => {
      const key = texKey(path)
      if (!scene.textures.exists(key)) scene.load.image(key, assetUrl(path))
      return key
    }

    queue(this.doc.base)
    for (const p of this.doc.props) {
      queue(p.src)
      if (p.swapStates) for (const s of Object.values(p.swapStates)) queue(s)
      if (p.tv) {
        for (const f of p.tv.staticFrames) if (f) queue(f)
        queue(p.tv.offOverlay)
      }
    }
    const table = manifest?.props?.table
    if (table) queue(table.sprite)

    return new Promise((resolve) => {
      scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
        this.buildChildren(table)
        resolve()
      })
      scene.load.start()
    })
  }

  /**
   * Integer-scale fit with letterbox. For pixel art the scale factor is
   * Math.floor when ≥ 1 (pixel-perfect), or plain contain when < 1 (small
   * viewports). Center position floors to integer for crisp pixels.
   */
  cover(viewW: number, viewH: number) {
    const raw = Math.min(viewW / this.bgW, viewH / this.bgH)
    const s = raw >= 1 ? Math.floor(raw) : raw
    this.setScale(s)
    this.setPosition(
      Math.floor((viewW - this.bgW * s) / 2),
      Math.floor((viewH - this.bgH * s) / 2),
    )
  }

  /** Add an agent (bg-space coords already set on the sprite). */
  addAgent(sprite: Phaser.GameObjects.Container) {
    sprite.setDepth(sprite.y)
    this.add(sprite)
    this.sort('depth')
  }

  /** External broadcast driver for the TV (true while a match is live). */
  setBroadcast(on: boolean) {
    this.tv?.setBroadcast(on)
  }

  /** Ordered list of interactive props for keyboard navigation. */
  getInteractiveProps(): readonly FocusableProp[] {
    return this.interactiveProps
  }

  private buildChildren(table?: ManifestTable) {
    const scene = this.scene
    if (!this.doc) return

    const bg = scene.add.image(0, 0, texKey(this.doc.base)).setOrigin(0, 0).setDepth(DEPTH_BG)
    this.add(bg)

    for (const def of this.doc.props) {
      const child = this.buildProp(def)
      this.add(child)
      // Collect interactive props in document (props.json) order
      if (def.interactive && isFocusable(child)) {
        this.interactiveProps.push(child)
      }
    }

    if (table) {
      const t = scene.add
        .image(table.offset.x, table.offset.y, texKey(table.sprite))
        .setOrigin(0, 0)
        .setDepth(table.anchorY)
      this.add(t)
    }

    this.sort('depth')
  }

  private buildProp(def: PropDef): Phaser.GameObjects.Container {
    const scene = this.scene

    if (def.tv) {
      const frameKeys = def.tv.staticFrames.map((f) => (f ? texKey(f) : null))
      this.tv = new TvSet(scene, def, texKey(def.src), frameKeys, texKey(def.tv.offOverlay))
      this.tv.setDepth(def.anchorY)
      return this.tv
    }

    if (def.hands && def.tz) {
      const clock = new AnalogClock(scene, def, texKey(def.src))
      clock.setDepth(def.anchorY)
      return clock
    }

    if (def.screenRect) {
      // Wall LCD: housing texture + runtime-drawn digits.
      const clock = new DigitalClock(scene, def.x, def.y, {
        textureKey: texKey(def.src),
        screen: def.screenRect,
      })
      clock.setDepth(def.anchorY)
      return clock
    }

    const sprite = new PropSprite(scene, def, texKey(def.src))
    sprite.setDepth(def.anchorY)
    return sprite
  }
}

function isFocusable(obj: unknown): obj is FocusableProp {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'propId' in obj &&
    'setFocused' in obj &&
    'activate' in obj
  )
}
