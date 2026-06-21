/**
 * writeJournal.test | 2026-06-21 | TASK 3
 * Validates the on-disk write journal: append, markDone, loadPending,
 * and crash-restart scenario (new instance from same journal dir re-enqueues).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { WriteJournal } from '../src/memory/writeJournal'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'wj-test-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('WriteJournal', () => {
  it('appended entries appear in loadPending', () => {
    const j = new WriteJournal(dir)
    j.append({ key: 'k1', text: 'hello', enqueuedAt: 1000 })
    j.append({ key: 'k2', text: 'world', enqueuedAt: 2000 })

    const j2 = new WriteJournal(dir)
    const pending = j2.loadPending()
    expect(pending).toHaveLength(2)
    expect(pending.map((p) => p.key)).toEqual(['k1', 'k2'])
  })

  it('markDone removes entry from pending on reload', () => {
    const j = new WriteJournal(dir)
    j.append({ key: 'k1', text: 'hello', enqueuedAt: 1000 })
    j.append({ key: 'k2', text: 'world', enqueuedAt: 2000 })
    j.markDone('k1')

    const j2 = new WriteJournal(dir)
    const pending = j2.loadPending()
    expect(pending).toHaveLength(1)
    expect(pending[0].key).toBe('k2')
  })

  it('crash-restart: new instance from same dir re-enqueues pending', () => {
    // Simulate: process 1 enqueues but crashes before markDone
    const j1 = new WriteJournal(dir)
    j1.append({ key: 'pred:match1:agent1', text: '{"type":"prediction"}', enqueuedAt: Date.now() })
    j1.append({ key: 'evo:2026-06-21', text: '{"type":"evolution"}', enqueuedAt: Date.now() })

    // Process 2 starts fresh — should see both pending
    const j2 = new WriteJournal(dir)
    const pending = j2.loadPending()
    expect(pending).toHaveLength(2)
    expect(pending[0].key).toBe('pred:match1:agent1')
    expect(pending[1].key).toBe('evo:2026-06-21')
  })

  it('loadPending on empty dir returns empty array', () => {
    const j = new WriteJournal(dir)
    expect(j.loadPending()).toEqual([])
  })

  it('duplicate key: later entry overwrites earlier in pending', () => {
    const j = new WriteJournal(dir)
    j.append({ key: 'k1', text: 'v1', enqueuedAt: 1000 })
    j.append({ key: 'k1', text: 'v2', enqueuedAt: 2000 })

    const j2 = new WriteJournal(dir)
    const pending = j2.loadPending()
    expect(pending).toHaveLength(1)
    expect(pending[0].text).toBe('v2')
  })
})
