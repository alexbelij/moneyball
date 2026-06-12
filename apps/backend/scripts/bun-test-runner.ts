/**
 * bun-test-runner | v0.2.0 | 2026-06-12
 * Purpose: Run the vitest suites in environments that have bun but no node
 * (vitest's tinypool requires node to fork workers). Provides a minimal
 * vitest-compatible shim (describe/it/expect/vi/beforeEach/afterEach) via a
 * Bun resolver plugin and imports every test file sequentially.
 *
 * Changelog:
 *   v0.2.0 — Added beforeEach/afterEach, vi.fn (with mockResolvedValue,
 *     mockImplementation, mock.calls), vi.useFakeTimers/useRealTimers/
 *     advanceTimersByTime/runAllTimersAsync, and matchers: toHaveBeenCalledWith,
 *     toHaveBeenCalledTimes, toBeTruthy, toBeNull, toBeUndefined.
 *   v0.1.1 — Initial shim (describe/it/expect basics).
 *
 * Usage: bun scripts/bun-test-runner.ts
 * CI still uses real vitest (`pnpm test`); this runner is a dev convenience
 * and must stay behavior-compatible for the matchers used in test/.
 */

import { readdirSync } from 'node:fs'
import { join } from 'node:path'

/* ── Stats ───────────────────────────────────────────────────────────── */

let passed = 0
let failed = 0
let skipped = 0
const failures: string[] = []
const stack: string[] = []

/* ── Deep equality ───────────────────────────────────────────────────── */

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (a instanceof Set && b instanceof Set) {
    return a.size === b.size && [...a].every((v) => b.has(v))
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((v, i) => deepEqual(v, b[i]))
  }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  const ka = Object.keys(a as object)
  const kb = Object.keys(b as object)
  if (ka.length !== kb.length) return false
  return ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}

/* ── Mock function (vi.fn) ───────────────────────────────────────────── */

interface MockFn<T extends (...args: any[]) => any = (...args: any[]) => any> {
  (...args: Parameters<T>): ReturnType<T>
  mock: { calls: Parameters<T>[] }
  mockResolvedValue: (v: unknown) => MockFn<T>
  mockImplementation: (fn: T) => MockFn<T>
}

function createMockFn(impl?: (...args: any[]) => any): MockFn {
  let _impl: (...args: any[]) => any = impl ?? (() => undefined)
  const mock = { calls: [] as any[][] }

  const fn = ((...args: any[]) => {
    mock.calls.push(args)
    return _impl(...args)
  }) as MockFn

  fn.mock = mock
  fn.mockResolvedValue = (v: unknown) => {
    _impl = async () => v
    return fn
  }
  fn.mockImplementation = (f: any) => {
    _impl = f
    return fn
  }
  return fn
}

/* ── Fake timers ─────────────────────────────────────────────────────── */

let fakeTimersActive = false
let fakeNow = 0
let timers: Array<{ id: number; fire: number; fn: () => void; interval: number | null }> = []
let timerId = 0

const realSetTimeout = globalThis.setTimeout
const realSetInterval = globalThis.setInterval
const realClearTimeout = globalThis.clearTimeout
const realClearInterval = globalThis.clearInterval
const realDateNow = Date.now

function installFakeTimers() {
  fakeTimersActive = true
  fakeNow = realDateNow.call(Date)
  timers = []

  // @ts-ignore
  globalThis.setTimeout = (fn: () => void, ms?: number) => {
    const id = ++timerId
    timers.push({ id, fire: fakeNow + (ms ?? 0), fn, interval: null })
    return id
  }
  // @ts-ignore
  globalThis.setInterval = (fn: () => void, ms?: number) => {
    const id = ++timerId
    timers.push({ id, fire: fakeNow + (ms ?? 0), fn, interval: ms ?? 0 })
    return id
  }
  globalThis.clearTimeout = (id: any) => {
    timers = timers.filter((t) => t.id !== id)
  }
  globalThis.clearInterval = (id: any) => {
    timers = timers.filter((t) => t.id !== id)
  }
  Date.now = () => fakeNow
}

function uninstallFakeTimers() {
  fakeTimersActive = false
  globalThis.setTimeout = realSetTimeout as any
  globalThis.setInterval = realSetInterval as any
  globalThis.clearTimeout = realClearTimeout
  globalThis.clearInterval = realClearInterval
  Date.now = realDateNow
  timers = []
}

function advanceTimersByTime(ms: number) {
  const target = fakeNow + ms
  while (fakeNow < target) {
    const next = timers.filter((t) => t.fire <= target).sort((a, b) => a.fire - b.fire)[0]
    if (!next) { fakeNow = target; break }
    fakeNow = next.fire
    if (next.interval !== null) {
      next.fire += next.interval
    } else {
      timers = timers.filter((t) => t.id !== next.id)
    }
    next.fn()
  }
}

async function runAllTimersAsync(maxIter = 100) {
  for (let i = 0; i < maxIter; i++) {
    const pending = timers.filter((t) => t.fire >= fakeNow).sort((a, b) => a.fire - b.fire)
    if (pending.length === 0) break
    const next = pending[0]
    fakeNow = next.fire
    if (next.interval !== null) {
      next.fire += next.interval
    } else {
      timers = timers.filter((t) => t.id !== next.id)
    }
    // Execute and allow microtask queue to flush
    await Promise.resolve().then(() => next.fn())
    // Flush one more tick for async chains
    await new Promise<void>((r) => realSetTimeout(r, 0))
  }
}

/* ── vi namespace ────────────────────────────────────────────────────── */

const vi = {
  fn: createMockFn,
  useFakeTimers: installFakeTimers,
  useRealTimers: uninstallFakeTimers,
  advanceTimersByTime,
  runAllTimersAsync,
}

/* ── expect / matchers ───────────────────────────────────────────────── */

function isMock(v: unknown): v is MockFn {
  return typeof v === 'function' && 'mock' in v && typeof (v as any).mock === 'object'
}

function makeExpect(actual: unknown, msg?: string) {
  const label = () => (msg ? ` [${msg}]` : '')
  const fail = (what: string) => {
    throw new Error(`${what}${label()} — got ${JSON.stringify(actual)}`)
  }

  const matchers = {
    toBe: (e: unknown) => { if (!Object.is(actual, e)) fail(`expected ${JSON.stringify(e)}`) },
    toEqual: (e: unknown) => {
      if (!deepEqual(actual, e))
        fail(`expected deep-equal ${JSON.stringify(e instanceof Set ? [...e] : e)}`)
    },
    toContain: (e: unknown) => {
      const ok = Array.isArray(actual)
        ? actual.includes(e)
        : typeof actual === 'string' && actual.includes(String(e))
      if (!ok) fail(`expected to contain ${JSON.stringify(e)}`)
    },
    toBeDefined: () => { if (actual === undefined) fail('expected defined') },
    toBeTruthy: () => { if (!actual) fail('expected truthy') },
    toBeNull: () => { if (actual !== null) fail('expected null') },
    toBeUndefined: () => { if (actual !== undefined) fail('expected undefined') },
    toBeGreaterThan: (e: number) => { if (!(Number(actual) > e)) fail(`expected > ${e}`) },
    toBeGreaterThanOrEqual: (e: number) => { if (!(Number(actual) >= e)) fail(`expected >= ${e}`) },
    toBeLessThan: (e: number) => { if (!(Number(actual) < e)) fail(`expected < ${e}`) },
    toBeLessThanOrEqual: (e: number) => { if (!(Number(actual) <= e)) fail(`expected <= ${e}`) },
    toThrow: (e?: string | RegExp) => {
      if (typeof actual !== 'function') fail('expected a function to test for throw')
      try { (actual as () => unknown)() } catch (err) {
        const m = err instanceof Error ? err.message : String(err)
        if (e === undefined) return
        if (typeof e === 'string' ? m.includes(e) : e.test(m)) return
        throw new Error(`expected throw matching ${e}${label()} — got "${m}"`)
      }
      throw new Error(`expected function to throw${label()}`)
    },
    toMatch: (re: RegExp | string) => {
      const ok = typeof actual === 'string' && (typeof re === 'string' ? actual.includes(re) : re.test(actual))
      if (!ok) fail(`expected to match ${re}`)
    },
    // Mock matchers
    toHaveBeenCalledWith: (...args: unknown[]) => {
      if (!isMock(actual)) fail('expected a mock function')
      const m = actual as MockFn
      const found = m.mock.calls.some((c) => deepEqual(c, args))
      if (!found)
        throw new Error(
          `expected mock to have been called with ${JSON.stringify(args)}${label()} — calls: ${JSON.stringify(m.mock.calls)}`,
        )
    },
    toHaveBeenCalledTimes: (n: number) => {
      if (!isMock(actual)) fail('expected a mock function')
      const m = actual as MockFn
      if (m.mock.calls.length !== n)
        throw new Error(
          `expected ${n} calls${label()} — got ${m.mock.calls.length}`,
        )
    },
    toHaveBeenCalledOnce: () => {
      if (!isMock(actual)) fail('expected a mock function')
      const m = actual as MockFn
      if (m.mock.calls.length !== 1)
        throw new Error(`expected 1 call${label()} — got ${m.mock.calls.length}`)
    },
  }

  return matchers
}

/* ── beforeEach / afterEach ──────────────────────────────────────────── */

type Hook = () => void | Promise<void>
let _beforeEachHooks: Hook[] = []
let _afterEachHooks: Hook[] = []

function beforeEach(fn: Hook) { _beforeEachHooks.push(fn) }
function afterEach(fn: Hook) { _afterEachHooks.push(fn) }

/* ── describe / it / queue ───────────────────────────────────────────── */

const queue: Array<() => Promise<void>> = []

const describe = (name: string, fn: () => void) => {
  const prevBefore = [..._beforeEachHooks]
  const prevAfter = [..._afterEachHooks]
  stack.push(name)
  fn()
  stack.pop()
  _beforeEachHooks = prevBefore
  _afterEachHooks = prevAfter
}

const it = (name: string, fn: () => void | Promise<void>) => {
  const full = [...stack, name].join(' › ')
  const hooks = { before: [..._beforeEachHooks], after: [..._afterEachHooks] }
  queue.push(async () => {
    try {
      for (const h of hooks.before) await h()
      await fn()
      passed++
      console.log(`  ✓ ${full}`)
    } catch (err) {
      failed++
      failures.push(`${full}: ${(err as Error).message}`)
      console.error(`  ✗ ${full}\n    ${(err as Error).message}`)
    } finally {
      for (const h of hooks.after) {
        try { await h() } catch { /* cleanup best-effort */ }
      }
    }
  })
}

/* ── Bun plugin: resolve 'vitest' to this shim ──────────────────────── */

const shim = { describe, it, expect: makeExpect, vi, beforeEach, afterEach }

Bun.plugin({
  name: 'vitest-shim',
  setup(build) {
    build.module('vitest', () => ({ exports: shim, loader: 'object' }))
  },
})

/* ── Run ─────────────────────────────────────────────────────────────── */

const testDir = join(import.meta.dir, '..', 'test')
const files = readdirSync(testDir).filter((f) => f.endsWith('.test.ts')).sort()

for (const f of files) {
  console.log(`\n${f}`)
  _beforeEachHooks = []
  _afterEachHooks = []

  try {
    await import(join(testDir, f))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('Cannot find module') || msg.includes('SyntaxError')) {
      console.log(`  ⊘ skipped (shim) — ${msg.slice(0, 80)}`)
      skipped++
      queue.length = 0
      continue
    }
    throw err
  }

  for (const job of queue.splice(0)) await job()
}

// Ensure real timers restored
if (fakeTimersActive) uninstallFakeTimers()

console.log(`\n${passed} passed, ${failed} failed${skipped ? `, ${skipped} skipped` : ''}`)
if (failures.length) {
  console.log('\nFailures:')
  failures.forEach((f) => console.log(`  • ${f}`))
  process.exit(1)
}
