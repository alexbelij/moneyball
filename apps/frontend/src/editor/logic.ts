/**
 * logic | v1.0.0 | 2026-06-13
 * Purpose: Pure logic for prop editor operations (testable with vitest).
 * T22: import/export, z-reorder, nudge, new_files computation.
 */

import type { EditorProp, PropsJsonSchema, PropsJsonEntry, ExportResult } from './types'

/* ── Known repo assets (populated at dev-time by manifest or glob) ───── */

let knownRepoFiles = new Set<string>()

export function setKnownRepoFiles(files: string[]): void {
  knownRepoFiles = new Set(files)
}

/* ── Import from props.json ──────────────────────────────────────────── */

/**
 * Convert a props.json document into EditorProp[].
 * Unknown fields are stored in _passthrough for round-trip fidelity.
 */
export function importPropsJson(doc: PropsJsonSchema): EditorProp[] {
  return doc.props.map((entry, i) => {
    const { id, src, w, h, target_xy, ...rest } = entry
    const x = target_xy ? target_xy[0] : 0
    const y = target_xy ? target_xy[1] : 0

    return {
      id,
      src: String(src),
      x,
      y,
      naturalW: typeof w === 'number' ? w : 0,
      naturalH: typeof h === 'number' ? h : 0,
      scale: 1,
      flipX: false,
      visible: true,
      locked: false,
      zIndex: i,
      filename: extractFilename(String(src)),
      isUploaded: false,
      _passthrough: rest,
    }
  })
}

/* ── Export to props.json ─────────────────────────────────────────────── */

/**
 * Convert EditorProp[] back to the props.json schema.
 * Unknown fields from _passthrough are preserved. Deleted props are excluded.
 * Returns the JSON and a list of new files the repo doesn't have yet.
 */
export function exportPropsJson(
  props: EditorProp[],
  base: string,
  note?: string,
): ExportResult {
  // Sort by zIndex for export (low = back, high = front)
  const sorted = [...props].sort((a, b) => a.zIndex - b.zIndex)

  const entries: PropsJsonEntry[] = sorted.map((p) => {
    const w = Math.round(p.naturalW * p.scale)
    const h = Math.round(p.naturalH * p.scale)
    const x = Math.round(p.x)
    const y = Math.round(p.y)
    const entry: PropsJsonEntry = {
      id: p.id,
      src: p.src,
      w,
      h,
      target_xy: [x, y],
      ...p._passthrough,
    }
    // The game loader (parsePropsDoc) DROPS any prop without a valid `anchor`
    // (the y-sort point). Newly placed props carry no anchor in _passthrough,
    // so synthesize a bottom-center default; hand-authored anchors from
    // imported props are preserved (already spread via _passthrough above).
    const a = entry.anchor as unknown
    const hasAnchor = Array.isArray(a) && a.length === 2 &&
      typeof a[0] === 'number' && typeof a[1] === 'number'
    if (!hasAnchor) {
      entry.anchor = [Math.round(x + w / 2), Math.round(y + h)]
    }
    if (p.flipX) entry.flipX = true
    if (!p.visible) entry.visible = false
    return entry
  })

  const json: PropsJsonSchema = { base, props: entries }
  if (note) json.note = note

  const new_files = sorted
    .filter((p) => p.isUploaded)
    .map((p) => p.filename)

  return { json, new_files }
}

/* ── Z-reorder operations ────────────────────────────────────────────── */

/** Move a prop to a new position in the z-order stack. 0 = back. */
export function reorderZ(props: EditorProp[], propId: string, newIndex: number): EditorProp[] {
  const sorted = [...props].sort((a, b) => a.zIndex - b.zIndex)
  const fromIdx = sorted.findIndex((p) => p.id === propId)
  if (fromIdx === -1) return props

  const clamped = Math.max(0, Math.min(newIndex, sorted.length - 1))
  const [item] = sorted.splice(fromIdx, 1)
  sorted.splice(clamped, 0, item)

  // Re-assign sequential zIndex
  return sorted.map((p, i) => ({ ...p, zIndex: i }))
}

/** Move prop one step forward (higher z). */
export function bringForward(props: EditorProp[], propId: string): EditorProp[] {
  const sorted = [...props].sort((a, b) => a.zIndex - b.zIndex)
  const idx = sorted.findIndex((p) => p.id === propId)
  if (idx === -1 || idx >= sorted.length - 1) return props
  return reorderZ(props, propId, idx + 1)
}

/** Move prop one step backward (lower z). */
export function sendBackward(props: EditorProp[], propId: string): EditorProp[] {
  const sorted = [...props].sort((a, b) => a.zIndex - b.zIndex)
  const idx = sorted.findIndex((p) => p.id === propId)
  if (idx <= 0) return props
  return reorderZ(props, propId, idx - 1)
}

/* ── Nudge math ──────────────────────────────────────────────────────── */

export type NudgeDir = 'up' | 'down' | 'left' | 'right'

/** Returns new [x, y] after nudging. */
export function nudge(
  x: number,
  y: number,
  dir: NudgeDir,
  shift: boolean,
): [number, number] {
  const step = shift ? 10 : 1
  switch (dir) {
    case 'up': return [x, y - step]
    case 'down': return [x, y + step]
    case 'left': return [x - step, y]
    case 'right': return [x + step, y]
  }
}

/* ── New files computation ───────────────────────────────────────────── */

/**
 * Given a set of EditorProps, return filenames the repo does not have.
 */
export function computeNewFiles(props: EditorProp[]): string[] {
  return props.filter((p) => p.isUploaded).map((p) => p.filename)
}

/* ── Helpers ──────────────────────────────────────────────────────────── */

export function extractFilename(src: string): string {
  const parts = src.split('/')
  return parts[parts.length - 1] || src
}

let _idCounter = 0
export function generateId(filename: string): string {
  const base = filename.replace(/\.png$/i, '').replace(/[^a-zA-Z0-9_]/g, '_')
  return `${base}_${Date.now().toString(36)}_${(++_idCounter).toString(36)}`
}
