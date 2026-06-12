/**
 * memwalWriteQueue.test | v1.0.0 | 2026-06-12
 * Tests for MemWalWriteQueue: coalescing, throttling, backoff, retry.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemWalWriteQueue } from '../src/memory/memwalWriteQueue'

describe('MemWalWriteQueue', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('calls remember with enqueued text', async () => {
    const remember = vi.fn().mockResolvedValue(undefined)
    const q = new MemWalWriteQueue(remember, { debounceMs: 0, minIntervalMs: 0 })

    q.enqueue('k1', 'hello')
    await vi.runAllTimersAsync()

    expect(remember).toHaveBeenCalledWith('hello')
  })

  it('coalesces multiple writes for the same key', async () => {
    const remember = vi.fn().mockResolvedValue(undefined)
    const q = new MemWalWriteQueue(remember, { debounceMs: 50, minIntervalMs: 0 })

    q.enqueue('k1', 'first')
    q.enqueue('k1', 'second')
    q.enqueue('k1', 'third')

    await vi.runAllTimersAsync()

    // Only the latest value should be written
    expect(remember).toHaveBeenCalledTimes(1)
    expect(remember).toHaveBeenCalledWith('third')
  })

  it('writes different keys independently', async () => {
    const remember = vi.fn().mockResolvedValue(undefined)
    const q = new MemWalWriteQueue(remember, { debounceMs: 0, minIntervalMs: 0 })

    q.enqueue('k1', 'value1')
    q.enqueue('k2', 'value2')

    await vi.runAllTimersAsync()

    expect(remember).toHaveBeenCalledTimes(2)
    const calls = remember.mock.calls.map((c: string[]) => c[0])
    expect(calls).toContain('value1')
    expect(calls).toContain('value2')
  })

  it('retries on failure with exponential backoff', async () => {
    let callCount = 0
    const remember = vi.fn().mockImplementation(async () => {
      callCount++
      if (callCount < 3) throw new Error('MemWal 429')
    })
    const q = new MemWalWriteQueue(remember, { debounceMs: 0, minIntervalMs: 0 })

    q.enqueue('k1', 'retry-me')

    // Run through all timers (backoff delays)
    for (let i = 0; i < 10; i++) {
      await vi.runAllTimersAsync()
    }

    expect(remember).toHaveBeenCalledTimes(3) // 2 failures + 1 success
  })

  it('respects minIntervalMs between writes', async () => {
    const timestamps: number[] = []
    const remember = vi.fn().mockImplementation(async () => {
      timestamps.push(Date.now())
    })
    const q = new MemWalWriteQueue(remember, { debounceMs: 0, minIntervalMs: 100 })

    q.enqueue('k1', 'a')
    q.enqueue('k2', 'b')

    await vi.runAllTimersAsync()

    expect(remember).toHaveBeenCalledTimes(2)
    if (timestamps.length === 2) {
      expect(timestamps[1] - timestamps[0]).toBeGreaterThanOrEqual(100)
    }
  })
})
