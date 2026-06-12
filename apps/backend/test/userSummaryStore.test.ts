/**
 * userSummaryStore.test | v1.0.0 | 2026-06-12
 * Tests for FileUserSummaryStore: getOrCreate, recordDisagree, takeaway milestones.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FileUserSummaryStore } from '../src/memory/userSummaryStore'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

describe('FileUserSummaryStore', () => {
  let tmpDir: string
  let store: FileUserSummaryStore

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moneyball-test-'))
    store = new FileUserSummaryStore(tmpDir)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('creates a fresh summary for unknown user', async () => {
    const s = await store.getOrCreate('guest:abc')
    expect(s.guestId).toBe('guest:abc')
    expect(s.sessionsCount).toBe(1)
    expect(s.agentDisagreeCounts).toEqual({})
    expect(s.takeaways.length).toBeGreaterThan(0)
  })

  it('returns same summary on second call', async () => {
    const s1 = await store.getOrCreate('guest:abc')
    const s2 = await store.getOrCreate('guest:abc')
    expect(s1.guestId).toBe(s2.guestId)
  })

  it('recordDisagree increments agent count', async () => {
    const s = await store.recordDisagree('guest:abc', 'dr_morgan')
    expect(s.agentDisagreeCounts['dr_morgan']).toBe(1)
  })

  it('recordDisagree adds first-time takeaway', async () => {
    const s = await store.recordDisagree('guest:abc', 'dr_morgan')
    expect(s.takeaways.some((t) => t.includes('dr_morgan') && t.includes('first'))).toBe(true)
  })

  it('recordDisagree adds pattern takeaway at 3', async () => {
    for (let i = 0; i < 3; i++) {
      await store.recordDisagree('guest:abc', 'dr_morgan')
    }
    const s = await store.getOrCreate('guest:abc')
    expect(s.agentDisagreeCounts['dr_morgan']).toBe(3)
    expect(s.takeaways.some((t) => t.includes('Pattern'))).toBe(true)
  })

  it('recordDisagree adds bias takeaway at 5', async () => {
    for (let i = 0; i < 5; i++) {
      await store.recordDisagree('guest:abc', 'dr_morgan')
    }
    const s = await store.getOrCreate('guest:abc')
    expect(s.agentDisagreeCounts['dr_morgan']).toBe(5)
    expect(s.takeaways.some((t) => t.toLowerCase().includes('bias'))).toBe(true)
  })

  it('caps takeaways at 12 entries', async () => {
    // Generate many disagrees across many agents to produce many takeaways
    for (let i = 0; i < 20; i++) {
      await store.recordDisagree('guest:abc', `agent_${i}`)
    }
    const s = await store.getOrCreate('guest:abc')
    expect(s.takeaways.length).toBeLessThanOrEqual(12)
  })
})
