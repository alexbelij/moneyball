/**
 * propTypes | v0.1.1 | 2026-06-12
 * Purpose: Typed schema + parser for public/assets/props/props.json.
 * Coordinates are bg-space px (1672x941 reference). `target_xy` = draw origin
 * (top-left), `anchor` = y-sort point, `states` = optional state overlays.
 */

export interface Vec2Tuple extends Array<number> {
  0: number
  1: number
}

export interface TvLedSpec {
  x: number
  y: number
  w: number
  h: number
  on: string
  off: string
}

export interface TvStatesSpec {
  overlay_offset: { x: number; y: number }
  overlay_size: { w: number; h: number }
  /** Frames for the static-noise loop; null = base sprite (no overlay). */
  staticFrames: Array<string | null>
  staticFps: number
  offOverlay: string
  led: TvLedSpec
}

export interface PropDef {
  id: string
  src: string
  w: number
  h: number
  /** Draw origin, bg-space top-left. */
  x: number
  y: number
  /** Y-sort key (bg-space). */
  anchorY: number
  interactive: boolean
  /** Simple swap states: state name -> texture path (e.g. exit_sign). */
  swapStates?: Record<string, string>
  /** Structured TV spec (tv_set only). */
  tv?: TvStatesSpec
  /** LCD screen rect, sprite-local px (digital_clock only). */
  screenRect?: { x: number; y: number; w: number; h: number }
  /** Analog clock hands spec + IANA timezone (clock_city_* only). */
  hands?: {
    center: [number, number]
    r_hour: number
    r_min: number
    width_hour: number
    width_min: number
    color: string
  }
  tz?: string
}

export interface PropsDoc {
  base: string
  props: PropDef[]
}

interface RawProp {
  id: string
  src: string
  w: number
  h: number
  /** null = spare sprite, not placed in the scene (e.g. baked into bg). */
  target_xy: [number, number] | null
  anchor: [number, number] | null
  interactive?: boolean
  states?: Record<string, unknown>
  screen_rect?: [number, number, number, number]
  hands?: {
    center: [number, number]
    r_hour: number
    r_min: number
    width_hour: number
    width_min: number
    color: string
  }
  tz?: string
}

function isString(v: unknown): v is string {
  return typeof v === 'string'
}

function parseTvStates(states: Record<string, unknown>): TvStatesSpec {
  const st = states as {
    overlay_offset: { x: number; y: number }
    overlay_size: { w: number; h: number }
    off: { overlay: string }
    static: { fps: number; frames: Array<string | null> }
    match: { led: { x: number; y: number; w: number; h: number; on: string; off: string } }
  }
  return {
    overlay_offset: st.overlay_offset,
    overlay_size: st.overlay_size,
    staticFrames: st.static.frames,
    staticFps: st.static.fps,
    offOverlay: st.off.overlay,
    led: st.match.led,
  }
}

/** Parse raw props.json content into typed defs. Throws on malformed input. */
export function parsePropsDoc(raw: unknown): PropsDoc {
  const doc = raw as { base: string; props: RawProp[] }
  if (!doc || !Array.isArray(doc.props)) throw new Error('props.json: missing props array')

  const props: PropDef[] = doc.props.filter((p) => p.target_xy && p.anchor).map((p) => {
    const def: PropDef = {
      id: p.id,
      src: p.src,
      w: p.w,
      h: p.h,
      x: p.target_xy![0],
      y: p.target_xy![1],
      anchorY: p.anchor![1],
      interactive: p.interactive === true,
    }
    if (p.hands && p.tz) {
      def.hands = p.hands
      def.tz = p.tz
    }
    if (p.screen_rect) {
      const [x, y, w, h] = p.screen_rect
      def.screenRect = { x, y, w, h }
    }
    if (p.states) {
      if (p.id === 'tv_set') {
        def.tv = parseTvStates(p.states)
      } else {
        const swap: Record<string, string> = {}
        for (const [k, v] of Object.entries(p.states)) {
          if (!k.startsWith('_') && isString(v)) swap[k] = v
        }
        if (Object.keys(swap).length > 0) def.swapStates = swap
      }
    }
    return def
  })

  return { base: doc.base, props }
}
