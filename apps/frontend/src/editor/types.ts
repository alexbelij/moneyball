/**
 * types | v1.0.0 | 2026-06-13
 * Purpose: Type definitions for the prop editor.
 * T22: Editor-specific prop placement types + export schema.
 */

/** A placed prop on the editor canvas. */
export interface EditorProp {
  /** Unique ID (from props.json or generated for uploads). */
  id: string
  /** Asset source path relative to /assets/ (e.g. "props/mug.png"). */
  src: string
  /** Display position in background coordinates. */
  x: number
  y: number
  /** Natural width/height of the source image. */
  naturalW: number
  naturalH: number
  /** Scale factor (1 = original). */
  scale: number
  /** Horizontal flip. */
  flipX: boolean
  /** Visible on canvas. */
  visible: boolean
  /** Locked (cannot be dragged/moved). */
  locked: boolean
  /** Z-index in the layer stack (higher = front). */
  zIndex: number
  /** Source filename for display. */
  filename: string
  /** Whether this prop was uploaded by the user. */
  isUploaded: boolean
  /** Object URL for uploaded files (not persisted). */
  objectUrl?: string
  /** All original fields from props.json that we don't directly model. */
  _passthrough: Record<string, unknown>
}

/** The props.json schema as used by the game. */
export interface PropsJsonSchema {
  base: string
  note?: string
  props: PropsJsonEntry[]
}

/** A single prop entry in props.json. */
export interface PropsJsonEntry {
  id: string
  src: string
  w: number
  h: number
  target_xy: [number, number] | null
  [key: string]: unknown
}

/** Export result including new files list. */
export interface ExportResult {
  json: PropsJsonSchema
  new_files: string[]
}
