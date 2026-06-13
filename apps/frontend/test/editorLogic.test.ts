/**
 * editorLogic.test | v1.0.0 | 2026-06-13
 * Purpose: Unit tests for editor pure logic.
 * T22: import/export round-trip, z-reorder, nudge, new_files computation.
 */

import { describe, it, expect } from 'vitest'
import {
  importPropsJson,
  exportPropsJson,
  reorderZ,
  bringForward,
  sendBackward,
  nudge,
  computeNewFiles,
  extractFilename,
  generateId,
} from '../src/editor/logic'
import type { EditorProp, PropsJsonSchema } from '../src/editor/types'

/* ── Fixtures ────────────────────────────────────────────────────────── */

const sampleDoc: PropsJsonSchema = {
  base: 'assets/backgrounds/room_bg_v02_table_clock_pennant.png',
  note: 'test note',
  props: [
    {
      id: 'board_left',
      src: 'props/board_left.png',
      w: 155,
      h: 208,
      target_xy: [22, 180],
      anchor: [99, 388],
      interactive: true,
      src_xy: [22, 207],
    },
    {
      id: 'mug',
      src: 'props/mug.png',
      w: 28,
      h: 28,
      target_xy: [202, 496],
      anchor: [216, 524],
      interactive: false,
      _comment: 'hires: docs/reference/mug_hires_v01.png',
    },
    {
      id: 'pennant_scouting',
      src: 'props/pennant.png',
      w: 98,
      h: 175,
      target_xy: null,
      anchor: null,
      interactive: false,
      _comment: 'spare sprite',
    },
  ],
}

function makeProps(): EditorProp[] {
  return [
    { id: 'a', src: 'props/a.png', x: 10, y: 20, naturalW: 50, naturalH: 50, scale: 1, flipX: false, visible: true, locked: false, zIndex: 0, filename: 'a.png', isUploaded: false, _passthrough: {} },
    { id: 'b', src: 'props/b.png', x: 30, y: 40, naturalW: 60, naturalH: 60, scale: 1, flipX: false, visible: true, locked: false, zIndex: 1, filename: 'b.png', isUploaded: false, _passthrough: {} },
    { id: 'c', src: 'props/c.png', x: 50, y: 60, naturalW: 70, naturalH: 70, scale: 1, flipX: false, visible: true, locked: false, zIndex: 2, filename: 'c.png', isUploaded: true, _passthrough: {} },
  ]
}

/* ── Import/Export round-trip ─────────────────────────────────────────── */

describe('import/export round-trip', () => {
  it('preserves unknown fields through import -> export', () => {
    const imported = importPropsJson(sampleDoc)
    expect(imported).toHaveLength(3)

    // board_left should preserve anchor, interactive, src_xy
    const boardLeft = imported.find((p) => p.id === 'board_left')!
    expect(boardLeft._passthrough).toHaveProperty('anchor')
    expect(boardLeft._passthrough).toHaveProperty('interactive')
    expect(boardLeft._passthrough).toHaveProperty('src_xy')
    expect(boardLeft._passthrough.anchor).toEqual([99, 388])

    // Export and verify
    const result = exportPropsJson(imported, sampleDoc.base, sampleDoc.note)
    const exported = result.json

    expect(exported.base).toBe(sampleDoc.base)
    expect(exported.note).toBe(sampleDoc.note)
    expect(exported.props).toHaveLength(3)

    // Check board_left round-trip
    const exportedBoard = exported.props.find((p) => p.id === 'board_left')!
    expect(exportedBoard.anchor).toEqual([99, 388])
    expect(exportedBoard.interactive).toBe(true)
    expect(exportedBoard.src_xy).toEqual([22, 207])
    expect(exportedBoard.target_xy).toEqual([22, 180])
    expect(exportedBoard.w).toBe(155)
    expect(exportedBoard.h).toBe(208)

    // mug _comment should survive
    const exportedMug = exported.props.find((p) => p.id === 'mug')!
    expect(exportedMug._comment).toBe('hires: docs/reference/mug_hires_v01.png')
  })

  it('handles null target_xy (pennant_scouting) with 0,0 default', () => {
    const imported = importPropsJson(sampleDoc)
    const pennant = imported.find((p) => p.id === 'pennant_scouting')!
    expect(pennant.x).toBe(0)
    expect(pennant.y).toBe(0)
  })

  it('export sorts by zIndex (low = back)', () => {
    const props = makeProps()
    // Reverse order
    props[0].zIndex = 2
    props[2].zIndex = 0
    const result = exportPropsJson(props, 'bg.png')
    expect(result.json.props[0].id).toBe('c')
    expect(result.json.props[2].id).toBe('a')
  })
})

/* ── Z-reorder ───────────────────────────────────────────────────────── */

describe('z-reorder', () => {
  it('reorderZ moves prop to new position', () => {
    const props = makeProps() // a=0, b=1, c=2
    const result = reorderZ(props, 'a', 2) // move a to front
    const sorted = [...result].sort((x, y) => x.zIndex - y.zIndex)
    expect(sorted.map((p) => p.id)).toEqual(['b', 'c', 'a'])
  })

  it('reorderZ clamps to bounds', () => {
    const props = makeProps()
    const result = reorderZ(props, 'c', 100)
    const sorted = [...result].sort((x, y) => x.zIndex - y.zIndex)
    expect(sorted[sorted.length - 1].id).toBe('c')
  })

  it('bringForward moves up one step', () => {
    const props = makeProps()
    const result = bringForward(props, 'a')
    const sorted = [...result].sort((x, y) => x.zIndex - y.zIndex)
    expect(sorted.map((p) => p.id)).toEqual(['b', 'a', 'c'])
  })

  it('sendBackward moves down one step', () => {
    const props = makeProps()
    const result = sendBackward(props, 'c')
    const sorted = [...result].sort((x, y) => x.zIndex - y.zIndex)
    expect(sorted.map((p) => p.id)).toEqual(['a', 'c', 'b'])
  })

  it('bringForward on front item is no-op', () => {
    const props = makeProps()
    const result = bringForward(props, 'c')
    expect(result.find((p) => p.id === 'c')!.zIndex).toBe(2)
  })

  it('sendBackward on back item is no-op', () => {
    const props = makeProps()
    const result = sendBackward(props, 'a')
    expect(result.find((p) => p.id === 'a')!.zIndex).toBe(0)
  })
})

/* ── Nudge math ──────────────────────────────────────────────────────── */

describe('nudge', () => {
  it('moves 1px without shift', () => {
    expect(nudge(100, 200, 'up', false)).toEqual([100, 199])
    expect(nudge(100, 200, 'down', false)).toEqual([100, 201])
    expect(nudge(100, 200, 'left', false)).toEqual([99, 200])
    expect(nudge(100, 200, 'right', false)).toEqual([101, 200])
  })

  it('moves 10px with shift', () => {
    expect(nudge(100, 200, 'up', true)).toEqual([100, 190])
    expect(nudge(100, 200, 'down', true)).toEqual([100, 210])
    expect(nudge(100, 200, 'left', true)).toEqual([90, 200])
    expect(nudge(100, 200, 'right', true)).toEqual([110, 200])
  })
})

/* ── New files computation ───────────────────────────────────────────── */

describe('computeNewFiles', () => {
  it('returns filenames of uploaded props only', () => {
    const props = makeProps()
    const result = computeNewFiles(props)
    expect(result).toEqual(['c.png'])
  })

  it('returns empty for no uploads', () => {
    const props = makeProps().map((p) => ({ ...p, isUploaded: false }))
    expect(computeNewFiles(props)).toEqual([])
  })
})

/* ── Helpers ──────────────────────────────────────────────────────────── */

describe('extractFilename', () => {
  it('extracts filename from path', () => {
    expect(extractFilename('props/board_left.png')).toBe('board_left.png')
    expect(extractFilename('characters/statistician/idle.png')).toBe('idle.png')
    expect(extractFilename('solo.png')).toBe('solo.png')
  })
})

describe('generateId', () => {
  it('generates a unique id from filename', () => {
    const id1 = generateId('mug.png')
    const id2 = generateId('mug.png')
    expect(id1).toContain('mug')
    // IDs should differ (timestamp-based)
    expect(id1).not.toBe(id2)
  })
})
